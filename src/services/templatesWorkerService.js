import { apiRequest } from './apiWorker';
import { localStore } from './localStore';

const USE_LOCAL_STORE = (import.meta.env.VITE_USE_LOCAL_STORE ?? '1') === '1';
const userKey = (userId) => userId || 'local-user';

export async function listarTemplates(token, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.list('templates', userKey(userId));
  }
  return apiRequest('/templates', 'GET', token);
}

export async function criarTemplateWorker(token, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.create('templates', userKey(userId), payload);
  }
  return apiRequest('/templates', 'POST', token, payload);
}

export async function atualizarTemplateWorker(token, id, payload, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.update('templates', userKey(userId), id, payload);
  }
  return apiRequest(`/templates/${id}`, 'PUT', token, payload);
}

export async function deletarTemplateWorker(token, id, userId) {
  if (USE_LOCAL_STORE) {
    return localStore.remove('templates', userKey(userId), id);
  }
  return apiRequest(`/templates/${id}`, 'DELETE', token);
}
