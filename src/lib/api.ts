import { getSupabaseClient } from './supabaseClient';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ApiFetchOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

const env = import.meta.env as Record<string, string | undefined>;

const API_BASE =
  (env.NEXT_PUBLIC_API_BASE ??
    env.VITE_API_BASE ??
    env.VITE_API_URL ??
    'https://jornasa-worker.jornabot.workers.dev').replace(/\/$/, '');

const resolveAccessToken = async (explicitToken?: string | null) => {
  if (explicitToken) return explicitToken;

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    throw new Error(
      'Token não informado e Supabase não configurado. Defina VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.',
    );
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Não foi possível carregar a sessão: ${error.message}`);
  }

  return data.session?.access_token ?? null;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;
  const accessToken = await resolveAccessToken(token);

  if (!accessToken) {
    throw new Error('Sessão não encontrada. Faça login para continuar.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(
    `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`,
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    },
  );

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorBody = await response.json();
      message = errorBody?.error ?? errorBody?.message ?? message;
    } catch {
      try {
        message = await response.text();
      } catch {
        // ignore
      }
    }
    throw new Error(`Erro ${response.status}: ${message}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}
