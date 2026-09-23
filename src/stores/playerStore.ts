import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateCombatStep, type CombatPlayer, type CombatEnemy } from '../engine/combat';
import { generateEnemy } from '../engine/enemies';
import { generateLoot } from '../engine/loot';
import { GAME_ITEMS, SET_BONUSES } from '../data/GameItems';
import { useInventoryStore } from './inventoryStore';
import { useCombatGridStore } from './combatGridStore';
import { useAuthStore } from './authStore';
import type { Item } from '../types/items';
import type { ActiveEffect } from '../types/player';
import type { AccessoryAbility } from '../types/abilities';
import { ABILITY_MAP } from '../data/accessoryAbilities';
import { SNIPER_ABILITIES, SNIPER_BY_ID, SNIPER_META, sniperCanAllocate, sniperBattleAbilities, sniperFindInvalid } from '../data/sniper';
import { PET_ABILITIES, PET_BY_ID, PET_META, PET_FREE_DEFS, petCanAllocate, petBattleAbilities, petFindInvalid, petBranchAuras, isPetBranchHidden, type PetKind, type PetBattleAbility } from '../data/pets';
import { MELEE_ABILITIES, MELEE_BY_ID, MELEE_META, meleeCanAllocate, meleeBattleAbilities, meleeFindInvalid } from '../data/melee';
import { SHOOTER_ABILITIES, SHOOTER_BY_ID, SHOOTER_META, shooterCanAllocate, shooterBattleAbilities, shooterFindInvalid } from '../data/shooter';
import { backpackSlotsFor, backpackDefByName, backpackSlots, makeBackpack, tryInsertInto, createGrid, tryInsertIntoGrid, removeItemFromGrid, findFreeSlot, placeItemAt, type BackpackGrid } from '../data/backpacks';
import { takeAmmoFrom, countAmmo, makeBulletPack, addAmmoToPack, ammoTypeForWeapon, type AmmoGroup } from '../data/ammo';
import { syncNow } from '../utils/serverSync';
import { modLevelMult, demoteModStats, effectiveItemStats, healWronglyDemoted } from '../utils/itemStats';
import { useUiStore, type SkillBuild } from './uiStore';
import { playCombatSound } from '../hooks/useSound';

const EQUIPMENT_SLOTS = [
  'head', 'armor', 'pants', 'weapon1', 'weapon2',
  'gun_pistol', 'gun_shotgun', 'gun_sniper', 'gun_heavy',
  'gloves', 'boots', 'backpack', 'shield',
] as const;
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];

// Оружейные слоты (6 иконок выбора): ближний, автомат + 4 классовых.
const GUN_SLOTS: EquipmentSlot[] = ['weapon1', 'weapon2', 'gun_pistol', 'gun_shotgun', 'gun_sniper', 'gun_heavy'];

export const getEquipSlot = (item: Item): EquipmentSlot | null => {
  if (!item.slot) return null;
  if ((EQUIPMENT_SLOTS as readonly string[]).includes(item.slot)) {
    // Огнестрел идёт строго в свой классовый слот (вторая рука — только автоматы).
    if (item.slot === 'weapon2') return gunSlotForWeapon(item);
    return item.slot as EquipmentSlot;
  }
  return null;
};

/**
 * Класс способности: sniper | lesnichiy | melee | shooter | null (классические ветки удалены из игры).
 */
export const classForSkill = (skillId: string): string | null => {
  if (skillId.startsWith('snp_')) return SNIPER_META.id;
  if (skillId.startsWith('mln_')) return MELEE_META.id;
  if (skillId.startsWith('sht_')) return SHOOTER_META.id;
  if (skillId.startsWith('pb_') || skillId.startsWith('pw_') || skillId.startsWith('po_') || skillId.startsWith('pet_')) return 'lesnichiy';
  return null;
};

/**
 * Классовый слот для огнестрела: пистолет / дробовик / снайперка / тяжёлое / автомат.
 * Огнемёты — тяжёлое (конус у них от поведения, не от слота).
 */
export const gunSlotForWeapon = (item: Pick<Item, 'name' | 'ammoType'>): EquipmentSlot => {
  const n = (item.name || '').toLowerCase();
  if (/базук|рпг|гп-25|гранатом|milkor|m79/.test(n)) return 'gun_heavy';
  if (/огнемет|огнемёт|flame/.test(n)) return 'gun_heavy';
  if (/m134|m60|m249|pkm|миниган|пулем/.test(n)) return 'gun_heavy';
  const g = ammoTypeForWeapon(item as any);
  if (g === 'pistol') return 'gun_pistol';
  if (g === 'shell') return 'gun_shotgun';
  if (g === 'sniper') return 'gun_sniper';
  if (g === 'mg') return 'gun_heavy';
  if (g === 'energy') return 'gun_heavy';
  return 'weapon2';
};

export { GUN_SLOTS };

// (Удалено: DPS-бонусы слотов амуниции. Слоты ammo1-4 убраны из игры.)

interface TravelState {
  isTraveling: boolean;
  isReturning: boolean;
  destination: string | null;
  remaining: number;
  total: number;
}

export interface SkillUtilityEffects {
  buyDiscount: number;
  sellBonus: number;
  extraShopSlots: number;
  refreshDiscount: number;
  chipMultiplier: number;
  xpMultiplier: number;
  extraLootChance: number;
  extraResourcePct: number;
  doubleLootChance: number;
  lootQualityBonus: number;
  utilityMultiplier: number;
}

export interface PlayerStats {
  maxHp: number; currentHp: number; maxStamina: number; stamina: number;
  damage: number; meleeDamage: number; shotgunDamage: number;
  autoDamage: number; pistolDamage: number; heavyDamage: number; critDamage: number;
  crit: number; armor: number; regen: number;
  evasion: number; block: number; punching: number; accuracy: number;
  vampir: number; speed: number;
  dpsEmi: number; dpsToxis: number; dpsExtro: number; dpsFire: number;
  power: number;
  incomingDamageMult: number;
  bonusAp: number;
  shieldCharges: number;
}

interface CombatState {
  isFighting: boolean; enemyHp: number; enemyMaxHp: number; enemyName: string;
  enemyDamage: number; enemyArmor: number; enemyRegen: number;
  enemyAccuracy: number; enemyEvasion: number; enemyBlock: number;
  enemyPunching: number; enemyVampir: number; enemyCrit: number; enemyFaction: string;
  enemyExpReward: number; enemyChipReward: number; turnCount: number;
}

interface LogEntry {
  id: number; message: string;
  type: 'info' | 'damage' | 'heal' | 'warning' | 'loot' | 'system';
  ts: number;
}

const LOG_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const LOG_MAX_IN_MEMORY = 20000;
const LOG_MAX_SAVED = 5000;

const pruneLogs = (logs: LogEntry[]): LogEntry[] => {
  const cutoff = Date.now() - LOG_MAX_AGE_MS;
  return logs.filter((l) => l.ts >= cutoff);
};

type EquipmentStore = Record<EquipmentSlot, Item | null>;

export interface PowerBreakdownItem {
  slot: string;
  itemName: string;
  abilityName: string;
  power: number;
}

export interface PowerBreakdownItemPower {
  slot: string;
  itemName: string;
  power: number;
}

export interface PowerBreakdown {
  offensiveScore: number;
  defensiveScore: number;
  abilityItems: PowerBreakdownItem[];
  itemPowers: PowerBreakdownItemPower[];
}

interface PlayerStore {
  level: number; currentExp: number; expToNext: number;
  dataChips: number; baseHealth: number; stats: PlayerStats;
  equipment: EquipmentStore;
  backpackGrid: BackpackGrid;
  activeEffects: ActiveEffect[];
  baseUpgrades: Record<string, number>;
  skillPoints: number;
  skills: Record<string, number>;
  pendingSkills: Record<string, number>;
  travel: TravelState; combat: CombatState;
  logs: LogEntry[]; logIdCounter: number;
  powerBreakdown: PowerBreakdown;
  explorationDeathTimestamp: number;
  // Выбранное оружие (урон идёт только с него): слот из GUN_SLOTS.
  activeWeaponSlot: EquipmentSlot;
  // Слоты перековки (persist на сервер через save-блоб).
  reforgeWeapon: Item | null;
  reforgeBlueprint: Item | null;
  setReforgeWeapon: (w: Item | null) => void;
  setReforgeBlueprint: (b: Item | null) => void;

