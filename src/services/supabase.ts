import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables from Vite runtime
const getEnvVar = (key: string): string => {
  // 1. Vite import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return String(import.meta.env[key]).trim();
  }
  // 2. process.env if injected via Vite define or build time
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return String(process.env[key]).trim();
  }
  return '';
};

const supabaseUrl = 
  getEnvVar('VITE_SUPABASE_URL');

const supabasePublishableKey =
  getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl && 
  supabasePublishableKey &&
  (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    })
  : null;

if (isSupabaseConfigured) {
  console.info('[Supabase] Initialized client with project URL:', supabaseUrl);
} else {
  console.info('[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY not set. Using local API / standalone store.');
}
