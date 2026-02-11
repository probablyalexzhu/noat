// database.ts
// ============================================
// This file handles everything SQLite-related.
// Import it once in your app's entry point and call initDatabase().
// Then use the helper functions everywhere else.
// ============================================

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// ============================================
// 1. OPEN THE DATABASE
// ============================================
// This creates the file if it doesn't exist.
// On iOS it lives in the app's sandboxed Documents directory.
// On Android it's in the app's private database directory.

const db = SQLite.openDatabaseSync('notes.db');

// ============================================
// 2. CREATE TABLES (runs once on first launch)
// ============================================
// SQLite's "IF NOT EXISTS" makes this safe to call every time
// the app starts — it won't wipe existing data.

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

  // Seed the sync_log with initial values if empty
  const row = db.getFirstSync('SELECT table_name FROM sync_log WHERE table_name = ?', ['messages']);
  if (!row) {
    db.runSync(
      'INSERT INTO sync_log (table_name, last_synced_at, last_pushed_at) VALUES (?, ?, ?)',
      ['messages', '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'],
    );
    db.runSync(
      'INSERT INTO sync_log (table_name, last_synced_at, last_pushed_at) VALUES (?, ?, ?)',
      ['conversations', '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'],
    );
  }

  // Add content column to conversations (for note editor)
  try {
    db.execSync(`ALTER TABLE conversations ADD COLUMN content TEXT DEFAULT '';`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  // Add theme column to conversations (per-page theme)
  try {
    db.execSync(`ALTER TABLE conversations ADD COLUMN theme TEXT DEFAULT 'dark';`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  console.log('Database initialized ✓');
}

// ============================================
// 3. DEVICE ID — Unique per install
// ============================================
// Generated once, stored in app_config, reused forever.

export function getDeviceId(): string {
  const row = db.getFirstSync('SELECT value FROM app_config WHERE key = ?', ['device_id']);
  if (row) return (row as any).value;

  const id = Crypto.randomUUID();
  db.runSync('INSERT INTO app_config (key, value) VALUES (?, ?)', ['device_id', id]);
  return id;
}

// ============================================
// 4. TEMPORARY USER ID (until you add auth)
// ============================================
// For now, we generate a fake user ID per device.
// When you add Supabase Auth later, replace this with
// the real authenticated user's ID.

export function getUserId(): string {
  const row = db.getFirstSync('SELECT value FROM app_config WHERE key = ?', ['user_id']);
  if (row) return (row as any).value;

  const id = Crypto.randomUUID();
  db.runSync('INSERT INTO app_config (key, value) VALUES (?, ?)', ['user_id', id]);
  return id;
}

// ============================================
// 5. THEME PREFERENCE
// ============================================

export type ThemeMode = 'paper' | 'forest' | 'ios' | 'dark' | 'cyberpunk';

const validThemes: ThemeMode[] = ['paper', 'forest', 'ios', 'dark', 'cyberpunk'];

export function getTheme(): ThemeMode {
  const row = db.getFirstSync('SELECT value FROM app_config WHERE key = ?', ['theme']);
  if (row) {
    const stored = (row as any).value;
    if (stored === 'light') return 'ios';
    if (validThemes.includes(stored)) return stored as ThemeMode;
  }
  return 'dark';
}

export function setTheme(mode: ThemeMode) {
  db.runSync('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)', ['theme', mode]);
}

// ============================================
// 6. TYPES
// ============================================

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

// ============================================
// 7. CRUD — Conversations
// ============================================

export function createConversation(title: string = 'Untitled', theme: ThemeMode = 'dark'): string {
  const now = new Date().toISOString();
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
  const now = new Date().toISOString();
  db.runSync(
    `UPDATE conversations SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
    [now, now, conversationId],
  );
}

// ============================================
// 6. CRUD — Messages
// ============================================

export function createMessage(conversationId: string, content: string): string {
  const now = new Date().toISOString();
  const id = Crypto.randomUUID();
  const deviceId = getDeviceId();
  const userId = getUserId();

  db.runSync(
    `INSERT INTO messages (id, conversation_id, user_id, content, created_at, updated_at, is_synced, device_id)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, conversationId, userId, content, now, now, deviceId],
  );

  // Also bump the conversation's updated_at so it sorts to the top
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
  const now = new Date().toISOString();
  db.runSync(`UPDATE messages SET content = ?, updated_at = ?, is_synced = 0 WHERE id = ?`, [
    newContent,
    now,
    messageId,
  ]);
}

export function deleteMessage(messageId: string) {
  const now = new Date().toISOString();
  db.runSync(`UPDATE messages SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`, [
    now,
    now,
    messageId,
  ]);
}

// ============================================
// 7. NOTE CONTENT
// ============================================

export function getNoteContent(noteId: string): string {
  const row = db.getFirstSync('SELECT content FROM conversations WHERE id = ?', [noteId]);
  return (row as any)?.content ?? '';
}

export function updateNoteContent(noteId: string, content: string): void {
  const now = new Date().toISOString();
  db.runSync('UPDATE conversations SET content = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [
    content,
    now,
    noteId,
  ]);
}

export function updateNoteTheme(noteId: string, theme: ThemeMode): void {
  const now = new Date().toISOString();
  db.runSync('UPDATE conversations SET theme = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [
    theme,
    now,
    noteId,
  ]);
}

// ============================================
// 8. EXPORT THE DB (for sync layer later)
// ============================================
export { db };