  addLog: (msg: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
  addExp: (amount: number) => void;
  addChips: (amount: number) => void;
  resetLevel: () => void;
  spendChips: (amount: number) => boolean;
  recalcStats: () => void;
  recalcAbilities: () => void;
  accessoryAbilities: (AccessoryAbility | null)[];
  skillAbilities: (AccessoryAbility | null)[];
  // Классы: максимум 2 одновременно, выбор стоит 3 очка (качать можно только выбранные).
  chosenClasses: string[];
  pickClass: (classId: string, className: string) => void;
  abandonClass: (classId: string) => void;
  requireClassFor: (skillId: string) => boolean;
  // Питомцы: активный зверь + его боевые способности для панели.
  activePetId: PetKind | null;
  petAbilities: PetBattleAbility[];
  // Сытость питомца (сервер — источник правды; null = данных нет, считаем сытым).
  petSatiety: { value: number; updatedAt: number } | null;
  loadPetState: () => Promise<void>;
  feedPet: (itemId: string) => Promise<void>;
  setActivePet: (kind: PetKind | null) => void;
  allocatePet: (skillId: string) => void;
  deallocatePet: (skillId: string) => void;
  syncPetAura: () => void;

  equipItem: (slot: EquipmentSlot, item: Item) => boolean;
  unequipItem: (slot: EquipmentSlot) => Item | null;
  // Досинкать надетый предмет на сервер (item_data целиком: loadedAmmo и т.п.).
  syncEquippedItem: (slot: EquipmentSlot) => void;
  // Выбрать активное оружие (урон идёт только с него).
  setActiveWeaponSlot: (slot: EquipmentSlot) => void;
  // Надетое активное оружие (с фолбэком на первый непустой ствол).
  getActiveWeapon: () => Item | null;
  putInBackpack: (itemId: string) => string;
  takeOutBackpack: (itemId: string) => void;
  emptyBackpackToInventory: () => number;
  clearBackpack: () => void;
  ensureBackpack: () => void;
  takeAmmoFromPack: (group: AmmoGroup, n: number) => { taken: number; quality: string; breakdown: Record<string, number> };
  returnAmmoToPack: (group: AmmoGroup, n: number, quality?: string) => number;
  ammoInPack: (group: AmmoGroup) => number;
  consumeFromPack: (itemId: string) => boolean;
  spendSkillPoint: (skillId: string) => boolean;
  allocateSkill: (skillId: string) => void;
  deallocateSkill: (skillId: string) => void;
  allocateSniper: (skillId: string) => void;
  deallocateSniper: (skillId: string) => void;
  allocateMelee: (skillId: string) => void;
  deallocateMelee: (skillId: string) => void;
  allocateShooter: (skillId: string) => void;
  deallocateShooter: (skillId: string) => void;
  migrateSniper: () => Promise<void>;
  applySkills: () => void;
  cancelSkills: () => void;
  resetSkills: () => void;
  saveSkillBuild: () => string | null;
  deleteSkillBuild: (id: string) => void;
  loadSkillBuild: (id: string) => Promise<void>;
  loadSkills: () => Promise<void>;
  skillBonuses: () => PlayerStats;
  skillUtility: () => SkillUtilityEffects;

  useConsumable: (item: Item) => void;
  addEffect: (effect: ActiveEffect) => void;
  removeEffect: (id: string) => void;
  tickEffects: () => void;
  startTravel: (zoneName: string, travelTime: number) => void;
  travelTick: () => void;
  cancelTravel: () => void;
  startReturnHome: () => void;
  returnHomeTick: () => void;

  startCombat: (zoneDifficulty: number, silent?: boolean) => void;
  combatTick: () => { enemyDefeated: boolean; playerDefeated: boolean };
  endCombat: (playerWon: boolean, enemyWon: boolean) => void;
  rest: () => void;
  restTick: () => boolean;
}

const EMPTY_STATS: PlayerStats = {
  maxHp: 0, currentHp: 0, maxStamina: 0, stamina: 0,
  damage: 0, meleeDamage: 0, shotgunDamage: 0,
  autoDamage: 0, pistolDamage: 0, heavyDamage: 0, critDamage: 0,
  crit: 0, armor: 0, regen: 0, evasion: 0, block: 0,
  punching: 0, accuracy: 0, vampir: 0, speed: 0,
  dpsEmi: 0, dpsToxis: 0, dpsExtro: 0, dpsFire: 0,
  power: 0,
  incomingDamageMult: 0,
  bonusAp: 0,
  shieldCharges: 0,
};

const STAT_KEY_MAP: Record<string, keyof PlayerStats> = {
  health: 'maxHp',
  maxHp: 'maxHp',
  stamina: 'maxStamina',
  maxStamina: 'maxStamina',
};

const sumItemStats = (items: (Item | null)[]): PlayerStats => {  const total = { ...EMPTY_STATS };
  for (const item of items) {
    if (!item) continue;
    // Итоговые статы: база + моды со скейлом + сферы перековки.
    const eff = effectiveItemStats(item);
    for (const [k, v] of Object.entries(eff)) {
      const mappedKey = STAT_KEY_MAP[k] || (k as keyof PlayerStats);
      if (mappedKey in total) (total as any)[mappedKey] += v;
    }
  }
  return total;
};

/**
 * Дельта характеристик от надетого (для подсветки штрафов):
 * неактивные стволы занулены, моды со скейлом — как в recalcStats.
 */
export const equipmentDelta = (equipment: EquipmentStore, activeWeaponSlot: EquipmentSlot): PlayerStats => {
  const items = EQUIPMENT_SLOTS.map((slot) => {
    const it = equipment[slot];
    if (!it) return it;
    if (GUN_SLOTS.includes(slot) && slot !== activeWeaponSlot) {
      return { ...it, stats: {}, mods: {} };
    }
    return it;
  });
  return sumItemStats(items);
};

const sumEffectStats = (effects: ActiveEffect[]): PlayerStats => {
  const total = { ...EMPTY_STATS };
  for (const e of effects) {
    if (!e.statBoosts) continue;
    for (const [k, v] of Object.entries(e.statBoosts)) {
      if (k in total) (total as any)[k] += (v || 0);
    }
  }
  return total;
};

const STAT_PCT_KEYS = new Set(['crit', 'evasion', 'block', 'vampir', 'accuracy', 'speed']);

const sumMultBoosts = (effects: ActiveEffect[]): Partial<Record<string, number>> => {
  const mults: Partial<Record<string, number>> = {};
  for (const e of effects) {
    if (!e.statBoostsMult) continue;
    for (const [k, v] of Object.entries(e.statBoostsMult)) {
      if (k === 'healOverTime') continue;
      if (k === 'incomingDamageMult') {
        mults[k] = (mults[k] ?? 1) * (v as number);
      } else if (k === 'bonusAp') {
        mults[k] = (mults[k] ?? 0) + (v as number);
      } else {
        mults[k] = (mults[k] ?? 1) * (1 + (v as number));
      }
    }
  }
  return mults;
};

export const computePowerFromStats = (stats: PlayerStats): { offensiveScore: number; defensiveScore: number } => {
  const attackCount = 1 + (stats.speed || 0) * 0.5;
  const hitChance = Math.min(stats.accuracy ?? 1, 1);
  const rawDPS = stats.damage * attackCount * hitChance;
  const expectedCrit = 1 + (stats.crit || 0);
  const punchMult = 1 + stats.punching * 0.5;
  const elementDamage = Math.max(
    (stats.dpsEmi || 0) * 0.25,
    (stats.dpsToxis || 0) * 0.25,
    Math.max(stats.dpsExtro || 0, stats.dpsFire || 0) * 0.5,
  );
  const effectiveDPS = (rawDPS + elementDamage) * expectedCrit * punchMult;
  const offensiveScore = effectiveDPS * 3;

  const FIGHT_TIME = 30;
  const blockChance = Math.min(stats.block * 0.1, 0.5);
  const blockEHP = blockChance > 0 && blockChance < 1 ? 1000 * blockChance / (1 - blockChance) : Infinity;
  const armorEHP = stats.armor * FIGHT_TIME;
  const evasionEHP = stats.evasion < 1 ? 1000 * stats.evasion / (1 - stats.evasion) : Infinity;
  const regenEHP = stats.regen * FIGHT_TIME;
  const vampirEHP = stats.vampir * effectiveDPS * FIGHT_TIME;

  let totalEHP = stats.maxHp + armorEHP + regenEHP + vampirEHP;
  if (Number.isFinite(evasionEHP)) totalEHP += evasionEHP;
  if (Number.isFinite(blockEHP)) totalEHP += blockEHP;

  const defensiveScore = totalEHP / 10;
  return { offensiveScore: Math.round(offensiveScore), defensiveScore: Math.round(defensiveScore) };
};

const BASE_STATS: PlayerStats = {
  maxHp: 9980, currentHp: 10000, maxStamina: 100, stamina: 100,
  damage: 5, meleeDamage: 0, shotgunDamage: 0,
  autoDamage: 0, pistolDamage: 0, heavyDamage: 0, critDamage: 0,
  crit: 0.05, armor: 2, regen: 1, evasion: 0.05, block: 0,
  punching: 0, accuracy: 1.0, vampir: 0.01, speed: 0.05,
  dpsEmi: 0, dpsToxis: 0, dpsExtro: 0, dpsFire: 0,
  power: 0,
  incomingDamageMult: 0,
  bonusAp: 0,
  shieldCharges: 0,
};

const emptyEquipment = (): EquipmentStore => {
  const map = {} as EquipmentStore;
  EQUIPMENT_SLOTS.forEach((s) => { map[s] = null; });
  return map;
};

export { EQUIPMENT_SLOTS };

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      level: 1, currentExp: 0, expToNext: 100,
      dataChips: 100, baseHealth: 20000,
      stats: { ...BASE_STATS },
      equipment: emptyEquipment(),
      backpackGrid: createGrid(0),
      activeEffects: [] as ActiveEffect[],
      travel: { isTraveling: false, isReturning: false, destination: null, remaining: 0, total: 0 },
      combat: {
        isFighting: false, enemyHp: 0, enemyMaxHp: 0, enemyName: '',
        enemyDamage: 0, enemyArmor: 0, enemyRegen: 0,
        enemyAccuracy: 1, enemyEvasion: 0, enemyBlock: 0,
        enemyPunching: 0, enemyVampir: 0, enemyCrit: 0, enemyFaction: '',
        enemyExpReward: 0, enemyChipReward: 0, turnCount: 0,
      },
      baseUpgrades: {} as Record<string, number>,
      skillPoints: 3,
      skills: {} as Record<string, number>,
      pendingSkills: {} as Record<string, number>,
      logs: [{ id: 0, message: 'Система инициализирована. Добро пожаловать в Пустошь.', type: 'system', ts: Date.now() }],
      logIdCounter: 1,
      accessoryAbilities: [],
      skillAbilities: [],
      activePetId: null,
      petAbilities: [],
      petSatiety: null,
      chosenClasses: [],
      powerBreakdown: { offensiveScore: 0, defensiveScore: 0, abilityItems: [], itemPowers: [] },
      explorationDeathTimestamp: 0,
      activeWeaponSlot: 'weapon2' as EquipmentSlot,
      reforgeWeapon: null as Item | null,
      reforgeBlueprint: null as Item | null,
      setReforgeWeapon: (w) => set({ reforgeWeapon: w }),
      setReforgeBlueprint: (b) => set({ reforgeBlueprint: b }),

      addLog: (msg, type = 'info') => set((s) => ({
        logs: pruneLogs([...s.logs, { id: s.logIdCounter, message: msg, type, ts: Date.now() }]).slice(-LOG_MAX_IN_MEMORY),
        logIdCounter: s.logIdCounter + 1,
      })),

      clearLogs: () => set({ logs: [{ id: 1, message: 'Лог очищен.', type: 'system', ts: Date.now() }], logIdCounter: 2 }),

      addExp: (amount) => {
        const state = get();
        let newExp = state.currentExp + amount;
        let newLevel = state.level;
        let newExpToNext = state.expToNext;
        let newSkillPoints = state.skillPoints;
        const msgs: string[] = [];
        while (newExp >= newExpToNext) {
          newExp -= newExpToNext;
          newLevel++;
          newSkillPoints += 3;
          newExpToNext = Math.floor(1000 + (newLevel - 1) * 1000);
          msgs.push(`⭐ НОВЫЙ УРОВЕНЬ! Ты достиг ${newLevel} уровня! +3 очка навыков`);
        }
        set({ currentExp: newExp, level: newLevel, expToNext: newExpToNext, skillPoints: newSkillPoints });
        msgs.forEach((m) => get().addLog(m, 'system'));
        if (msgs.length > 0) get().recalcStats();
      },

      addChips: (amount) => set((s) => ({ dataChips: s.dataChips + amount })),
      resetLevel: () => {
        set({ level: 1, currentExp: 0, expToNext: 100, skillPoints: 3, skills: {}, pendingSkills: {} });
        get().addLog('🔄 Уровень сброшен до 1.', 'warning');
        get().recalcStats();
      },
      spendChips: (amount) => {
        const s = get();
        if (s.dataChips < amount) return false;
        set({ dataChips: s.dataChips - amount });
        return true;
      },

