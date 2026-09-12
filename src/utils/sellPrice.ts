/** Фикс цены продажи ресурсов для крафта (за шт, без мультипликаторов). */
export const CRAFT_MAT_SELL_PRICE: Record<string, number> = {
  'Металлолом': 1, 'Провода': 1, 'Порох': 1, 'Редкий сплав': 1,
  'Микросхема': 2, 'Хим. реагент': 2,
};

export const getSellPrice = (item: { price?: number; level?: number; quality?: string; quantity?: number; name?: string; type?: string }): number => {
  // Ресурсы крафта — фикс за штуку (иначе формула давала 8+ за единицу).
  if ((item as any).type === 'material' && item.name && CRAFT_MAT_SELL_PRICE[item.name] != null) {
    return CRAFT_MAT_SELL_PRICE[item.name] * (item.quantity || 1);
  }
  if (item.price) return Math.floor(item.price * 0.4);
  const qualityMultiplier =
    item.quality === 'Божественный' ? 12 :
    item.quality === 'Легендарный' ? 8 :
    item.quality === 'Смертоносный' ? 6 :
    item.quality === 'Эпический' ? 4 :
    item.quality === 'Раритетный' ? 2.5 :
    item.quality === 'Редкий' ? 1.5 : 1;
  return Math.floor(((item.level || 1) * 3 + 5) * qualityMultiplier * (item.quantity || 1));
};
