import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, getMeta } from '../api';
import PickerModal from '../components/PickerModal';

const MONO = 'Courier New';

const STORE_CAT_COLORS: Record<string, string> = {
  'potraviny':  '#22c55e',
  'pekáreň':   '#f59e0b',
  'drogéria':  '#3b82f6',
  'domácnosť': '#a78bfa',
  'iné':       '#888888',
};

const TIER_COLORS: Record<string, string> = {
  'S+': '#f59e0b', 'S': '#fbbf24', 'A': '#22c55e',
  'B': '#3b82f6', 'C': '#a78bfa', 'D': '#ef4444',
};

interface ShoppingItem {
  id: number; name: string; quantity?: string;
  store_category?: string; pantry_item_id: number; category?: string;
}
interface PantryItem {
  id: number; name: string; category?: string; tier?: string | null;
}
interface RecipeIngredient {
  id: number; pantry_item_id: number; name: string; category?: string; quantity?: string;
}
interface Recipe {
  id: number; name: string; last_cooked?: string | null; ingredients: RecipeIngredient[];
}

type ActiveTab = 'pantry' | 'shop' | 'recipes';

function groupByStoreCategory(items: ShoppingItem[]): Record<string, ShoppingItem[]> {
  const groups: Record<string, ShoppingItem[]> = {};
  for (const item of items) {
    const cat = item.store_category || 'iné';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

function formatLastCooked(iso: string | null | undefined): string {
  if (!iso) return 'Nikdy uvarené';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Uvarené dnes';
  if (days === 1) return 'Uvarené včera';
  if (days < 30) return `Pred ${days} dňami`;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function nextTier(tiers: string[], current: string | null | undefined): string | null {
  if (!current) return tiers[0] ?? 'S+';
  const idx = tiers.indexOf(current);
  return idx === tiers.length - 1 ? null : tiers[idx + 1];
}

// ── Edit Modals ───────────────────────────────────────────────────────────────

function EditItemModal({ item, tiers, categories, onSave, onClose }: {
  item: PantryItem; tiers: string[]; categories: string[];
  onSave: (id: number, name: string, category: string, tier: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category || '');
  const [tier, setTier] = useState(item.tier || '');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={EM.overlay} activeOpacity={1} onPress={onClose}>
        <View style={EM.modal}>
          <View style={EM.header}>
            <Text style={EM.title}>Upraviť potravinu</Text>
            <TouchableOpacity onPress={onClose}><Text style={EM.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <Text style={EM.label}>Názov</Text>
          <TextInput style={EM.input} value={name} onChangeText={setName} autoFocus />

          <Text style={EM.label}>Kategória</Text>
          <PickerModal
            value={category}
            options={categories.map(c => ({ label: c, value: c }))}
            onChange={setCategory}
            placeholder="— žiadna —"
            style={EM.input}
          />

          <Text style={[EM.label, { marginTop: 14 }]}>Tier</Text>
          <View style={EM.tierRow}>
            {['', ...tiers].map(t => {
              const color = t ? TIER_COLORS[t] : null;
              const active = tier === t;
              return (
                <TouchableOpacity
                  key={t || 'none'}
                  style={[EM.tierOpt, {
                    backgroundColor: active ? (color ? color + '30' : '#2a2a2a') : 'transparent',
                    borderColor: active ? (color ?? '#555') : '#333',
                  }]}
                  onPress={() => setTier(t)}
                >
                  <Text style={[EM.tierOptText, { color: active ? (color ?? '#777') : '#444' }]}>
                    {t || '—'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[EM.saveBtn, !name.trim() && { opacity: 0.4 }]}
            onPress={() => onSave(item.id, name.trim(), category, tier)}
            disabled={!name.trim()}
          >
            <Text style={EM.saveBtnText}>Uložiť</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function AddShopModal({ storeCategories, onAdd, onClose }: {
  storeCategories: string[];
  onAdd: (name: string, quantity: string, storeCategory: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [storeCat, setStoreCat] = useState('potraviny');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={EM.overlay} activeOpacity={1} onPress={onClose}>
        <View style={EM.modal}>
          <View style={EM.header}>
            <Text style={EM.title}>Pridať do nákupu</Text>
            <TouchableOpacity onPress={onClose}><Text style={EM.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <Text style={EM.label}>Názov</Text>
          <TextInput style={EM.input} value={name} onChangeText={setName} autoFocus placeholder="napr. Banán" placeholderTextColor="#333" />

          <Text style={EM.label}>Množstvo</Text>
          <TextInput style={EM.input} value={quantity} onChangeText={setQuantity} placeholder="napr. 2x, 1L..." placeholderTextColor="#333" />

          <Text style={[EM.label, { marginTop: 14 }]}>Kategória obchodu</Text>
          <PickerModal
            value={storeCat}
            options={storeCategories.map(c => ({ label: c, value: c }))}
            onChange={setStoreCat}
            style={EM.input}
          />

          <TouchableOpacity
            style={[EM.saveBtn, !name.trim() && { opacity: 0.4 }]}
            onPress={() => onAdd(name.trim(), quantity, storeCat)}
            disabled={!name.trim()}
          >
            <Text style={EM.saveBtnText}>Pridať</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function EditShopModal({ item, storeCategories, onSave, onClose }: {
  item: ShoppingItem; storeCategories: string[];
  onSave: (id: number, storeCategory: string, quantity: string, name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity || '');
  const [storeCat, setStoreCat] = useState(item.store_category || 'potraviny');
  const isManual = item.pantry_item_id === 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={EM.overlay} activeOpacity={1} onPress={onClose}>
        <View style={EM.modal}>
          <View style={EM.header}>
            <Text style={EM.title}>Upraviť položku</Text>
            <TouchableOpacity onPress={onClose}><Text style={EM.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <Text style={EM.label}>Názov</Text>
          {isManual
            ? <TextInput style={EM.input} value={name} onChangeText={setName} />
            : <View style={[EM.input, { justifyContent: 'center' }]}><Text style={{ color: '#555' }}>{item.name}</Text></View>
          }

          <Text style={EM.label}>Množstvo</Text>
          <TextInput style={EM.input} value={quantity} onChangeText={setQuantity} />

          <Text style={[EM.label, { marginTop: 14 }]}>Kategória obchodu</Text>
          <PickerModal
            value={storeCat}
            options={storeCategories.map(c => ({ label: c, value: c }))}
            onChange={setStoreCat}
            style={EM.input}
          />

          <TouchableOpacity style={EM.saveBtn} onPress={() => onSave(item.id, storeCat, quantity, isManual ? name.trim() : item.name)}>
            <Text style={EM.saveBtnText}>Uložiť</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const EM = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, width: '100%', paddingBottom: 40,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  title: { fontSize: 14, fontWeight: '600', color: '#e0e0e0', fontFamily: MONO },
  closeBtn: { color: '#444', fontSize: 18, padding: 4 },
  label: {
    fontSize: 10, color: '#555', textTransform: 'uppercase',
    letterSpacing: 2, fontFamily: MONO, marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 7, paddingHorizontal: 12, paddingVertical: 10,
    color: '#e0e0e0', fontSize: 14, marginBottom: 14,
  },
  tierRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
  tierOpt: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  tierOptText: { fontSize: 12, fontFamily: MONO, fontWeight: '700' },
  saveBtn: {
    borderWidth: 1, borderColor: '#22c55e44', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', marginTop: 6,
  },
  saveBtnText: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
});

// ── Recipe Detail View ────────────────────────────────────────────────────────

function RecipeDetail({ recipe, items, shoppingIds, onBack, onDelete, onCook, onAddIngredient, onRemoveIngredient, onUpdateIngredientQty }: {
  recipe: Recipe;
  items: PantryItem[];
  shoppingIds: Set<number>;
  onBack: () => void;
  onDelete: () => void;
  onCook: () => void;
  onAddIngredient: (pantryItemId: number, quantity: string) => void;
  onRemoveIngredient: (id: number) => void;
  onUpdateIngredientQty: (id: number, quantity: string) => void;
}) {
  const [addIngValue, setAddIngValue] = useState('');
  const [addIngQty, setAddIngQty] = useState('');
  const [ingQuantities, setIngQuantities] = useState<Record<number, string>>(
    Object.fromEntries(recipe.ingredients.map(i => [i.id, i.quantity || '']))
  );
  const neverCooked = !recipe.last_cooked;
  const usedIds = new Set(recipe.ingredients.map(i => i.pantry_item_id));
  const availableItems = items.filter(i => !usedIds.has(i.id));

  useEffect(() => {
    setIngQuantities(Object.fromEntries(recipe.ingredients.map(i => [i.id, i.quantity || ''])));
  }, [recipe.ingredients]);

  return (
    <ScrollView contentContainerStyle={S.container} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={onBack}>
          <Text style={{ color: '#22c55e', fontSize: 18 }}>‹</Text>
          <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '600' }}>Recepty</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.deleteRecipeBtn} onPress={onDelete}>
          <Text style={{ color: '#7f1d1d', fontSize: 12 }}>Vymazať</Text>
        </TouchableOpacity>
      </View>

      <Text style={S.detailTitle}>{recipe.name}</Text>

      <View style={S.detailMeta}>
        <Text style={[S.detailLastCooked, { color: neverCooked ? '#f97316' : '#666' }]}>
          {formatLastCooked(recipe.last_cooked)}
        </Text>
        <TouchableOpacity style={S.cookBtnLg} onPress={onCook}>
          <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '600' }}>✓ Uvarené dnes</Text>
        </TouchableOpacity>
      </View>

      <Text style={S.sectionLabel}>Ingrediencie</Text>
      {recipe.ingredients.length === 0 ? (
        <Text style={S.emptyState}>Žiadne ingrediencie — pridaj z kuchyne</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {recipe.ingredients.map(ing => {
            const inCart = shoppingIds.has(ing.pantry_item_id);
            return (
              <View key={ing.id} style={[S.ingCard, { opacity: inCart ? 0.5 : 1 }]}>
                <Text style={S.ingCardName}>{ing.name}</Text>
                {!!ing.category && <Text style={S.ingCardCategory}>{ing.category}</Text>}
                <TextInput
                  style={S.ingQuantityInput}
                  placeholder="množstvo..."
                  placeholderTextColor="#444"
                  value={ingQuantities[ing.id] ?? ''}
                  onChangeText={v => setIngQuantities(prev => ({ ...prev, [ing.id]: v }))}
                  onBlur={() => onUpdateIngredientQty(ing.id, ingQuantities[ing.id] ?? '')}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[S.ingCartBtn, inCart && S.ingCartBtnDone]}
                  onPress={() => !inCart && onAddIngredient(ing.pantry_item_id, ingQuantities[ing.id] ?? ing.quantity ?? '')}
                  disabled={inCart}
                >
                  <Text style={{ color: inCart ? '#555' : '#22c55e', fontSize: 11, fontWeight: '600' }}>
                    {inCart ? '✓ V košíku' : '+ Do košíka'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.ingRemoveBtn} onPress={() => onRemoveIngredient(ing.id)}>
                  <Text style={{ color: '#555', fontSize: 14 }}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <Text style={S.sectionLabel}>Pridaj ingredienciu</Text>
      {items.length === 0 ? (
        <Text style={S.addIngHint}>Najprv pridaj potraviny v sekcii Kuchyňa</Text>
      ) : availableItems.length === 0 ? (
        <Text style={S.addIngHint}>Všetky potraviny z kuchyne sú už v recepte</Text>
      ) : (
        <View style={{ gap: 8, marginBottom: 24 }}>
          <PickerModal
            value={addIngValue}
            options={availableItems.map(i => ({ label: i.name + (i.category ? ` (${i.category})` : ''), value: String(i.id) }))}
            onChange={setAddIngValue}
            placeholder="— vyber z kuchyne —"
          />
          <TextInput
            style={S.input}
            placeholder="Množstvo"
            placeholderTextColor="#333"
            value={addIngQty}
            onChangeText={setAddIngQty}
          />
          <TouchableOpacity
            style={[S.addIngBtn, !addIngValue && { opacity: 0.4 }]}
            onPress={() => { if (addIngValue) { onAddIngredient(Number(addIngValue), addIngQty); setAddIngValue(''); setAddIngQty(''); } }}
            disabled={!addIngValue}
          >
            <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '600' }}>Pridaj</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ── PantryScreen ──────────────────────────────────────────────────────────────

interface Props {
  activeTab: ActiveTab;
}

export default function PantryScreen({ activeTab }: Props) {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newTier, setNewTier] = useState('');
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<string[]>(['S+','S','A','B','C','D']);
  const [categories, setCategories] = useState<string[]>([]);
  const [storeCategories, setStoreCategories] = useState<string[]>(['potraviny','pekáreň','drogéria','domácnosť','iné']);
  const [addShopOpen, setAddShopOpen] = useState(false);
  const [editShopItem, setEditShopItem] = useState<ShoppingItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [recipeToast, setRecipeToast] = useState<{ msg: string; onUndo?: (() => void) | null } | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }
  function showRecipeToast(msg: string, onUndo: (() => void) | null = null) {
    setRecipeToast({ msg, onUndo });
    if (!onUndo) setTimeout(() => setRecipeToast(null), 2500);
  }

  const loadAll = useCallback(async () => {
    try {
      const [pantryRes, shopRes, recipesRes, meta] = await Promise.all([
        api.pantry.list(), api.shopping.list(), api.recipes.list(), getMeta(),
      ]);
      const [pantryData, shopData, recipesData] = await Promise.all([
        pantryRes!.json(), shopRes!.json(), recipesRes!.json(),
      ]);
      setItems(Array.isArray(pantryData) ? pantryData : []);
      setShopping(Array.isArray(shopData) ? shopData : []);
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
      if (Array.isArray(meta?.tiers)) setTiers(meta.tiers);
      if (Array.isArray(meta?.pantry_categories)) setCategories(meta.pantry_categories);
      if (Array.isArray(meta?.store_categories)) setStoreCategories(meta.store_categories);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Keep selectedRecipe in sync
  useEffect(() => {
    if (selectedRecipe) {
      const updated = recipes.find(r => r.id === selectedRecipe.id);
      if (updated) setSelectedRecipe(updated);
    }
  }, [recipes]);

  // Close recipe detail on tab change
  useEffect(() => { setSelectedRecipe(null); }, [activeTab]);

  async function addItem() {
    const name = newName.trim();
    if (!name) return;
    const res = await api.pantry.add(name, newCategory, newTier || null);
    if (res?.ok) {
      const item = await res.json();
      setItems(prev => [...prev, item]);
      setNewName(''); setNewCategory(''); setNewTier('');
    }
  }

  async function saveEdit(id: number, name: string, category: string, tier: string) {
    const res = await api.pantry.update(id, name, category, tier || null);
    if (res && (res.ok || res.status === 204)) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, name, category, tier: tier || null } : i));
      setEditItem(null);
    }
  }

  async function deletePantryItem(id: number) {
    setDeleteError(null);
    const res = await api.pantry.delete(id);
    if (res && (res.ok || res.status === 204)) {
      setItems(prev => prev.filter(i => i.id !== id));
      setShopping(prev => prev.filter(s => s.pantry_item_id !== id));
    } else if (res?.status === 409) {
      const data = await res.json();
      setDeleteError(data.error || 'Potravina sa používa v recepte');
      setTimeout(() => setDeleteError(null), 4000);
    }
  }

  async function addToShopping(pantryItem: Pick<PantryItem, 'id' | 'name'>, quantity = '') {
    const res = await api.shopping.add(pantryItem.id, quantity);
    if (res && (res.ok || res.status === 204)) {
      const shopRes = await api.shopping.list();
      const shopData = await shopRes!.json();
      setShopping(Array.isArray(shopData) ? shopData : []);
      showToast(`${pantryItem.name} pridané do nákupu`);
    }
  }

  async function addManualShoppingItem(name: string, quantity: string, storeCategory: string) {
    const res = await api.shopping.addManual(name, quantity, storeCategory);
    if (res && (res.ok || res.status === 204)) {
      const shopRes = await api.shopping.list();
      const shopData = await shopRes!.json();
      setShopping(Array.isArray(shopData) ? shopData : []);
      setAddShopOpen(false);
    }
  }

  async function saveShopEdit(id: number, storeCategory: string, quantity: string, name: string) {
    const res = await api.shopping.update(id, storeCategory, quantity, name);
    if (res && (res.ok || res.status === 204)) {
      setShopping(prev => prev.map(s => s.id === id ? { ...s, store_category: storeCategory, quantity, name: s.pantry_item_id === 0 ? name : s.name } : s));
      setEditShopItem(null);
    }
  }

  async function removeFromShopping(id: number) {
    const item = shopping.find(s => s.id === id);
    const res = await api.shopping.remove(id);
    if (res && (res.ok || res.status === 204)) {
      setShopping(prev => prev.filter(s => s.id !== id));
      showToast(`${item?.name ?? 'Položka'} zakúpená`);
    }
  }

  async function addRecipe() {
    const name = newRecipeName.trim();
    if (!name) return;
    const res = await api.recipes.add(name);
    if (res?.ok) {
      const recipe = await res.json();
      setRecipes(prev => [...prev, recipe]);
      setNewRecipeName('');
      showRecipeToast('Recept pridaný');
    }
  }

  async function deleteRecipe(id: number) {
    const res = await api.recipes.delete(id);
    if (res && (res.ok || res.status === 204)) {
      setRecipes(prev => prev.filter(r => r.id !== id));
      if (selectedRecipe?.id === id) setSelectedRecipe(null);
    }
  }

  async function addIngredient(pantryItemId: number, quantity: string) {
    if (!selectedRecipe) return;
    const res = await api.recipes.addIngredient(selectedRecipe.id, pantryItemId, quantity);
    if (res && (res.ok || res.status === 204)) {
      const r2 = await api.recipes.list();
      const d2 = await r2!.json();
      setRecipes(Array.isArray(d2) ? d2 : []);
      showRecipeToast('Ingrediencia pridaná');
    }
  }

  async function removeIngredient(ingredientId: number) {
    const res = await api.recipes.removeIngredient(ingredientId);
    if (res && (res.ok || res.status === 204)) {
      setRecipes(prev => prev.map(r => ({ ...r, ingredients: r.ingredients.filter(i => i.id !== ingredientId) })));
      showRecipeToast('Ingrediencia odstránená');
    }
  }

  async function updateIngredientQty(id: number, quantity: string) {
    await api.recipes.updateIngredient(id, quantity);
    const r = await api.recipes.list();
    const d = await r!.json();
    setRecipes(Array.isArray(d) ? d : []);
  }

  async function cookRecipe(recipeId: number) {
    const res = await api.recipes.cook(recipeId);
    if (res && (res.ok || res.status === 204)) {
      const r = await api.recipes.list();
      const d = await r!.json();
      setRecipes(Array.isArray(d) ? d : []);
      showRecipeToast('Uvarené dnes', async () => {
        setRecipeToast(null);
        await api.recipes.uncook(recipeId);
        const r2 = await api.recipes.list();
        const d2 = await r2!.json();
        setRecipes(Array.isArray(d2) ? d2 : []);
      });
    }
  }

  const shoppingIds = new Set(shopping.map(s => s.pantry_item_id));

  if (loading) {
    return (
      <SafeAreaView style={S.page} edges={['top']}>
        <ActivityIndicator color="#22c55e" size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  // Recipe detail
  if (activeTab === 'recipes' && selectedRecipe) {
    return (
      <SafeAreaView style={S.page} edges={['top']}>
        <RecipeDetail
          recipe={selectedRecipe}
          items={items}
          shoppingIds={shoppingIds}
          onBack={() => setSelectedRecipe(null)}
          onDelete={() => deleteRecipe(selectedRecipe.id)}
          onCook={() => cookRecipe(selectedRecipe.id)}
          onAddIngredient={(pid, qty) => addIngredient(pid, qty)}
          onRemoveIngredient={removeIngredient}
          onUpdateIngredientQty={updateIngredientQty}
        />
        {recipeToast && (
          <View style={S.toast}>
            <Text style={S.toastText}>{recipeToast.msg}</Text>
            {recipeToast.onUndo && (
              <TouchableOpacity style={S.undoBtn} onPress={recipeToast.onUndo}>
                <Text style={{ color: '#22c55e', fontSize: 11, fontFamily: MONO }}>Undo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.page} edges={['top']}>
      {editItem && (
        <EditItemModal item={editItem} tiers={tiers} categories={categories} onSave={saveEdit} onClose={() => setEditItem(null)} />
      )}
      {addShopOpen && (
        <AddShopModal storeCategories={storeCategories} onAdd={addManualShoppingItem} onClose={() => setAddShopOpen(false)} />
      )}
      {editShopItem && (
        <EditShopModal item={editShopItem} storeCategories={storeCategories} onSave={saveShopEdit} onClose={() => setEditShopItem(null)} />
      )}

      <ScrollView contentContainerStyle={S.container} showsVerticalScrollIndicator={false}>
        <View style={S.header}>
          <Text style={S.appTitle}>
            {{ pantry: 'KUCHYŇA', shop: 'NÁKUP', recipes: 'RECEPTY' }[activeTab]}
          </Text>
        </View>

        {/* ── Kuchyňa ── */}
        {activeTab === 'pantry' && (
          <>
            <View style={S.addCard}>
              <TextInput
                style={[S.input, { flex: 1 }]}
                placeholder="napr. Banán"
                placeholderTextColor="#333"
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={addItem}
                returnKeyType="done"
              />
              <PickerModal
                value={newCategory}
                options={categories.map(c => ({ label: c, value: c }))}
                onChange={setNewCategory}
                placeholder="Kategória"
                style={{ flex: 1 }}
              />
              <PickerModal
                value={newTier}
                options={tiers.map(t => ({ label: t, value: t }))}
                onChange={setNewTier}
                placeholder="Tier"
                style={{ width: 80 }}
              />
              <TouchableOpacity style={S.addBtn} onPress={addItem}>
                <Text style={{ color: '#22c55e', fontSize: 22 }}>+</Text>
              </TouchableOpacity>
            </View>

            {!!deleteError && (
              <View style={S.deleteError}><Text style={{ color: '#ef4444', fontSize: 12, fontFamily: MONO }}>{deleteError}</Text></View>
            )}
            {!!toast && (
              <View style={S.toastGreen}><Text style={{ color: '#22c55e', fontSize: 12, fontFamily: MONO }}>✓ {toast}</Text></View>
            )}

            {items.length === 0 ? (
              <Text style={S.emptyState}>Kuchyňa je prázdna</Text>
            ) : (
              <View style={S.card}>
                {items.map(item => {
                  const inCart = shoppingIds.has(item.id);
                  const tierColor = item.tier ? TIER_COLORS[item.tier] : null;
                  return (
                    <View key={item.id} style={S.itemRow}>
                      <View style={[S.tierBadge, {
                        backgroundColor: tierColor ? tierColor + '25' : 'transparent',
                        borderColor: tierColor ?? '#333',
                      }]}>
                        <Text style={[S.tierBadgeText, { color: tierColor ?? '#555' }]}>{item.tier || '·'}</Text>
                      </View>
                      <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => setEditItem({ ...item })}>
                        <Text style={[S.itemName, { color: inCart ? '#555' : '#e0e0e0' }]}>{item.name}</Text>
                        {!!item.category && <Text style={S.categoryTag}>{item.category}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[S.cartBtn, { opacity: inCart ? 0.4 : 1 }]}
                        onPress={() => !inCart && addToShopping(item)}
                        disabled={inCart}
                      >
                        <Text style={{ color: '#22c55e', fontSize: 16 }}>{inCart ? '✓' : '+'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={S.deleteBtn} onPress={() => deletePantryItem(item.id)}>
                        <Text style={{ color: '#555', fontSize: 16 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── Nákup ── */}
        {activeTab === 'shop' && (
          <>
            {!!toast && (
              <View style={S.toastGreen}><Text style={{ color: '#22c55e', fontSize: 12, fontFamily: MONO }}>✓ {toast}</Text></View>
            )}
            <TouchableOpacity style={S.addShopBtn} onPress={() => setAddShopOpen(true)}>
              <Text style={{ color: '#444', fontSize: 13, fontFamily: MONO, letterSpacing: 1 }}>+ Pridať položku</Text>
            </TouchableOpacity>

            {shopping.length === 0 ? (
              <Text style={S.emptyState}>Nič nekupuješ</Text>
            ) : (
              Object.entries(groupByStoreCategory(shopping)).map(([cat, catItems]) => {
                const color = STORE_CAT_COLORS[cat] || '#888';
                return (
                  <View key={cat} style={[S.stickyNote, { borderLeftColor: color }]}>
                    <View style={S.stickyHeader}>
                      <Text style={[S.stickyCat, { color }]}>{cat.toUpperCase()}</Text>
                      <Text style={[S.stickyCount, { color }]}>{catItems.length}</Text>
                    </View>
                    {catItems.map(item => (
                      <View key={item.id} style={S.stickyItem}>
                        <TouchableOpacity style={S.stickyItemMain} onPress={() => removeFromShopping(item.id)}>
                          <View style={S.checkBox} />
                          <View style={{ flex: 1 }}>
                            <Text style={S.stickyItemName}>{item.name}</Text>
                            {!!item.quantity && <Text style={[S.stickyQty, { color }]}>{item.quantity}</Text>}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={S.editShopBtn} onPress={() => setEditShopItem(item)}>
                          <Text style={{ color: '#444', fontSize: 16 }}>✎</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── Recepty ── */}
        {activeTab === 'recipes' && (
          <>
            {recipeToast && (
              <View style={S.toast}>
                <Text style={S.toastText}>{recipeToast.msg}</Text>
                {recipeToast.onUndo && (
                  <TouchableOpacity style={S.undoBtn} onPress={recipeToast.onUndo}>
                    <Text style={{ color: '#22c55e', fontSize: 11, fontFamily: MONO }}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TextInput
                style={[S.input, { flex: 1 }]}
                placeholder="Názov receptu..."
                placeholderTextColor="#333"
                value={newRecipeName}
                onChangeText={setNewRecipeName}
                onSubmitEditing={addRecipe}
                returnKeyType="done"
              />
              <TouchableOpacity style={S.addBtn} onPress={addRecipe}>
                <Text style={{ color: '#22c55e', fontSize: 22 }}>+</Text>
              </TouchableOpacity>
            </View>

            {recipes.length === 0 ? (
              <Text style={S.emptyState}>Žiadne recepty</Text>
            ) : (
              <View style={S.card}>
                {recipes.map(recipe => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={S.itemRow}
                    onPress={() => setSelectedRecipe(recipe)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={S.itemName}>{recipe.name}</Text>
                      <Text style={[S.lastCookedChip, { color: recipe.last_cooked ? '#666' : '#f97316' }]}>
                        {formatLastCooked(recipe.last_cooked)}
                      </Text>
                    </View>
                    <Text style={S.ingCount}>
                      {recipe.ingredients.length > 0 ? `${recipe.ingredients.length} ing.` : '—'}
                    </Text>
                    <Text style={{ color: '#444', fontSize: 18 }}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {activeTab !== 'recipes' && !!toast && (
        <View style={S.toastFixed} pointerEvents="none">
          <Text style={S.toastText}>✓ {toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1a1a1a' },
  container: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appTitle: { fontSize: 24, fontWeight: '700', letterSpacing: 4, fontFamily: MONO, color: '#e0e0e0' },

  addCard: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' },
  input: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#444',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: '#e0e0e0', fontSize: 14,
  },
  addBtn: {
    backgroundColor: '#14532d', borderWidth: 1, borderColor: '#22c55e',
    borderRadius: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },

  card: { backgroundColor: '#242424', borderRadius: 10, borderWidth: 1, borderColor: '#333', overflow: 'hidden', marginBottom: 14 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  itemName: { fontSize: 15, fontWeight: '500', color: '#e0e0e0' },
  categoryTag: {
    fontSize: 11, color: '#555', backgroundColor: '#2a2a2a', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, fontFamily: MONO,
    textTransform: 'uppercase', marginTop: 2,
  },
  tierBadge: {
    borderWidth: 1, borderRadius: 5, width: 34, height: 26,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tierBadgeText: { fontSize: 11, fontFamily: MONO, fontWeight: '700' },
  cartBtn: {
    backgroundColor: '#1e2a1e', borderWidth: 1, borderColor: '#22c55e',
    borderRadius: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  deleteBtn: {
    borderWidth: 1, borderColor: '#333', borderRadius: 6,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  emptyState: { textAlign: 'center', color: '#555', fontSize: 15, paddingVertical: 40 },
  deleteError: {
    backgroundColor: '#1a0a0a', borderWidth: 1, borderColor: '#3a1010',
    borderRadius: 7, padding: 10, marginBottom: 10,
  },
  toastGreen: {
    backgroundColor: '#0a1a0a', borderWidth: 1, borderColor: '#22c55e22',
    borderRadius: 7, padding: 10, marginBottom: 10,
  },

  // Shopping
  addShopBtn: {
    width: '100%', marginBottom: 14,
    borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 11, alignItems: 'center',
  },
  stickyNote: {
    backgroundColor: '#1c1c1c', borderWidth: 1, borderColor: '#2a2a2a',
    borderLeftWidth: 3, borderRadius: 10, marginBottom: 14, overflow: 'hidden',
  },
  stickyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222',
  },
  stickyCat: { fontSize: 10, fontWeight: '700', fontFamily: MONO, letterSpacing: 2 },
  stickyCount: { fontSize: 10, fontFamily: MONO, fontWeight: '600', opacity: 0.6 },
  stickyItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  stickyItemMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingHorizontal: 14, paddingVertical: 11 },
  checkBox: { width: 16, height: 16, borderWidth: 1.5, borderColor: '#333', borderRadius: 4 },
  stickyItemName: { fontSize: 14, color: '#d0d0d0' },
  stickyQty: { fontSize: 11, fontFamily: MONO, fontWeight: '600', marginTop: 2 },
  editShopBtn: { padding: 11 },

  // Recipes
  lastCookedChip: { fontSize: 11, fontFamily: MONO, marginTop: 2 },
  ingCount: { fontSize: 12, color: '#555', fontFamily: MONO, flexShrink: 0 },

  // Recipe detail
  sectionLabel: {
    fontSize: 11, color: '#555', textTransform: 'uppercase',
    letterSpacing: 2, fontFamily: MONO, marginBottom: 10,
  },
  deleteRecipeBtn: { borderWidth: 1, borderColor: '#3a1a1a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  detailTitle: { fontSize: 26, fontWeight: '700', color: '#e0e0e0', marginBottom: 16, lineHeight: 32 },
  detailMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 10, marginBottom: 28,
    padding: 14, backgroundColor: '#242424', borderWidth: 1, borderColor: '#333', borderRadius: 10,
  },
  detailLastCooked: { fontSize: 13, fontFamily: MONO },
  cookBtnLg: {
    backgroundColor: '#14532d', borderWidth: 1, borderColor: '#22c55e',
    borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9,
  },
  ingCard: {
    backgroundColor: '#242424', borderWidth: 1, borderColor: '#333',
    borderRadius: 10, padding: 12, gap: 6, width: '47%',
  },
  ingCardName: { fontSize: 14, fontWeight: '600', color: '#e0e0e0' },
  ingCardCategory: {
    fontSize: 10, color: '#555', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: 1,
  },
  ingQuantityInput: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333',
    borderRadius: 6, color: '#22c55e', fontSize: 12, fontFamily: MONO,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  ingCartBtn: {
    backgroundColor: '#1e2a1e', borderWidth: 1, borderColor: '#22c55e',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center',
  },
  ingCartBtnDone: { backgroundColor: '#1a1a1a', borderColor: '#333' },
  ingRemoveBtn: {
    borderWidth: 1, borderColor: '#333', borderRadius: 5,
    paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center',
  },
  addIngHint: { fontSize: 13, color: '#555', paddingVertical: 10 },
  addIngBtn: {
    backgroundColor: '#14532d', borderWidth: 1, borderColor: '#22c55e',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },

  // Toasts
  toast: {
    position: 'absolute', bottom: 12, left: 16, right: 16,
    backgroundColor: '#0a1a0a', borderWidth: 1, borderColor: '#22c55e22',
    borderRadius: 7, paddingHorizontal: 14, paddingVertical: 9,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  toastFixed: {
    position: 'absolute', bottom: 28, left: 0, right: 0,
    alignItems: 'center', pointerEvents: 'none' as any,
  },
  toastText: { fontSize: 12, color: '#22c55e', fontFamily: MONO, letterSpacing: 1 },
  undoBtn: { borderWidth: 1, borderColor: '#22c55e44', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 3 },
});
