import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pcxcsamghibownfnefbw.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGNzYW1naGlib3duZm5lZmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMzYyMzQsImV4cCI6MjA4NjYxMjIzNH0.6uCX--GoFIW1b9iAPZTuEps1YOvBlzEqDboe-5tY2B8';

const DEV_USER_ID = 'b2db7bba-cbc5-4226-9ac8-eef18ca0097c';

const cleanupClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Hard-delete all notes with __test__ title prefix for the dev user. */
export async function deleteTestNotes(): Promise<void> {
  const { error } = await cleanupClient
    .from('notes')
    .delete()
    .eq('user_id', DEV_USER_ID)
    .like('title', '__test__%');
  if (error) console.warn(`cleanup deleteTestNotes failed: ${error.message}`);
}
