import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { RemoteNote } from '../../src/types';

const SUPABASE_URL = 'https://pcxcsamghibownfnefbw.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGNzYW1naGlib3duZm5lZmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMzYyMzQsImV4cCI6MjA4NjYxMjIzNH0.6uCX--GoFIW1b9iAPZTuEps1YOvBlzEqDboe-5tY2B8';

const DEV_USER_ID = 'b2db7bba-cbc5-4226-9ac8-eef18ca0097c';

export type RealtimeEvent = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  note: RemoteNote | null;
  receivedAt: number;
};

/**
 * Simulates an independent device with its own Supabase client and WebSocket connection.
 * Each instance uses a unique device_id to mimic real multi-device scenarios.
 */
export class DeviceSimulator {
  readonly client: SupabaseClient;
  readonly deviceId: string;
  readonly userId = DEV_USER_ID;
  readonly events: RealtimeEvent[] = [];
  private channel: RealtimeChannel | null = null;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  /** Upsert a note to Supabase (simulates push). */
  async upsert(note: Partial<RemoteNote> & { id: string }): Promise<RemoteNote> {
    const now = new Date().toISOString();
    const full: RemoteNote = {
      id: note.id,
      user_id: note.user_id ?? this.userId,
      title: note.title ?? '__test__ Untitled',
      content: note.content ?? '',
      theme: note.theme ?? null,
      created_at: note.created_at ?? now,
      updated_at: note.updated_at ?? now,
      deleted_at: note.deleted_at ?? null,
      device_id: note.device_id ?? this.deviceId,
    };

    const { error } = await this.client.from('notes').upsert(full, { onConflict: 'id' });
    if (error) throw new Error(`upsert failed: ${error.message}`);
    return full;
  }

  /** Pull all non-deleted notes for the user (simulates pull). */
  async pull(): Promise<RemoteNote[]> {
    const { data, error } = await this.client
      .from('notes')
      .select('*')
      .eq('user_id', this.userId)
      .is('deleted_at', null);

    if (error) throw new Error(`pull failed: ${error.message}`);
    return data as RemoteNote[];
  }

  /** Pull a single note by ID (includes soft-deleted). */
  async pullOne(noteId: string): Promise<RemoteNote | null> {
    const { data, error } = await this.client.from('notes').select('*').eq('id', noteId).single();

    if (error && error.code !== 'PGRST116') throw new Error(`pullOne failed: ${error.message}`);
    return (data as RemoteNote) ?? null;
  }

  /** Soft-delete a note by setting deleted_at. */
  async softDelete(noteId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from('notes')
      .update({ deleted_at: now, updated_at: now, device_id: this.deviceId })
      .eq('id', noteId);

    if (error) throw new Error(`softDelete failed: ${error.message}`);
  }

  /** Subscribe to realtime changes for this user. Events are collected in this.events. */
  async subscribe(): Promise<void> {
    await this.unsubscribe();
    this.events.length = 0;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('subscribe timed out')), 10_000);

      this.channel = this.client
        .channel(`test-notes:${this.deviceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notes',
            filter: `user_id=eq.${this.userId}`,
          },
          (payload) => {
            const note = payload.eventType === 'DELETE' ? null : (payload.new as RemoteNote);
            this.events.push({
              eventType: payload.eventType as RealtimeEvent['eventType'],
              note,
              receivedAt: Date.now(),
            });
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timeout);
            reject(new Error(`subscribe failed: ${status}`));
          }
        });
    });
  }

  /** Unsubscribe from realtime. */
  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }

  /** Hard-delete a note by ID (for cleanup). */
  async hardDelete(noteId: string): Promise<void> {
    await this.client.from('notes').delete().eq('id', noteId);
  }

  /** Disconnect the Supabase client entirely. */
  async destroy(): Promise<void> {
    await this.unsubscribe();
    await this.client.removeAllChannels();
  }
}
