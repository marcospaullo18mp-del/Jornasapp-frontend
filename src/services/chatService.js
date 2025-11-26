import { supabase } from '../supabaseClient';

export async function loadConversas(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('chat_conversas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadMensagens(conversaId, userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('chat_mensagens')
    .select('*')
    .eq('conversa_id', conversaId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function criarConversa(userId, title, preview) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase
    .from('chat_conversas')
    .insert([{ user_id: userId, title, preview }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarConversa(conversaId, userId, payload) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase
    .from('chat_conversas')
    .update(payload)
    .eq('id', conversaId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function inserirMensagem(conversaId, userId, message) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase
    .from('chat_mensagens')
    .insert([{ conversa_id: conversaId, user_id: userId, ...message }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletarConversa(conversaId, userId) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { error } = await supabase
    .from('chat_conversas')
    .delete()
    .eq('id', conversaId)
    .eq('user_id', userId);
  if (error) throw error;
}
