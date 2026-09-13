import { useCallback, useMemo, useState } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { RECIPES, FOOD_MAP, type RecipeDef } from '../../data/food';
import { makeConsumable } from '../../data/consumables';
import { removeItemFromGrid } from '../../data/backpacks';

const COOK_SLOTS = 4;

export const CookingMenu = () => {
  const showCookingMenu = useCombatGridStore((s) => s.showCookingMenu);
  const setShowCookingMenu = useCombatGridStore((s) => s.setShowCookingMenu);
  const backpackItems = usePlayerStore((s) => s.backpackGrid.items);

  const [slots, setSlots] = useState<(string | null)[]>(Array(COOK_SLOTS).fill(null));
  const [cooked, setCooked] = useState<{ name: string; icon: string } | null>(null);

  const rawItems = useMemo(() => {
    return backpackItems.filter((i) => {
      const fd = FOOD_MAP[(i as any).abilityId];
      return fd && fd.isRaw;
    });
  }, [backpackItems]);

  const findRecipe = useCallback((): RecipeDef | null => {
    const slotIds = slots.filter(Boolean) as string[];
    if (slotIds.length === 0) return null;
    for (const recipe of RECIPES) {
      if (slotIds.length !== recipe.ingredients.reduce((s, ing) => s + ing.qty, 0)) continue;
      const remaining = [...slotIds];
      let match = true;
      for (const ing of recipe.ingredients) {
        for (let q = 0; q < ing.qty; q++) {
          const idx = remaining.indexOf(ing.foodId);
          if (idx === -1) { match = false; break; }
          remaining.splice(idx, 1);
        }
        if (!match) break;
      }
      if (match && remaining.length === 0) return recipe;
    }
    return null;
  }, [slots]);

  const matchedRecipe = findRecipe();

  const handleSlotClick = (slotIndex: number) => {
    if (slots[slotIndex]) {
      setSlots((prev) => { const n = [...prev]; n[slotIndex] = null; return n; });
    }
  };

  const handleAddIngredient = (abilityId: string) => {
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx !== -1) {
      setSlots((prev) => { const n = [...prev]; n[emptyIdx] = abilityId; return n; });
    }
  };

  const handleCook = () => {
    if (!matchedRecipe) return;
    const pStore = usePlayerStore.getState();
    let grid = pStore.backpackGrid;
    // Remove ingredients from backpack grid
    for (const ing of matchedRecipe.ingredients) {
      let remaining = ing.qty;
      for (const item of [...grid.items]) {
        if (remaining <= 0) break;
        if ((item as any).abilityId === ing.foodId) {
          const qty = (item.quantity ?? 1) as number;
          const remove = Math.min(qty, remaining);
          if (remove >= qty) {
            grid = removeItemFromGrid(grid, item.id);
          }
          remaining -= remove;
        }
      }
    }
    // Add cooked item
    const cookedItem = makeConsumable(matchedRecipe.result.id, 1);
    usePlayerStore.setState({ backpackGrid: grid });
    pStore.putInBackpack(cookedItem);
    setSlots(Array(COOK_SLOTS).fill(null));
    setCooked({ name: matchedRecipe.name, icon: matchedRecipe.icon });
    setTimeout(() => setCooked(null), 2000);
  };

  if (!showCookingMenu) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={() => setShowCookingMenu(false)}>
      <div style={{
        background: '#1a1a2e', border: '2px solid #e67e22', borderRadius: 12, padding: 20, minWidth: 400, maxWidth: 500,
        color: '#eee', position: 'relative',
      }} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setShowCookingMenu(false)} style={{
          position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', color: '#999', fontSize: 20, cursor: 'pointer',
        }}>✕</button>
        <h3 style={{ margin: '0 0 12px', color: '#e67e22', textAlign: 'center' }}>🔥 Костёр — Готовка</h3>

        {/* Cooking slots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          {slots.map((s, i) => {
            const fd = s ? FOOD_MAP[s] : null;
            return (
              <div key={i} onClick={() => handleSlotClick(i)} style={{
                width: 56, height: 56, border: '2px dashed #555', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: fd ? '#2a2a4e' : 'transparent', cursor: fd ? 'pointer' : 'default', fontSize: 28,
              }}>
                {fd ? fd.icon : <span style={{ color: '#444', fontSize: 16 }}>+</span>}
              </div>
            );
          })}
        </div>

        {/* Matched recipe info */}
        {matchedRecipe ? (
          <div style={{ textAlign: 'center', marginBottom: 12, color: '#2ecc71' }}>
            {matchedRecipe.icon} {matchedRecipe.name} — {matchedRecipe.result.healPct}% HP
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 12, color: '#666' }}>Добавь ингредиенты</div>
        )}

        {/* Cook button */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button disabled={!matchedRecipe} onClick={handleCook} style={{
            padding: '8px 24px', background: matchedRecipe ? '#e67e22' : '#333', color: '#fff', border: 'none', borderRadius: 8,
            cursor: matchedRecipe ? 'pointer' : 'default', fontSize: 14, fontWeight: 700,
          }}>Приготовить</button>
        </div>

        {/* Cooked feedback */}
        {cooked && (
          <div style={{ textAlign: 'center', color: '#2ecc71', fontWeight: 700, marginBottom: 8 }}>
            ✅ {cooked.icon} {cooked.name} приготовлено!
          </div>
        )}

        {/* Raw ingredients from backpack */}
        <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Сырые продукты в рюкзаке:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {rawItems.length === 0 && <span style={{ color: '#555' }}>Нет сырых продуктов</span>}
            {rawItems.map((item) => {
              const fd = FOOD_MAP[(item as any).abilityId];
              const qty = (item.quantity ?? 1) as number;
              return (
                <div key={item.id} onClick={() => handleAddIngredient((item as any).abilityId)} title={fd?.desc} style={{
                  padding: '4px 8px', background: '#2a2a4e', border: '1px solid #444', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 18 }}>{fd?.icon}</span> {fd?.name} ×{qty}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recipes reference */}
        <div style={{ borderTop: '1px solid #333', paddingTop: 12, marginTop: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Рецепты:</div>
          {RECIPES.map((r) => (
            <div key={r.id} style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{r.desc}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
