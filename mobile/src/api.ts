import * as SecureStore from 'expo-secure-store';

const BASE = process.env.EXPO_PUBLIC_API_URL || '';
const TOKEN_KEY = 'lifeos_token';
const SAVED_EMAIL_KEY = 'lifeos_saved_email';
const SAVED_PASSWORD_KEY = 'lifeos_saved_password';

let onUnauthorized: (() => void) | null = null;
export function setUnauthCallback(cb: () => void) {
  onUnauthorized = cb;
}

export const token = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

export const savedCreds = {
  getEmail: () => SecureStore.getItemAsync(SAVED_EMAIL_KEY),
  getPassword: () => SecureStore.getItemAsync(SAVED_PASSWORD_KEY),
  set: async (email: string, password: string) => {
    await SecureStore.setItemAsync(SAVED_EMAIL_KEY, email);
    await SecureStore.setItemAsync(SAVED_PASSWORD_KEY, password);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(SAVED_EMAIL_KEY);
    await SecureStore.deleteItemAsync(SAVED_PASSWORD_KEY);
  },
};

async function request(path: string, options: RequestInit = {}): Promise<Response | undefined> {
  const t = await token.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    await token.clear();
    onUnauthorized?.();
    return;
  }
  return res;
}

let _meta: any = null;
export async function getMeta(): Promise<any> {
  if (_meta) return _meta;
  const res = await fetch(`${BASE}/api/meta`);
  _meta = await res.json();
  return _meta;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),

  pantry: {
    list: () => request('/api/pantry'),
    add: (name: string, category: string, tier: string | null) =>
      request('/api/pantry', { method: 'POST', body: JSON.stringify({ name, category, tier: tier || null }) }),
    update: (id: number, name: string, category: string, tier: string | null) =>
      request(`/api/pantry/${id}`, { method: 'PATCH', body: JSON.stringify({ name, category, tier: tier || null }) }),
    delete: (id: number) => request(`/api/pantry/${id}`, { method: 'DELETE' }),
    updateTier: (id: number, tier: string | null) =>
      request(`/api/pantry/${id}/tier`, { method: 'PATCH', body: JSON.stringify({ tier }) }),
  },

  shopping: {
    list: () => request('/api/shopping'),
    add: (pantryItemId: number, quantity = '') =>
      request(`/api/shopping/${pantryItemId}`, { method: 'POST', body: JSON.stringify({ quantity }) }),
    addManual: (name: string, quantity = '', storeCategory = 'potraviny') =>
      request('/api/shopping', { method: 'POST', body: JSON.stringify({ name, quantity, store_category: storeCategory }) }),
    update: (id: number, storeCategory: string, quantity: string, name = '') =>
      request(`/api/shopping/${id}`, { method: 'PATCH', body: JSON.stringify({ store_category: storeCategory, quantity, name }) }),
    remove: (id: number) => request(`/api/shopping/${id}`, { method: 'DELETE' }),
  },

  recipes: {
    list: () => request('/api/recipes'),
    add: (name: string) => request('/api/recipes', { method: 'POST', body: JSON.stringify({ name }) }),
    delete: (id: number) => request(`/api/recipes/${id}`, { method: 'DELETE' }),
    addIngredient: (recipeId: number, pantryItemId: number, quantity: string) =>
      request(`/api/recipes/${recipeId}/ingredients`, { method: 'POST', body: JSON.stringify({ pantryItemId, quantity }) }),
    removeIngredient: (id: number) => request(`/api/recipe-ingredients/${id}`, { method: 'DELETE' }),
    updateIngredient: (id: number, quantity: string) =>
      request(`/api/recipe-ingredients/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
    cook: (id: number) => request(`/api/recipes/${id}/cook`, { method: 'POST' }),
    uncook: (id: number) => request(`/api/recipes/${id}/cook`, { method: 'DELETE' }),
  },

  workout: {
    muscles: {
      list: () => request('/api/workout/muscles'),
      add: (name: string) => request('/api/workout/muscles', { method: 'POST', body: JSON.stringify({ name }) }),
      update: (id: number, name: string) =>
        request(`/api/workout/muscles/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
      delete: (id: number) => request(`/api/workout/muscles/${id}`, { method: 'DELETE' }),
    },
    exercises: {
      add: (muscleGroupId: number, name: string) =>
        request(`/api/workout/muscles/${muscleGroupId}/exercises`, { method: 'POST', body: JSON.stringify({ name }) }),
      update: (id: number, name: string) =>
        request(`/api/workout/exercises/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
      delete: (id: number) => request(`/api/workout/exercises/${id}`, { method: 'DELETE' }),
    },
    sessions: {
      list: () => request('/api/workout/sessions'),
      save: (date: string, muscleIds: number[], exercises: unknown[], notes: string) =>
        request('/api/workout/sessions', {
          method: 'POST',
          body: JSON.stringify({ date, muscle_ids: muscleIds, exercises, notes }),
        }),
    },
    schedule: {
      get: () => request('/api/workout/schedule'),
      setDay: (day: number, muscleIds: number[]) =>
        request(`/api/workout/schedule/${day}`, { method: 'PUT', body: JSON.stringify({ muscle_ids: muscleIds }) }),
    },
    stats: {
      get: () => request('/api/workout/stats'),
    },
  },

  day: {
    get: (date: string) => request(`/api/day/${date}`),
  },

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    await token.set(data.token);
  },

  async register(email: string, password: string): Promise<void> {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    await token.set(data.token);
  },
};
