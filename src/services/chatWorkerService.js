import { apiRequest } from './apiWorker';
import { localStore } from './localStore';

const USE_LOCAL_STORE = (import.meta.env.VITE_USE_LOCAL_STORE ?? '0') === '1';
const userKey = (userId) => userId || 'local-user';

export async function listarConversas(token, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.list('chat_conversas', userKey(userId));
  }
  return apiRequest('/chat/conversas', 'GET', token);
}

export async function criarConversaWorker(token, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.create('chat_conversas', userKey(userId), payload);
  }
  return apiRequest('/chat/conversas', 'POST', token, payload);
}

export async function deletarConversaWorker(token, id, userId) {
  if (USE_LOCAL_STORE) {
    localStore.remove('chat_conversas', userKey(userId), id);
    localStore.clear('chat_mensagens', userKey(userId), id);
    return;
  }
  return apiRequest(`/chat/conversas/${id}`, 'DELETE', token);
}

export async function listarMensagens(token, conversaId, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.list('chat_mensagens', userKey(userId), conversaId);
  }
  return apiRequest(`/chat/mensagens?conversa_id=${encodeURIComponent(conversaId)}`, 'GET', token);
}

export async function criarMensagemWorker(token, conversaId, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.create('chat_mensagens', userKey(userId), payload, conversaId);
  }
  return apiRequest(`/chat/mensagens?conversa_id=${encodeURIComponent(conversaId)}`, 'POST', token, payload);
}
