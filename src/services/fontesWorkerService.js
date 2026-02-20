import { apiRequest } from './apiWorker';
import { localStore } from './localStore';

const USE_LOCAL_STORE = (import.meta.env.VITE_USE_LOCAL_STORE ?? '0') === '1';
const userKey = (userId) => userId || 'local-user';

export async function listarFontes(token, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.list('fontes', userKey(userId));
  }
  return apiRequest('/fontes', 'GET', token);
}

export async function criarFonteWorker(token, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.create('fontes', userKey(userId), payload);
  }
  return apiRequest('/fontes', 'POST', token, payload);
}

export async function atualizarFonteWorker(token, id, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.update('fontes', userKey(userId), id, payload);
  }
  return apiRequest(`/fontes/${id}`, 'PUT', token, payload);
}

export async function deletarFonteWorker(token, id, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.remove('fontes', userKey(userId), id);
  }
  return apiRequest(`/fontes/${id}`, 'DELETE', token);
}
