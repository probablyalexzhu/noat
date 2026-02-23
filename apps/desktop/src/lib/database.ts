/**
 * database.ts — Local SQLite database access via @tauri-apps/plugin-sql.
 *
 * Manages schema creation, app config (user_id, device_id), and all note
 * CRUD operations. Re-exports the Note type from @noat/sync. Also provides
 * waitForDatabase() and upsertNoteFromRemote() shared by sync and realtime layers.
 */
import Database from '@tauri-apps/plugin-sql';
import type { Note, RemoteNote } from '@noat/sync';

export type { Note } from '@noat/sync';

let db: Database;

export async function initDatabase() {
  db = await Database.load('sqlite:notes.db');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT DEFAULT 'Untitled',
      content     TEXT DEFAULT '',
      theme       TEXT DEFAULT 'dark',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT,
      is_synced   INTEGER DEFAULT 0,
      device_id   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      table_name     TEXT PRIMARY KEY,
      last_synced_at TEXT NOT NULL,
      last_pushed_at TEXT NOT NULL
    );
  `);

  await seedSyncLogIfEmpty();

  console.log('Database initialized ✓');
}

async function seedSyncLogIfEmpty() {
  const rows = await db.select<Array<{ table_name: string }>>(
    'SELECT table_name FROM sync_log WHERE table_name = ?',
    ['notes'],
  );
  if (rows.length === 0) {
    const initialTimestamp = '1970-01-01T00:00:00Z';
    await db.execute(
      'INSERT INTO sync_log (table_name, last_synced_at, last_pushed_at) VALUES (?, ?, ?)',
      ['notes', initialTimestamp, initialTimestamp],
    );
  }
}

type ConfigRow = { value: string };

async function getOrCreateConfigValue(key: string): Promise<string> {
  const rows = await db.select<ConfigRow[]>('SELECT value FROM app_config WHERE key = ?', [key]);
  if (rows.length > 0) {
    return rows[0].value;
  }

  let id: string;

  if (key === 'user_id') {
    // Hard-coded test user for development
    id = 'b2db7bba-cbc5-4226-9ac8-eef18ca0097c';
  } else {
    // device_id stays unique per device
    id = crypto.randomUUID();
  }

  await db.execute('INSERT INTO app_config (key, value) VALUES (?, ?)', [key, id]);
  return id;
}

export async function getDeviceId(): Promise<string> {
  return getOrCreateConfigValue('device_id');
}

export async function getUserId(): Promise<string> {
  return getOrCreateConfigValue('user_id');
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export async function createNote(
  title: string = 'Untitled',
  theme: string = 'dark',
): Promise<string> {
  const now = getCurrentTimestamp();
  const id = crypto.randomUUID();
  const deviceId = await getDeviceId();
  const userId = await getUserId();

  await db.execute(
    `INSERT INTO notes (id, user_id, title, theme, created_at, updated_at, is_synced, device_id)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, userId, title, theme, now, now, deviceId],
  );

  return id;
}

export async function getNotesByCreationOrder(): Promise<Note[]> {
  const userId = await getUserId();
  return db.select<Note[]>(
    `SELECT * FROM notes
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [userId],
  );
}

export async function deleteNote(noteId: string) {
  const now = getCurrentTimestamp();
  await db.execute(`UPDATE notes SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`, [
    now,
    now,
    noteId,
  ]);
}

export async function updateNoteContent(noteId: string, content: string): Promise<void> {
  const now = getCurrentTimestamp();
  await db.execute('UPDATE notes SET content = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [
    content,
    now,
    noteId,
  ]);
}

export async function updateNoteTheme(noteId: string, theme: string): Promise<void> {
  const now = getCurrentTimestamp();
  await db.execute('UPDATE notes SET theme = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [
    theme,
    now,
    noteId,
  ]);
}

export async function cleanupOldDeletedNotes(daysOld: number = 7): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  await db.execute('DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?', [
    cutoff.toISOString(),
  ]);
}

/**
 * Wait for the database module-level `db` to be initialized.
 * Polls every 100ms up to 50 attempts (5 seconds).
 */
export async function waitForDatabase(): Promise<boolean> {
  let attempts = 0;
  while (!db && attempts < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }
  return !!db;
}

/**
 * Upsert a remote note into local SQLite, marking it as synced.
 * Used by both full-pull (sync.ts) and realtime single-note upserts (realtime.ts).
 */
export async function upsertNoteFromRemote(note: RemoteNote): Promise<void> {
  const cols = Object.keys(note);
  const placeholders = cols.map(() => '?').join(',');
  const updates = cols.map((c) => `${c} = excluded.${c}`).join(',');

  await db.execute(
    `INSERT INTO notes (${cols.join(',')}, is_synced)
     VALUES (${placeholders}, 1)
     ON CONFLICT(id) DO UPDATE SET ${updates}, is_synced = 1`,
    cols.map((c) => note[c as keyof RemoteNote]),
  );
}

export { db };
