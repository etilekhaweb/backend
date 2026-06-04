import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANONKEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabase: SupabaseClient | null = null;
if (!SUPABASE_CONFIGURED) {
  console.warn('Supabase credentials not set: SUPABASE_URL or SUPABASE_ANON_KEY');
} else {
  try {
    supabase = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
  } catch (err) {
    console.error('Failed to create Supabase client', err);
    supabase = null;
  }
}

// Export as `any` to avoid repetitive null checks in call sites; routes guard against missing config.
export default (supabase as unknown) as any;
