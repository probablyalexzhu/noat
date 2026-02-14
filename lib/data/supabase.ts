import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pcxcsamghibownfnefbw.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGNzYW1naGlib3duZm5lZmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMzYyMzQsImV4cCI6MjA4NjYxMjIzNH0.6uCX--GoFIW1b9iAPZTuEps1YOvBlzEqDboe-5tY2B8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
