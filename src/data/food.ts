// ─── Food System ───────────────────────────────────────────────────────

export interface FoodDef {
  id: string;
  name: string;
  icon: string;
  healPct: number;      // HP % restored (0 = no heal)
  stamPct: number;      // stamina % restored (0 = none)
  price: number;         // base price
  desc: string;
  isRaw: boolean;       // true = needs cooking, false = eat directly
}

export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  result: FoodDef;
  healPct: number;
  ingredients: Array<{ foodId: string; qty: number }>;
  desc: string;
}

const F = (id: string, name: string, icon: string, healPct: number, price: number, desc: string, isRaw: boolean, stamPct = 0): FoodDef =>
  ({ id, name, icon, healPct, stamPct, price, desc, isRaw });

// ─── Raw food (needs cooking) ─────────────────────────────────────────
export const FOOD_MEAT = F('food_meat', 'Мясо', '🥩', 0, 150, 'Сырое мясо. Нужно приготовить.', true);
export const FOOD_POTATO = F('food_potato', 'Картошка', '🥔', 0, 25, 'Сырая картошка. Нужно приготовить.', true);
export const FOOD_WATER = F('food_water', 'Вода', '💧', 0, 15, 'Чистая вода. Используется для приготовления.', true);

// ─── Ready-to-eat food ────────────────────────────────────────────────
export const FOOD_SAUSAGE = F('food_sausage', 'Колбаса', '🌭', 2, 50, 'Восстанавливает 2% HP.', false);
export const FOOD_APPLE = F('food_apple', 'Яблоко', '🍎', 1, 20, 'Восстанавливает 1% HP.', false);
export const FOOD_STEW = F('food_stew', 'Тушёнка', '🥫', 3, 75, 'Восстанавливает 3% HP.', false);
export const FOOD_BREAD = F('food_bread', 'Хлеб', '🍞', 2, 30, 'Восстанавливает 2% HP.', false);

// ─── Cooked food (crafted from recipes) — цена = сумма ингредиентов ──
export const FOOD_BOILED_WATER = F('food_boiled_water', 'Кипяченая вода', '♨️', 1, 30, 'Вода × 2. Восстанавливает 1% HP.', false);
export const FOOD_RAGU = F('food_ragu', 'Рагу', '🍲', 12, 190, 'Картошка + вода + мясо. Восстанавливает 12% HP.', false);
export const FOOD_FRIED_MEAT = F('food_fried_meat', 'Жареное мясо', '🍖', 14, 300, 'Мясо × 2. Восстанавливает 14% HP.', false);
export const FOOD_BOILED_POTATO = F('food_boiled_potato', 'Варёная картошка', '🥔', 10, 40, 'Картошка + вода. Восстанавливает 10% HP.', false);
export const FOOD_SANDWICH = F('food_sandwich', 'Бутерброд', '🥪', 5, 80, 'Колбаса + хлеб. Восстанавливает 5% HP.', false);
export const FOOD_FRIED_POTATO = F('food_fried_potato', 'Жареная картошка', '🍟', 8, 50, 'Картошка × 2. Восстанавливает 8% HP.', false);

// ─── Еда на выносливость и полевая медицина (дорогие позиции базара) ──
export const FOOD_COFFEE = F('food_coffee', 'Кофе', '☕', 0, 150, 'Восстанавливает 3% выносливости.', false, 3);
export const FOOD_ENERGY = F('food_energy', 'Энергетик', '🧃', 0, 250, 'Восстанавливает 5% выносливости.', false, 5);
export const FOOD_ADRENALINE = F('food_adrenaline', 'Укол адреналина', '💉', 0, 800, 'Восстанавливает 10% выносливости. Дорогой.', false, 10);
export const FOOD_FIRSTAID = F('food_firstaid', 'Аптечка', '🩹', 25, 600, 'Восстанавливает 25% HP. Дорогая.', false);
export const FOOD_BANDAGE = F('food_bandage', 'Бинты', '🩼', 15, 450, 'Восстанавливают 15% HP. Дорогие.', false);

export const ALL_FOOD: FoodDef[] = [
  FOOD_MEAT, FOOD_POTATO, FOOD_WATER,
  FOOD_SAUSAGE, FOOD_APPLE, FOOD_STEW, FOOD_BREAD,
  FOOD_BOILED_WATER, FOOD_RAGU, FOOD_FRIED_MEAT, FOOD_BOILED_POTATO, FOOD_SANDWICH, FOOD_FRIED_POTATO,
  FOOD_COFFEE, FOOD_ENERGY, FOOD_ADRENALINE, FOOD_FIRSTAID, FOOD_BANDAGE,
];

