// sync.ts
import { db, getDeviceId } from './database';
import { supabase } from '@noat/sync';

// ============================================
// PUSH — Send unsynced notes to Supabase
// ============================================
export async function push() {
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
