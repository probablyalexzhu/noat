import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@noat/sync';
import { db, getUserId } from './database';
import type { RemoteNote, UpdatedAtResult, UpsertResult } from '@noat/sync';

/**
 * Upsert a remote note into local SQLite database.
 * Called when realtime subscription receives INSERT/UPDATE event.
 *
 * Returns UpsertResult indicating success or reason for failure.
 */
export async function upsertRemoteNote(remoteNote: RemoteNote): Promise<UpsertResult> {
  try {
    // Skip if this change came from current device (avoid feedback loop)
    // Disabled for testing - allow all remote changes
    // const deviceId = await getDeviceId();
    // if (remoteNote.device_id === deviceId) {
    //   return { success: false, reason: 'device_skip' };
    // }

    // Check if local note is newer (conflict resolution)
    const localRows = await db.select<UpdatedAtResult[]>(
      'SELECT updated_at FROM notes WHERE id = ?',
      [remoteNote.id],
    );
    const local = localRows.length > 0 ? localRows[0] : null;

    if (local && local.updated_at >= remoteNote.updated_at) {
      return { success: false, reason: 'stale_remote' };
    }

    // Upsert remote note into local DB (mark as synced)
    const cols = Object.keys(remoteNote);
    const placeholders = cols.map(() => '?').join(',');
    const updates = cols.map((c) => `${c} = excluded.${c}`).join(',');

    await db.execute(
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
export async function subscribeToNotes(
  onNoteChanged: (noteId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => void,
  onStatusChange?: (status: string) => void,
): Promise<RealtimeChannel> {
  const userId = await getUserId();
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
      async (payload) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        const noteId = (payload.new as RemoteNote)?.id || (payload.old as Partial<RemoteNote>)?.id;
        const remoteDeviceId =
          (payload.new as RemoteNote)?.device_id || (payload.old as Partial<RemoteNote>)?.device_id;
        console.log(
          `[${time}] Realtime ${payload.eventType}: ${noteId} (from device: ${remoteDeviceId})`,
        );

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          console.log(`[${time}] Processing ${payload.eventType} for note ${noteId}`);
          const result = await upsertRemoteNote(payload.new as RemoteNote);
          console.log(`[${time}] Upsert result for ${noteId}:`, result);
          if (result.success) {
            console.log(
              `[${time}] Calling onNoteChanged callback with noteId=${result.noteId}, event=${payload.eventType}`,
            );
            onNoteChanged(result.noteId, payload.eventType);
          } else if (result.reason === 'db_error') {
            console.error('Failed to apply remote change:', result.error);
          } else {
            console.log(`[${time}] Skipped update: ${result.reason}`);
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as Partial<RemoteNote>)?.id;
          if (deletedId) {
            console.log(`[${time}] Calling onNoteChanged callback with noteId=${deletedId}, event=DELETE`);
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
