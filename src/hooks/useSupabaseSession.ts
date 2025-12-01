import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';

type SessionState = {
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
};

export function useSupabaseSession() {
  const supabase = getSupabaseClient();
  const [state, setState] = useState<SessionState>({
    session: null,
    user: null,
    accessToken: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
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

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session ?? null;
    },
    [supabase],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data.session ?? null;
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  const refreshSession = useCallback(async () => {
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
