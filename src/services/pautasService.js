import { supabase } from '../supabaseClient';

export async function loadPautas(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('pautas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function criarPauta(userId, payload) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase
    .from('pautas')
    .insert([{ user_id: userId, ...payload }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarPauta(id, userId, payload) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase
    .from('pautas')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletarPauta(id, userId) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { error } = await supabase
    .from('pautas')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
