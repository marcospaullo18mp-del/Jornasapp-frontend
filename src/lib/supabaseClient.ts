import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env as Record<string, string | undefined>;

const SUPABASE_URL = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase não configurado: defina VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ou NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY no .env',
  );
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'jornasa.auth',
    },
  });
}

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabase) {
    throw new Error('Supabase client não inicializado. Verifique as variáveis de ambiente.');
  }
  return supabase;
};

export { supabase };
