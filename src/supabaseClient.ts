import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANONKEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials not set: SUPABASE_URL or SUPABASE_ANON_KEY');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

export default supabase;
