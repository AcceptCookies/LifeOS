import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, token, getMeta } from "../api";

// We need to reset the _meta cache between tests by re-importing the module.
// We do this by using a dynamic re-import trick: mock the module-level cache via
// vi.resetModules() in the beforeEach that cares about it.

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// ── token ──────────────────────────────────────────────────────────────────

describe("token", () => {
  it("set stores token in localStorage by default", () => {
    token.set("abc123");
    expect(localStorage.getItem("lifeos_token")).toBe("abc123");
  });

  it("set stores token in sessionStorage when persistent=false", () => {
    token.set("abc123", false);
    expect(sessionStorage.getItem("lifeos_token")).toBe("abc123");
    expect(localStorage.getItem("lifeos_token")).toBeNull();
  });

  it("get returns token from localStorage", () => {
    localStorage.setItem("lifeos_token", "mytoken");
    expect(token.get()).toBe("mytoken");
  });

  it("get returns token from sessionStorage if localStorage is empty", () => {
    sessionStorage.setItem("lifeos_token", "sesstoken");
    expect(token.get()).toBe("sesstoken");
  });

  it("get returns null when no token is set", () => {
    expect(token.get()).toBeNull();
  });

  it("clear removes token from both storages", () => {
    localStorage.setItem("lifeos_token", "t1");
    sessionStorage.setItem("lifeos_token", "t2");
    token.clear();
    expect(localStorage.getItem("lifeos_token")).toBeNull();
    expect(sessionStorage.getItem("lifeos_token")).toBeNull();
    expect(token.get()).toBeNull();
  });
});

// ── api.login ──────────────────────────────────────────────────────────────

describe("api.login", () => {
  it("calls POST /api/auth/login with correct body", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ token: "tok123" }));

    await api.login("user@example.com", "secret");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ email: "user@example.com", password: "secret" });
  });

  it("stores token in localStorage on success (persistent=true)", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ token: "tok123" }));

    await api.login("user@example.com", "secret", true);

    expect(localStorage.getItem("lifeos_token")).toBe("tok123");
  });

  it("stores token in sessionStorage when persistent=false", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ token: "tok456" }));

    await api.login("user@example.com", "secret", false);

    expect(sessionStorage.getItem("lifeos_token")).toBe("tok456");
    expect(localStorage.getItem("lifeos_token")).toBeNull();
  });

  it("throws an error when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ error: "Invalid credentials" }, false, 401));

    await expect(api.login("user@example.com", "wrong")).rejects.toThrow("Invalid credentials");
  });

  it("throws generic error when no error field in response", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({}, false, 400));

    await expect(api.login("user@example.com", "wrong")).rejects.toThrow("Login failed");
  });
});

// ── api.register ───────────────────────────────────────────────────────────

describe("api.register", () => {
  it("calls POST /api/auth/register with correct body", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ token: "newtok" }));

    await api.register("new@example.com", "password123");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/register");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ email: "new@example.com", password: "password123" });
  });

  it("stores token in localStorage after registration", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ token: "newtok" }));

    await api.register("new@example.com", "password123");

    expect(localStorage.getItem("lifeos_token")).toBe("newtok");
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ error: "Email already taken" }, false, 409));

    await expect(api.register("taken@example.com", "pass")).rejects.toThrow("Email already taken");
  });
});

// ── getMeta ────────────────────────────────────────────────────────────────

describe("getMeta", () => {
  // getMeta has a module-level cache (_meta). We reset modules between tests in this group.
  beforeEach(() => {
    vi.resetModules();
  });

  it("calls /api/meta and returns parsed data", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ tiers: ["S", "A", "B"] }));

    // Import fresh module to bypass cache
    const { getMeta: getMetaFresh } = await import("../api?cachebust=1");
    const result = await getMetaFresh();

    expect(mockFetch).toHaveBeenCalledWith("/api/meta");
    expect(result).toEqual({ tiers: ["S", "A", "B"] });
  });

  it("caches result — second call does not fetch again", async () => {
    mockFetch.mockResolvedValue(makeFetchResponse({ tiers: ["S", "A"] }));

    const { getMeta: getMetaFresh } = await import("../api?cachebust=2");
    await getMetaFresh();
    await getMetaFresh();

    // fetch was called only once despite two getMeta calls
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ── api.pantry.list ────────────────────────────────────────────────────────

describe("api.pantry.list", () => {
  it("calls GET /api/pantry with Authorization header when token is set", async () => {
    token.set("bearer-token");
    mockFetch.mockResolvedValueOnce(makeFetchResponse([]));

    await api.pantry.list();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/pantry");
    expect(opts.method).toBeUndefined(); // GET by default (no method set)
    expect(opts.headers["Authorization"]).toBe("Bearer bearer-token");
  });

  it("calls GET /api/pantry without Authorization header when no token", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse([]));

    await api.pantry.list();

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Authorization"]).toBeUndefined();
  });
});

// ── api.pantry.add ─────────────────────────────────────────────────────────

describe("api.pantry.add", () => {
  it("calls POST /api/pantry with correct JSON body", async () => {
    token.set("mytoken");
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ id: 1 }));

    await api.pantry.add("Milk", "dairy", "A");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/pantry");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ name: "Milk", category: "dairy", tier: "A" });
  });

  it("sends tier as null when not provided", async () => {
    token.set("mytoken");
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ id: 2 }));

    await api.pantry.add("Eggs", "dairy", null);

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ tier: null });
  });
});

// ── api.shopping.addManual ─────────────────────────────────────────────────

describe("api.shopping.addManual", () => {
  it("uses 'potraviny' as default store_category when not specified", async () => {
    token.set("mytoken");
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ id: 10 }));

    await api.shopping.addManual("Bread");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.store_category).toBe("potraviny");
    expect(body.name).toBe("Bread");
  });

  it("uses provided store_category when specified", async () => {
    token.set("mytoken");
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ id: 11 }));

    await api.shopping.addManual("Shampoo", "1 bottle", "drogéria");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.store_category).toBe("drogéria");
  });

  it("uses empty string as default quantity", async () => {
    token.set("mytoken");
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ id: 12 }));

    await api.shopping.addManual("Sugar");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.quantity).toBe("");
  });
});

// ── 401 response clears token ─────────────────────────────────────────────

describe("401 response", () => {
  it("clears the token on 401 from an authenticated request", async () => {
    token.set("expired-token");

    // Mock window.location.reload to prevent jsdom errors
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    } as unknown as Response);

    await api.pantry.list();

    expect(localStorage.getItem("lifeos_token")).toBeNull();
    expect(sessionStorage.getItem("lifeos_token")).toBeNull();
  });
});
