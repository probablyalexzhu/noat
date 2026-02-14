// sync.ts
import { db, getDeviceId } from './database';
import { supabase } from './supabase';

// ============================================
// PUSH — Send unsynced notes to Supabase
// ============================================
export async function push() {
  const rows = db.getAllSync('SELECT * FROM notes WHERE is_synced = 0');
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
  db.runSync(`UPDATE notes SET is_synced = 1 WHERE id IN (${placeholders})`, ids);

  db.runSync(`UPDATE sync_log SET last_pushed_at = ? WHERE table_name = 'notes'`, [
    new Date().toISOString(),
  ]);

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${time}] Pushed ${rows.length} notes`);
}
