import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type { ThemeMode } from '@/lib/theme';

const db = SQLite.openDatabaseSync('notes.db');

/**
 * Renames the legacy `conversations` table to `notes` and `conversation_id` column
 * to `note_id`. Each statement is wrapped in try/catch so it's idempotent — a no-op
 * on fresh installs (table doesn't exist yet) or after already migrating.
 */
function migrateConversationsToNotes() {
  try {
    db.execSync(`ALTER TABLE conversations RENAME TO notes;`);
  } catch {
    // Table already renamed or doesn't exist (fresh install)
  }
  try {
    db.execSync(`ALTER TABLE messages RENAME COLUMN conversation_id TO note_id;`);
  } catch {
    // Column already renamed or table doesn't exist yet
  }
  try {
    db.execSync(`DROP INDEX IF EXISTS idx_messages_conversation;`);
  } catch {
    // Index already dropped
  }
  try {
    db.execSync(`UPDATE sync_log SET table_name = 'notes' WHERE table_name = 'conversations';`);
  } catch {
    // sync_log doesn't exist yet (fresh install) or already updated
  }
}

export function initDatabase() {
  migrateConversationsToNotes();

  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT DEFAULT 'Untitled',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT,
      is_synced   INTEGER DEFAULT 0,
      device_id   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      note_id         TEXT NOT NULL REFERENCES notes(id),
      user_id         TEXT NOT NULL,
      content         TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      is_synced       INTEGER DEFAULT 0,
      device_id       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_note
      ON messages(note_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_messages_unsynced
      ON messages(is_synced) WHERE is_synced = 0;

    CREATE TABLE IF NOT EXISTS sync_log (
      table_name     TEXT PRIMARY KEY,
      last_synced_at TEXT NOT NULL,
      last_pushed_at TEXT NOT NULL
    );
  `);

  seedSyncLogIfEmpty();
  addContentColumnIfNeeded();
  addThemeColumnIfNeeded();

  console.log('Database initialized ✓');
}

function seedSyncLogIfEmpty() {
  const row = db.getFirstSync('SELECT table_name FROM sync_log WHERE table_name = ?', ['messages']);
  if (!row) {
    const initialTimestamp = '1970-01-01T00:00:00Z';
    db.runSync(
      'INSERT INTO sync_log (table_name, last_synced_at, last_pushed_at) VALUES (?, ?, ?)',
      ['messages', initialTimestamp, initialTimestamp],
    );
    db.runSync(
      'INSERT INTO sync_log (table_name, last_synced_at, last_pushed_at) VALUES (?, ?, ?)',
      ['notes', initialTimestamp, initialTimestamp],
    );
  }
}

function addContentColumnIfNeeded() {
  try {
    db.execSync(`ALTER TABLE notes ADD COLUMN content TEXT DEFAULT '';`);
  } catch {
    // Column already exists
  }
}

function addThemeColumnIfNeeded() {
  try {
    db.execSync(`ALTER TABLE notes ADD COLUMN theme TEXT DEFAULT 'dark';`);
  } catch {
    // Column already exists
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

  const id = Crypto.randomUUID();
  db.runSync('INSERT INTO app_config (key, value) VALUES (?, ?)', [key, id]);
  return id;
}

export function getDeviceId(): string {
  return getOrCreateConfigValue('device_id');
}

export function getUserId(): string {
  return getOrCreateConfigValue('user_id');
}

const VALID_THEMES: ThemeMode[] = ['paper', 'forest', 'ios', 'dark', 'cyberpunk'];
const DEFAULT_THEME: ThemeMode = 'dark';

export function getTheme(): ThemeMode {
  const row = db.getFirstSync('SELECT value FROM app_config WHERE key = ?', [
    'theme',
  ]) as ConfigRow | null;
  if (row) {
    const stored = row.value;
    if (stored === 'light') {
      return 'ios';
    }
    if (VALID_THEMES.includes(stored as ThemeMode)) {
      return stored as ThemeMode;
    }
  }
  return DEFAULT_THEME;
}

export function setTheme(mode: ThemeMode) {
  db.runSync('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)', ['theme', mode]);
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

export function getNotes() {
  return db.getAllSync(
    `SELECT * FROM notes
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC`,
    [getUserId()],
  );
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
  db.runSync(
    `UPDATE notes SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
    [now, now, noteId],
  );
}

export function createMessage(noteId: string, content: string): string {
  const now = getCurrentTimestamp();
  const id = Crypto.randomUUID();
  const deviceId = getDeviceId();
  const userId = getUserId();

  db.runSync(
    `INSERT INTO messages (id, note_id, user_id, content, created_at, updated_at, is_synced, device_id)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, noteId, userId, content, now, now, deviceId],
  );

  db.runSync(`UPDATE notes SET updated_at = ?, is_synced = 0 WHERE id = ?`, [
    now,
    noteId,
  ]);

  return id;
}

export function getMessages(noteId: string) {
  return db.getAllSync(
    `SELECT * FROM messages
     WHERE note_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [noteId],
  );
}

export function editMessage(messageId: string, newContent: string) {
  const now = getCurrentTimestamp();
  db.runSync(`UPDATE messages SET content = ?, updated_at = ?, is_synced = 0 WHERE id = ?`, [
    newContent,
    now,
    messageId,
  ]);
}

export function deleteMessage(messageId: string) {
  const now = getCurrentTimestamp();
  db.runSync(`UPDATE messages SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`, [
    now,
    now,
    messageId,
  ]);
}

type ContentRow = { content: string };

export function getNoteContent(noteId: string): string {
  const row = db.getFirstSync('SELECT content FROM notes WHERE id = ?', [
    noteId,
  ]) as ContentRow | null;
  return row?.content ?? '';
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

export { db };
