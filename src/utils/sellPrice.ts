import { socketSlotsOf } from '../data/schematics';

/** Фикс цены продажи ресурсов для крафта (за шт, без мультипликаторов). */
export const CRAFT_MAT_SELL_PRICE: Record<string, number> = {
  'Металлолом': 1, 'Провода': 1, 'Порох': 1, 'Редкий сплав': 1,
  'Микросхема': 2, 'Хим. реагент': 2,
};

export const getSellPrice = (item: { price?: number; level?: number; quality?: string; quantity?: number; name?: string; type?: string }, rate = 0.4): number => {
  // Ресурсы крафта — фикс за штуку (иначе формула давала 8+ за единицу).
  if ((item as any).type === 'material' && item.name && CRAFT_MAT_SELL_PRICE[item.name] != null) {
    return CRAFT_MAT_SELL_PRICE[item.name] * (item.quantity || 1);
  }
  if (item.price) return Math.floor(item.price * rate);
  // Без цены — формула уже является ценой продажи при ставке 0.4,
  // поэтому нестандартную ставку (барон 0.8/1.0) масштабируем относительно неё.
  const rateMult = rate / 0.4;
  const qualityMultiplier =
    item.quality === 'Божественный' ? 12 :
    item.quality === 'Легендарный' ? 8 :
    item.quality === 'Смертоносный' ? 6 :
    item.quality === 'Эпический' ? 4 :
    item.quality === 'Раритетный' ? 2.5 :
    item.quality === 'Редкий' ? 1.5 : 1;
  // Оружие: учитываем редкость дефа и гнёзда под сферы.
  // Редкость: normal 1 / epic 1.6 / superepic 2.5.
  // Гнёзда: 0→0.4, 1→0.6, 2→1.0, 3→1.4, 4→1.9, 5→2.5.
  const slot = (item as any).slot || '';
  const isWeapon = slot === 'weapon1' || slot === 'weapon2' || slot.startsWith('gun_');
  let extraMult = 1;
  if (isWeapon) {
    const rarity = (item as any).rarity || 'normal';
    const rarityMult = rarity === 'superepic' ? 2.5 : rarity === 'epic' ? 1.6 : 1;
    const sockets = Math.max(0, Math.min(5, (item as any).socketSlots ?? socketSlotsOf(item as any) ?? 0));
    const socketMult = [0.4, 0.6, 1.0, 1.4, 1.9, 2.5][sockets] ?? 1;
    extraMult = rarityMult * socketMult;
  }
  return Math.floor(((item.level || 1) * 3 + 5) * qualityMultiplier * extraMult * (item.quantity || 1) * rateMult);
};
