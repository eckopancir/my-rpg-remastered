import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { RECIPES, FOOD_MAP, maxPortionsFor, consumeOneSet, type RecipeDef } from '../../data/food';
import { makeConsumable } from '../../data/consumables';
import { removeItemFromGrid, tryInsertIntoGrid } from '../../data/backpacks';
import { playLoopSound, stopLoopSound } from '../../hooks/useSound';
import { syncNow } from '../../utils/serverSync';

const COOK_SLOTS = 4;
const SEC_PER_PORTION = 3;
const COOK_SOUND = 'c977168fcb66822';

export const CookingMenu = () => {
  const showCookingMenu = useCombatGridStore((s) => s.showCookingMenu);
  const setShowCookingMenu = useCombatGridStore((s) => s.setShowCookingMenu);
  const backpackItems = usePlayerStore((s) => s.backpackGrid.items);

  const [slots, setSlots] = useState<(string | null)[]>(Array(COOK_SLOTS).fill(null));
  const [cooked, setCooked] = useState<{ name: string; icon: string } | null>(null);
  // Мультиготовка: { recipeId, total, done, leftSec }.
  const [cooking, setCooking] = useState<{ recipeId: string; total: number; done: number; leftSec: number } | null>(null);
  const [portions, setPortions] = useState(1);

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

  /** Сколько полных наборов ингредиентов есть в рюкзаке. */
  const maxPortions = useMemo(() => {
    if (!matchedRecipe) return 0;
    return maxPortionsFor(matchedRecipe, backpackItems);
  }, [matchedRecipe, backpackItems]);

  useEffect(() => {
    setPortions((p) => Math.min(Math.max(1, p), Math.max(1, maxPortions)));
  }, [maxPortions]);

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
    if (!matchedRecipe || cooking) return;
    const n = Math.min(Math.max(1, portions), Math.max(1, maxPortions));
    if (n <= 0) return;
    setCooking({ recipeId: matchedRecipe.id, total: n, done: 0, leftSec: n * SEC_PER_PORTION });
    playLoopSound(COOK_SOUND, 0.5);
  };

  const cancelCooking = useCallback(() => {
    stopLoopSound(COOK_SOUND);
    setCooking(null);
  }, []);

  // Тиканье готовки: каждые 3с списываем 1 набор и выдаём 1 блюдо.
  useEffect(() => {
    if (!cooking) return;
    const iv = window.setInterval(() => {
      setCooking((prev) => {
        if (!prev) return prev;
        const left = prev.leftSec - 1;
        const shouldFinishPortion = (prev.total * SEC_PER_PORTION - left) % SEC_PER_PORTION === 0 || left <= 0;
        if (shouldFinishPortion) {
          const recipe = RECIPES.find((r) => r.id === prev.recipeId);
          if (recipe) {
            const pStore = usePlayerStore.getState();
            const grid = consumeOneSet(pStore.backpackGrid, recipe, removeItemFromGrid);
            const res = tryInsertIntoGrid(grid, makeConsumable(recipe.result.id, 1));
            usePlayerStore.setState({ backpackGrid: res.grid });
            if (!res.moved) {
              usePlayerStore.getState().addLog('❌ Рюкзак полон — блюдо потеряно!', 'warning');
            }
            syncNow();
            setCooked({ name: recipe.name, icon: recipe.icon });
            setTimeout(() => setCooked(null), 2000);
          }
        }
        if (left <= 0) {
          stopLoopSound(COOK_SOUND);
          setSlots(Array(COOK_SLOTS).fill(null));
          return null;
        }
        return { ...prev, done: prev.done + (shouldFinishPortion ? 1 : 0), leftSec: left };
      });
    }, 1000);
    return () => {
      window.clearInterval(iv);
      stopLoopSound(COOK_SOUND);
    };
  }, [cooking !== null]);

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

        {/* Cook button + portions */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {!cooking ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                <button
                  disabled={!matchedRecipe || portions <= 1}
                  onClick={() => setPortions((p) => Math.max(1, p - 1))}
                  style={{ width: 30, height: 30, background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: matchedRecipe && portions > 1 ? 'pointer' : 'default', opacity: matchedRecipe && portions > 1 ? 1 : 0.4, fontSize: 16, fontWeight: 700 }}
                >
                  −
                </button>
                <span style={{ fontSize: 14, fontWeight: 700, minWidth: 90 }}>
                  ×{matchedRecipe ? Math.min(portions, Math.max(1, maxPortions)) : portions} порц.
                </span>
                <button
                  disabled={!matchedRecipe || portions >= Math.max(1, maxPortions)}
                  onClick={() => setPortions((p) => Math.min(Math.max(1, maxPortions), p + 1))}
                  style={{ width: 30, height: 30, background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: matchedRecipe && portions < Math.max(1, maxPortions) ? 'pointer' : 'default', opacity: matchedRecipe && portions < Math.max(1, maxPortions) ? 1 : 0.4, fontSize: 16, fontWeight: 700 }}
                >
                  +
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
                {matchedRecipe ? `Хватит на ${maxPortions} порц. · ${SEC_PER_PORTION}с за порцию` : 'Выбери рецепт'}
              </div>
              <button disabled={!matchedRecipe || maxPortions <= 0} onClick={handleCook} style={{
                padding: '8px 24px', background: matchedRecipe && maxPortions > 0 ? '#e67e22' : '#333', color: '#fff', border: 'none', borderRadius: 8,
                cursor: matchedRecipe && maxPortions > 0 ? 'pointer' : 'default', fontSize: 14, fontWeight: 700,
              }}>Приготовить{matchedRecipe ? ` ×${Math.min(portions, Math.max(1, maxPortions))}` : ''}</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e67e22', marginBottom: 8 }}>
                🔥 Готовится {cooking.done + 1}/{cooking.total}… {cooking.leftSec}с
              </div>
              <div style={{ height: 10, background: '#333', borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  height: '100%', width: `${Math.round(((cooking.total * SEC_PER_PORTION - cooking.leftSec) / (cooking.total * SEC_PER_PORTION)) * 100)}%`,
                  background: 'linear-gradient(90deg, #e67e22, #f1c40f)', transition: 'width 1s linear',
                }} />
              </div>
              <button onClick={cancelCooking} style={{
                padding: '6px 18px', background: '#555', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12,
              }}>Отмена (готовое останется)</button>
            </>
          )}
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