      recalcStats: () => {
        const s = get();
        // Миграция старых слотов ammo1-4 (удалены): вещи — в инвентарь.
        const legacySlots = ['ammo1', 'ammo2', 'ammo3', 'ammo4'];
        let migrated = false;
        for (const ls of legacySlots) {
          const old = (s.equipment as any)[ls];
          if (old) {
            useInventoryStore.getState().addItem(old);
            migrated = true;
          }
          if (old || ls in (s.equipment as any)) delete (s.equipment as any)[ls];
        }
        // Активное оружие валидно: непустой ствол, иначе первый непустой.
        let aws = s.activeWeaponSlot;
        if (!GUN_SLOTS.includes(aws) || !s.equipment[aws]) {
          const first = GUN_SLOTS.find((g) => s.equipment[g]);
          aws = first || 'weapon2';
          if (aws !== s.activeWeaponSlot) set({ activeWeaponSlot: aws });
        }
        if (migrated) {
          get().addLog('📦 Старые слоты амуниции убраны: вещи переехали в инвентарь.', 'info');
          syncNow();
        }
        // Характеристики идут ТОЛЬКО с активного оружия: остальные стволы
        // не дают ничего (ни урона, ни крита, ни прочего; сеты считаются как раньше).
        const items = EQUIPMENT_SLOTS.map((slot) => {
          const it = s.equipment[slot];
          if (!it) return it;
          if (GUN_SLOTS.includes(slot) && slot !== aws) {
            return { ...it, stats: {}, mods: {} };
          }
          return it;
        });
        const equipBonus = sumItemStats(items);
        const effectBonus = sumEffectStats(s.activeEffects);
        const skillBonus = s.skillBonuses();

        // Set bonuses
        const setCounts: Record<string, number> = {};
        for (const item of items) {
          if (item && item.set) setCounts[item.set] = (setCounts[item.set] || 0) + 1;
        }
        const setBonus: PlayerStats = { ...EMPTY_STATS };
        for (const [setName, count] of Object.entries(setCounts)) {
          const tiers = SET_BONUSES[setName];
          if (!tiers) continue;
          let activeTier = -1;
          for (let i = tiers.length - 1; i >= 0; i--) {
            if (count >= tiers[i].count) { activeTier = i; break; }
          }
          if (activeTier >= 0) {
            for (const [k, v] of Object.entries(tiers[activeTier].bonuses)) {
              const mappedKey = STAT_KEY_MAP[k] || (k as keyof PlayerStats);
              if (mappedKey === 'allDps') {
                setBonus.dpsEmi += (v as number);
                setBonus.dpsToxis += (v as number);
                setBonus.dpsExtro += (v as number);
                setBonus.dpsFire += (v as number);
              } else if (mappedKey in setBonus) {
                (setBonus as any)[mappedKey] += v;
              }
            }
          }
        }

        const lvl = s.level;
        const dps = BASE_STATS.damage + lvl + equipBonus.damage + effectBonus.damage + skillBonus.damage + setBonus.damage;
        const newStats: PlayerStats = {
          maxHp: Math.round(BASE_STATS.maxHp + lvl * 20 + equipBonus.maxHp + effectBonus.maxHp + skillBonus.maxHp + setBonus.maxHp),
          currentHp: 0,
          maxStamina: Math.round(BASE_STATS.maxStamina + lvl * 5 + equipBonus.maxStamina + effectBonus.maxStamina + skillBonus.maxStamina + setBonus.maxStamina),
          stamina: 0,
          damage: Math.max(1, dps),
          meleeDamage: Math.max(0, skillBonus.meleeDamage),
          shotgunDamage: Math.max(0, skillBonus.shotgunDamage),
          autoDamage: Math.max(0, skillBonus.autoDamage),
          pistolDamage: Math.max(0, skillBonus.pistolDamage),
          heavyDamage: Math.max(0, skillBonus.heavyDamage),
          critDamage: Math.max(0, skillBonus.critDamage),
          crit: Math.max(0, BASE_STATS.crit + equipBonus.crit + effectBonus.crit + skillBonus.crit + setBonus.crit),
          armor: Math.max(0, BASE_STATS.armor + equipBonus.armor + effectBonus.armor + skillBonus.armor + setBonus.armor),
          regen: Math.max(0, BASE_STATS.regen + equipBonus.regen + effectBonus.regen + skillBonus.regen + setBonus.regen),
          evasion: Math.min(0.9, Math.max(0, BASE_STATS.evasion + equipBonus.evasion + effectBonus.evasion + skillBonus.evasion + setBonus.evasion)),
          block: Math.min(5.0, Math.max(0, BASE_STATS.block + equipBonus.block + effectBonus.block + skillBonus.block + setBonus.block)),
          punching: Math.max(0, BASE_STATS.punching + equipBonus.punching + effectBonus.punching + skillBonus.punching + setBonus.punching),
          accuracy: Math.min(2, Math.max(0.1, BASE_STATS.accuracy + equipBonus.accuracy + effectBonus.accuracy + skillBonus.accuracy + setBonus.accuracy)),
          vampir: Math.min(5.0, Math.max(0, BASE_STATS.vampir + equipBonus.vampir + effectBonus.vampir + skillBonus.vampir + setBonus.vampir)),
          speed: Math.max(0, BASE_STATS.speed + equipBonus.speed + effectBonus.speed + skillBonus.speed + setBonus.speed),
          dpsEmi: Math.max(0, BASE_STATS.dpsEmi + equipBonus.dpsEmi + effectBonus.dpsEmi + skillBonus.dpsEmi + setBonus.dpsEmi),
          dpsToxis: Math.max(0, BASE_STATS.dpsToxis + equipBonus.dpsToxis + effectBonus.dpsToxis + skillBonus.dpsToxis + setBonus.dpsToxis),
          dpsExtro: Math.max(0, BASE_STATS.dpsExtro + equipBonus.dpsExtro + effectBonus.dpsExtro + skillBonus.dpsExtro + setBonus.dpsExtro),
          dpsFire: Math.max(0, BASE_STATS.dpsFire + equipBonus.dpsFire + effectBonus.dpsFire + skillBonus.dpsFire + setBonus.dpsFire),
          power: 0,
          incomingDamageMult: 1,
          bonusAp: 0,
          shieldCharges: s.stats.shieldCharges || 0,
        };

        // Слоты амуниции удалены: DPS-бонусов и passive-усилений от них больше нет.

        // Apply multiplier boosts from effects (fortify: ×2 armor, adrenaline: ×1.5 damage, etc.)
        const multBoosts = sumMultBoosts(s.activeEffects);
        for (const [k, v] of Object.entries(multBoosts)) {
          if (v === undefined) continue;
          if (k === 'incomingDamageMult') {
            newStats.incomingDamageMult = v;
          } else if (k === 'bonusAp') {
            newStats.bonusAp = v;
          } else if (k in newStats) {
            (newStats as any)[k] *= v;
          }
        }

        // Жёсткая установка статов эффектами (Ваншот: крит ровно 500%, даже с 700%).
        for (const e of s.activeEffects) {
          if (!e.statSets) continue;
          for (const [k, v] of Object.entries(e.statSets)) {
            if (v !== undefined && k in newStats) (newStats as any)[k] = v;
          }
        }

        // Щит милишника: +2.5 блока (25% шанс) при надетом щите.
        // Фикс вне скейла уровня/редкости: редкость влияет только на доборочные статы.
        if (s.equipment.shield) {
          newStats.block = Math.min(5.0, newStats.block + 2.5);
        }

        // Power rating
        const { offensiveScore, defensiveScore } = computePowerFromStats(newStats);
        let powerFromAbilities = 0;
        const abilityItems: PowerBreakdownItem[] = [];
        // Способности теперь из расходников рюкзака (см. recalcAbilities);
        // у оружия abilityId нет — цикл оставлен для совместимости.
        for (const slot of GUN_SLOTS) {
          const item = s.equipment[slot];
          if (item && (item as any).abilityId && ABILITY_MAP[(item as any).abilityId]) {
            const base = ABILITY_MAP[(item as any).abilityId].powerRating;
            const levelFactor = 1 + (item.level - 1) * 0.05;
            const pwr = Math.round(base * levelFactor * 3);
            powerFromAbilities += pwr;
            abilityItems.push({ slot, itemName: item.displayName || item.name, abilityName: ABILITY_MAP[(item as any).abilityId].name, power: pwr });
          }
        }
        const fullPower = offensiveScore + defensiveScore + powerFromAbilities;
        newStats.power = fullPower;

        const fresh = get().stats;
        newStats.currentHp = Math.round(Math.min(fresh.currentHp, newStats.maxHp));
        newStats.stamina = Math.round(Math.min(fresh.stamina, newStats.maxStamina));
        newStats.incomingDamageMult = Math.max(0, newStats.incomingDamageMult);

        // Per-item power contribution (delta: full - without this item)
        const itemPowers: PowerBreakdownItemPower[] = [];
        for (const slot of EQUIPMENT_SLOTS) {
          const item = s.equipment[slot];
          if (!item) continue;
          const woStats: PlayerStats = { ...newStats };
          const eff = effectiveItemStats(item);
          for (const [k, v] of Object.entries(eff)) {
            const mappedKey = STAT_KEY_MAP[k] || (k as keyof PlayerStats);
            if (mappedKey in woStats && typeof woStats[mappedKey] === 'number') {
              (woStats as any)[mappedKey] -= v;
            }
          }
          woStats.damage = Math.max(1, woStats.damage);
          woStats.crit = Math.max(0, woStats.crit);
          woStats.armor = Math.max(0, woStats.armor);
          woStats.regen = Math.max(0, woStats.regen);
          woStats.evasion = Math.min(0.9, Math.max(0, woStats.evasion));
          woStats.block = Math.min(5.0, Math.max(0, woStats.block));
          woStats.punching = Math.max(0, woStats.punching);
          woStats.accuracy = Math.min(2, Math.max(0.1, woStats.accuracy));
          woStats.vampir = Math.min(5.0, Math.max(0, woStats.vampir));
          woStats.speed = Math.max(0, woStats.speed);
          woStats.dpsEmi = Math.max(0, woStats.dpsEmi);
          woStats.dpsToxis = Math.max(0, woStats.dpsToxis);
          woStats.dpsExtro = Math.max(0, woStats.dpsExtro);
          woStats.dpsFire = Math.max(0, woStats.dpsFire);

          const { offensiveScore: woOff, defensiveScore: woDef } = computePowerFromStats(woStats);

          // Subtract ability power for gun slots (у оружия их нет — ноль).
          let woAbility = 0;
          if (GUN_SLOTS.includes(slot as EquipmentSlot)) {
            const ai = abilityItems.find((a) => a.slot === slot);
            if (ai) woAbility = ai.power;
          }
          const withoutPower = woOff + woDef + (powerFromAbilities - woAbility);
          const contribution = fullPower - withoutPower;
          if (contribution > 0) {
            itemPowers.push({ slot, itemName: item.displayName || item.name, power: contribution });
          }
        }

        const powerBreakdown: PowerBreakdown = {
          offensiveScore,
          defensiveScore,
          abilityItems,
          itemPowers,
        };
        set({ stats: newStats, powerBreakdown });
        get().recalcAbilities();
      },

      recalcAbilities: () => {
        // Расходники — только для HUD.
        const seenConsumable = new Set<string>();
        const consumableAbs: (AccessoryAbility | null)[] = [];
        for (const it of get().backpackGrid.items) {
          if (it.type !== 'consumable' || !(it as any).abilityId) continue;
          const aid = (it as any).abilityId as string;
          if (aid.startsWith('food_')) continue;
          if (seenConsumable.has(aid)) continue;
          const ab = ABILITY_MAP[aid];
          if (!ab || (ab as any).passive) continue;
          seenConsumable.add(aid);
          consumableAbs.push(ab);
          if (consumableAbs.length >= 12) break;
        }
        // Скилловые способности — снайпер + милишник (для WOW-панели). Классика удалена.
        const seenSkill = new Set<string>();
        const skillAbs: (AccessoryAbility | null)[] = [];
        for (const ab of sniperBattleAbilities(get().skills, {})) {
          if (seenSkill.has(ab.id)) continue;
          seenSkill.add(ab.id);
          skillAbs.push(ab as any);
        }
        for (const ab of meleeBattleAbilities(get().skills, {})) {
          if (seenSkill.has(ab.id)) continue;
          seenSkill.add(ab.id);
          skillAbs.push(ab as any);
        }
        for (const ab of shooterBattleAbilities(get().skills, {})) {
          if (seenSkill.has(ab.id)) continue;
          seenSkill.add(ab.id);
          skillAbs.push(ab as any);
        }
        set({ accessoryAbilities: consumableAbs, skillAbilities: skillAbs });
        // Питомцы: боевые активки активной ветки (для панели 24).
        let pa: any[] = get().activePetId ? petBattleAbilities(get().skills, get().activePetId) as any[] : [];
        if (get().activePetId) {
          if (!pa.some((a: any) => a.id === 'petb_pet_ai')) {
            pa.push({ id: 'petb_pet_ai', defId: 'pet_ai', name: 'ИИ: автобой', icon: '🤖', petApCost: 0, cooldown: 0, needsTarget: false, range: 2, exec: 'ai' } as any);
          }
          if (!pa.some((a: any) => a.id === 'petb_pet_command')) {
            pa.push({ id: 'petb_pet_command', defId: 'pet_command', name: 'Команда: атака', icon: '🎯', petApCost: 0, cooldown: 0, needsTarget: true, range: 20, exec: 'command' } as any);
          }
          // Пассивки-автопроки медведя — показываем в 24 слотах как инфо с КД, перетаскиваемые
          if (get().activePetId === 'bear') {
            if ((get().skills['pb_t3_paw'] || 0) > 0 && !pa.some((a: any) => a.id === 'petp_pb_t3_paw')) {
              pa.push({ id: 'petp_pb_t3_paw', defId: 'pb_t3_paw', name: 'Тяжёлая лапа', icon: '🐾', petApCost: 0, cooldown: 6, needsTarget: false, range: 2, exec: 'passive' } as any);
            }
            if ((get().skills['pb_t3_roar'] || 0) > 0 && !pa.some((a: any) => a.id === 'petp_pb_t3_roar')) {
              pa.push({ id: 'petp_pb_t3_roar', defId: 'pb_t3_roar', name: 'Дикий рёв', icon: '📢', petApCost: 0, cooldown: 8, needsTarget: false, range: 10, exec: 'passive' } as any);
            }
          }
          // Пассивки-автопроки волка — так же в 24 слотах.
          if (get().activePetId === 'wolf') {
            if ((get().skills['pw_t3_rend'] || 0) > 0 && !pa.some((a: any) => a.id === 'petp_pw_t3_rend')) {
              pa.push({ id: 'petp_pw_t3_rend', defId: 'pw_t3_rend', name: 'Рваная рана', icon: '🦷', petApCost: 0, cooldown: 4, needsTarget: false, range: 2, exec: 'passive' } as any);
            }
            if ((get().skills['pw_t3_shade'] || 0) > 0 && !pa.some((a: any) => a.id === 'petp_pw_t3_shade')) {
              pa.push({ id: 'petp_pw_t3_shade', defId: 'pw_t3_shade', name: 'Полоснуть', icon: '🌑', petApCost: 0, cooldown: 4, needsTarget: false, range: 2, exec: 'passive' } as any);
            }
          }
        }
        set({ petAbilities: pa as any });
      },

      equipItem: (slot, item) => {
        const s = get();
        // Щит — только с классом «Милишник».
        if (slot === 'shield' && !s.chosenClasses.includes(MELEE_META.id)) {
          get().addLog('🔒 Щит доступен с классом «Милишник»', 'warning');
          return false;
        }
        if (s.equipment[slot]) {
          get().addLog(`❌ Слот ${slot} уже занят. Сначала снимите предмет.`, 'warning');
          return false;
        }
        set((state) => ({ equipment: { ...state.equipment, [slot]: item } }));
        get().addLog(`⛓️ ${item.displayName || item.name} экипирован в слот ${slot}.`, 'info');
        get().recalcStats();

        try {
          const token = useAuthStore.getState().token;
          if (token) {
            fetch('/api/player/equip.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ slot, item }),
            });
          }
        } catch { /* best effort */ }
        // Инвентарь тоже изменился (предмет ушёл из него) — сразу на сервер.
        syncNow();

