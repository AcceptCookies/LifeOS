import { useState, useEffect, useCallback, useRef } from "react";
import { api, getMeta } from "./api";
import ImportModal from "./ImportModal";
import { BLUEPRINTS } from "./importBlueprints";
import type { Blueprint } from "./importBlueprints";
import SalesSection from "./SalesSection";

const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace";

const STORE_CAT_COLORS: Record<string, string> = {
  "potraviny":  "#22c55e",
  "pekáreň":   "#f59e0b",
  "drogéria":  "#3b82f6",
  "domácnosť": "#a78bfa",
  "iné":       "#888888",
};

interface ShoppingItem {
  id: number;
  name: string;
  quantity?: string;
  store_category?: string;
  pantry_item_id: number;
  category?: string;
}

interface PantryItem {
  id: number;
  name: string;
  category?: string;
  tier?: string | null;
}

interface RecipeIngredient {
  id: number;
  pantry_item_id: number;
  name: string;
  category?: string;
  quantity?: string;
}

interface Recipe {
  id: number;
  name: string;
  last_cooked?: string | null;
  ingredients: RecipeIngredient[];
}

function groupByStoreCategory(items: ShoppingItem[]): Record<string, ShoppingItem[]> {
  const groups: Record<string, ShoppingItem[]> = {};
  for (const item of items) {
    const cat = item.store_category || "iné";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

// TIER_COLORS is UI-only – backend is source of truth for valid values (via /api/meta)
const TIER_COLORS: Record<string, string> = {
  "S+": "#f59e0b",
  "S":  "#fbbf24",
  "A":  "#22c55e",
  "B":  "#3b82f6",
  "C":  "#a78bfa",
  "D":  "#ef4444",
};

function nextTier(tiers: string[], current: string | null | undefined): string | null {
  if (!current) return tiers[0] ?? "S+";
  const idx = tiers.indexOf(current);
  return idx === tiers.length - 1 ? null : tiers[idx + 1];
}

interface StickyNoteProps {
  category: string;
  items: ShoppingItem[];
  onRemove: (id: number) => void;
  onEdit: (item: ShoppingItem) => void;
}

function StickyNote({ category, items, onRemove, onEdit }: StickyNoteProps): JSX.Element {
  const color = STORE_CAT_COLORS[category] || "#888";
  return (
    <div style={{ ...SN.note, borderLeftColor: color }}>
      <div style={SN.header}>
        <span style={{ ...SN.catLabel, color }}>{category.toUpperCase()}</span>
        <span style={{ ...SN.catCount, color }}>{items.length}</span>
      </div>
      <div>
        {items.map((item) => (
          <div key={item.id} style={SN.item}>
            <div style={SN.itemMain} onClick={() => onRemove(item.id)}>
              <span style={SN.checkBox} />
              <div style={SN.itemText}>
                <span style={SN.itemName}>{item.name}</span>
                {item.quantity && <span style={{ ...SN.qty, color }}>{item.quantity}</span>}
              </div>
            </div>
            <button style={SN.editBtn} onClick={() => onEdit(item)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const SN: Record<string, React.CSSProperties> = {
  note: {
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderLeft: "3px solid #22c55e",
    borderRadius: 10,
    marginBottom: 14,
    overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px 8px",
    borderBottom: "1px solid #222",
  },
  catLabel: {
    fontSize: 10, fontWeight: 700, fontFamily: MONO, letterSpacing: "0.12em",
  },
  catCount: {
    fontSize: 10, fontFamily: MONO, fontWeight: 600, opacity: 0.6,
  },
  item: {
    display: "flex", alignItems: "center",
    borderBottom: "1px solid #1e1e1e",
  },
  itemMain: {
    display: "flex", alignItems: "center", gap: 10,
    flex: 1, padding: "11px 14px", cursor: "pointer",
  },
  checkBox: {
    width: 16, height: 16, flexShrink: 0,
    border: "1.5px solid #333", borderRadius: 4,
    background: "transparent", display: "inline-block",
  },
  itemText: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, color: "#d0d0d0", wordBreak: "break-word" },
  qty: {
    fontSize: 11, fontFamily: MONO, fontWeight: 600,
    marginLeft: 8,
  },
  editBtn: {
    background: "none", border: "none", color: "#444",
    padding: "11px 12px", cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center",
  },
};

interface AddShopModalProps {
  storeCategories: string[];
  onAdd: (name: string, quantity: string, storeCategory: string) => void;
  onClose: () => void;
}

function AddShopModal({ storeCategories, onAdd, onClose }: AddShopModalProps): JSX.Element {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [storeCat, setStoreCat] = useState("potraviny");
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlay(e: React.MouseEvent<HTMLDivElement>): void { if (e.target === overlayRef.current) onClose(); }

  return (
    <div ref={overlayRef} onClick={handleOverlay} style={EM.overlay}>
      <div style={EM.modal}>
        <div style={EM.header}>
          <span style={EM.title}>Pridať do nákupu</span>
          <button style={EM.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={EM.field}>
          <label style={EM.label}>Názov</label>
          <input style={EM.input} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onAdd(name.trim(), quantity, storeCat)}
            autoFocus placeholder="napr. Banán" />
        </div>
        <div style={EM.field}>
          <label style={EM.label}>Množstvo</label>
          <input style={EM.input} value={quantity} onChange={(e) => setQuantity(e.target.value)}
            placeholder="napr. 2x, 1L..." />
        </div>
        <div style={EM.field}>
          <label style={EM.label}>Kategória obchodu</label>
          <select style={EM.input} value={storeCat} onChange={(e) => setStoreCat(e.target.value)}>
            {storeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button style={EM.saveBtn} onClick={() => onAdd(name.trim(), quantity, storeCat)} disabled={!name.trim()}>
          Pridať
        </button>
      </div>
    </div>
  );
}

interface EditShopModalProps {
  item: ShoppingItem;
  storeCategories: string[];
  onSave: (id: number, storeCategory: string, quantity: string, name: string) => void;
  onClose: () => void;
}

function EditShopModal({ item, storeCategories, onSave, onClose }: EditShopModalProps): JSX.Element {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity || "");
  const [storeCat, setStoreCat] = useState(item.store_category || "potraviny");
  const overlayRef = useRef<HTMLDivElement>(null);
  const isManual = item.pantry_item_id === 0;

  function handleOverlay(e: React.MouseEvent<HTMLDivElement>): void { if (e.target === overlayRef.current) onClose(); }

  return (
    <div ref={overlayRef} onClick={handleOverlay} style={EM.overlay}>
      <div style={EM.modal}>
        <div style={EM.header}>
          <span style={EM.title}>Upraviť položku</span>
          <button style={EM.closeBtn} onClick={onClose}>✕</button>
        </div>
        {isManual ? (
          <div style={EM.field}>
            <label style={EM.label}>Názov</label>
            <input style={EM.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        ) : (
          <div style={EM.field}>
            <label style={EM.label}>Názov</label>
            <div style={{ ...EM.input, color: "#555" }}>{item.name}</div>
          </div>
        )}
        <div style={EM.field}>
          <label style={EM.label}>Množstvo</label>
          <input style={EM.input} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div style={EM.field}>
          <label style={EM.label}>Kategória obchodu</label>
          <select style={EM.input} value={storeCat} onChange={(e) => setStoreCat(e.target.value)}>
            {storeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button style={EM.saveBtn} onClick={() => onSave(item.id, storeCat, quantity, isManual ? name.trim() : item.name)}>
          Uložiť
        </button>
      </div>
    </div>
  );
}

interface EditItemModalProps {
  item: PantryItem;
  tiers: string[];
  categories: string[];
  onSave: (id: number, name: string, category: string, tier: string) => void;
  onClose: () => void;
}

function EditItemModal({ item, tiers, categories, onSave, onClose }: EditItemModalProps): JSX.Element {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category || "");
  const [tier, setTier] = useState(item.tier || "");
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlay(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div ref={overlayRef} onClick={handleOverlay} style={EM.overlay}>
      <div style={EM.modal}>
        <div style={EM.header}>
          <span style={EM.title}>Upraviť potravinu</span>
          <button style={EM.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={EM.field}>
          <label style={EM.label}>Názov</label>
          <input
            style={EM.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSave(item.id, name.trim(), category, tier)}
            autoFocus
          />
        </div>

        <div style={EM.field}>
          <label style={EM.label}>Kategória</label>
          <select style={EM.input} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— žiadna —</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={EM.field}>
          <label style={EM.label}>Tier</label>
          <div style={EM.tierRow}>
            {["", ...tiers].map((t) => {
              const color = t ? TIER_COLORS[t] : null;
              const active = tier === t;
              return (
                <button
                  key={t || "none"}
                  style={{
                    ...EM.tierOpt,
                    background: active ? (color ? color + "30" : "#2a2a2a") : "transparent",
                    border: `1px solid ${active ? (color ?? "#555") : "#333"}`,
                    color: active ? (color ?? "#777") : "#444",
                  }}
                  onClick={() => setTier(t)}
                >
                  {t || "—"}
                </button>
              );
            })}
          </div>
        </div>

        <button
          style={EM.saveBtn}
          onClick={() => onSave(item.id, name.trim(), category, tier)}
          disabled={!name.trim()}
        >
          Uložiť
        </button>
      </div>
    </div>
  );
}

const EM: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
    zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
  },
  modal: {
    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12,
    padding: "20px", width: "100%", maxWidth: 360,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20,
  },
  title: { fontSize: 14, fontWeight: 600, color: "#e0e0e0", fontFamily: MONO },
  closeBtn: {
    background: "none", border: "none", color: "#444", fontSize: 16, cursor: "pointer", padding: "2px 6px",
  },
  field: { marginBottom: 14 },
  label: {
    display: "block", fontSize: 10, color: "#555", textTransform: "uppercase",
    letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 6,
  },
  input: {
    width: "100%", boxSizing: "border-box", background: "#0f0f0f",
    border: "1px solid #2a2a2a", borderRadius: 7, padding: "10px 12px",
    color: "#e0e0e0", fontSize: 14, outline: "none",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  tierRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  tierOpt: {
    borderRadius: 5, fontSize: 12, fontFamily: MONO, fontWeight: 700,
    padding: "4px 10px", cursor: "pointer", transition: "all 0.15s",
  },
  saveBtn: {
    width: "100%", marginTop: 6, background: "transparent",
    border: "1px solid #22c55e44", borderRadius: 8, color: "#22c55e",
    fontSize: 14, fontWeight: 600, padding: "12px 0", cursor: "pointer",
  },
};

function formatLastCooked(iso: string | null | undefined): string {
  if (!iso) return "Nikdy uvarené";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Uvarené dnes";
  if (days === 1) return "Uvarené včera";
  if (days < 30) return `Pred ${days} dňami`;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

type ActiveTab = "pantry" | "shop" | "recipes";

interface PantryPageProps {
  activeTab: ActiveTab;
  onTabChange?: (tab: string) => void;
}

interface RecipeToast {
  msg: string;
  onUndo?: (() => void) | null;
}

export default function PantryPage({ activeTab }: PantryPageProps): JSX.Element {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newTier, setNewTier] = useState("");
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [addIngValue, setAddIngValue] = useState("");
  const [addIngQuantity, setAddIngQuantity] = useState("");
  const [ingQuantities, setIngQuantities] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [importBlueprint, setImportBlueprint] = useState<Blueprint | null>(null);
  const [tiers, setTiers] = useState<string[]>(["S+", "S", "A", "B", "C", "D"]);
  const [categories, setCategories] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [boughtMsg, setBoughtMsg] = useState<string | null>(null);
  const [addedToCartMsg, setAddedToCartMsg] = useState<string | null>(null);
  const [recipeToast, setRecipeToast] = useState<RecipeToast | null>(null);
  const [storeCategories, setStoreCategories] = useState<string[]>(["potraviny", "pekáreň", "drogéria", "domácnosť", "iné"]);
  const [addShopOpen, setAddShopOpen] = useState(false);
  const [editShopItem, setEditShopItem] = useState<ShoppingItem | null>(null);
  const [shopSubTab, setShopSubTab] = useState<"zoznam" | "akcie">("zoznam");

  function showRecipeToast(msg: string, onUndo: (() => void) | null = null): void {
    setRecipeToast({ msg, onUndo });
    if (!onUndo) setTimeout(() => setRecipeToast(null), 2500);
  }

  const loadAll = useCallback(async () => {
    try {
      const [pantryRes, shopRes, recipesRes, meta] = await Promise.all([
        api.pantry.list(),
        api.shopping.list(),
        api.recipes.list(),
        getMeta(),
      ]);
      const [pantryData, shopData, recipesData] = await Promise.all([
        pantryRes!.json(),
        shopRes!.json(),
        recipesRes!.json(),
      ]);
      setItems(Array.isArray(pantryData) ? pantryData : []);
      setShopping(Array.isArray(shopData) ? shopData : []);
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
      if (Array.isArray(meta?.tiers)) setTiers(meta.tiers);
      if (Array.isArray(meta?.pantry_categories)) setCategories(meta.pantry_categories);
      if (Array.isArray(meta?.store_categories)) setStoreCategories(meta.store_categories);
    } catch (e) {
      console.error("load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Keep selectedRecipe in sync with recipes state
  useEffect(() => {
    if (selectedRecipe) {
      const updated = recipes.find((r) => r.id === selectedRecipe.id);
      if (updated) {
        setSelectedRecipe(updated);
        setIngQuantities(
          Object.fromEntries(updated.ingredients.map((i) => [i.id, i.quantity || ""]))
        );
      }
    }
  }, [recipes]);

  // Close detail when switching tabs
  useEffect(() => {
    setSelectedRecipe(null);
  }, [activeTab]);

  async function addItem(): Promise<void> {
    const name = newName.trim();
    if (!name) return;
    const res = await api.pantry.add(name, newCategory, newTier || null);
    if (res && res.ok) {
      const item = await res.json();
      setItems((prev) => [...prev, item]);
      setNewName("");
      setNewCategory("");
      setNewTier("");
    }
  }

  async function saveEdit(id: number, name: string, category: string, tier: string): Promise<void> {
    const res = await api.pantry.update(id, name, category, tier || null);
    if (res && (res.ok || res.status === 204)) {
      setItems((prev) => prev.map((i) =>
        i.id === id ? { ...i, name, category, tier: tier || null } : i
      ));
      setEditItem(null);
    }
  }

  async function addToShopping(pantryItem: Pick<PantryItem, "id" | "name">, quantity = ""): Promise<void> {
    const res = await api.shopping.add(pantryItem.id, quantity);
    if (res && (res.ok || res.status === 204)) {
      const shopRes = await api.shopping.list();
      const shopData = await shopRes!.json();
      setShopping(Array.isArray(shopData) ? shopData : []);
      setAddedToCartMsg(pantryItem.name);
      setTimeout(() => setAddedToCartMsg(null), 2500);
    }
  }

  async function addManualShoppingItem(name: string, quantity: string, storeCategory: string): Promise<void> {
    const res = await api.shopping.addManual(name, quantity, storeCategory);
    if (res && (res.ok || res.status === 204)) {
      const shopRes = await api.shopping.list();
      const shopData = await shopRes!.json();
      setShopping(Array.isArray(shopData) ? shopData : []);
      setAddShopOpen(false);
    }
  }

  async function saveShopEdit(id: number, storeCategory: string, quantity: string, name: string): Promise<void> {
    const res = await api.shopping.update(id, storeCategory, quantity, name);
    if (res && (res.ok || res.status === 204)) {
      setShopping((prev) => prev.map((s) =>
        s.id === id ? { ...s, store_category: storeCategory, quantity, name: s.pantry_item_id === 0 ? name : s.name } : s
      ));
      setEditShopItem(null);
    }
  }

  async function removeFromShopping(id: number): Promise<void> {
    const item = shopping.find((s) => s.id === id);
    const res = await api.shopping.remove(id);
    if (res && (res.ok || res.status === 204)) {
      setShopping((prev) => prev.filter((s) => s.id !== id));
      setBoughtMsg(item?.name ?? "Položka");
      setTimeout(() => setBoughtMsg(null), 2500);
    }
  }

  async function deletePantryItem(id: number): Promise<void> {
    setDeleteError(null);
    const res = await api.pantry.delete(id);
    if (res && (res.ok || res.status === 204)) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setShopping((prev) => prev.filter((s) => s.pantry_item_id !== id));
    } else if (res?.status === 409) {
      const data = await res.json();
      setDeleteError(data.error || "Potravina sa používa v recepte");
      setTimeout(() => setDeleteError(null), 4000);
    }
  }

  async function cycleTier(item: PantryItem): Promise<void> {
    const newTierVal = nextTier(tiers, item.tier);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, tier: newTierVal } : i));
    await api.pantry.updateTier(item.id, newTierVal);
  }

  async function addRecipe(): Promise<void> {
    const name = newRecipeName.trim();
    if (!name) return;
    const res = await api.recipes.add(name);
    if (res && res.ok) {
      const recipe = await res.json();
      setRecipes((prev) => [...prev, recipe]);
      setNewRecipeName("");
      showRecipeToast("Recept pridaný");
    }
  }

  async function deleteRecipe(id: number): Promise<void> {
    const res = await api.recipes.delete(id);
    if (res && (res.ok || res.status === 204)) {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      if (selectedRecipe?.id === id) setSelectedRecipe(null);
    }
  }

  async function addIngredient(): Promise<void> {
    if (!addIngValue || !selectedRecipe) return;
    const res = await api.recipes.addIngredient(selectedRecipe.id, Number(addIngValue), addIngQuantity.trim());
    if (res && (res.ok || res.status === 204)) {
      const recipesRes = await api.recipes.list();
      const recipesData = await recipesRes!.json();
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
      setAddIngValue("");
      setAddIngQuantity("");
      showRecipeToast("Ingrediencia pridaná");
    }
  }

  async function saveIngredientQuantity(id: number): Promise<void> {
    const quantity = ingQuantities[id] ?? "";
    await api.recipes.updateIngredient(id, quantity);
    const recipesRes = await api.recipes.list();
    const recipesData = await recipesRes!.json();
    setRecipes(Array.isArray(recipesData) ? recipesData : []);
  }

  async function removeIngredient(ingredientId: number): Promise<void> {
    const res = await api.recipes.removeIngredient(ingredientId);
    if (res && (res.ok || res.status === 204)) {
      setRecipes((prev) => prev.map((r) => ({
        ...r,
        ingredients: r.ingredients.filter((i) => i.id !== ingredientId),
      })));
      showRecipeToast("Ingrediencia odstránená");
    }
  }

  async function cookRecipe(recipeId: number): Promise<void> {
    const res = await api.recipes.cook(recipeId);
    if (res && (res.ok || res.status === 204)) {
      const recipesRes = await api.recipes.list();
      const recipesData = await recipesRes!.json();
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
      showRecipeToast("Uvarené dnes", async () => {
        setRecipeToast(null);
        await api.recipes.uncook(recipeId);
        const r2 = await api.recipes.list();
        const d2 = await r2!.json();
        setRecipes(Array.isArray(d2) ? d2 : []);
      });
    }
  }

  // suppress unused warning — cycleTier exposed for potential future use
  void cycleTier;

  const shoppingIds = new Set(shopping.map((s) => s.pantry_item_id));

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.centered}>Načítavam...</div>
      </div>
    );
  }

  // ── Recipe detail view ──
  if (activeTab === "recipes" && selectedRecipe) {
    const usedIds = new Set(selectedRecipe.ingredients.map((i) => i.pantry_item_id));
    const availableItems = items.filter((i) => !usedIds.has(i.id));
    const neverCooked = !selectedRecipe.last_cooked;

    return (
      <div style={S.page}>
        <div style={S.container}>

          {/* Back + title */}
          <div style={S.detailHeader}>
            <button style={S.backBtn} onClick={() => setSelectedRecipe(null)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Recepty
            </button>
            <button style={S.deleteRecipeBtn} onClick={() => deleteRecipe(selectedRecipe.id)}>
              Vymazať
            </button>
          </div>

          <div style={S.detailTitleRow}>
            <h1 style={S.detailTitle}>{selectedRecipe.name}</h1>
          </div>

          {/* Last cooked + cook button */}
          <div style={S.detailMeta}>
            <span style={{ ...S.detailLastCooked, color: neverCooked ? "#f97316" : "#666" }}>
              {formatLastCooked(selectedRecipe.last_cooked)}
            </span>
            <button style={S.cookBtnLg} onClick={() => cookRecipe(selectedRecipe.id)}>
              ✓ Uvarené dnes
            </button>
          </div>

          {recipeToast && (
            <div style={S.recipeToast}>
              <span>{recipeToast.msg}</span>
              {recipeToast.onUndo && (
                <button style={S.undoBtn} onClick={recipeToast.onUndo}>Undo</button>
              )}
            </div>
          )}

          {/* Ingredients section */}
          <div style={S.sectionLabel}>Ingrediencie</div>

          {selectedRecipe.ingredients.length === 0 ? (
            <div style={S.emptyState}>Žiadne ingrediencie — pridaj z kuchyne</div>
          ) : (
            <div style={S.ingGrid}>
              {selectedRecipe.ingredients.map((ing) => {
                const inCart = shoppingIds.has(ing.pantry_item_id);
                return (
                  <div key={ing.id} style={{ ...S.ingCard, opacity: inCart ? 0.5 : 1 }}>
                    <span style={S.ingCardName}>{ing.name}</span>
                    {ing.category && <span style={S.ingCardCategory}>{ing.category}</span>}
                    <input
                      style={S.ingQuantityInput}
                      placeholder="množstvo..."
                      value={ingQuantities[ing.id] ?? ""}
                      onChange={(e) => setIngQuantities((prev) => ({ ...prev, [ing.id]: e.target.value }))}
                      onBlur={() => saveIngredientQuantity(ing.id)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    />
                    <button
                      style={{ ...S.ingCartBtn, ...(inCart ? S.ingCartBtnDone : {}) }}
                      onClick={() => !inCart && addToShopping({ id: ing.pantry_item_id, name: ing.name }, ingQuantities[ing.id] ?? ing.quantity ?? "")}
                      disabled={inCart}
                    >
                      {inCart ? "✓ V košíku" : "+ Do košíka"}
                    </button>
                    <button
                      style={S.ingRemoveBtn}
                      onClick={() => removeIngredient(ing.id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add ingredient */}
          <div style={{ ...S.sectionLabel, marginTop: 24 }}>Pridaj ingredienciu</div>
          {items.length === 0 ? (
            <div style={S.addIngHint}>Najprv pridaj potraviny v sekcii Kuchyňa</div>
          ) : availableItems.length === 0 ? (
            <div style={S.addIngHint}>Všetky potraviny z kuchyne sú už v recepte</div>
          ) : (
            <div style={S.addIngRow}>
              <select
                style={S.select}
                value={addIngValue}
                onChange={(e) => setAddIngValue(e.target.value)}
              >
                <option value="">— vyber z kuchyne —</option>
                {availableItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}{i.category ? ` (${i.category})` : ""}</option>
                ))}
              </select>
              <input
                style={{ ...S.input, flex: "0 0 100px" }}
                placeholder="Množstvo"
                value={addIngQuantity}
                onChange={(e) => setAddIngQuantity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addIngredient()}
              />
              <button style={S.addIngBtn} onClick={addIngredient}>Pridaj</button>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ── Main list view ──
  return (
    <div style={S.page}>
      <div style={S.container}>
        {importBlueprint && (
          <ImportModal blueprint={importBlueprint} onClose={() => setImportBlueprint(null)} onSuccess={loadAll} />
        )}

        <div style={S.header}>
          <div style={S.appTitle}>
            {{ pantry: "KUCHYŇA", shop: "NÁKUP", recipes: "RECEPTY" }[activeTab]}
          </div>
          <button
            style={S.importBtnSmall}
            onClick={() => setImportBlueprint({ pantry: BLUEPRINTS.pantry, shop: BLUEPRINTS.shopping, recipes: BLUEPRINTS.recipes }[activeTab])}
          >
            Import
          </button>
        </div>

        {/* ── Edit modal ── */}
        {editItem && (
          <EditItemModal
            item={editItem}
            tiers={tiers}
            categories={categories}
            onSave={saveEdit}
            onClose={() => setEditItem(null)}
          />
        )}

        {/* ── Kuchyňa ── */}
        {activeTab === "pantry" && (
          <>
            <div style={S.addCard}>
              <div style={S.addFields}>
                <div style={S.addField}>
                  <label style={S.addLabel}>Potravina</label>
                  <input
                    style={S.addInput}
                    placeholder="napr. Banán"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addItem()}
                  />
                </div>
                <div style={{ ...S.addField, flex: "0 0 148px" }}>
                  <label style={S.addLabel}>Kategória</label>
                  <select
                    style={S.addSelect}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div style={{ ...S.addField, flex: "0 0 80px" }}>
                  <label style={S.addLabel}>Tier</label>
                  <select
                    style={S.addSelect}
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
                  >
                    <option value="">—</option>
                    {tiers.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button style={S.addBtn} onClick={addItem}>+</button>
            </div>
            {addedToCartMsg && (
              <div style={S.boughtToast}>✓ {addedToCartMsg} pridané do nákupu</div>
            )}
            {deleteError && (
              <div style={S.deleteError}>{deleteError}</div>
            )}
            {items.length === 0 ? (
              <div style={S.emptyState}>Kuchyňa je prázdna</div>
            ) : (
              <div style={S.card}>
                {items.map((item) => {
                  const inCart = shoppingIds.has(item.id);
                  const tierColor = item.tier ? TIER_COLORS[item.tier] : null;
                  return (
                    <div key={item.id} style={S.itemRow}>
                      <span
                        style={{
                          ...S.tierBtn,
                          background: tierColor ? tierColor + "25" : "transparent",
                          border: `1px solid ${tierColor ?? "#333"}`,
                          color: tierColor ?? "#555",
                          cursor: "default",
                        }}
                      >
                        {item.tier || "·"}
                      </span>
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                        onClick={() => setEditItem({ ...item })}
                      >
                        <span style={{ ...S.itemName, color: inCart ? "#555" : "#e0e0e0" }}>
                          {item.name}
                        </span>
                        {item.category && <span style={S.categoryTag}>{item.category}</span>}
                      </div>
                      <button
                        style={{ ...S.cartBtn, opacity: inCart ? 0.4 : 1 }}
                        onClick={() => !inCart && addToShopping(item)}
                        disabled={inCart}
                      >
                        {inCart ? "✓" : "+"}
                      </button>
                      <button style={S.deleteBtn} onClick={() => deletePantryItem(item.id)}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Nákup ── */}
        {activeTab === "shop" && (
          <>
            {/* Sub-tabs: Zoznam / Akcie */}
            <div style={S.shopSubTabs}>
              <button
                style={{ ...S.shopSubTab, ...(shopSubTab === "zoznam" ? S.shopSubTabActive : {}) }}
                onClick={() => setShopSubTab("zoznam")}
              >
                Zoznam
              </button>
              <button
                style={{ ...S.shopSubTab, ...(shopSubTab === "akcie" ? S.shopSubTabActive : {}) }}
                onClick={() => setShopSubTab("akcie")}
              >
                Akcie v obchodoch
              </button>
            </div>

            {shopSubTab === "zoznam" && (
              <>
                {boughtMsg && <div style={S.boughtToast}>✓ {boughtMsg} zakúpené</div>}
                <button style={S.addShopBtn} onClick={() => setAddShopOpen(true)}>
                  + Pridať položku
                </button>
                {addShopOpen && (
                  <AddShopModal
                    storeCategories={storeCategories}
                    onAdd={addManualShoppingItem}
                    onClose={() => setAddShopOpen(false)}
                  />
                )}
                {editShopItem && (
                  <EditShopModal
                    item={editShopItem}
                    storeCategories={storeCategories}
                    onSave={saveShopEdit}
                    onClose={() => setEditShopItem(null)}
                  />
                )}
                {shopping.length === 0 ? (
                  <div style={S.emptyState}>Nič nekupuješ</div>
                ) : (
                  <div>
                    {Object.entries(groupByStoreCategory(shopping)).map(([cat, catItems]) => (
                      <StickyNote
                        key={cat}
                        category={cat}
                        items={catItems}
                        onRemove={removeFromShopping}
                        onEdit={setEditShopItem}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {shopSubTab === "akcie" && <SalesSection />}
          </>
        )}

        {/* ── Recepty ── */}
        {activeTab === "recipes" && (
          <>
            {recipeToast && (
            <div style={S.recipeToast}>
              <span>{recipeToast.msg}</span>
              {recipeToast.onUndo && (
                <button style={S.undoBtn} onClick={recipeToast.onUndo}>Undo</button>
              )}
            </div>
          )}
            <div style={S.addRow}>
              <input
                style={S.input}
                placeholder="Názov receptu..."
                value={newRecipeName}
                onChange={(e) => setNewRecipeName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRecipe()}
              />
              <button style={S.addBtn} onClick={addRecipe}>+</button>
            </div>
            {recipes.length === 0 ? (
              <div style={S.emptyState}>Žiadne recepty</div>
            ) : (
              <div style={S.card}>
                {recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    style={{ ...S.itemRow, cursor: "pointer" }}
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={S.itemName}>{recipe.name}</span>
                      <span style={{
                        ...S.lastCookedChip,
                        color: recipe.last_cooked ? "#666" : "#f97316",
                      }}>
                        {formatLastCooked(recipe.last_cooked)}
                      </span>
                    </div>
                    <span style={S.ingCount}>
                      {recipe.ingredients.length > 0
                        ? `${recipe.ingredients.length} ing.`
                        : "—"}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    background: "#1a1a1a",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#e0e0e0",
    overflowX: "hidden",
  },
  centered: {
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: "100vh", color: "#555", fontSize: 16,
  },
  container: {
    maxWidth: 480, width: "100%", margin: "0 auto",
    padding: "24px 16px 80px", boxSizing: "border-box",
  },
  header: { marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" },
  appTitle: {
    fontSize: 28, fontWeight: 700, letterSpacing: "0.14em",
    fontFamily: MONO, color: "#e0e0e0",
  },

  // ── List styles ──
  addRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  addCard: {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 10,
    padding: "14px 14px 14px 16px",
    marginBottom: 16,
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
  },
  addFields: {
    display: "flex",
    flex: 1,
    gap: 10,
    flexWrap: "wrap",
    minWidth: 0,
  },
  addField: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  addLabel: {
    fontSize: 9,
    color: "#3a3a3a",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontFamily: MONO,
  },
  addInput: {
    background: "#0c0c0c",
    border: "1px solid #1e1e1e",
    borderRadius: 7,
    padding: "9px 11px",
    color: "#d0d0d0",
    fontSize: 13,
    outline: "none",
    fontFamily: "'Inter', system-ui, sans-serif",
    width: "100%",
    boxSizing: "border-box",
  },
  addSelect: {
    background: "#0c0c0c url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23444'/%3E%3C/svg%3E\") no-repeat",
    backgroundPosition: "calc(100% - 10px) center",
    border: "1px solid #1e1e1e",
    borderRadius: 7,
    padding: "9px 28px 9px 11px",
    color: "#d0d0d0",
    fontSize: 13,
    outline: "none",
    fontFamily: "'Inter', system-ui, sans-serif",
    width: "100%",
    boxSizing: "border-box",
    appearance: "none",
    WebkitAppearance: "none",
    cursor: "pointer",
  },
  input: {
    flex: "1 1 120px", minWidth: 0, background: "#1a1a1a",
    border: "1px solid #444", borderRadius: 8, padding: "10px 12px",
    color: "#e0e0e0", fontSize: 15, outline: "none",
    fontFamily: "'Inter', system-ui, sans-serif", width: "100%",
  },
  addBtn: {
    background: "#14532d", border: "1px solid #22c55e", borderRadius: 8,
    color: "#22c55e", fontSize: 22, width: 44, height: 44, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  select: {
    minWidth: 0, background: "#1a1a1a", border: "1px solid #444",
    borderRadius: 8, padding: "10px 12px", color: "#e0e0e0",
    fontSize: 14, outline: "none", fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: "#242424", borderRadius: 10,
    border: "1px solid #333", overflow: "hidden",
  },
  itemRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "13px 14px", borderBottom: "1px solid #2a2a2a", minWidth: 0,
  },
  itemName: {
    fontSize: 15, fontWeight: 500, transition: "color 0.15s",
    wordBreak: "break-word", minWidth: 0,
  },
  categoryTag: {
    fontSize: 11, color: "#555", background: "#2a2a2a", borderRadius: 4,
    padding: "2px 6px", marginLeft: 8, fontFamily: MONO,
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  tierBtn: {
    borderRadius: 5,
    fontSize: 11, fontFamily: MONO, fontWeight: 700,
    width: 34, height: 26, cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    letterSpacing: "0.02em",
    transition: "background 0.15s, color 0.15s, border-color 0.15s",
    padding: 0, minWidth: 34,
  },
  cartBtn: {
    background: "#1e2a1e", border: "1px solid #22c55e", borderRadius: 6,
    color: "#22c55e", fontSize: 16, width: 32, height: 32, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "opacity 0.15s",
  },
  deleteBtn: {
    background: "none", border: "1px solid #333", borderRadius: 6,
    color: "#555", fontSize: 16, width: 32, height: 32, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  checkHint: {
    width: 18, height: 18, flexShrink: 0,
    border: "1.5px solid #444", borderRadius: 4,
    background: "transparent", display: "inline-block",
  },
  quantityBadge: {
    fontSize: 12, color: "#22c55e", fontFamily: MONO, fontWeight: 600,
    marginLeft: 8,
  },
  emptyState: { textAlign: "center", color: "#555", fontSize: 15, padding: "40px 0" },
  boughtToast: {
    fontSize: 12, color: "#22c55e", background: "#0a1a0a",
    border: "1px solid #22c55e22", borderRadius: 7,
    padding: "9px 14px", marginBottom: 10,
    fontFamily: MONO, letterSpacing: "0.04em",
  },
  deleteError: {
    fontSize: 12, color: "#ef4444", background: "#1a0a0a",
    border: "1px solid #3a1010", borderRadius: 7,
    padding: "10px 14px", marginBottom: 10, fontFamily: MONO,
  },
  recipeToast: {
    fontSize: 12, color: "#22c55e", background: "#0a1a0a",
    border: "1px solid #22c55e22", borderRadius: 7,
    padding: "9px 14px", marginBottom: 10,
    fontFamily: MONO, letterSpacing: "0.04em",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
  },
  undoBtn: {
    background: "none", border: "1px solid #22c55e44", borderRadius: 5,
    color: "#22c55e", fontSize: 11, fontFamily: MONO,
    padding: "3px 10px", cursor: "pointer", flexShrink: 0,
  },
  lastCookedChip: { display: "block", fontSize: 11, fontFamily: MONO, marginTop: 2 },
  ingCount: { fontSize: 12, color: "#555", fontFamily: MONO, flexShrink: 0 },

  // ── Detail view ──
  detailHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    display: "flex", alignItems: "center", gap: 4,
    background: "none", border: "none", color: "#22c55e",
    fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 0,
    marginLeft: -8,
  },
  deleteRecipeBtn: {
    background: "none", border: "1px solid #3a1a1a", borderRadius: 6,
    color: "#7f1d1d", fontSize: 12, padding: "5px 10px", cursor: "pointer",
  },
  detailTitleRow: { marginBottom: 16 },
  detailTitle: {
    fontSize: 26, fontWeight: 700, color: "#e0e0e0",
    wordBreak: "break-word", lineHeight: 1.2,
  },
  detailMeta: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 10, marginBottom: 28,
    padding: "14px 16px", background: "#242424",
    border: "1px solid #333", borderRadius: 10,
  },
  detailLastCooked: { fontSize: 13, fontFamily: MONO },
  cookBtnLg: {
    background: "#14532d", border: "1px solid #22c55e", borderRadius: 8,
    color: "#22c55e", fontSize: 14, fontWeight: 600,
    padding: "9px 18px", cursor: "pointer", flexShrink: 0,
  },
  sectionLabel: {
    fontSize: 11, color: "#555", textTransform: "uppercase",
    letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 10,
  },
  ingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 10,
  },
  ingCard: {
    background: "#242424", border: "1px solid #333", borderRadius: 10,
    padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 6,
    transition: "opacity 0.2s",
  },
  ingCardName: {
    fontSize: 14, fontWeight: 600, color: "#e0e0e0", wordBreak: "break-word",
  },
  ingQuantityInput: {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#22c55e", fontSize: 12, fontFamily: MONO,
    padding: "4px 8px", outline: "none", width: "100%", boxSizing: "border-box",
  },
  ingCardCategory: {
    fontSize: 10, color: "#555", fontFamily: MONO,
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  ingCartBtn: {
    marginTop: 4, background: "#1e2a1e", border: "1px solid #22c55e",
    borderRadius: 6, color: "#22c55e", fontSize: 11, fontWeight: 600,
    padding: "5px 8px", cursor: "pointer", textAlign: "center",
  },
  ingCartBtnDone: {
    background: "#1a1a1a", border: "1px solid #333", color: "#555", cursor: "default",
  },
  ingRemoveBtn: {
    background: "none", border: "1px solid #333", borderRadius: 5,
    color: "#555", fontSize: 14, padding: "2px 8px", cursor: "pointer",
    textAlign: "center",
  },
  addShopBtn: {
    width: "100%", marginBottom: 14,
    background: "transparent", border: "1px dashed #2a2a2a",
    borderRadius: 8, color: "#444", fontSize: 13,
    fontFamily: MONO, letterSpacing: "0.04em",
    padding: "11px 0", cursor: "pointer",
    transition: "border-color 0.15s, color 0.15s",
  },
  shopSubTabs: {
    display: "flex", gap: 6, marginBottom: 16,
  },
  shopSubTab: {
    background: "none", border: "1px solid #1e1e1e", borderRadius: 6,
    color: "#3a3a3a", fontSize: 12, fontWeight: 600,
    padding: "7px 16px", cursor: "pointer", fontFamily: MONO,
    letterSpacing: "0.04em", transition: "all 0.15s",
  },
  shopSubTabActive: {
    background: "#0a1a0a", border: "1px solid #22c55e30", color: "#22c55e",
  },
  importBtnSmall: {
    background: "none",
    border: "1px solid #2a2a2a",
    borderRadius: 5,
    color: "#3a3a3a",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.06em",
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    textTransform: "uppercase",
  },
  addIngHint: { fontSize: 13, color: "#555", padding: "10px 0" },
  addIngRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  addIngBtn: {
    background: "#14532d", border: "1px solid #22c55e", borderRadius: 8,
    color: "#22c55e", fontSize: 14, padding: "10px 16px",
    cursor: "pointer", fontWeight: 600, flexShrink: 0,
  },
};
