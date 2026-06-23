import { useState, useEffect, useRef } from "react";
import { api } from "./api";

const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace";

const STORE_COLORS: Record<string, string> = {
  Kaufland: "#ef4444",
  Lidl:     "#f59e0b",
  Billa:    "#22c55e",
  Tesco:    "#3b82f6",
};

interface SaleItem {
  id: number;
  store: string;
  name: string;
  price: number | null;
  orig_price: number | null;
  discount: number | null;
  valid_from: string | null;
  valid_to: string | null;
  location: string | null;
  scraped_at: string;
}

const HOME_CITY = "martin";

function locationForCity(loc: string | null): "home" | "other" | null {
  if (!loc) return null;
  return loc.toLowerCase().includes(HOME_CITY) ? "home" : "other";
}

// Sort: Martin-specific first, then nationwide (no location), then other cities last.
function sortByLocation(items: SaleItem[]): SaleItem[] {
  return [...items].sort((a, b) => {
    const la = locationForCity(a.location);
    const lb = locationForCity(b.location);
    const rank = (l: "home" | "other" | null) => l === "home" ? 0 : l === null ? 1 : 2;
    return rank(la) - rank(lb);
  });
}

function fmtPrice(p: number | null): string {
  if (p == null) return "—";
  return p.toFixed(2).replace(".", ",") + " €";
}

function fmtDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s + "T12:00:00Z");
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function daysLeft(validTo: string | null): number | null {
  if (!validTo) return null;
  const diff = new Date(validTo + "T23:59:59Z").getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

interface HistoryModalProps {
  query: string;
  onClose: () => void;
}

function HistoryModal({ query, onClose }: HistoryModalProps) {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.sales.history(query).then(r => r?.json()).then((data: SaleItem[]) => {
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [query]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      style={M.overlay}
    >
      <div style={M.modal}>
        <div style={M.header}>
          <span style={M.title}>História: {query}</span>
          <button style={M.closeBtn} onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div style={M.empty}>Načítavam...</div>
        ) : items.length === 0 ? (
          <div style={M.empty}>Žiadna história pre „{query}"</div>
        ) : (
          <div style={M.list}>
            {items.map((it) => {
              const c = STORE_COLORS[it.store] || "#888";
              return (
                <div key={it.id} style={M.row}>
                  <span style={{ ...M.storeBadge, background: c + "20", color: c, border: `1px solid ${c}40` }}>
                    {it.store}
                  </span>
                  <span style={M.histName}>{it.name}</span>
                  <span style={M.histPrice}>{fmtPrice(it.price)}</span>
                  <span style={M.histDate}>
                    {fmtDate(it.valid_from)}–{fmtDate(it.valid_to)}
                    {it.valid_to ? it.valid_to.slice(0, 4) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SalesSection() {
  const [query, setQuery] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [featured, setFeatured] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [historyQuery, setHistoryQuery] = useState<string | null>(null);
  const [filterStore, setFilterStore] = useState<string>("všetky");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  useEffect(() => {
    api.sales.featured()
      .then(r => r?.json())
      .then((data: SaleItem[]) => {
        setFeatured(Array.isArray(data) ? data : []);
        setFeaturedLoading(false);
      })
      .catch(() => setFeaturedLoading(false));
  }, []);

  async function doSearch(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    try {
      const res = await api.sales.search(q);
      const data: SaleItem[] = await res?.json() ?? [];
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function triggerScrape() {
    setScraping(true);
    setScrapeError(null);
    try {
      const res = await api.sales.scrape();
      if (res && !res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { error?: string }).error ?? "Scrape zlyhal";
        setScrapeError(msg === "scrape already in progress" ? "Scrape už beží, počkaj chvíľu." : msg);
        setScraping(false);
        return;
      }
    } catch {
      setScrapeError("Chyba spojenia so serverom.");
      setScraping(false);
      return;
    }
    setTimeout(async () => {
      try {
        const res = await api.sales.featured();
        const data: SaleItem[] = await res?.json() ?? [];
        setFeatured(Array.isArray(data) ? data : []);
      } catch {
        setScrapeError("Nepodarilo sa načítať výsledky.");
      } finally {
        setScraping(false);
      }
    }, 8000);
  }

  const stores = ["všetky", ...Object.keys(STORE_COLORS)];

  function filterItems(arr: SaleItem[]) {
    if (filterStore === "všetky") return arr;
    return arr.filter(it => it.store === filterStore);
  }

  const displayItems = sortByLocation(query ? filterItems(items) : filterItems(featured));
  const isSearchMode = !!query;

  // Group by store for featured view
  function groupByStore(arr: SaleItem[]): Record<string, SaleItem[]> {
    const g: Record<string, SaleItem[]> = {};
    for (const it of arr) {
      if (!g[it.store]) g[it.store] = [];
      g[it.store].push(it);
    }
    return g;
  }

  const grouped = !isSearchMode ? groupByStore(displayItems) : {};

  return (
    <div style={S.root}>
      {historyQuery && (
        <HistoryModal query={historyQuery} onClose={() => setHistoryQuery(null)} />
      )}

      {/* Search bar */}
      <div style={S.searchRow}>
        <input
          style={S.searchInput}
          placeholder="Hľadaj potravinu (napr. mlieko, maslo, chlieb...)"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch(inputVal)}
        />
        <button style={S.searchBtn} onClick={() => doSearch(inputVal)}>
          Hľadaj
        </button>
        {query && (
          <button
            style={S.clearBtn}
            onClick={() => { setQuery(""); setInputVal(""); setItems([]); }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Store filter */}
      <div style={S.filterRow}>
        {stores.map(st => (
          <button
            key={st}
            style={{
              ...S.filterBtn,
              ...(filterStore === st ? {
                background: (STORE_COLORS[st] || "#22c55e") + "20",
                border: `1px solid ${STORE_COLORS[st] || "#22c55e"}50`,
                color: STORE_COLORS[st] || "#22c55e",
              } : {}),
            }}
            onClick={() => setFilterStore(st)}
          >
            {st}
          </button>
        ))}
        <button
          style={{ ...S.filterBtn, marginLeft: "auto", color: scraping ? "#555" : "#3a3a3a" }}
          onClick={triggerScrape}
          disabled={scraping}
          title="Stiahnuť aktuálne letáky"
        >
          {scraping ? "Sťahujem..." : "↻ Refresh"}
        </button>
      </div>

      {/* Scrape error banner */}
      {scrapeError && (
        <div style={{ color: "#ef4444", fontSize: 13, padding: "6px 0" }}>
          {scrapeError}
        </div>
      )}

      {/* Results */}
      {loading && <div style={S.empty}>Hľadám...</div>}

      {!loading && isSearchMode && (
        <>
          <div style={S.sectionTitle}>
            Výsledky pre „{query}" — {displayItems.length} nájdených
            {displayItems.length > 0 && (
              <button style={S.historyBtn} onClick={() => setHistoryQuery(query)}>
                História cien
              </button>
            )}
          </div>
          {displayItems.length === 0 ? (
            <div style={S.empty}>Žiadne akcie pre „{query}" v {filterStore === "všetky" ? "žiadnom obchode" : filterStore}</div>
          ) : (
            <div style={S.resultsGrid}>
              {displayItems.map(it => <SaleCard key={it.id} item={it} onHistory={() => setHistoryQuery(it.name)} />)}
            </div>
          )}
        </>
      )}

      {!loading && !isSearchMode && (
        <>
          <div style={S.sectionTitle}>Aktuálne akcie tento týždeň</div>
          {featuredLoading ? (
            <div style={S.empty}>Načítavam akcie...</div>
          ) : displayItems.length === 0 ? (
            <div style={S.empty}>
              Žiadne akcie — stlač ↻ Refresh na stiahnutie letákov
            </div>
          ) : filterStore === "všetky" ? (
            Object.entries(grouped).map(([store, storeItems]) => (
              <div key={store} style={S.storeGroup}>
                <div style={{ ...S.storeGroupTitle, color: STORE_COLORS[store] || "#888" }}>
                  {store}
                  <span style={S.storeCount}>{storeItems.length} akcií</span>
                </div>
                <div style={S.resultsGrid}>
                  {storeItems.map(it => <SaleCard key={it.id} item={it} onHistory={() => setHistoryQuery(it.name)} />)}
                </div>
              </div>
            ))
          ) : (
            <div style={S.resultsGrid}>
              {displayItems.map(it => <SaleCard key={it.id} item={it} onHistory={() => setHistoryQuery(it.name)} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SaleCardProps {
  item: SaleItem;
  onHistory: () => void;
}

function SaleCard({ item, onHistory }: SaleCardProps) {
  const c = STORE_COLORS[item.store] || "#888";
  const days = daysLeft(item.valid_to);
  const urgent = days != null && days <= 2;
  const locType = locationForCity(item.location);

  return (
    <div style={C.card}>
      <div style={C.top}>
        <span style={{ ...C.storeBadge, background: c + "18", color: c, border: `1px solid ${c}35` }}>
          {item.store}
        </span>
        {item.discount != null && (
          <span style={C.discount}>-{item.discount}%</span>
        )}
      </div>

      <div style={C.name}>{item.name}</div>

      <div style={C.priceRow}>
        <span style={C.price}>{fmtPrice(item.price)}</span>
        {item.orig_price != null && item.orig_price !== item.price && (
          <span style={C.origPrice}>{fmtPrice(item.orig_price)}</span>
        )}
      </div>

      {(item.valid_from || item.valid_to) && (
        <div style={{ ...C.validity, color: urgent ? "#f97316" : "#555" }}>
          {fmtDate(item.valid_from)}–{item.valid_to ? fmtDate(item.valid_to) + item.valid_to.slice(0, 4) : ""}
          {days != null && <span style={C.daysLeft}>{days <= 0 ? "dnes posledný" : `${days}d`}</span>}
        </div>
      )}

      {/* Location badge — shown only when the deal is branch-specific */}
      {item.location && (
        <div style={{
          ...C.locationBadge,
          ...(locType === "home"
            ? { color: "#22c55e", borderColor: "#22c55e40" }
            : { color: "#f97316", borderColor: "#f9741640" }),
        }}>
          {locType === "home" ? "📍 " : "⚠️ "}
          {item.location}
        </div>
      )}

      <button style={C.histBtn} onClick={onHistory}>história</button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    paddingTop: 4,
  },
  searchRow: {
    display: "flex",
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    background: "#0c0c0c",
    border: "1px solid #222",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#e8e8e8",
    fontSize: 14,
    outline: "none",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  searchBtn: {
    background: "#0a1a0a",
    border: "1px solid #22c55e30",
    borderRadius: 8,
    color: "#22c55e",
    fontSize: 13,
    fontWeight: 600,
    padding: "0 16px",
    cursor: "pointer",
    fontFamily: MONO,
    letterSpacing: "0.03em",
    whiteSpace: "nowrap",
  },
  clearBtn: {
    background: "none",
    border: "1px solid #222",
    borderRadius: 8,
    color: "#555",
    fontSize: 14,
    padding: "0 12px",
    cursor: "pointer",
  },
  filterRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 16,
    alignItems: "center",
  },
  filterBtn: {
    background: "none",
    border: "1px solid #1e1e1e",
    borderRadius: 6,
    color: "#3a3a3a",
    fontSize: 11,
    fontWeight: 600,
    padding: "5px 12px",
    cursor: "pointer",
    fontFamily: MONO,
    letterSpacing: "0.04em",
    transition: "all 0.15s",
  },
  sectionTitle: {
    fontSize: 11,
    color: "#3e3e3e",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    marginBottom: 12,
    fontFamily: MONO,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  historyBtn: {
    background: "none",
    border: "1px solid #222",
    borderRadius: 5,
    color: "#555",
    fontSize: 10,
    padding: "3px 10px",
    cursor: "pointer",
    fontFamily: MONO,
    letterSpacing: "0.06em",
  },
  storeGroup: {
    marginBottom: 24,
  },
  storeGroupTitle: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    fontFamily: MONO,
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  storeCount: {
    fontSize: 10,
    color: "#3a3a3a",
    fontWeight: 400,
  },
  resultsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 8,
  },
  empty: {
    color: "#444",
    fontSize: 13,
    textAlign: "center",
    padding: "32px 0",
  },
};

const C: Record<string, React.CSSProperties> = {
  card: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 10,
    padding: "12px 12px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  storeBadge: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.08em",
    fontFamily: MONO,
    borderRadius: 4,
    padding: "2px 6px",
    textTransform: "uppercase",
  },
  discount: {
    fontSize: 11,
    fontWeight: 700,
    color: "#22c55e",
    fontFamily: MONO,
  },
  name: {
    fontSize: 12,
    color: "#c8c8c8",
    lineHeight: 1.4,
    minHeight: 32,
  },
  priceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: 700,
    color: "#f0f0f0",
    fontFamily: MONO,
  },
  origPrice: {
    fontSize: 11,
    color: "#444",
    fontFamily: MONO,
    textDecoration: "line-through",
  },
  validity: {
    fontSize: 10,
    fontFamily: MONO,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  daysLeft: {
    color: "#555",
  },
  locationBadge: {
    fontSize: 10,
    fontFamily: MONO,
    border: "1px solid",
    borderRadius: 4,
    padding: "2px 6px",
    lineHeight: 1.4,
    wordBreak: "break-word" as const,
  },
  histBtn: {
    background: "none",
    border: "none",
    color: "#2a2a2a",
    fontSize: 10,
    fontFamily: MONO,
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
    marginTop: 2,
    letterSpacing: "0.04em",
  },
};

const M: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    padding: "20px",
    width: "100%",
    maxWidth: 520,
    maxHeight: "80vh",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e8e8e8",
    fontFamily: MONO,
    letterSpacing: "0.03em",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#444",
    fontSize: 16,
    cursor: "pointer",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 0",
    borderBottom: "1px solid #1a1a1a",
    flexWrap: "wrap",
  },
  storeBadge: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.08em",
    fontFamily: MONO,
    borderRadius: 4,
    padding: "2px 6px",
    textTransform: "uppercase",
    flexShrink: 0,
  },
  histName: {
    flex: 1,
    fontSize: 12,
    color: "#c8c8c8",
    minWidth: 120,
  },
  histPrice: {
    fontSize: 13,
    fontWeight: 700,
    color: "#f0f0f0",
    fontFamily: MONO,
    flexShrink: 0,
  },
  histDate: {
    fontSize: 10,
    color: "#555",
    fontFamily: MONO,
    flexShrink: 0,
  },
  empty: {
    color: "#444",
    fontSize: 13,
    textAlign: "center",
    padding: "24px 0",
  },
};
