/** Наёмники данжа: HP и броня по звёздам. Атаки у них нет — только «губки». */

export type MercRole = 'tank' | 'medic' | 'mechanic';
export type Slot = 'front1' | 'front2' | 'back1' | 'back2';

export const SLOTS: Slot[] = ['front1', 'front2', 'back1', 'back2'];

export const SLOT_LABEL: Record<Slot, string> = {
  front1: 'Перед 1',
  front2: 'Перед 2',
  back1: 'Зад 1',
  back2: 'Зад 2',
};

export const ROLE_ICON: Record<MercRole, string> = {
  tank: '🛡️',
  medic: '💉',
  mechanic: '🔧',
};

export const ROLE_NAME: Record<MercRole, string> = {
  tank: 'Танк',
  medic: 'Медик',
  mechanic: 'Техник',
};

export const ROLE_COLOR: Record<MercRole, string> = {
  tank: '#60a5fa',
  medic: '#4ade80',
  mechanic: '#fbbf24',
};

export interface MercStats {
  maxHp: number;
  maxArmor: number;
}

/** Броня восстанавливается до максимума в конце каждого хода. */
export const mercStats = (role: MercRole, stars: number): MercStats => {
  const s = Math.max(1, Math.min(5, Math.round(stars || 1)));
  if (role === 'tank') return { maxHp: 110 + 75 * (s - 1), maxArmor: 6 + 4 * (s - 1) };
  if (role === 'medic') return { maxHp: 80 + 50 * (s - 1), maxArmor: 3 + 3 * (s - 1) };
  return { maxHp: 65 + 45 * (s - 1), maxArmor: 2 + 2 * (s - 1) };
};

export const starsText = (stars: number): string => {
  const s = Math.max(1, Math.min(5, Math.round(stars || 1)));
  return '★'.repeat(s) + '☆'.repeat(5 - s);
};

/** Тестовый состав для аккаунтов без наёмников. */
export const TEST_MERCS = [
  { id: 'test_tank', name: 'Тестовый танк', role: 'tank' as MercRole, stars: 2 },
  { id: 'test_medic', name: 'Тестовый медик', role: 'medic' as MercRole, stars: 2 },
  { id: 'test_mech', name: 'Тестовый техник', role: 'mechanic' as MercRole, stars: 1 },
];
