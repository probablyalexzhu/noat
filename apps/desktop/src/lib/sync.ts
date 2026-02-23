/**
 * sync.ts — Full push/pull sync with Supabase.
 *
 * push() sends all unsynced local notes to Supabase in batches.
 * pull() fetches all remote notes and upserts them locally.
 * cleanupOldDeletedNotesRemote() hard-deletes stale soft-deleted notes from Supabase.
 */
import { db, getUserId, upsertNoteFromRemote, waitForDatabase } from './database';
import { getTimestamp } from './utils';
import { supabase } from '@noat/sync';
import type { Note, RemoteNote } from '@noat/sync';

const UPSERT_BATCH_SIZE = 50;
export async function push() {
  const ready = await waitForDatabase();
  if (!ready) {
    console.error('Push failed: Database not initialized');
    return;
  }

  const rows = await db.select<Note[]>('SELECT * FROM notes WHERE is_synced = 0');
  if (rows.length === 0) return;

  const cleaned: RemoteNote[] = rows.map(({ is_synced: _, ...rest }) => rest);

  for (let i = 0; i < cleaned.length; i += UPSERT_BATCH_SIZE) {
    const batch = cleaned.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from('notes').upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`[${getTimestamp()}] Push failed:`, error.message);
      return;
    }
  }

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  await db.execute(`UPDATE notes SET is_synced = 1 WHERE id IN (${placeholders})`, ids);

  await db.execute(`UPDATE sync_log SET last_pushed_at = ? WHERE table_name = 'notes'`, [
    new Date().toISOString(),
  ]);

  console.log(`[${getTimestamp()}] Pushed ${rows.length} notes`);
}

// ============================================
// PULL — Fetch notes from Supabase to local DB
// ============================================
export async function pull(): Promise<void> {
  const ready = await waitForDatabase();
  if (!ready) {
    console.error('Pull failed: Database not initialized');
    return;
  }

  const userId = await getUserId();
  const { data: remoteNotes, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) {
    console.error(`[${getTimestamp()}] Pull failed:`, error.message);
    return;
  }

  if (!remoteNotes || remoteNotes.length === 0) {
    return;
  }

  for (const note of remoteNotes) {
    await upsertNoteFromRemote(note as RemoteNote);
  }

  console.log(`[${getTimestamp()}] Pulled ${remoteNotes.length} notes from Supabase`);

  await db.execute(`UPDATE sync_log SET last_synced_at = ? WHERE table_name = 'notes'`, [
    new Date().toISOString(),
  ]);
}

// ============================================
// CLEANUP — Remove old soft-deleted notes
// ============================================
export async function cleanupOldDeletedNotesRemote(daysOld: number = 7): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const { error } = await supabase
    .from('notes')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff.toISOString());

  if (error) {
    console.error('Failed to cleanup remote deleted notes:', error);
  }
}
