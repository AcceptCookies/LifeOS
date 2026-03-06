const BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "lifeos_token";

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),
  set: (t, persistent = true) => {
    if (persistent) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      sessionStorage.setItem(TOKEN_KEY, t);
    }
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

async function request(path, options = {}) {
  const t = token.get();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    token.clear();
    window.location.reload();
    return;
  }
  return res;
}

// Cached meta (tiers, etc.) fetched once from /api/meta
let _meta = null;
export async function getMeta() {
  if (_meta) return _meta;
  const res = await fetch(`${BASE}/api/meta`);
  _meta = await res.json();
  return _meta;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),

  pantry: {
    list: () => request("/api/pantry"),
    add: (name, category, tier) => request("/api/pantry", { method: "POST", body: JSON.stringify({ name, category, tier: tier || null }) }),
    update: (id, name, category, tier) => request(`/api/pantry/${id}`, { method: "PATCH", body: JSON.stringify({ name, category, tier: tier || null }) }),
    delete: (id) => request(`/api/pantry/${id}`, { method: "DELETE" }),
    updateTier: (id, tier) => request(`/api/pantry/${id}/tier`, { method: "PATCH", body: JSON.stringify({ tier }) }),
  },
  shopping: {
    list: () => request("/api/shopping"),
    add: (pantryItemId, quantity = "") => request(`/api/shopping/${pantryItemId}`, { method: "POST", body: JSON.stringify({ quantity }) }),
    remove: (id) => request(`/api/shopping/${id}`, { method: "DELETE" }),
  },
  recipes: {
    list: () => request("/api/recipes"),
    add: (name) => request("/api/recipes", { method: "POST", body: JSON.stringify({ name }) }),
    delete: (id) => request(`/api/recipes/${id}`, { method: "DELETE" }),
    addIngredient: (recipeId, pantryItemId, quantity) =>
      request(`/api/recipes/${recipeId}/ingredients`, { method: "POST", body: JSON.stringify({ pantryItemId, quantity }) }),
    removeIngredient: (id) => request(`/api/recipe-ingredients/${id}`, { method: "DELETE" }),
    updateIngredient: (id, quantity) => request(`/api/recipe-ingredients/${id}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
    cook: (id) => request(`/api/recipes/${id}/cook`, { method: "POST" }),
    uncook: (id) => request(`/api/recipes/${id}/cook`, { method: "DELETE" }),
  },

  workout: {
    muscles: {
      list: () => request("/api/workout/muscles"),
      add: (name) => request("/api/workout/muscles", { method: "POST", body: JSON.stringify({ name }) }),
      update: (id, name) => request(`/api/workout/muscles/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
      delete: (id) => request(`/api/workout/muscles/${id}`, { method: "DELETE" }),
    },
    exercises: {
      add: (muscleGroupId, name) => request(`/api/workout/muscles/${muscleGroupId}/exercises`, { method: "POST", body: JSON.stringify({ name }) }),
      update: (id, name) => request(`/api/workout/exercises/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
      delete: (id) => request(`/api/workout/exercises/${id}`, { method: "DELETE" }),
    },
    sessions: {
      list: () => request("/api/workout/sessions"),
      save: (date, muscleIds, exercises, notes) => request("/api/workout/sessions", {
        method: "POST",
        body: JSON.stringify({ date, muscle_ids: muscleIds, exercises, notes }),
      }),
    },
    schedule: {
      get: () => request("/api/workout/schedule"),
      setDay: (day, muscleIds) => request(`/api/workout/schedule/${day}`, {
        method: "PUT",
        body: JSON.stringify({ muscle_ids: muscleIds }),
      }),
    },
    stats: {
      get: () => request("/api/workout/stats"),
    },
  },

  day: {
    get: (date) => request(`/api/day/${date}`),
  },

  async login(email, password, persistent = true) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    token.set(data.token, persistent);
  },

  async register(email, password) {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    token.set(data.token);
  },
};
