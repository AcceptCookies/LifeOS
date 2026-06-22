const BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "lifeos_token";
const DEFAULT_STORE_CATEGORY = "potraviny";

export const token = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),
  set: (t: string, persistent = true): void => {
    if (persistent) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      sessionStorage.setItem(TOKEN_KEY, t);
    }
  },
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

async function request(path: string, options: RequestInit = {}): Promise<Response | undefined> {
  const t = token.get();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
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
let _meta: any = null;
export async function getMeta(): Promise<any> {
  if (_meta) return _meta;
  const res = await fetch(`${BASE}/api/meta`);
  _meta = await res.json();
  return _meta;
}

export const api = {
  get: (path: string): Promise<Response | undefined> => request(path),
  post: (path: string, body: unknown): Promise<Response | undefined> => request(path, { method: "POST", body: JSON.stringify(body) }),

  pantry: {
    list: (): Promise<Response | undefined> => request("/api/pantry"),
    add: (name: string, category: string, tier: string | null): Promise<Response | undefined> => request("/api/pantry", { method: "POST", body: JSON.stringify({ name, category, tier: tier || null }) }),
    update: (id: number, name: string, category: string, tier: string | null): Promise<Response | undefined> => request(`/api/pantry/${id}`, { method: "PATCH", body: JSON.stringify({ name, category, tier: tier || null }) }),
    delete: (id: number): Promise<Response | undefined> => request(`/api/pantry/${id}`, { method: "DELETE" }),
    updateTier: (id: number, tier: string | null): Promise<Response | undefined> => request(`/api/pantry/${id}/tier`, { method: "PATCH", body: JSON.stringify({ tier }) }),
  },
  shopping: {
    list: (): Promise<Response | undefined> => request("/api/shopping"),
    add: (pantryItemId: number, quantity = ""): Promise<Response | undefined> => request(`/api/shopping/${pantryItemId}`, { method: "POST", body: JSON.stringify({ quantity }) }),
    addManual: (name: string, quantity = "", storeCategory = DEFAULT_STORE_CATEGORY): Promise<Response | undefined> => request("/api/shopping", { method: "POST", body: JSON.stringify({ name, quantity, store_category: storeCategory }) }),
    update: (id: number, storeCategory: string, quantity: string, name = ""): Promise<Response | undefined> => request(`/api/shopping/${id}`, { method: "PATCH", body: JSON.stringify({ store_category: storeCategory, quantity, name }) }),
    remove: (id: number): Promise<Response | undefined> => request(`/api/shopping/${id}`, { method: "DELETE" }),
  },
  recipes: {
    list: (): Promise<Response | undefined> => request("/api/recipes"),
    add: (name: string): Promise<Response | undefined> => request("/api/recipes", { method: "POST", body: JSON.stringify({ name }) }),
    delete: (id: number): Promise<Response | undefined> => request(`/api/recipes/${id}`, { method: "DELETE" }),
    addIngredient: (recipeId: number, pantryItemId: number, quantity: string): Promise<Response | undefined> =>
      request(`/api/recipes/${recipeId}/ingredients`, { method: "POST", body: JSON.stringify({ pantryItemId, quantity }) }),
    removeIngredient: (id: number): Promise<Response | undefined> => request(`/api/recipe-ingredients/${id}`, { method: "DELETE" }),
    updateIngredient: (id: number, quantity: string): Promise<Response | undefined> => request(`/api/recipe-ingredients/${id}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
    cook: (id: number): Promise<Response | undefined> => request(`/api/recipes/${id}/cook`, { method: "POST" }),
    uncook: (id: number): Promise<Response | undefined> => request(`/api/recipes/${id}/cook`, { method: "DELETE" }),
  },

  workout: {
    muscles: {
      list: (): Promise<Response | undefined> => request("/api/workout/muscles"),
      add: (name: string): Promise<Response | undefined> => request("/api/workout/muscles", { method: "POST", body: JSON.stringify({ name }) }),
      update: (id: number, name: string): Promise<Response | undefined> => request(`/api/workout/muscles/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
      delete: (id: number): Promise<Response | undefined> => request(`/api/workout/muscles/${id}`, { method: "DELETE" }),
    },
    exercises: {
      add: (muscleGroupId: number, name: string): Promise<Response | undefined> => request(`/api/workout/muscles/${muscleGroupId}/exercises`, { method: "POST", body: JSON.stringify({ name }) }),
      update: (id: number, name: string): Promise<Response | undefined> => request(`/api/workout/exercises/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
      delete: (id: number): Promise<Response | undefined> => request(`/api/workout/exercises/${id}`, { method: "DELETE" }),
    },
    sessions: {
      list: (): Promise<Response | undefined> => request("/api/workout/sessions"),
      save: (date: string, muscleIds: number[], exercises: unknown[], notes: string): Promise<Response | undefined> => request("/api/workout/sessions", {
        method: "POST",
        body: JSON.stringify({ date, muscle_ids: muscleIds, exercises, notes }),
      }),
    },
    schedule: {
      get: (): Promise<Response | undefined> => request("/api/workout/schedule"),
      setDay: (day: number, muscleIds: number[]): Promise<Response | undefined> => request(`/api/workout/schedule/${day}`, {
        method: "PUT",
        body: JSON.stringify({ muscle_ids: muscleIds }),
      }),
    },
    stats: {
      get: (): Promise<Response | undefined> => request("/api/workout/stats"),
    },
    splits: {
      list: (): Promise<Response | undefined> => request("/api/workout/splits"),
      add: (name: string): Promise<Response | undefined> => request("/api/workout/splits", { method: "POST", body: JSON.stringify({ name }) }),
      update: (id: number, name: string): Promise<Response | undefined> => request(`/api/workout/splits/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
      delete: (id: number): Promise<Response | undefined> => request(`/api/workout/splits/${id}`, { method: "DELETE" }),
      setMuscles: (id: number, muscleIds: number[]): Promise<Response | undefined> => request(`/api/workout/splits/${id}/muscles`, { method: "PUT", body: JSON.stringify({ muscle_ids: muscleIds }) }),
    },
  },

  habits: {
    get: (date: string): Promise<Response | undefined> => request(`/api/habits/${date}`),
    save: (date: string, data: Record<string, unknown>): Promise<Response | undefined> => request(`/api/habits/${date}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (date: string): Promise<Response | undefined> => request(`/api/habits/${date}`, { method: "DELETE" }),
  },

  day: {
    get: (date: string): Promise<Response | undefined> => request(`/api/day/${date}`),
  },

  sales: {
    featured: (): Promise<Response | undefined> => request("/api/sales/featured"),
    search: (q: string): Promise<Response | undefined> => request(`/api/sales/search?q=${encodeURIComponent(q)}`),
    history: (q: string): Promise<Response | undefined> => request(`/api/sales/history?q=${encodeURIComponent(q)}`),
    scrape: (): Promise<Response | undefined> => request("/api/sales/scrape", { method: "POST" }),
  },

  bugs: {
    list: (): Promise<Response | undefined> => request("/api/bugs"),
    create: (text: string): Promise<Response | undefined> => request("/api/bugs", { method: "POST", body: JSON.stringify({ text }) }),
    update: (id: number, patch: { text?: string; status?: string }): Promise<Response | undefined> => request(`/api/bugs/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
    delete: (id: number): Promise<Response | undefined> => request(`/api/bugs/${id}`, { method: "DELETE" }),
  },

  async login(email: string, password: string, persistent = true): Promise<void> {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    token.set(data.token, persistent);
  },

  async register(email: string, password: string): Promise<void> {
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
