import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

const db = SQLite.openDatabaseSync('notes.db');

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
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
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      user_id         TEXT NOT NULL,
      content         TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      is_synced       INTEGER DEFAULT 0,
      device_id       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at);

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
      ['conversations', initialTimestamp, initialTimestamp],
    );
  }
}

function addContentColumnIfNeeded() {
  try {
    db.execSync(`ALTER TABLE conversations ADD COLUMN content TEXT DEFAULT '';`);
  } catch {
    // Column already exists
  }
}

function addThemeColumnIfNeeded() {
  try {
    db.execSync(`ALTER TABLE conversations ADD COLUMN theme TEXT DEFAULT 'dark';`);
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

export type ThemeMode = 'paper' | 'forest' | 'ios' | 'dark' | 'cyberpunk';

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

export type Conversation = {
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

export function createConversation(title: string = 'Untitled', theme: ThemeMode = 'dark'): string {
  const now = getCurrentTimestamp();
  const id = Crypto.randomUUID();
  const deviceId = getDeviceId();
  const userId = getUserId();

  db.runSync(
    `INSERT INTO conversations (id, user_id, title, theme, created_at, updated_at, is_synced, device_id)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, userId, title, theme, now, now, deviceId],
  );

  return id;
}

export function getConversations() {
  return db.getAllSync(
    `SELECT * FROM conversations
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC`,
    [getUserId()],
  );
}

export function getConversationsByCreationOrder(): Conversation[] {
  return db.getAllSync(
    `SELECT * FROM conversations
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [getUserId()],
  ) as Conversation[];
}

export function deleteConversation(conversationId: string) {
  const now = getCurrentTimestamp();
  db.runSync(
    `UPDATE conversations SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
    [now, now, conversationId],
  );
}

export function createMessage(conversationId: string, content: string): string {
  const now = getCurrentTimestamp();
  const id = Crypto.randomUUID();
  const deviceId = getDeviceId();
  const userId = getUserId();

  db.runSync(
    `INSERT INTO messages (id, conversation_id, user_id, content, created_at, updated_at, is_synced, device_id)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, conversationId, userId, content, now, now, deviceId],
  );

  db.runSync(`UPDATE conversations SET updated_at = ?, is_synced = 0 WHERE id = ?`, [
    now,
    conversationId,
  ]);

  return id;
}

export function getMessages(conversationId: string) {
  return db.getAllSync(
    `SELECT * FROM messages
     WHERE conversation_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [conversationId],
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
  const row = db.getFirstSync('SELECT content FROM conversations WHERE id = ?', [
    noteId,
  ]) as ContentRow | null;
  return row?.content ?? '';
}

export function updateNoteContent(noteId: string, content: string): void {
  const now = getCurrentTimestamp();
  db.runSync('UPDATE conversations SET content = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [
    content,
    now,
    noteId,
  ]);
}

export function updateNoteTheme(noteId: string, theme: ThemeMode): void {
  const now = getCurrentTimestamp();
  db.runSync('UPDATE conversations SET theme = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [
    theme,
    now,
    noteId,
  ]);
}

export { db };
