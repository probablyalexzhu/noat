// Database types (matches SQLite schema)
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

export type RemoteNote = Omit<Note, 'is_synced'>;

// Supabase realtime payload types
export type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  commit_timestamp: string;
  errors: string[];
  new: RemoteNote | Record<string, never>;
  old: Partial<RemoteNote> | Record<string, never>;
};

// Result type for operations that can fail
export type UpsertResult =
  | { success: true; noteId: string }
  | { success: false; reason: 'device_skip' | 'stale_remote' | 'db_error'; error?: Error };

// Database query result types
export type CountResult = { count: number };
export type UpdatedAtResult = { updated_at: string };
