import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@noat/sync';
import { db, getUserId, getDeviceId } from './database';
import type { RemoteNote, UpdatedAtResult, UpsertResult } from '@noat/sync';

/**
 * Upsert a remote note into local SQLite database.
 * Called when realtime subscription receives INSERT/UPDATE event.
 *
 * Returns UpsertResult indicating success or reason for failure.
 */
export function upsertRemoteNote(remoteNote: RemoteNote): UpsertResult {
  try {
    // Skip if this change came from current device (avoid feedback loop)
    if (remoteNote.device_id === getDeviceId()) {
      return { success: false, reason: 'device_skip' };
    }

    // Check if local note is newer (conflict resolution)
    const local = db.getFirstSync<UpdatedAtResult>('SELECT updated_at FROM notes WHERE id = ?', [
      remoteNote.id,
    ]);

    if (local && local.updated_at >= remoteNote.updated_at) {
      return { success: false, reason: 'stale_remote' };
    }

    // Upsert remote note into local DB (mark as synced)
    const cols = Object.keys(remoteNote);
    const placeholders = cols.map(() => '?').join(',');
    const updates = cols.map((c) => `${c} = excluded.${c}`).join(',');

    db.runSync(
      `INSERT INTO notes (${cols.join(',')}, is_synced)
       VALUES (${placeholders}, 1)
       ON CONFLICT(id) DO UPDATE SET ${updates}, is_synced = 1`,
      cols.map((c) => remoteNote[c as keyof RemoteNote]),
    );

    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log(`[${time}] Realtime upserted: ${remoteNote.id}`);
    return { success: true, noteId: remoteNote.id };
  } catch (error) {
    console.error('upsertRemoteNote failed:', error);
    return {
      success: false,
      reason: 'db_error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Subscribe to realtime changes for current user's notes.
 *
 * @param onNoteChanged - Callback called when remote note changes (INSERT/UPDATE/DELETE)
 * @param onStatusChange - Optional callback for subscription status changes
 * @returns RealtimeChannel - Caller must unsubscribe on unmount
 */
export function subscribeToNotes(
  onNoteChanged: (noteId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => void,
  onStatusChange?: (status: string) => void,
): RealtimeChannel {
  const userId = getUserId();
  const channelName = `notes:${userId}`;

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
        const noteId = (payload.new as RemoteNote)?.id || (payload.old as Partial<RemoteNote>)?.id;
        const remoteDeviceId =
          (payload.new as RemoteNote)?.device_id || (payload.old as Partial<RemoteNote>)?.device_id;
        console.log(
          `[${time}] Realtime ${payload.eventType}: ${noteId} (from device: ${remoteDeviceId})`,
        );

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const result = upsertRemoteNote(payload.new as RemoteNote);
          if (result.success) {
            onNoteChanged(result.noteId, payload.eventType);
          } else if (result.reason === 'db_error') {
            console.error('Failed to apply remote change:', result.error);
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as Partial<RemoteNote>)?.id;
          if (deletedId) {
            onNoteChanged(deletedId, 'DELETE');
          }
        }
      },
    )
    .subscribe((status) => {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      console.log(`[${time}] Realtime subscription status: ${status}`);
      onStatusChange?.(status);
    });

  return channel;
}
