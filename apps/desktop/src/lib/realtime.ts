/**
 * realtime.ts — Supabase Realtime subscription for live note updates.
 *
 * subscribeToNotes() listens to postgres_changes on the notes table and
 * calls back with INSERT/UPDATE/DELETE events. upsertRemoteNote() applies
 * a single remote change to local SQLite with last-write-wins conflict resolution.
 */
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@noat/sync';
import { getUserId, upsertNoteFromRemote } from './database';
import { getTimestamp } from './utils';
import type { RemoteNote, UpdatedAtResult, UpsertResult } from '@noat/sync';
import { db } from './database';

/**
 * Upsert a remote note into local SQLite database.
 * Called when realtime subscription receives INSERT/UPDATE event.
 *
 * Returns UpsertResult indicating success or reason for failure.
 */
export async function upsertRemoteNote(remoteNote: RemoteNote): Promise<UpsertResult> {
  try {
    // Check if local note is newer (conflict resolution)
    const localRows = await db.select<UpdatedAtResult[]>(
      'SELECT updated_at FROM notes WHERE id = ?',
      [remoteNote.id],
    );
    const local = localRows.length > 0 ? localRows[0] : null;

    if (local && local.updated_at >= remoteNote.updated_at) {
      return { success: false, reason: 'stale_remote' };
    }

    await upsertNoteFromRemote(remoteNote);

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
        event: '*',
        schema: 'public',
        table: 'notes',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const result = await upsertRemoteNote(payload.new as RemoteNote);
          if (result.success) {
            onNoteChanged(result.noteId, payload.eventType);
          } else if (result.reason === 'db_error') {
            console.error('Failed to apply remote change:', result.error);
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as Partial<RemoteNote>)?.id;
          if (deletedId) {
            await db.execute('DELETE FROM notes WHERE id = ?', [deletedId]);
            onNoteChanged(deletedId, 'DELETE');
          }
        }
      },
    )
    .subscribe((status) => {
      console.log(`[${getTimestamp()}] Realtime subscription status: ${status}`);
      onStatusChange?.(status);
    });

  return channel;
}
