import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { DeviceSimulator } from './helpers/device';
import { deleteTestNotes } from './helpers/cleanup';
import { waitFor, sleep } from './helpers/wait';

/**
 * Realtime reliability tests — verify subscription resilience after
 * disconnect/reconnect and measure delivery latency.
 */
describe('sync-realtime', () => {
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

  it('Disconnect/reconnect — missed events are caught by pull, new events arrive after resubscribe', async () => {
    const noteId1 = crypto.randomUUID();
    const noteId2 = crypto.randomUUID();

    // Unsubscribe Device B (simulates going offline)
    await deviceB.unsubscribe();

    // Device A creates a note while B is offline
    await deviceA.upsert({
      id: noteId1,
      title: '__test__ realtime disconnect note1',
      content: 'Created while B was offline',
    });

    await sleep(500);

    // Device B missed the realtime event — verify via events array
    expect(deviceB.events).toHaveLength(0);

    // Device B comes back online — pull catches the missed note
    const pulled = await deviceB.pull();
    const found = pulled.find((n) => n.id === noteId1);
    expect(found).toBeDefined();
    expect(found?.content).toBe('Created while B was offline');

    // Resubscribe Device B
    await deviceB.subscribe();
    await sleep(500);

    // Device A creates another note — B should receive it via realtime now
    await deviceA.upsert({
      id: noteId2,
      title: '__test__ realtime reconnect note2',
      content: 'Created after B reconnected',
    });

    await waitFor(() => deviceB.events.some((e) => e.note?.id === noteId2));
    const event = deviceB.events.find((e) => e.note?.id === noteId2);
    expect(event?.eventType).toBe('INSERT');
    expect(event?.note?.content).toBe('Created after B reconnected');
  });

  it('Latency check — realtime delivery under 5 seconds', async () => {
    const noteId = crypto.randomUUID();

    const sendTime = Date.now();

    await deviceA.upsert({
      id: noteId,
      title: '__test__ realtime latency',
      content: 'Latency test',
    });

    await waitFor(() => deviceB.events.some((e) => e.note?.id === noteId));
    const event = deviceB.events.find((e) => e.note?.id === noteId);
    const latency = event!.receivedAt - sendTime;

    expect(latency).toBeLessThan(5000);
    // Log for visibility in test output
    console.log(`Realtime latency: ${latency}ms`);
  });
});
