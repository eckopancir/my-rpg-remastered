export const getSellPrice = (item: { price?: number; level?: number; quality?: string; quantity?: number }): number => {
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
