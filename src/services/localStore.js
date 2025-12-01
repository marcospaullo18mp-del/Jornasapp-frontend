const PREFIX = 'jornasa:local';

const uid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const storageKey = (type, userId = 'local-user', suffix) =>
  [PREFIX, type, userId, suffix].filter(Boolean).join(':');

const readList = (type, userId, suffix) => {
  try {
    const raw = localStorage.getItem(storageKey(type, userId, suffix));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeList = (type, userId, list, suffix) => {
  try {
    localStorage.setItem(storageKey(type, userId, suffix), JSON.stringify(list));
  } catch {
    // ignore quota/availability issues
  }
};

export const localStore = {
  list(type, userId, suffix) {
    return readList(type, userId, suffix);
  },
  create(type, userId, payload, suffix) {
    const now = new Date().toISOString();
    const record = {
      id: uid(),
      created_at: now,
      updated_at: now,
      ...payload,
    };
    const list = readList(type, userId, suffix);
    const updated = [record, ...list];
    writeList(type, userId, updated, suffix);
    return record;
  },
  update(type, userId, id, payload, suffix) {
    const now = new Date().toISOString();
    const list = readList(type, userId, suffix);
    const updated = list.map((item) =>
      item.id === id ? { ...item, ...payload, updated_at: now } : item,
    );
    writeList(type, userId, updated, suffix);
    return updated.find((item) => item.id === id) || null;
  },
  remove(type, userId, id, suffix) {
    const list = readList(type, userId, suffix).filter((item) => item.id !== id);
    writeList(type, userId, list, suffix);
  },
  clear(type, userId, suffix) {
    writeList(type, userId, [], suffix);
  },
};
