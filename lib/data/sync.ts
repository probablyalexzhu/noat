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

// ============================================
// PULL — Fetch remote changes since last sync
// ============================================
export async function pull() {
  const log: any = db.getFirstSync(
    `SELECT last_synced_at FROM sync_log WHERE table_name = 'notes'`,
  );
  const since = log?.last_synced_at ?? '1970-01-01T00:00:00Z';
  const deviceId = getDeviceId();

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .gt('updated_at', since)
    .neq('device_id', deviceId)
    .order('updated_at', { ascending: true })
    .limit(500);

  if (error) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.error(`[${time}] Pull failed:`, error.message);
    return;
  }

  if (!data || data.length === 0) return;

  for (const row of data) {
    const local: any = db.getFirstSync('SELECT updated_at FROM notes WHERE id = ?', [row.id]);

    if (local && local.updated_at >= row.updated_at) continue;

    const cols = Object.keys(row);
    const placeholders = cols.map(() => '?').join(',');
    const updates = cols.map((c) => `${c} = excluded.${c}`).join(',');

    db.runSync(
      `INSERT INTO notes (${cols.join(',')}, is_synced)
       VALUES (${placeholders}, 1)
       ON CONFLICT(id) DO UPDATE SET ${updates}, is_synced = 1`,
      cols.map((c) => row[c]),
    );
  }

  const latest = data[data.length - 1].updated_at;
  db.runSync(`UPDATE sync_log SET last_synced_at = ? WHERE table_name = 'notes'`, [latest]);

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${time}] Pulled ${data.length} notes`);
}
