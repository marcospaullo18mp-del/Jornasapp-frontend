import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase as supabaseClient } from '../lib/supabaseClient';

const SUPABASE_NOT_CONFIGURED_ERROR =
  'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';

type SessionState = {
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
};

export function useSupabaseSession() {
  const supabase = supabaseClient;
  const [state, setState] = useState<SessionState>({
    session: null,
    user: null,
    accessToken: null,
    loading: !!supabase,
    error: supabase ? null : SUPABASE_NOT_CONFIGURED_ERROR,
  });

  useEffect(() => {
    if (!supabase) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: SUPABASE_NOT_CONFIGURED_ERROR,
      }));
      return;
    }

    let active = true;

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      setState((prev) => ({
        ...prev,
        session: data.session ?? null,
        user: data.session?.user ?? null,
        accessToken: data.session?.access_token ?? null,
        loading: false,
        error: error?.message ?? null,
      }));
    };

    loadSession();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setState({
        session: newSession ?? null,
        user: newSession?.user ?? null,
        accessToken: newSession?.access_token ?? null,
        loading: false,
        error: null,
      });
    });

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(SUPABASE_NOT_CONFIGURED_ERROR);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session ?? null;
  }, [supabase]);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(SUPABASE_NOT_CONFIGURED_ERROR);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data.session ?? null;
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error(SUPABASE_NOT_CONFIGURED_ERROR);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  const refreshSession = useCallback(async () => {
    if (!supabase) throw new Error(SUPABASE_NOT_CONFIGURED_ERROR);
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    setState((prev) => ({
      ...prev,
      session: data.session ?? null,
      user: data.session?.user ?? null,
      accessToken: data.session?.access_token ?? null,
      loading: false,
      error: null,
    }));
    return data.session ?? null;
  }, [supabase]);

  return {
    ...state,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshSession,
  };
}
