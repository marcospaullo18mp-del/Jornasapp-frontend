import { apiRequest } from './apiWorker';
import { localStore } from './localStore';

const USE_LOCAL_STORE = (import.meta.env.VITE_USE_LOCAL_STORE ?? '1') === '1';
const userKey = (userId) => userId || 'local-user';

export async function listarNotificacoes(token, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.list('notificacoes', userKey(userId));
  }
  return apiRequest('/notificacoes', 'GET', token);
}

export async function criarNotificacaoWorker(token, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.create('notificacoes', userKey(userId), payload);
  }
  return apiRequest('/notificacoes', 'POST', token, payload);
}

export async function atualizarNotificacaoWorker(token, id, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.update('notificacoes', userKey(userId), id, payload);
  }
  return apiRequest(`/notificacoes/${id}`, 'PUT', token, payload);
}

export async function deletarNotificacaoWorker(token, id, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.remove('notificacoes', userKey(userId), id);
  }
  return apiRequest(`/notificacoes/${id}`, 'DELETE', token);
}
