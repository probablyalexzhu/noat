/**
 * Vitest global setup — runs a single cleanup sweep after ALL test files complete.
 *
 * This exists because per-file afterAll hooks race against vitest's process exit:
 * Supabase clients hold open WebSocket connections, so vitest force-exits before
 * in-flight cleanup HTTP requests resolve. By using globalSetup, vitest waits for
 * teardown() to finish before exiting.
 */
export async function teardown() {
  // Inline client — no module-scope side effects that would keep handles open
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(
    'https://pcxcsamghibownfnefbw.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGNzYW1naGlib3duZm5lZmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMzYyMzQsImV4cCI6MjA4NjYxMjIzNH0.6uCX--GoFIW1b9iAPZTuEps1YOvBlzEqDboe-5tY2B8',
  );

  const { error } = await client
    .from('notes')
    .delete()
    .eq('user_id', 'b2db7bba-cbc5-4226-9ac8-eef18ca0097c')
    .like('title', '__test__%');

  if (error) console.warn(`global teardown deleteTestNotes failed: ${error.message}`);
}
