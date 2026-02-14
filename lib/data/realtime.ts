import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { db, getUserId, getDeviceId } from './database';

/**
 * Upsert a remote note into local SQLite database.
 * Called when realtime subscription receives INSERT/UPDATE event.
 *
 * Returns note ID if successfully upserted, null if skipped.
 */
export function upsertRemoteNote(remoteNote: any): string | null {
  // Skip if this change came from current device (avoid feedback loop)
  if (remoteNote.device_id === getDeviceId()) {
    console.log(`[Realtime] Skipping own device change: ${remoteNote.id}`);
    return null;
  }

  // Check if local note is newer (conflict resolution)
  const local: any = db.getFirstSync('SELECT updated_at FROM notes WHERE id = ?', [remoteNote.id]);

  if (local && local.updated_at >= remoteNote.updated_at) {
    console.log(`[Realtime] Local note is newer, skipping: ${remoteNote.id}`);
    return null;
  }

  // Upsert remote note into local DB (mark as synced)
  const cols = Object.keys(remoteNote);
  const placeholders = cols.map(() => '?').join(',');
  const updates = cols.map((c) => `${c} = excluded.${c}`).join(',');

  db.runSync(
    `INSERT INTO notes (${cols.join(',')}, is_synced)
     VALUES (${placeholders}, 1)
     ON CONFLICT(id) DO UPDATE SET ${updates}, is_synced = 1`,
    cols.map((c) => remoteNote[c]),
  );

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${time}] Realtime upserted: ${remoteNote.id}`);
  return remoteNote.id;
}

/**
 * Subscribe to realtime changes for current user's notes.
 *
 * @param onNoteChanged - Callback called when remote note changes (INSERT/UPDATE/DELETE)
 * @returns RealtimeChannel - Caller must unsubscribe on unmount
 */
export function subscribeToNotes(
  onNoteChanged: (noteId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => void,
): RealtimeChannel {
  const userId = getUserId();
  const deviceId = getDeviceId();
  const channelName = `notes:${userId}`;

  console.log(`[Realtime] Subscribing with user_id=${userId}, device_id (ours)=${deviceId}`);
  console.log(`[Realtime] Filter: user_id=eq.${userId} (device_id filter temporarily disabled for testing)`);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'notes',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        const noteId = (payload.new as any)?.id || (payload.old as any)?.id;
        const remoteDeviceId = (payload.new as any)?.device_id || (payload.old as any)?.device_id;
        console.log(
          `[${time}] Realtime ${payload.eventType}: ${noteId} (from device: ${remoteDeviceId})`,
        );

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const upsertedId = upsertRemoteNote(payload.new);
          if (upsertedId) {
            onNoteChanged(upsertedId, payload.eventType);
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            onNoteChanged(deletedId, 'DELETE');
          }
        }
      },
    )
    .subscribe((status) => {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      console.log(`[${time}] Realtime subscription status: ${status}`);
    });

  return channel;
}
