const META_KEY = 'jornasa:templates:meta';

const defaults = {
  tags: [],
  categoria: '',
  favorito: false,
  usageCount: 0,
  lastUsedAt: null,
};

const loadAll = () => {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveAll = (data) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
};

export const getTemplateMeta = (templateId) => {
  if (!templateId) return { ...defaults };
  const all = loadAll();
  return { ...defaults, ...(all[templateId] || {}) };
};

export const upsertTemplateMeta = (templateId, patch) => {
  if (!templateId) return;
  const all = loadAll();
  const existing = all[templateId] || {};
  all[templateId] = { ...defaults, ...existing, ...patch };
  saveAll(all);
  return all[templateId];
};

export const recordTemplateUsage = (templateId) => {
  if (!templateId) return;
  const all = loadAll();
  const existing = all[templateId] || { ...defaults };
  const usageCount = (existing.usageCount || 0) + 1;
  const lastUsedAt = new Date().toISOString();
  all[templateId] = { ...defaults, ...existing, usageCount, lastUsedAt };
  saveAll(all);
  return all[templateId];
};

export const removeTemplateMeta = (templateId) => {
  if (!templateId) return;
  const all = loadAll();
  delete all[templateId];
  saveAll(all);
};