export const FOOD_MAP: Record<string, FoodDef> = Object.fromEntries(ALL_FOOD.map((f) => [f.id, f]));

// ─── Recipes ──────────────────────────────────────────────────────────
export const RECIPES: RecipeDef[] = [
  {
    id: 'recipe_boiled_water', name: 'Кипяченая вода', icon: '♨️', result: FOOD_BOILED_WATER, healPct: 1,
    ingredients: [{ foodId: 'food_water', qty: 2 }],
    desc: 'Вода × 2 = Кипяченая вода (1% HP)',
  },
  {
    id: 'recipe_ragu', name: 'Рагу', icon: '🍲', result: FOOD_RAGU, healPct: 12,
    ingredients: [{ foodId: 'food_potato', qty: 1 }, { foodId: 'food_water', qty: 1 }, { foodId: 'food_meat', qty: 1 }],
    desc: 'Картошка + Вода + Мясо = Рагу (12% HP)',
  },
  {
    id: 'recipe_fried_meat', name: 'Жареное мясо', icon: '🍖', result: FOOD_FRIED_MEAT, healPct: 14,
    ingredients: [{ foodId: 'food_meat', qty: 2 }],
    desc: 'Мясо × 2 = Жареное мясо (14% HP)',
  },
  {
    id: 'recipe_boiled_potato', name: 'Варёная картошка', icon: '🥔', result: FOOD_BOILED_POTATO, healPct: 10,
    ingredients: [{ foodId: 'food_potato', qty: 1 }, { foodId: 'food_water', qty: 1 }],
    desc: 'Картошка + Вода = Варёная картошка (10% HP)',
  },
  {
    id: 'recipe_sandwich', name: 'Бутерброд', icon: '🥪', result: FOOD_SANDWICH, healPct: 5,
    ingredients: [{ foodId: 'food_sausage', qty: 1 }, { foodId: 'food_bread', qty: 1 }],
    desc: 'Колбаса + Хлеб = Бутерброд (5% HP)',
  },
  {
    id: 'recipe_fried_potato', name: 'Жареная картошка', icon: '🍟', result: FOOD_FRIED_POTATO, healPct: 8,
    ingredients: [{ foodId: 'food_potato', qty: 2 }],
    desc: 'Картошка × 2 = Жареная картошка (8% HP)',
  },
];

/** Сколько полных наборов рецепта есть в списке предметов (по quantity). */
export const maxPortionsFor = (
  recipe: RecipeDef,
  items: { abilityId?: string; quantity?: number }[],
): number => {
  const have: Record<string, number> = {};
  for (const it of items) {
    const aid = (it as any).abilityId as string;
    if (!aid) continue;
    have[aid] = (have[aid] || 0) + (((it as any).quantity ?? 1) as number);
  }
  let max = Infinity;
  for (const ing of recipe.ingredients) {
    max = Math.min(max, Math.floor((have[ing.foodId] || 0) / ing.qty));
  }
  return max === Infinity ? 0 : Math.max(0, max);
};

/** Списать 1 набор ингредиентов из сетки рюкзака (стаки декрементит). */
export const consumeOneSet = (grid: any, recipe: RecipeDef, removeFromGrid: (g: any, id: string) => any): any => {
  let g = grid;
  for (const ing of recipe.ingredients) {
    let remaining = ing.qty;
    for (const item of [...g.items]) {
      if (remaining <= 0) break;
      if ((item as any).abilityId === ing.foodId) {
        const qty = (item.quantity ?? 1) as number;
        const remove = Math.min(qty, remaining);
        if (remove >= qty) {
          g = removeFromGrid(g, item.id);
        } else {
          const items = g.items.map((i: any) => (i.id === item.id ? { ...i, quantity: qty - remove } : i));
          const cells = g.cells.map((row: any) => [...row]);
          g = { ...g, items, cells };
        }
        remaining -= remove;
      }
    }
  }
  return g;
};

/** Check if player has ingredients for a recipe in backpack */
export const hasIngredients = (backpackItems: any[], recipe: RecipeDef): boolean => {
  for (const ing of recipe.ingredients) {
    const count = backpackItems
      .filter((i: any) => (i as any).abilityId === ing.foodId)
      .reduce((sum: number, i: any) => sum + ((i.quantity ?? 1) as number), 0);
    if (count < ing.qty) return false;
  }
  return true;
};
