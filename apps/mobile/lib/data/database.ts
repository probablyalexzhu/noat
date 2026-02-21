import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type { ThemeMode } from '@/lib/theme';

const db = SQLite.openDatabaseSync('notes.db');

export function initDatabase() {
  db.execSync(`
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

  seedSyncLogIfEmpty();

  console.log('Database initialized ✓');
}

function seedSyncLogIfEmpty() {
  const row = db.getFirstSync('SELECT table_name FROM sync_log WHERE table_name = ?', ['notes']);
  if (!row) {
    const initialTimestamp = '1970-01-01T00:00:00Z';
    db.runSync(
      'INSERT INTO sync_log (table_name, last_synced_at, last_pushed_at) VALUES (?, ?, ?)',
      ['notes', initialTimestamp, initialTimestamp],
    );
  }
}

type ConfigRow = { value: string };

function getOrCreateConfigValue(key: string): string {
  const row = db.getFirstSync('SELECT value FROM app_config WHERE key = ?', [
    key,
  ]) as ConfigRow | null;
  if (row) {
    return row.value;
  }

  let id: string;

  if (key === 'user_id') {
    // Hard-coded test user for development (matches desktop for cross-device sync)
    id = 'b2db7bba-cbc5-4226-9ac8-eef18ca0097c';
  } else {
    // device_id stays unique per device
    id = Crypto.randomUUID();
  }

  db.runSync('INSERT INTO app_config (key, value) VALUES (?, ?)', [key, id]);
  return id;
}

export function getDeviceId(): string {
  return getOrCreateConfigValue('device_id');
}

export function getUserId(): string {
  return getOrCreateConfigValue('user_id');
}

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  theme: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_synced: number;
  device_id: string;
};

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function createNote(title: string = 'Untitled', theme: ThemeMode = 'dark'): string {
  const now = getCurrentTimestamp();
  const id = Crypto.randomUUID();
  const deviceId = getDeviceId();
  const userId = getUserId();

  db.runSync(
    `INSERT INTO notes (id, user_id, title, theme, created_at, updated_at, is_synced, device_id)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, userId, title, theme, now, now, deviceId],
  );

  return id;
}

export function getNotesByCreationOrder(): Note[] {
  return db.getAllSync(
    `SELECT * FROM notes
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [getUserId()],
  ) as Note[];
}

export function deleteNote(noteId: string) {
  const now = getCurrentTimestamp();
  db.runSync(`UPDATE notes SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`, [
    now,
    now,
    noteId,
  ]);
}

export function updateNoteContent(noteId: string, content: string): void {
  const now = getCurrentTimestamp();
  db.runSync('UPDATE notes SET content = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [
    content,
    now,
    noteId,
  ]);
}

export function updateNoteTheme(noteId: string, theme: ThemeMode): void {
  const now = getCurrentTimestamp();
  db.runSync('UPDATE notes SET theme = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [
    theme,
    now,
    noteId,
  ]);
}

export function cleanupOldDeletedNotes(daysOld: number = 7): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  db.runSync('DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?', [
    cutoff.toISOString(),
  ]);
}

export { db };