        return true;
      },

      unequipItem: (slot) => {
        const s = get();
        const item = s.equipment[slot];
        if (!item) return null;
        set((state) => ({ equipment: { ...state.equipment, [slot]: null } }));
        get().addLog(`📦 ${item.displayName || item.name} снят со слота ${slot}.`, 'info');
        get().recalcStats();

        try {
          const token = useAuthStore.getState().token;
          if (token) {
            fetch('/api/player/unequip.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ slot }),
            });
          }
        } catch { /* best effort */ }
        syncNow();

        return item;
      },

      // Досинкать надетый предмет на сервер (целиком item_data: loadedAmmo и т.п.).
      // Вызывать после любого локального изменения экипировки вне equip/unequip.
      syncEquippedItem: (slot) => {
        const it = get().equipment[slot];
        if (!it) return;
        try {
          const token = useAuthStore.getState().token;
          if (!token) return;
          fetch('/api/player/update-equipment.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ slot, item: it }),
          }).catch(() => {});
        } catch { /* best effort */ }
      },

      // Выбрать активное оружие (только непустой ствол).
      setActiveWeaponSlot: (slot) => {
        if (!GUN_SLOTS.includes(slot)) return;
        const it = get().equipment[slot];
        if (!it) {
          get().addLog('❌ Слот пуст — нечего выбирать.', 'warning');
          return;
        }
        if (get().activeWeaponSlot === slot) return;
        set({ activeWeaponSlot: slot });
        get().recalcStats();
      },

      // Надетое активное оружие (с фолбэком на первый непустой ствол).
      getActiveWeapon: () => {
        const s = get();
        const cur = GUN_SLOTS.includes(s.activeWeaponSlot) ? s.equipment[s.activeWeaponSlot] : null;
        if (cur) return cur;
        for (const g of GUN_SLOTS) {
          if (s.equipment[g]) return s.equipment[g];
        }
        return null;
      },

      putInBackpack: (itemId) => {
        const s = get();
        const pack = s.equipment.backpack;
        if (!pack) return '❌ Нет рюкзака!';
        const inv = useInventoryStore.getState();
        const item = inv.items.find((i) => i.id === itemId);
        if (!item) return '❌ Нет предмета!';
        const maxSlots = backpackSlotsFor(pack);
        // Ensure grid is sized correctly
        let grid = s.backpackGrid;
        const neededH = Math.max(1, Math.ceil(maxSlots / 5));
        if (grid.h !== neededH || grid.w !== 5) {
          grid = createGrid(maxSlots);
          // Re-place existing items
          for (const existing of s.backpackGrid.items) {
            const w = existing.gridW ?? 1;
            const h = existing.gridH ?? 1;
            const slot = findFreeSlot(grid, w, h);
            if (slot) grid = placeItemAt(grid, existing, slot.x, slot.y);
          }
        }
        const { grid: newGrid, moved, leftoverQty } = tryInsertIntoGrid(grid, item);
        if (!moved) return '❌ Рюкзак полон!';
        inv.removeItem(item.id);
        if (leftoverQty > 0) inv.addItem({ ...item, quantity: leftoverQty });
        set({ backpackGrid: newGrid });
        syncNow();
        get().recalcAbilities();
        return leftoverQty > 0 ? `⚠️ Влезло частично, в рюкзаке нет места!` : `🎒 В рюкзаке`;
      },

      takeOutBackpack: (itemId) => {
        const s = get();
        const item = s.backpackGrid.items.find((i) => i.id === itemId);
        if (!item) return;
        const newGrid = removeItemFromGrid(s.backpackGrid, itemId);
        set({ backpackGrid: newGrid });
        useInventoryStore.getState().addItem(item);
        syncNow();
        get().recalcAbilities();
      },

      clearBackpack: () => { const pack = get().equipment.backpack; set({ backpackGrid: createGrid(backpackSlotsFor(pack)) }); syncNow(); get().recalcAbilities(); },

      // Выложить всё содержимое рюкзака в инвентарь. Возвращает число предметов.
      emptyBackpackToInventory: () => {
        const s = get();
        if (s.backpackGrid.items.length === 0) return 0;
        const inv = useInventoryStore.getState();
        for (const it of s.backpackGrid.items) inv.addItem(it);
        const n = s.backpackGrid.items.length;
        const pack = s.equipment.backpack;
        set({ backpackGrid: createGrid(backpackSlotsFor(pack)) });
        syncNow();
        get().recalcAbilities();
        return n;
      },

      ensureBackpack: () => {
        const s = get();
        if (s.equipment.backpack) return;
        const pack = makeBackpack('Походный рюкзак');
        get().equipItem('backpack', pack);
        if (s.backpackGrid.items.length === 0) {
          const g = createGrid(backpackSlotsFor(pack));
          const { grid: g1 } = tryInsertIntoGrid(g, makeBulletPack('rifle', 30));
          const { grid: g2 } = tryInsertIntoGrid(g1, makeBulletPack('pistol', 12));
          set({ backpackGrid: g2 });
        }
      },

      takeAmmoFromPack: (group, n) => {
        const s = get();
        const { items, taken, quality, breakdown } = takeAmmoFrom(s.backpackGrid.items, group, n);
        if (taken > 0) {
          // Rebuild grid with remaining items
          const pack = s.equipment.backpack;
          let grid = createGrid(backpackSlotsFor(pack));
          for (const it of items) {
            const { grid: g } = tryInsertIntoGrid(grid, it);
            grid = g;
          }
          set({ backpackGrid: grid });
          syncNow();
        }
        return { taken, quality, breakdown };
      },

      // Вернуть патроны в рюкзак (остаток магазина). Не влезло — в инвентарь.
      returnAmmoToPack: (group, n, quality = 'Обычный') => {
        const s = get();
        if (n <= 0) return 0;
        const pack = s.equipment.backpack;
        const maxSlots = pack ? backpackSlotsFor(pack) : 0;
        // Use the old flat-array helper then rebuild grid
        const flatItems = s.backpackGrid.items.map((i) => ({ ...i }));
        const { items: newFlat, leftover } = addAmmoToPack(flatItems, group, n, maxSlots, quality);
        // Rebuild grid
        let grid = createGrid(maxSlots);
        for (const it of newFlat) {
          const { grid: g } = tryInsertIntoGrid(grid, it);
          grid = g;
        }
        set({ backpackGrid: grid });
        if (leftover > 0) useInventoryStore.getState().addItem(makeBulletPack(group, leftover, quality));
        syncNow();
        return n - leftover;
      },

      ammoInPack: (group) => countAmmo(get().backpackGrid.items, group),

      // Съесть 1 шт. предмета из рюкзака (расходники). false — нет такого.
      consumeFromPack: (itemId) => {
        const s = get();
        const it = s.backpackGrid.items.find((i) => i.id === itemId);
        if (!it) return false;
        const q = (it.quantity ?? 1) as number;
        let grid = s.backpackGrid;
        if (q > 1) {
          // Decrement quantity: rebuild with updated item
          const items = grid.items.map((i) => i.id === itemId ? { ...i, quantity: q - 1 } : i);
          const cells = grid.cells.map((row) => [...row]);
          grid = { ...grid, items, cells };
        } else {
          grid = removeItemFromGrid(grid, itemId);
        }
        set({ backpackGrid: grid });
        syncNow();
        get().recalcAbilities();
        return true;
      },

      spendSkillPoint: (skillId) => {
        const s = get();
        if (s.skillPoints <= 0) return false;
        const current = s.skills[skillId] || 0;
        set({ skillPoints: s.skillPoints - 1, skills: { ...s.skills, [skillId]: current + 1 } });
        get().recalcStats();
        return true;
      },

      allocateSkill: (_skillId) => {
        // Классические ветки удалены из игры.
        get().addLog('❌ Этот класс удалён из игры', 'warning');
      },

      deallocateSkill: (_skillId) => {
        // Классические ветки удалены из игры.
      },

      allocateSniper: async (skillId) => {
        const s = get();
        const def = SNIPER_BY_ID[skillId];
        if (!def) return;
        if (!get().requireClassFor(skillId)) return;
        // Базовые бесплатны и применяются СРАЗУ (без ПРИНЯТЬ): клик — активна.
        if (def.freeTake) {
          for (const rival of def.exclusiveWith || []) {
            const rPending = s.pendingSkills[rival] || 0;
            const rApplied = s.skills[rival] || 0;
            if (rPending <= 0 && rApplied <= 0) continue;
            if (rPending > 0) {
              const updated = { ...get().pendingSkills };
              delete updated[rival];
              set({ pendingSkills: updated });
            } else {
              // Снятие применённой базы — через сервер (очков не возвращает, было бесплатно).
              const cur = { ...get().skills };
              delete cur[rival];
              set({ skills: cur });
              try {
                const token = useAuthStore.getState().token;
                if (!token) throw new Error('no token');
                const res = await fetch('/api/skills/remove.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ skillIds: [rival] }),
                });
                if (!res.ok) throw new Error('remove failed');
              } catch {
                set({ skills: { ...get().skills, [rival]: rApplied } });
                get().addLog('❌ Не удалось переключить способность', 'warning');
                return;
              }
            }
          }
          const st = get();
          const check = sniperCanAllocate(skillId, st.skills, st.pendingSkills, st.skillPoints);
          if (!check.ok) {
            if (check.reason) get().addLog(`❌ ${check.reason}`, 'warning');
            return;
          }
          // Сразу в применённые + скрытность первой снайперской (тоже сразу).
          const toApply: Record<string, number> = { [skillId]: 1 };
          const cur = get();
          if (skillId !== 'snp_x_stealth' && !(cur.skills['snp_x_stealth'] > 0) && !(cur.pendingSkills['snp_x_stealth'] > 0)) {
            toApply['snp_x_stealth'] = 1;
          }
          set({ skills: { ...cur.skills, ...toApply } });
          get().recalcStats();
          try {
            const token = useAuthStore.getState().token;
            if (!token) throw new Error('no token');
            const res = await fetch('/api/skills/apply.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ pendingSkills: toApply }),
            });
            if (!res.ok) throw new Error('apply failed');
            const json = await res.json();
            set({ skills: json.skills, skillPoints: json.skillPoints });
            get().addLog(`✨ «${def.name}» активна`, 'info');
          } catch {
            const rollback = { ...get().skills };
            for (const id of Object.keys(toApply)) delete rollback[id];
            set({ skills: rollback });
            get().addLog('❌ Не удалось взять способность (нет связи?)', 'warning');
          }
          return;
        }
        const st = get();
        const check = sniperCanAllocate(skillId, st.skills, st.pendingSkills, st.skillPoints);
        if (!check.ok) {
          if (check.reason) get().addLog(`❌ ${check.reason}`, 'warning');
          return;
        }
        const pending = st.pendingSkills[skillId] || 0;
        set({ skillPoints: st.skillPoints - 1, pendingSkills: { ...st.pendingSkills, [skillId]: pending + 1 } });
        // Первая снайперская — скрытность сразу (бесплатно, без ПРИНЯТЬ).
        const cur2 = get();
        if (!(cur2.skills['snp_x_stealth'] > 0) && !(cur2.pendingSkills['snp_x_stealth'] > 0)) {
          set({ skills: { ...cur2.skills, snp_x_stealth: 1 } });
          try {
            const token2 = useAuthStore.getState().token;
            if (token2) {
              await fetch('/api/skills/apply.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
                body: JSON.stringify({ pendingSkills: { snp_x_stealth: 1 } }),
              });
            }
          } catch { /* silent — доберём в applySkills */ }
        }
      },

      deallocateSniper: async (skillId) => {
        const s = get();
        const def = SNIPER_BY_ID[skillId];
        if (!def) return;
        const pending = s.pendingSkills[skillId] || 0;
        if (pending > 0) {
          const next = pending - 1;
          const updated = { ...s.pendingSkills };
          if (next <= 0) delete updated[skillId];
          else updated[skillId] = next;
          // Антиабуз: проверяем, что после снятия всё осталось валидно.
          const dropped = sniperFindInvalid(s.skills, updated);
          const hitsApplied = dropped.filter((id) => (s.skills[id] || 0) > 0);
          if (hitsApplied.length > 0) {
            // Применённые способности сломались бы — запрещаем снятие.
            const names = hitsApplied.map((id) => `«${SNIPER_BY_ID[id]?.name || id}»`).join(', ');
            get().addLog(`❌ Нельзя снять: сломается ${names} (сначала сброс ветки)`, 'warning');
            return;
          }
          let refund = def.freeTake ? 0 : 1;
          if (dropped.length > 0) {
            for (const id of dropped) {
              if (!SNIPER_BY_ID[id]?.freeTake) refund += updated[id] || 0;
              delete updated[id];
            }
            const names = dropped.map((id) => `«${SNIPER_BY_ID[id]?.name || id}»`).join(', ');
            get().addLog(`🧹 Закрыто без гейта и снято: ${names}`, 'warning');
          }
          set({ skillPoints: s.skillPoints + refund, pendingSkills: updated });
          return;
        }
        // Снятие применённой базовой способности (была бесплатна — без возврата).
        const applied = s.skills[skillId] || 0;
        if (applied > 0 && def.freeTake) {
          const cur = { ...get().skills };
          delete cur[skillId];
          set({ skills: cur });
          try {
            const token = useAuthStore.getState().token;
            if (!token) throw new Error('no token');
            const res = await fetch('/api/skills/remove.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ skillIds: [skillId] }),
            });
            if (!res.ok) throw new Error('remove failed');
            get().addLog(`🔄 «${def.name}» снята`, 'info');
          } catch {
            set({ skills: { ...get().skills, [skillId]: applied } });
            get().addLog('❌ Не удалось снять способность', 'warning');
          }
        }
      },

      // Питомцы: ветки тратят общие очки; freeTake (реген) — сразу применённые.
      allocateMelee: async (skillId) => {
        const s = get();
        const def = MELEE_BY_ID[skillId];
        if (!def) return;
        if (!get().requireClassFor(skillId)) return;
        // Базовые бесплатны и применяются СРАЗУ (без ПРИНЯТЬ): клик — активна.
        if (def.freeTake) {
          const st = get();
          const check = meleeCanAllocate(skillId, st.skills, st.pendingSkills, st.skillPoints);
          if (!check.ok) {
            if (check.reason) get().addLog(`❌ ${check.reason}`, 'warning');
            return;
          }
          const toApply: Record<string, number> = { [skillId]: 1 };
          const cur = get();
          set({ skills: { ...cur.skills, ...toApply } });
          get().recalcStats();
          try {
            const token = useAuthStore.getState().token;
            if (!token) throw new Error('no token');
            const res = await fetch('/api/skills/apply.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ pendingSkills: toApply }),
            });
            if (!res.ok) throw new Error('apply failed');
            const json = await res.json();
            set({ skills: json.skills, skillPoints: json.skillPoints });
            get().addLog(`✨ «${def.name}» активна`, 'info');
          } catch {
            const rollback = { ...get().skills };
            for (const id of Object.keys(toApply)) delete rollback[id];
            set({ skills: rollback });
            get().addLog('❌ Не удалось взять способность (нет связи?)', 'warning');
          }
          return;
        }
        const st = get();
        const check = meleeCanAllocate(skillId, st.skills, st.pendingSkills, st.skillPoints);
        if (!check.ok) {
          if (check.reason) get().addLog(`❌ ${check.reason}`, 'warning');
          return;
        }
        const pending = st.pendingSkills[skillId] || 0;
        set({ skillPoints: st.skillPoints - 1, pendingSkills: { ...st.pendingSkills, [skillId]: pending + 1 } });
      },

      deallocateMelee: async (skillId) => {
        const s = get();
        const def = MELEE_BY_ID[skillId];
        if (!def) return;
        const pending = s.pendingSkills[skillId] || 0;
        if (pending > 0) {
          const next = pending - 1;
          const updated = { ...s.pendingSkills };
          if (next <= 0) delete updated[skillId];
          else updated[skillId] = next;
          // Антиабуз: проверяем, что после снятия всё осталось валидно.
          const dropped = meleeFindInvalid(s.skills, updated);
          const hitsApplied = dropped.filter((id) => (s.skills[id] || 0) > 0);
          if (hitsApplied.length > 0) {
            // Применённые способности сломались бы — запрещаем снятие.
            const names = hitsApplied.map((id) => `«${MELEE_BY_ID[id]?.name || id}»`).join(', ');
            get().addLog(`❌ Нельзя снять: сломается ${names} (сначала сброс ветки)`, 'warning');
            return;
          }
          let refund = def.freeTake ? 0 : 1;
          if (dropped.length > 0) {
            for (const id of dropped) {
              if (!MELEE_BY_ID[id]?.freeTake) refund += updated[id] || 0;
              delete updated[id];
            }
            const names = dropped.map((id) => `«${MELEE_BY_ID[id]?.name || id}»`).join(', ');
            get().addLog(`🧹 Закрыто без гейта и снято: ${names}`, 'warning');
          }
          set({ skillPoints: s.skillPoints + refund, pendingSkills: updated });
          return;
        }
        // Снятие применённой базовой способности (была бесплатна — без возврата).
        const applied = s.skills[skillId] || 0;
        if (applied > 0 && def.freeTake) {
          const cur = { ...get().skills };
          delete cur[skillId];
          set({ skills: cur });
          try {
            const token = useAuthStore.getState().token;
            if (!token) throw new Error('no token');
            const res = await fetch('/api/skills/remove.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ skillIds: [skillId] }),
            });
            if (!res.ok) throw new Error('remove failed');
            get().addLog(`🔄 «${def.name}» снята`, 'info');
          } catch {
            set({ skills: { ...get().skills, [skillId]: applied } });
            get().addLog('❌ Не удалось снять способность', 'warning');
          }
        }
      },

      allocateShooter: async (skillId) => {
        const s = get();
        const def = SHOOTER_BY_ID[skillId];
        if (!def) return;
        if (!get().requireClassFor(skillId)) return;
        // Базовые бесплатны и применяются СРАЗУ (без ПРИНЯТЬ): клик — активна.
        if (def.freeTake) {
          const st = get();
          const check = shooterCanAllocate(skillId, st.skills, st.pendingSkills, st.skillPoints);
          if (!check.ok) {
            if (check.reason) get().addLog(`❌ ${check.reason}`, 'warning');
            return;
          }
          const toApply: Record<string, number> = { [skillId]: 1 };
          const cur = get();
          set({ skills: { ...cur.skills, ...toApply } });
          get().recalcStats();
          try {
            const token = useAuthStore.getState().token;
            if (!token) throw new Error('no token');
            const res = await fetch('/api/skills/apply.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ pendingSkills: toApply }),
            });
            if (!res.ok) throw new Error('apply failed');
            const json = await res.json();
            set({ skills: json.skills, skillPoints: json.skillPoints });
            get().addLog(`✨ «${def.name}» активна`, 'info');
          } catch {
            const rollback = { ...get().skills };
            for (const id of Object.keys(toApply)) delete rollback[id];
            set({ skills: rollback });
            get().addLog('❌ Не удалось взять способность (нет связи?)', 'warning');
          }
          return;
        }
        const st = get();
        const check = shooterCanAllocate(skillId, st.skills, st.pendingSkills, st.skillPoints);
        if (!check.ok) {
          if (check.reason) get().addLog(`❌ ${check.reason}`, 'warning');
          return;
        }
        const pending = st.pendingSkills[skillId] || 0;
        set({ skillPoints: st.skillPoints - 1, pendingSkills: { ...st.pendingSkills, [skillId]: pending + 1 } });
      },

      deallocateShooter: async (skillId) => {
        const s = get();
        const def = SHOOTER_BY_ID[skillId];
        if (!def) return;
        const pending = s.pendingSkills[skillId] || 0;
        if (pending > 0) {
          const next = pending - 1;
          const updated = { ...s.pendingSkills };
          if (next <= 0) delete updated[skillId];
          else updated[skillId] = next;
          // Антиабуз: проверяем, что после снятия всё осталось валидно.
          const dropped = shooterFindInvalid(s.skills, updated);
          const hitsApplied = dropped.filter((id) => (s.skills[id] || 0) > 0);
          if (hitsApplied.length > 0) {
            // Применённые способности сломались бы — запрещаем снятие.
            const names = hitsApplied.map((id) => `«${SHOOTER_BY_ID[id]?.name || id}»`).join(', ');
            get().addLog(`❌ Нельзя снять: сломается ${names} (сначала сброс ветки)`, 'warning');
            return;
          }
          let refund = def.freeTake ? 0 : 1;
          if (dropped.length > 0) {
            for (const id of dropped) {
              if (!SHOOTER_BY_ID[id]?.freeTake) refund += updated[id] || 0;
              delete updated[id];
            }
            const names = dropped.map((id) => `«${SHOOTER_BY_ID[id]?.name || id}»`).join(', ');
            get().addLog(`🧹 Закрыто без гейта и снято: ${names}`, 'warning');
          }
          set({ skillPoints: s.skillPoints + refund, pendingSkills: updated });
          return;
        }
        // Снятие применённой базовой способности (была бесплатна — без возврата).
        const applied = s.skills[skillId] || 0;
        if (applied > 0 && def.freeTake) {
          const cur = { ...get().skills };
          delete cur[skillId];
          set({ skills: cur });
          try {
            const token = useAuthStore.getState().token;
            if (!token) throw new Error('no token');
            const res = await fetch('/api/skills/remove.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ skillIds: [skillId] }),
            });
            if (!res.ok) throw new Error('remove failed');
            get().addLog(`🔄 «${def.name}» снята`, 'info');
          } catch {
            set({ skills: { ...get().skills, [skillId]: applied } });
            get().addLog('❌ Не удалось снять способность', 'warning');
          }
        }
      },

      allocatePet: async (skillId) => {
        const s = get();
        const def = PET_BY_ID[skillId];
        if (!def) return;
        if (!get().requireClassFor(skillId)) return;
        if (def.freeTake) {
          const st = get();
          const check = petCanAllocate(skillId, st.skills, st.pendingSkills, st.skillPoints);
          if (!check.ok) {
            if (check.reason) get().addLog(`❌ ${check.reason}`, 'warning');
            return;
          }
          set({ skills: { ...st.skills, [skillId]: 1 } });
          get().recalcStats();
          try {
            const token = useAuthStore.getState().token;
            if (!token) throw new Error('no token');
            const res = await fetch('/api/skills/apply.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ pendingSkills: { [skillId]: 1 } }),
            });
            if (!res.ok) throw new Error('apply failed');
            const json = await res.json();
            set({ skills: json.skills, skillPoints: json.skillPoints });
            get().addLog(`✨ «${def.name}» активна`, 'info');
          } catch {
            const rollback = { ...get().skills };
            delete rollback[skillId];
            set({ skills: rollback });
            get().addLog('❌ Не удалось взять способность (нет связи?)', 'warning');
          }
          return;
        }
        const check = petCanAllocate(skillId, s.skills, s.pendingSkills, s.skillPoints);
        if (!check.ok) {
          if (check.reason) get().addLog(`❌ ${check.reason}`, 'warning');
          return;
        }
        const pending = s.pendingSkills[skillId] || 0;
        set({ skillPoints: s.skillPoints - 1, pendingSkills: { ...s.pendingSkills, [skillId]: pending + 1 } });
      },

      deallocatePet: async (skillId) => {
        const s = get();
        const def = PET_BY_ID[skillId];
        if (!def) return;
        const pending = s.pendingSkills[skillId] || 0;
        if (pending > 0) {
          const next = pending - 1;
          const updated = { ...s.pendingSkills };
          if (next <= 0) delete updated[skillId];
          else updated[skillId] = next;
          const dropped = petFindInvalid(s.skills, updated);
          const hitsApplied = dropped.filter((id) => (s.skills[id] || 0) > 0);
          if (hitsApplied.length > 0) {
            const names = hitsApplied.map((id) => `«${PET_BY_ID[id]?.name || id}»`).join(', ');
            get().addLog(`❌ Нельзя снять: сломается ${names} (сначала сброс ветки)`, 'warning');
            return;
          }
          let refund = def.freeTake ? 0 : 1;
          if (dropped.length > 0) {
            for (const id of dropped) {
              if (!PET_BY_ID[id]?.freeTake) refund += updated[id] || 0;
              delete updated[id];
            }
            const names = dropped.map((id) => `«${PET_BY_ID[id]?.name || id}»`).join(', ');
            get().addLog(`🧹 Закрыто без гейта и снято: ${names}`, 'warning');
          }
          set({ skillPoints: s.skillPoints + refund, pendingSkills: updated });
          return;
        }
        const applied = s.skills[skillId] || 0;
        if (applied > 0 && def.freeTake) {
          const cur = { ...get().skills };
          delete cur[skillId];
          set({ skills: cur });
          try {
            const token = useAuthStore.getState().token;
            if (!token) throw new Error('no token');
            const res = await fetch('/api/skills/remove.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ skillIds: [skillId] }),
            });
            if (!res.ok) throw new Error('remove failed');
            get().addLog(`🔄 «${def.name}» снята`, 'info');
          } catch {
            set({ skills: { ...get().skills, [skillId]: applied } });
            get().addLog('❌ Не удалось снять способность', 'warning');
          }
        }
      },

      setActivePet: (kind) => {
        if (kind && isPetBranchHidden(kind)) {
          get().addLog('🔒 Этот зверь выйдет в будущем обновлении', 'warning');
          return;
        }
        set({ activePetId: kind });
        get().recalcAbilities();
        get().syncPetAura();
      },

      loadPetState: async () => {
        const token = useAuthStore.getState().token;
        if (!token) return;
        try {
          const res = await fetch('/api/pets/state.php', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const json = await res.json();
          if (typeof json.value === 'number') {
          set({ petSatiety: { value: json.value, updatedAt: Date.now() } });
          }
        } catch { /* silent */ }
      },

      feedPet: async (itemId) => {
        const token = useAuthStore.getState().token;
        if (!token) return;
        try {
          const res = await fetch('/api/pets/feed.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ itemId }),
          });
          const json = await res.json();
          if (!res.ok) {
            get().addLog(`❌ ${json.error || 'Не удалось покормить'}`, 'warning');
            return;
          }
          set({ petSatiety: { value: json.value, updatedAt: Date.now() } });
          // Убрать съеденное локально (рюкзак или инвентарь) + синк.
          const take = json.consumed ?? 0;
          if (take > 0) {
            const s = get();
            const gridIt = s.backpackGrid.items.find((i) => i.id === itemId);
            if (gridIt) {
              const left = (gridIt.quantity ?? 1) - take;
              let grid = s.backpackGrid;
              if (left > 0) {
                const items = grid.items.map((i) => (i.id === itemId ? { ...i, quantity: left } : i));
                const cells = grid.cells.map((row) => [...row]);
                grid = { ...grid, items, cells };
              } else {
                grid = removeItemFromGrid(grid, itemId);
              }
              set({ backpackGrid: grid });
            } else {
              const inv = useInventoryStore.getState();
              if (inv.items.some((i: any) => i.id === itemId)) {
                for (let k = 0; k < take; k++) {
                  const cur = useInventoryStore.getState().items.find((i: any) => i.id === itemId);
                  if (!cur) break;
                  if ((cur.quantity ?? 1) <= 1) useInventoryStore.getState().removeItem(itemId);
                  else useInventoryStore.getState().decrementItem(itemId);
                }
              }
            }
            syncNow();
          }
          playCombatSound('nom-nom-nom_gPJiWn4', 0.5);
          get().addLog(`🍖 Питомец поел (−${json.consumed} шт.), сытость ${Math.round(json.value)}%`, 'info');
        } catch {
          get().addLog('❌ Ошибка сети при кормлении', 'warning');
        }
      },

      // Аура стаи: пока зверь активен и не спит — hidden-эффект у игрока.
      syncPetAura: () => {
        const s = get();
        const combat = useCombatGridStore.getState();
        const pet = combat.enemies.find((e: any) => e.isPet && !e.dead && !e.sleeping && (e.currentHp || 0) > 0);
        const cur = s.activeEffects.find((e) => e.id === 'pet_aura');
        if (!s.activePetId || !pet) {
          if (cur) {
            set({ activeEffects: s.activeEffects.filter((e) => e.id !== 'pet_aura') });
            get().recalcStats();
          }
          return;
        }
        const boosts: Record<string, number> = {};
        const mults: Record<string, number> = {};
        for (const a of petBranchAuras(s.activePetId, s.skills)) {
          // Стена стаи — % к броне, Улучшенная стена — % к здоровью,
          // Кровь стаи — % к урону союзников.
          if ((a.stat === 'armor' || a.stat === 'maxHp' || a.stat === 'damage') && a.value < 1) {
            mults[a.stat] = (mults[a.stat] || 0) + a.value;
          } else {
            boosts[a.stat] = (boosts[a.stat] || 0) + a.value;
          }
        }
        if (Object.keys(boosts).length === 0 && Object.keys(mults).length === 0) {
          if (cur) {
            set({ activeEffects: s.activeEffects.filter((e) => e.id !== 'pet_aura') });
            get().recalcStats();
          }
          return;
        }
        const effect = {
          id: 'pet_aura', name: 'Аура стаи', duration: 999, remaining: 999,
          statBoosts: boosts, statBoostsMult: mults,
        } as any;
        const next = cur
          ? s.activeEffects.map((e) => (e.id === 'pet_aura' ? { ...effect, remaining: e.remaining } : e))
          : [...s.activeEffects, effect];
        set({ activeEffects: next });
        get().recalcStats();
      },

      // Удаление старых sniper_* очков (ветка заменена). Возврат очков — через loadSkills.
      migrateSniper: async () => {
        if ((globalThis as any).__snpMigrated) return;
        (globalThis as any).__snpMigrated = true;
        const token = useAuthStore.getState().token;
        if (!token) return;
        try {
          await fetch('/api/skills/migrate_sniper.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          });
          await get().loadSkills();
          get().addLog('🔄 Ветка снайпера обновлена, очки возвращены', 'info');
        } catch { /* silent */ }
      },

      applySkills: async () => {
        const s = get();
        const token = useAuthStore.getState().token;
        if (!token) return;
        // Скрытность: выдаётся сразу при выборе снайпера (в том же запросе).
        const pending = { ...s.pendingSkills };
        const hasSnp = SNIPER_ABILITIES.some((a) => (pending[a.id] || 0) > 0 || (s.skills[a.id] || 0) > 0);
        if (hasSnp && !(pending['snp_x_stealth'] > 0) && !(s.skills['snp_x_stealth'] > 0)) {
          pending['snp_x_stealth'] = 1;
        }
        try {
          const res = await fetch('/api/skills/apply.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ pendingSkills: pending }),
          });
          if (!res.ok) {
            const err = await res.json();
            get().addLog(`❌ ${err.error || 'Ошибка применения навыков'}`, 'warning');
            return;
          }
          const json = await res.json();
          set({ skills: json.skills, skillPoints: json.skillPoints, pendingSkills: {} });
          get().recalcStats();
          get().addLog('✅ Навыки применены!', 'info');
        } catch {
          get().addLog('❌ Ошибка сети при применении навыков', 'warning');
        }
      },

      cancelSkills: () => {
        const s = get();
        const refund = Object.values(s.pendingSkills).reduce((a, b) => a + b, 0);
        set({ skillPoints: s.skillPoints + refund, pendingSkills: {} });
        get().addLog('🔄 Изменения отменены.', 'info');
      },

      // Классы: выбор (макс. 2, 3 очка) и отказ. Подтверждение — модалкой в UI.
      pickClass: (classId, className) => {
        const s = get();
        if (s.chosenClasses.includes(classId)) return;
        if (s.chosenClasses.length >= 2) {
          get().addLog('❌ Максимум 2 класса одновременно', 'warning');
          return;
        }
        if (s.skillPoints < 3) {
          get().addLog('❌ Выбор класса стоит 3 очка', 'warning');
          return;
        }
        set({ chosenClasses: [...get().chosenClasses, classId], skillPoints: get().skillPoints - 3 });
        get().addLog(`🎓 Класс «${className}» принят! Качай его ветку.`, 'info');
      },

      abandonClass: (classId) => {
        const s = get();
        if (!s.chosenClasses.includes(classId)) return;
        set({ chosenClasses: get().chosenClasses.filter((c) => c !== classId) });
        get().addLog('🚪 Класс убран из выбранных', 'info');
      },

      requireClassFor: (skillId) => {
        const cid = classForSkill(skillId);
        if (!cid) return true;
        if (get().chosenClasses.includes(cid)) return true;
        get().addLog('🔒 Сначала выбери класс (максимум 2, выбор — 3 очка)', 'warning');
        return false;
      },

      // Билды навыков: снимок текущей расстановки (макс. 5), загрузка через сброс.
      saveSkillBuild: () => {
        const s = get();
        const merged: Record<string, number> = { ...s.skills };
        for (const [id, pts] of Object.entries(s.pendingSkills)) merged[id] = (merged[id] || 0) + pts;
        const skills: Record<string, number> = {};
        for (const [id, pts] of Object.entries(merged)) if (pts > 0) skills[id] = pts;
        const total = Object.values(skills).reduce((a, b) => a + b, 0);
        if (total <= 0) {
          get().addLog('❌ Нечего сохранять — очки не расставлены', 'warning');
          return null;
        }
        const builds = useUiStore.getState().skillBuilds;
        if (builds.length >= 5) {
          get().addLog('❌ Максимум 5 билдов — удали старый', 'warning');
          return null;
        }
        let classId = SNIPER_META.id;
        let best = SNIPER_ABILITIES.reduce((sum, a) => sum + (skills[a.id] || 0), 0);
        for (const pk of ['bear', 'wolf', 'boar'] as const) {
          const spent = PET_ABILITIES.filter((a) => a.branch === pk).reduce((sum, a) => sum + (skills[a.id] || 0), 0);
          if (spent > best) { best = spent; classId = `pet_${pk}`; }
        }
        {
          const spent = MELEE_ABILITIES.reduce((sum, a) => sum + (skills[a.id] || 0), 0);
          if (spent > best) { best = spent; classId = MELEE_META.id; }
        }
        {
          const spent = SHOOTER_ABILITIES.reduce((sum, a) => sum + (skills[a.id] || 0), 0);
          if (spent > best) { best = spent; classId = SHOOTER_META.id; }
        }
        const className = classId === SNIPER_META.id
          ? SNIPER_META.name
          : classId === MELEE_META.id
            ? MELEE_META.name
            : classId === SHOOTER_META.id
              ? SHOOTER_META.name
              : (PET_META as any)[classId.replace('pet_', '')]?.name || classId;
        const build: SkillBuild = {
          id: `build_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: `${className} ${total}`,
          classId, total, createdAt: Date.now(), skills,
        };
        useUiStore.getState().setSkillBuilds([...builds, build]);
        get().addLog(`💾 Билд «${build.name}» сохранён`, 'info');
        return build.id;
      },

      deleteSkillBuild: (id) => {
        useUiStore.getState().setSkillBuilds(
          useUiStore.getState().skillBuilds.filter((b) => b.id !== id),
        );
        get().addLog('🗑️ Билд удалён', 'info');
      },

      loadSkillBuild: async (id) => {
        const build = useUiStore.getState().skillBuilds.find((b) => b.id === id);
        if (!build) return;
        const s = get();
        const hasApplied = Object.keys(s.skills).length > 0;
        const hasPending = Object.keys(s.pendingSkills).length > 0;
        if (hasApplied || hasPending) {
          const cost = hasApplied ? ` Применённые очки сбросятся за ${s.level * 100} 💾.` : '';
          if (!window.confirm(`Загрузить билд «${build.name}»? Текущая расстановка будет заменена.${cost}`)) return;
        }
        if (hasApplied) {
          await get().resetSkills();
        } else if (hasPending) {
          get().cancelSkills();
        }
        const earned = 3 + (get().level - 1) * 3;
        // Бесплатные базовые в лимит очков не входят.
        const freeIds = new Set([
          ...SNIPER_ABILITIES.filter((a) => a.freeTake).map((a) => a.id),
          ...PET_ABILITIES.filter((a) => a.freeTake).map((a) => a.id),
          ...PET_FREE_DEFS.filter((a) => a.freeTake).map((a) => a.id),
          ...MELEE_ABILITIES.filter((a) => a.freeTake).map((a) => a.id),
          ...SHOOTER_ABILITIES.filter((a) => a.freeTake).map((a) => a.id),
        ]);
        const paidTotal = Object.entries(build.skills).reduce((sum, [id, pts]) => sum + (freeIds.has(id) ? 0 : pts), 0);
        set({ pendingSkills: { ...build.skills }, skillPoints: Math.max(0, earned - paidTotal) });
        // Сброс снял классы — автоматом берём главный класс билда (за 3 очка,
        // как обычно; второй доберёшь вручную). Без класса билд не вкачать.
        const mainChosen = build.classId === SNIPER_META.id
          ? { id: SNIPER_META.id, name: SNIPER_META.name }
          : build.classId === MELEE_META.id
            ? { id: MELEE_META.id, name: MELEE_META.name }
            : build.classId === SHOOTER_META.id
              ? { id: SHOOTER_META.id, name: SHOOTER_META.name }
              : build.classId.startsWith('pet_')
                ? { id: 'lesnichiy', name: (PET_META as any)[build.classId.replace('pet_', '')]?.name || 'Лесничий' }
                : null;
        if (mainChosen) get().pickClass(mainChosen.id, mainChosen.name);
        get().addLog(`📥 Билд «${build.name}» подгружен — нажми ПРИНЯТЬ`, 'info');
      },

      loadSkills: async () => {
        const token = useAuthStore.getState().token;
        if (!token) return;
        try {
          const res = await fetch('/api/skills/load.php', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const json = await res.json();
          set({ skills: json.skills, skillPoints: json.skillPoints, pendingSkills: {} });
          // Классика удалена из игры: чистим старые id, очки возвращаем.
          const CLASSIC_PREFIXES = ['soldier_', 'demo_', 'night_', 'arcanist_', 'occult_', 'berserker_', 'tank_', 'survivor_', 'merchant_', 'trader_', 'stalker_', 'cap_'];
          const stc = get();
          const classicIds = Object.keys(stc.skills).filter((id) => CLASSIC_PREFIXES.some((p) => id.startsWith(p)));
          if (classicIds.length > 0) {
            const refund = classicIds.reduce((sum, id) => sum + (stc.skills[id] || 0), 0);
            const next = { ...stc.skills };
            classicIds.forEach((id) => delete next[id]);
            set({ skills: next, skillPoints: stc.skillPoints + refund });
            try {
              await fetch('/api/skills/remove.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ skillIds: classicIds }),
              });
            } catch { /* silent */ }
            get().addLog(`🧹 Удалённые классы сняты (${classicIds.length}, +${refund} очк.)`, 'warning');
          }
          // Антиабуз: чистим применённые способности без гейта (старые сейвы).
          const st = get();
          const bad = sniperFindInvalid(st.skills, {});
          const badMelee = meleeFindInvalid(st.skills, {});
          const badShooter = shooterFindInvalid(st.skills, {});
          const allBad = [...bad, ...badMelee.filter((id) => !bad.includes(id)), ...badShooter.filter((id) => !bad.includes(id))];
          if (allBad.length > 0) {
            const refund = allBad.reduce((sum, id) => sum + (st.skills[id] || 0), 0);
            const next = { ...st.skills };
            allBad.forEach((id) => delete next[id]);
            set({ skills: next, skillPoints: st.skillPoints + refund });
            get().recalcStats();
            try {
              await fetch('/api/skills/remove.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ skillIds: allBad }),
              });
            } catch { /* silent */ }
            get().addLog(`🧹 Сняты недействительные способности (${allBad.length}, +${refund} очк.)`, 'warning');
          }
          // Скрытность: автовыдача тем, у кого уже есть снайперские навыки (старые сейвы).
          const st2 = get();
          const hasSnpSkills = SNIPER_ABILITIES.some((a) => (st2.skills[a.id] || 0) > 0);
          if (hasSnpSkills && !(st2.skills['snp_x_stealth'] > 0)) {
            try {
              const ares = await fetch('/api/skills/apply.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ pendingSkills: { snp_x_stealth: 1 } }),
              });
              if (ares.ok) {
                const ajson = await ares.json();
                set({ skills: ajson.skills, skillPoints: ajson.skillPoints });
                get().addLog('🥷 Скрытность получена (база снайпера)', 'info');
              }
            } catch { /* silent */ }
          }
          get().recalcStats();
          // Миграция классов: у кого уже вкачано, но классы не выбраны — топ-2 бесплатно.
          const st3 = get();
          if (st3.chosenClasses.length === 0) {
            const spent = new Map<string, number>();
            for (const [id, pts] of Object.entries(st3.skills)) {
              const cid = classForSkill(id);
              if (cid && (pts as number) > 0) spent.set(cid, (spent.get(cid) || 0) + (pts as number));
            }
            const top = [...spent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([cid]) => cid);
            if (top.length > 0) {
              set({ chosenClasses: top });
              get().addLog(`🎓 Твои классы: ${top.join(', ')} (выбраны автоматически)`, 'info');
            }
          }
        } catch { /* silent */ }
      },

      resetSkills: async () => {
        const s = get();
        const cost = s.level * 100;
        const token = useAuthStore.getState().token;
        if (!token) return;
        // Clear skills immediately on client, don't wait for server.
        // Классы тоже снимаются (иначе сброс = бесплатные классы навсегда:
        // сервер вернёт все очки, а галки останутся). Перевыбор — за 3 очка.
        set({ skills: {}, pendingSkills: {}, chosenClasses: [] });
        get().recalcStats();
        try {
          const res = await fetch('/api/skills/reset.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const err = await res.json();
            get().addLog(`❌ ${err.error || 'Ошибка сброса навыков'}`, 'warning');
            return;
          }
          const json = await res.json();
          set({ skillPoints: json.skillPoints, dataChips: json.dataChips, chosenClasses: [] });
          get().addLog(`🔄 Навыки сброшены. Списанo ${cost} 💾. Классы сняты — выбери заново.`, 'info');
        } catch {
          get().addLog('❌ Ошибка сети при сбросе навыков', 'warning');
        }
      },

      skillBonuses: () => {
        const skills = get().skills;
        const total: PlayerStats = { ...EMPTY_STATS };
        const lvl = (id: string) => skills[id] || 0;

        // Классические ветки удалены из игры: остались снайпер (ниже) и питомцы.

        // Снайпер считается через src/data/sniper.ts (snp_*), см. ниже.
        for (const def of SNIPER_ABILITIES) {
          if (!def.statsPerRank) continue;
          const r = lvl(def.id);
          if (r <= 0) continue;
          for (const s of def.statsPerRank) {
            (total as any)[s.stat] = ((total as any)[s.stat] || 0) + s.value * r;
          }
        }

        // Милишник считается через src/data/melee.ts (mln_*).
        for (const def of MELEE_ABILITIES) {
          if (!def.statsPerRank) continue;
          const r = lvl(def.id);
          if (r <= 0) continue;
          for (const s of def.statsPerRank) {
            (total as any)[s.stat] = ((total as any)[s.stat] || 0) + s.value * r;
          }
        }

        // Стрелок считается через src/data/shooter.ts (sht_*).
        for (const def of SHOOTER_ABILITIES) {
          if (!def.statsPerRank) continue;
          const r = lvl(def.id);
          if (r <= 0) continue;
          for (const s of def.statsPerRank) {
            (total as any)[s.stat] = ((total as any)[s.stat] || 0) + s.value * r;
          }
        }

        // Классические ветки удалены из игры.

        return total;
      },

      skillUtility: () => {
        const s = get();
        const lvl = (id: string) => s.skills[id] || 0;

        const buyDiscount = lvl('trader_haggle') * 0.03 + lvl('trader_network') * 0.02 + lvl('trader_bulk') * 0.02;
        const sellBonus = lvl('trader_connections') * 0.03 + lvl('trader_network') * 0.02 + lvl('trader_bulk') * 0.02;
        const extraShopSlots = Math.floor(lvl('trader_shelves') / 2) * 1;
        const refreshDiscount = lvl('trader_discount') * 0.05 + lvl('trader_bulk') * 0.02;
        const chipBonus = lvl('trader_deal') * 0.05 + lvl('trader_bulk') * 0.02;
        const lootQualityBonus = lvl('trader_premium') * 0.03 + lvl('trader_bulk') * 0.02;

        const extraLootChance = lvl('stalker_lucky') * 0.05 + lvl('stalker_mastery') * 0.03;
        const chipFromStalker = lvl('stalker_bounty') * 0.05 + lvl('stalker_mastery') * 0.03;
        const xpFromStalker = lvl('stalker_scout') * 0.05 + lvl('stalker_experience') * 0.05 + lvl('stalker_mastery') * 0.03;
        const extraResourcePct = lvl('stalker_harvest') * 0.05 + lvl('stalker_mastery') * 0.03;
        const doubleLootChance = lvl('stalker_double') * 0.03 + lvl('stalker_mastery') * 0.03;
        const lootQualityFromStalker = lvl('stalker_quality') * 0.03 + lvl('stalker_mastery') * 0.03;

        const traderCapMulti = lvl('trader_capstone') > 0 ? 0.15 : 0;
        const stalkerCapMulti = lvl('stalker_capstone') > 0 ? 0.20 : 0;
        const stalkerCapLoot = lvl('stalker_capstone') > 0 ? 0.30 : 0;
        const stalkerCapDouble = lvl('stalker_capstone') > 0 ? 0.05 : 0;
        const traderCapSlots = lvl('trader_capstone') > 0 ? 2 : 0;

        const capChipBonus = lvl('stalker_capstone') > 0 ? 0.20 : 0;
        const capXpBonus = lvl('stalker_capstone') > 0 ? 0.20 : 0;

        return {
          buyDiscount: Math.min(0.9, buyDiscount * (1 + traderCapMulti)),
          sellBonus: sellBonus * (1 + traderCapMulti),
          extraShopSlots: extraShopSlots + traderCapSlots,
          refreshDiscount: Math.min(0.9, refreshDiscount * (1 + traderCapMulti)),
          chipMultiplier: 1 + chipBonus * (1 + traderCapMulti) + chipFromStalker * (1 + stalkerCapMulti) + capChipBonus,
          xpMultiplier: 1 + xpFromStalker * (1 + stalkerCapMulti) + capXpBonus,
          extraLootChance: extraLootChance * (1 + stalkerCapMulti) + stalkerCapLoot,
          extraResourcePct: extraResourcePct * (1 + stalkerCapMulti),
          doubleLootChance: Math.min(0.9, doubleLootChance * (1 + stalkerCapMulti) + stalkerCapDouble),
          lootQualityBonus: lootQualityBonus * (1 + traderCapMulti) + lootQualityFromStalker * (1 + stalkerCapMulti),
          utilityMultiplier: 1,
        };
      },

      useConsumable: (item) => {
        if (item.type !== 'consumable' && !item.timeLimit) {
          get().addLog(`❌ ${item.displayName || item.name} нельзя использовать.`, 'warning');
          return;
        }
        const abilId = item.abilityId || '';
        const RAW_FOOD = ['food_meat', 'food_potato', 'food_water'];
        if (RAW_FOOD.includes(abilId)) {
          get().addLog(`❌ ${item.displayName || item.name} нужно приготовить на костре!`, 'warning');
          return;
        }
        // Food: cannot eat during active combat
        const FOOD_HEAL: Record<string, number> = {
          food_sausage: 2, food_apple: 1, food_stew: 3, food_bread: 2,
          food_ragu: 12, food_fried_meat: 14, food_boiled_potato: 10,
          food_sandwich: 5, food_fried_potato: 8, food_boiled_water: 1,
          food_firstaid: 25, food_bandage: 15,
        };
        // Еда на выносливость: % от maxStamina.
        const FOOD_STAM: Record<string, number> = {
          food_coffee: 3, food_energy: 5, food_adrenaline: 10,
        };
        if (FOOD_HEAL[abilId] !== undefined || FOOD_STAM[abilId] !== undefined) {
          if (useCombatGridStore.getState().isCombatActive()) {
            get().addLog(`❌ Нельзя есть во время боя!`, 'warning');
            return;
          }
          const s = get();
          const parts: string[] = [];
          let newHp = s.stats.currentHp;
          let newStam = s.stats.stamina;
          if (FOOD_HEAL[abilId] !== undefined) {
            const pct = FOOD_HEAL[abilId];
            const heal = Math.round(s.stats.maxHp * pct / 100);
            newHp = Math.min(s.stats.maxHp, s.stats.currentHp + heal);
            parts.push(`+${pct}% HP (+${heal})`);
          }
          if (FOOD_STAM[abilId] !== undefined) {
            const pct = FOOD_STAM[abilId];
            const gain = Math.round(s.stats.maxStamina * pct / 100);
            newStam = Math.min(s.stats.maxStamina, s.stats.stamina + gain);
            parts.push(`+${pct}% выносливости (+${gain})`);
          }
          set({ stats: { ...s.stats, currentHp: newHp, stamina: newStam } });
          playCombatSound('nom-nom-nom_gPJiWn4', 0.5);
          get().addLog(`🍖 ${item.displayName || item.name}: ${parts.join(', ')}`, 'heal');
          const qty = (item.quantity ?? 1) as number;
          if (qty > 1) {
            useInventoryStore.getState().decrementItem(item.id);
          } else {
            useInventoryStore.getState().removeItem(item.id);
          }
          return;
        }
        get().addLog(`🧪 Использован: ${item.displayName || item.name}`, 'heal');
        const duration = item.timeLimit || 30;
        const effect: ActiveEffect = {
          id: `effect_${Date.now()}`,
          name: item.displayName || item.name,
          duration,
          remaining: duration,
          statBoosts: item.stats as any,
        };
        get().addEffect(effect);
        useInventoryStore.getState().removeItem(item.id);
      },

      addEffect: (effect) => {
        set((s) => ({ activeEffects: [...s.activeEffects, effect] }));
        get().recalcStats();
        get().addLog(`✨ Активирован эффект: ${effect.name} (${effect.duration} хода)`, 'heal');
      },

      removeEffect: (id) => {
        const s = get();
        const effect = s.activeEffects.find((e) => e.id === id);
        if (!effect) return;
        set((state) => ({ activeEffects: state.activeEffects.filter((e) => e.id !== id) }));
        get().addLog(`⏳ Эффект ${effect.name} закончился.`, 'info');
        get().recalcStats();
      },

      tickEffects: () => {
        const s = get();
        const expired: string[] = [];
        let hotHealTotal = 0;
        const updated = s.activeEffects.map((e) => {
          const remaining = e.remaining - 1;
          if (remaining <= 0) expired.push(e.id);
          // Apply heal-over-time
          if (e.statBoostsMult?.healOverTime) {
            hotHealTotal += Math.round(s.stats.maxHp * e.statBoostsMult.healOverTime);
          }
          return { ...e, remaining: Math.max(0, remaining) };
        });
        if (hotHealTotal > 0) {
          set((st) => ({
            stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + hotHealTotal) },
          }));
        }
        if (expired.length > 0) {
          set({ activeEffects: updated.filter((e) => !expired.includes(e.id)) });
          expired.forEach((id) => {
            const e = s.activeEffects.find((ef) => ef.id === id);
            if (e) get().addLog(`⏳ Эффект ${e.name} закончился.`, 'info');
          });
          get().recalcStats();
        } else {
          set({ activeEffects: updated });
        }
      },

      startTravel: (zoneName, travelTime) => {
        set({ travel: { isTraveling: true, isReturning: false, destination: zoneName, remaining: travelTime, total: travelTime } });
        get().addLog(`🚀 Отправляемся в "${zoneName}". Время: ${travelTime} сек.`, 'info');
      },

      travelTick: () => {
        const s = get();
        if (!s.travel.isTraveling) return;
        const newRemaining = s.travel.remaining - 1;
        // Дрейн стамины в пути — почасовая модель (−1%/ч), считает минутный тик и бекенд.
        set((state) => ({
          travel: { ...state.travel, remaining: newRemaining },
        }));
        if (newRemaining <= 0) {
          set({ travel: { isTraveling: false, isReturning: false, destination: null, remaining: 0, total: 0 } });
          get().addLog(`📍 Прибыли в "${s.travel.destination}".`, 'info');
        }
      },

      cancelTravel: () => {
        set({ travel: { isTraveling: false, isReturning: false, destination: null, remaining: 0, total: 0 } });
        get().addLog(`❌ Путь прерван.`, 'warning');
      },

      startReturnHome: () => {
        set({ travel: { isTraveling: false, isReturning: true, destination: 'База', remaining: 1, total: 1 } });
        get().addLog(`🚀 Возвращаемся на базу... 1 сек.`, 'info');
      },

      returnHomeTick: () => {
        const s = get();
        if (!s.travel.isReturning) return;
        set((state) => ({ travel: { ...state.travel, remaining: state.travel.remaining - 1 } }));
        if (s.travel.remaining <= 1) {
          set({
            travel: { isTraveling: false, isReturning: false, destination: null, remaining: 0, total: 0 },
          });
          get().addLog(`🏠 Вернулись на базу.`, 'heal');
        }
      },

      startCombat: (zoneDifficulty, silent) => {
        const playerLevel = get().level;
        const enemyData = generateEnemy(playerLevel, zoneDifficulty);
        const enemyName = ('name' in enemyData ? (enemyData as any).name : 'Враг') || 'Враг';
        const maxHp = Math.round(enemyData.scaledHealth);
        set({
          combat: {
            isFighting: true, enemyHp: maxHp, enemyMaxHp: maxHp,
            enemyName,
            enemyDamage: Math.round(enemyData.scaledDamage) || 10,
            enemyArmor: enemyData.scaledArmor || 2,
            enemyRegen: enemyData.scaledRegen || 0.5,
            enemyAccuracy: enemyData.scaledAccuracy || 0.9,
            enemyEvasion: enemyData.scaledEvasion || 0.05,
            enemyBlock: enemyData.scaledBlock || 0,
            enemyPunching: enemyData.scaledPunching || 0,
            enemyCrit: enemyData.scaledCrit || 0,
            enemyVampir: enemyData.scaledVampir || 0.001,
            enemyFaction: enemyData.faction || 'Неизвестно',
            enemyExpReward: (enemyData.expRewardMultiplier || 1) * 100,
            enemyChipReward: Math.floor(zoneDifficulty * 15 + 20),
            turnCount: 0,
          },
        });
        if (!silent) get().addLog(`⚔️ ВСТРЕЧА! ${enemyName} (фракция: ${enemyData.faction || 'Неизвестно'})`, 'damage');
      },

      combatTick: () => {
        const s = get();
        if (!s.combat.isFighting) return { enemyDefeated: false, playerDefeated: false };

        const player: CombatPlayer = {
          dps: s.stats.damage, dpsToxis: s.stats.dpsToxis,
          dpsEmi: s.stats.dpsEmi, dpsExtro: s.stats.dpsExtro, dpsFire: s.stats.dpsFire,
          health: s.stats.maxHp, stamina: s.stats.stamina,
          armor: s.stats.armor, regen: s.stats.regen,
          accuracy: s.stats.accuracy, evasion: s.stats.evasion,
          block: s.stats.block, punching: s.stats.punching, vampir: s.stats.vampir,
          crit: s.stats.crit,
        };
        const enemy: CombatEnemy = {
          dps: s.combat.enemyDamage, health: s.combat.enemyMaxHp,
          armor: s.combat.enemyArmor, regen: s.combat.enemyRegen,
          accuracy: s.combat.enemyAccuracy, evasion: s.combat.enemyEvasion,
          block: s.combat.enemyBlock, punching: s.combat.enemyPunching,
          vampir: s.combat.enemyVampir, crit: s.combat.enemyCrit, faction: s.combat.enemyFaction,
        };

        const result = calculateCombatStep(player, enemy, s.stats.currentHp, s.combat.enemyHp);
        result.logMessages.forEach((msg) => get().addLog(msg, 'damage'));

        const staminaDrain = 0.02 * s.combat.turnCount + 0.01;
        set((state) => ({
          stats: {
            ...state.stats,
            currentHp: result.newPlayerHp,
            stamina: Math.max(0, state.stats.stamina - staminaDrain),
          },
          combat: {
            ...state.combat,
            enemyHp: result.newEnemyHp,
            turnCount: state.combat.turnCount + 1,
          },
        }));

        const enemyDefeated = result.newEnemyHp <= 0;
        const playerDefeated = result.newPlayerHp <= 0;
        if (enemyDefeated || playerDefeated) get().endCombat(enemyDefeated, playerDefeated);
        return { enemyDefeated, playerDefeated };
      },

      endCombat: (playerWon, enemyWon) => {
        const s = get();
        if (playerWon) {
          const util = get().skillUtility();
          const expReward = Math.floor(s.combat.enemyExpReward * (1 + s.level * 0.1) * util.xpMultiplier);
          const chipReward = Math.floor(s.combat.enemyChipReward * util.chipMultiplier);
          get().addLog(`🏆 ПОБЕДА! +${expReward} опыта, +${chipReward} чипов`, 'loot');
          get().addExp(expReward);
          get().addChips(chipReward);
          // Stamina cost: 10% of max
          set((state) => ({ stats: { ...state.stats, stamina: Math.max(0, state.stats.stamina - state.stats.maxStamina * 0.1) } }));

          const lootItems = generateLoot(GAME_ITEMS, s.level, {
            bonusQuality: util.lootQualityBonus,
            extraItemChance: util.extraLootChance,
            extraResourcePct: util.extraResourcePct,
            doubleLootChance: util.doubleLootChance,
          });
          if (lootItems.length > 0) {
            get().addLog(`🎒 Добыто ${lootItems.length} предмет(ов): ${lootItems.map((li) => li.displayName).join(', ')}`, 'loot');
            lootItems.forEach((li) => useInventoryStore.getState().addItem(li));
          }
          // Auto-return home
          get().startReturnHome();
        } else if (enemyWon) {
          get().addLog(`💀 ПОРАЖЕНИЕ...`, 'warning');
          set((state) => ({ stats: { ...state.stats, currentHp: 1 } }));
        }
        // Clear combat-only effects
        set((state) => ({
          stats: { ...state.stats, shieldCharges: 0 },
          activeEffects: (state.activeEffects || []).filter((e: any) => !e.id.startsWith('ability_')),
          combat: { ...state.combat, isFighting: false },
        }));
      },

      rest: () => get().addLog('🛌 Начинаем отдых для восстановления сил.', 'info'),

      restTick: () => {
        const s = get();
        if (s.stats.currentHp >= s.stats.maxHp && s.stats.stamina >= s.stats.maxStamina) return true;
        const regenUsed = s.stats.regen;
        const hpBefore = s.stats.currentHp;
        const hpAfter = Math.min(s.stats.maxHp, hpBefore + regenUsed * 3 + 5);
        console.log('[REST_TICK_FN]', { before: hpBefore, regenUsed, formula: `${regenUsed}*3+5=${regenUsed*3+5}`, after: hpAfter, maxHp: s.stats.maxHp, ts: Date.now() });
        set((state) => ({
          stats: {
            ...state.stats,
            currentHp: Math.min(state.stats.maxHp, state.stats.currentHp + state.stats.regen * 3 + 5),
            stamina: Math.min(state.stats.maxStamina, state.stats.stamina + 2),
          },
        }));
        return false;
      },

    }),
    {
      name: 'remastered_player',
      version: 16,
      migrate: (persisted: any, version: number) => {
        if (version < 11 && persisted) {
          // Моды переехали на рантайм-скейл: гасим старый запечённый скейл один раз.
          const eq = persisted.equipment || {};
          for (const it of Object.values(eq)) demoteModStats(it);
          for (const it of (persisted.backpackGrid?.items || persisted.backpackContents || [])) demoteModStats(it);
        }
        if (version < 12 && persisted) {
          // Старые моды (без метки) удаляем из игры: россыпь и вставленные.
          let n = 0;
          const eq = persisted.equipment || {};
          for (const it of Object.values(eq) as any[]) {
            if (it && (it as any).mods) {
              const fresh: any = {};
              for (const [mk, mv] of Object.entries((it as any).mods)) {
                if ((mv as any)?._modv === 2) fresh[mk] = mv;
                else n += 1;
              }
              (it as any).mods = fresh;
            }
          }
          if (Array.isArray(persisted.backpackContents)) {
            const before = persisted.backpackContents.length;
            persisted.backpackContents = persisted.backpackContents.filter(
              (it: any) => !(it?.type === 'mod' && (it as any)._modv !== 2),
            );
            n += before - persisted.backpackContents.length;
          }
          if (n > 0 && Array.isArray(persisted.logs)) {
            persisted.logs.push({ id: Date.now(), message: `🔧 Старые моды удалены из игры (${n} шт.)`, type: 'system', ts: Date.now() });
          }
        }
        if (version < 13 && persisted) {
          // Лечение модов нового образца, ошибочно порезанных даунскейлом
          // (делил сырые статы — откатываем умножением обратно, точно).
          let h = 0;
          const eq = persisted.equipment || {};
          for (const it of Object.values(eq) as any[]) {
            if (it && healWronglyDemoted(it)) h += 1;
          }
          if (Array.isArray(persisted.backpackContents)) {
            for (const it of persisted.backpackContents) {
              if (it && healWronglyDemoted(it)) h += 1;
            }
          }
          if (h > 0 && Array.isArray(persisted.logs)) {
            persisted.logs.push({ id: Date.now(), message: `🔧 Моды восстановлены после ошибочного даунскейла (${h} шт.)`, type: 'system', ts: Date.now() });
          }
        }
        // v14: Convert old flat backpackContents array to backpackGrid
        if (version < 14 && persisted && Array.isArray(persisted.backpackContents)) {
          const oldItems: Item[] = persisted.backpackContents;
          const pack = persisted.equipment?.backpack;
          const slots = (() => {
            try {
              const def = backpackDefByName(pack?.name || '');
              return def ? backpackSlots(def, pack?.quality) : 4;
            } catch { return 4; }
          })();
          // Reuse the import
          let grid = createGrid(slots);
          for (const it of oldItems) {
            const { grid: g } = tryInsertIntoGrid(grid, it);
            grid = g;
          }
          persisted.backpackGrid = grid;
          delete persisted.backpackContents;
        }
        // v15: активный питомец (по умолчанию нет).
        if (version < 15 && persisted) {
          if (persisted.activePetId === undefined) persisted.activePetId = null;
        }
        // v16: выбранные классы (по умолчанию нет).
        if (version < 16 && persisted) {
          if (persisted.chosenClasses === undefined) persisted.chosenClasses = [];
        }
        return persisted;
      },
      partialize: (state) => ({
        level: state.level, currentExp: state.currentExp, expToNext: state.expToNext,
        dataChips: state.dataChips, baseHealth: state.baseHealth,
        stats: state.stats, equipment: state.equipment,
        backpackGrid: state.backpackGrid,
        activeEffects: state.activeEffects,
        skillPoints: state.skillPoints,
        activePetId: state.activePetId,
        chosenClasses: state.chosenClasses,
        activeWeaponSlot: state.activeWeaponSlot,
        reforgeWeapon: state.reforgeWeapon,
        reforgeBlueprint: state.reforgeBlueprint,
        logs: pruneLogs(state.logs).slice(-LOG_MAX_SAVED), logIdCounter: state.logIdCounter,
        explorationDeathTimestamp: state.explorationDeathTimestamp,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.recalcStats();
      },
    },
  ),
);
