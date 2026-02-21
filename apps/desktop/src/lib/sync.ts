// sync.ts
import { db, getUserId } from './database';
import { supabase } from '@noat/sync';

// ============================================
// PUSH — Send unsynced notes to Supabase
// ============================================
export async function push() {
  // Wait for database to be initialized (max 5 seconds)
  let attempts = 0;
  while (!db || attempts > 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  if (!db) {
    console.error('Push failed: Database not initialized');
    return;
  }

  const rows = await db.select<Array<any>>('SELECT * FROM notes WHERE is_synced = 0');
  if (rows.length === 0) return;

  const cleaned = rows.map(({ is_synced, ...rest }: any) => rest);

  for (let i = 0; i < cleaned.length; i += 50) {
    const batch = cleaned.slice(i, i + 50);
    const { error } = await supabase.from('notes').upsert(batch, { onConflict: 'id' });

    if (error) {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      console.error(`[${time}] Push failed:`, error.message);
      return;
    }
  }

  const ids = rows.map((r: any) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  await db.execute(`UPDATE notes SET is_synced = 1 WHERE id IN (${placeholders})`, ids);

  await db.execute(`UPDATE sync_log SET last_pushed_at = ? WHERE table_name = 'notes'`, [
    new Date().toISOString(),
  ]);

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${time}] Pushed ${rows.length} notes`);
}

// ============================================
// PULL — Fetch notes from Supabase to local DB
// ============================================
export async function pull(): Promise<void> {
  // Wait for database to be initialized (max 5 seconds)
  let attempts = 0;
  while (!db || attempts > 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  if (!db) {
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
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.error(`[${time}] Pull failed:`, error.message);
    return;
  }

  if (!remoteNotes || remoteNotes.length === 0) {
    console.log('[Pull] No notes to pull from Supabase');
    return;
  }

  // Upsert remote notes into local DB (mark as synced)
  for (const note of remoteNotes) {
    const cols = Object.keys(note);
    const placeholders = cols.map(() => '?').join(',');
    const updates = cols.map((c) => `${c} = excluded.${c}`).join(',');
    const values = cols.map((c) => (note as any)[c]);

    await db.execute(
      `INSERT INTO notes (${cols.join(',')}, is_synced)
       VALUES (${placeholders}, 1)
       ON CONFLICT(id) DO UPDATE SET ${updates}, is_synced = 1`,
      values,
    );
  }

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${time}] Pulled ${remoteNotes.length} notes from Supabase`);

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
