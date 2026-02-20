import { apiRequest } from './apiWorker';
import { localStore } from './localStore';

const USE_LOCAL_STORE = (import.meta.env.VITE_USE_LOCAL_STORE ?? '0') === '1';
const userKey = (userId) => userId || 'local-user';

export async function listarPautas(token, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.list('pautas', userKey(userId));
  }
  return apiRequest('/pautas', 'GET', token);
}

export async function criarPautaWorker(token, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.create('pautas', userKey(userId), payload);
  }
  return apiRequest('/pautas', 'POST', token, payload);
}

export async function atualizarPautaWorker(token, id, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.update('pautas', userKey(userId), id, payload);
  }
  return apiRequest(`/pautas/${id}`, 'PUT', token, payload);
}

export async function deletarPautaWorker(token, id, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.remove('pautas', userKey(userId), id);
  }
  return apiRequest(`/pautas/${id}`, 'DELETE', token);
}
