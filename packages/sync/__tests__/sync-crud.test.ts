import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { DeviceSimulator } from './helpers/device';
import { deleteTestNotes } from './helpers/cleanup';
import { waitFor, sleep } from './helpers/wait';

/**
 * CRUD sync tests — verify that create, update, and soft-delete operations
 * made by one device are visible to another via both realtime and pull.
 */
describe('sync-crud', () => {
  let deviceA: DeviceSimulator;
  let deviceB: DeviceSimulator;

  beforeAll(async () => {
    // Clean up any stale test notes from previous interrupted runs
    await deleteTestNotes();
    deviceA = new DeviceSimulator(crypto.randomUUID());
    deviceB = new DeviceSimulator(crypto.randomUUID());
    await deviceA.subscribe();
    await deviceB.subscribe();
    // Brief pause to let subscriptions stabilize
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

  it('Device A creates note → Device B receives INSERT via realtime + sees it via pull', async () => {
    const noteId = crypto.randomUUID();

    const note = await deviceA.upsert({
      id: noteId,
      title: '__test__ CRUD create',
      content: 'Hello from Device A',
    });

    // Device B should receive INSERT via realtime
    await waitFor(() =>
      deviceB.events.some((e) => e.eventType === 'INSERT' && e.note?.id === noteId),
    );
    const insertEvent = deviceB.events.find((e) => e.note?.id === noteId);
    expect(insertEvent?.eventType).toBe('INSERT');
    expect(insertEvent?.note?.content).toBe('Hello from Device A');

    // Device B should also see it via pull
    const pulled = await deviceB.pull();
    const found = pulled.find((n) => n.id === noteId);
    expect(found).toBeDefined();
    expect(found?.title).toBe(note.title);
    expect(found?.content).toBe('Hello from Device A');
  });

  it('Device A updates content → Device B receives UPDATE with new content', async () => {
    const noteId = crypto.randomUUID();

    await deviceA.upsert({
      id: noteId,
      title: '__test__ CRUD update content',
      content: 'Original content',
    });

    // Wait for Device B to see the INSERT first
    await waitFor(() => deviceB.events.some((e) => e.note?.id === noteId));
    deviceB.events.length = 0;

    // Device A updates the content
    await sleep(50); // Ensure updated_at differs
    await deviceA.upsert({
      id: noteId,
      title: '__test__ CRUD update content',
      content: 'Updated content from A',
    });

    // Device B should receive UPDATE
    await waitFor(() =>
      deviceB.events.some(
        (e) => e.eventType === 'UPDATE' && e.note?.content === 'Updated content from A',
      ),
    );
    const updateEvent = deviceB.events.find(
      (e) => e.eventType === 'UPDATE' && e.note?.id === noteId,
    );
    expect(updateEvent?.note?.content).toBe('Updated content from A');
  });

  it('Device A updates theme → Device B receives UPDATE with new theme', async () => {
    const noteId = crypto.randomUUID();

    await deviceA.upsert({
      id: noteId,
      title: '__test__ CRUD update theme',
      content: 'Theme test note',
      theme: 'dark',
    });

    await waitFor(() => deviceB.events.some((e) => e.note?.id === noteId));
    deviceB.events.length = 0;

    // Device A changes theme
    await sleep(50);
    await deviceA.upsert({
      id: noteId,
      title: '__test__ CRUD update theme',
      content: 'Theme test note',
      theme: 'ocean',
    });

    await waitFor(() =>
      deviceB.events.some((e) => e.eventType === 'UPDATE' && e.note?.theme === 'ocean'),
    );
    const updateEvent = deviceB.events.find(
      (e) => e.eventType === 'UPDATE' && e.note?.id === noteId,
    );
    expect(updateEvent?.note?.theme).toBe('ocean');
  });

  it('Device A soft-deletes note → Device B receives UPDATE with deleted_at set, pull excludes it', async () => {
    const noteId = crypto.randomUUID();

    await deviceA.upsert({
      id: noteId,
      title: '__test__ CRUD soft-delete',
      content: 'Will be deleted',
    });

    await waitFor(() => deviceB.events.some((e) => e.note?.id === noteId));
    deviceB.events.length = 0;

    // Device A soft-deletes
    await sleep(50);
    await deviceA.softDelete(noteId);

    // Device B should receive UPDATE with deleted_at set
    await waitFor(() =>
      deviceB.events.some(
        (e) => e.eventType === 'UPDATE' && e.note?.id === noteId && e.note.deleted_at !== null,
      ),
    );

    // Pull should exclude soft-deleted notes
    const pulled = await deviceB.pull();
    const found = pulled.find((n) => n.id === noteId);
    expect(found).toBeUndefined();

    // But direct query should still find it
    const direct = await deviceB.pullOne(noteId);
    expect(direct?.deleted_at).not.toBeNull();
  });

  it('Bidirectional: Device B creates note → Device A sees it', async () => {
    const noteId = crypto.randomUUID();

    const note = await deviceB.upsert({
      id: noteId,
      title: '__test__ CRUD bidirectional',
      content: 'Hello from Device B',
    });

    // Device A should receive INSERT via realtime
    await waitFor(() =>
      deviceA.events.some((e) => e.eventType === 'INSERT' && e.note?.id === noteId),
    );
    const insertEvent = deviceA.events.find((e) => e.note?.id === noteId);
    expect(insertEvent?.eventType).toBe('INSERT');
    expect(insertEvent?.note?.content).toBe('Hello from Device B');

    // Device A should also see it via pull
    const pulled = await deviceA.pull();
    const found = pulled.find((n) => n.id === noteId);
    expect(found).toBeDefined();
    expect(found?.device_id).toBe(note.device_id);
  });
});
