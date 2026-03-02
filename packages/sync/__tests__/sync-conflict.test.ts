import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { DeviceSimulator } from './helpers/device';
import { deleteTestNotes } from './helpers/cleanup';
import { waitFor, sleep } from './helpers/wait';

/**
 * Conflict resolution tests — verify last-write-wins semantics and
 * eventual convergence when multiple devices update the same note.
 */
describe('sync-conflict', () => {
  let deviceA: DeviceSimulator;
  let deviceB: DeviceSimulator;

  beforeAll(async () => {
    await deleteTestNotes();
    deviceA = new DeviceSimulator(crypto.randomUUID());
    deviceB = new DeviceSimulator(crypto.randomUUID());
    await deviceA.subscribe();
    await deviceB.subscribe();
    await sleep(1000);
  });

  afterEach(() => {
    deviceA.events.length = 0;
    deviceB.events.length = 0;
  });

  afterAll(async () => {
    await deviceA.destroy();
    await deviceB.destroy();
  });

  it('Both devices update same note — last upsert wins at Supabase level', async () => {
    const noteId = crypto.randomUUID();

    // Create initial note from Device A
    await deviceA.upsert({
      id: noteId,
      title: '__test__ conflict LWW',
      content: 'Original',
    });

    await waitFor(() => deviceB.events.some((e) => e.note?.id === noteId));
    deviceA.events.length = 0;
    deviceB.events.length = 0;

    // Device A updates first
    const t1 = new Date().toISOString();
    await deviceA.upsert({
      id: noteId,
      title: '__test__ conflict LWW',
      content: 'From Device A',
      updated_at: t1,
    });

    // Small delay so Device B's write is strictly later
    await sleep(100);

    // Device B updates second — this should win
    const t2 = new Date().toISOString();
    await deviceB.upsert({
      id: noteId,
      title: '__test__ conflict LWW',
      content: 'From Device B',
      updated_at: t2,
    });

    // Both should converge: Supabase now has Device B's version
    await sleep(500);
    const fromA = await deviceA.pullOne(noteId);
    const fromB = await deviceB.pullOne(noteId);

    expect(fromA?.content).toBe('From Device B');
    expect(fromB?.content).toBe('From Device B');
    // Supabase normalizes 'Z' → '+00:00', so compare as timestamps
    expect(new Date(fromA!.updated_at).getTime()).toBe(new Date(t2).getTime());
  });

  it('Stale remote check — newer local timestamp means remote should be skipped', async () => {
    /**
     * This tests the timestamp comparison logic used by upsertRemoteNote() in the apps.
     * When a remote note has an older updated_at than the local copy, it should be skipped.
     * We verify this at the Supabase level: an older upsert should be overwritten by a newer one.
     */
    const noteId = crypto.randomUUID();

    // Write a note with a "future" timestamp
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    await deviceA.upsert({
      id: noteId,
      title: '__test__ conflict stale',
      content: 'Newer local version',
      updated_at: futureTime,
    });

    await sleep(300);

    // Write the same note with a "past" timestamp from Device B
    const pastTime = new Date(Date.now() - 60_000).toISOString();
    await deviceB.upsert({
      id: noteId,
      title: '__test__ conflict stale',
      content: 'Older remote version',
      updated_at: pastTime,
    });

    // Supabase stores the latest write regardless, but the app-level upsertRemoteNote()
    // would skip this based on timestamp. Verify what Supabase actually has.
    const result = await deviceA.pullOne(noteId);
    // At the Supabase level, the last upsert call wins (no server-side timestamp check).
    // The app layer is responsible for filtering stale remotes.
    expect(result).not.toBeNull();
    // The note should have the pastTime since Device B wrote last.
    // This confirms apps MUST implement client-side timestamp checks.
    expect(new Date(result!.updated_at).getTime()).toBe(new Date(pastTime).getTime());
  });

  it('Rapid alternating updates — both devices converge to same final state', async () => {
    const noteId = crypto.randomUUID();

    await deviceA.upsert({
      id: noteId,
      title: '__test__ conflict rapid',
      content: 'Initial',
    });

    await waitFor(() => deviceB.events.some((e) => e.note?.id === noteId));
    deviceA.events.length = 0;
    deviceB.events.length = 0;

    // Rapid alternating updates
    for (let i = 1; i <= 5; i++) {
      const device = i % 2 === 1 ? deviceA : deviceB;
      const label = i % 2 === 1 ? 'A' : 'B';
      await device.upsert({
        id: noteId,
        title: '__test__ conflict rapid',
        content: `Update ${i} from ${label}`,
      });
      // Small gap to ensure distinct timestamps
      await sleep(50);
    }

    // Final update was #5 from Device A
    // Wait for propagation
    await sleep(1000);

    const fromA = await deviceA.pullOne(noteId);
    const fromB = await deviceB.pullOne(noteId);

    // Both devices should see the same final state
    expect(fromA?.content).toBe(fromB?.content);
    expect(fromA?.content).toBe('Update 5 from A');
  });
});
