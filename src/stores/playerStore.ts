import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateCombatStep, type CombatPlayer, type CombatEnemy } from '../engine/combat';
import { generateEnemy } from '../engine/enemies';
import { generateLoot } from '../engine/loot';
import { GAME_ITEMS, SET_BONUSES } from '../data/GameItems';
import { useInventoryStore } from './inventoryStore';
import { useUiStore } from './uiStore';
import type { Item } from '../types/items';
import type { ActiveEffect } from '../types/player';
import type { AccessoryAbility } from '../types/abilities';
import { ABILITY_MAP } from '../data/accessoryAbilities';
import { SKILL_CLASSES } from '../data/skills';

const EQUIPMENT_SLOTS = [
  'head', 'armor', 'weapon1', 'weapon2', 'gloves', 'boots',
  'ammo1', 'ammo2', 'ammo3', 'ammo4',
] as const;
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];

const AMMO_SLOTS: EquipmentSlot[] = ['ammo1', 'ammo2', 'ammo3', 'ammo4'];

export const getEquipSlot = (item: Item): EquipmentSlot | null => {
  if (!item.slot) return null;
  if ((EQUIPMENT_SLOTS as readonly string[]).includes(item.slot)) return item.slot as EquipmentSlot;
  if (item.slot === 'ammo') return 'ammo1';
  return null;
};

const AMMO_BONUSES: Record<string, { dpsStat: keyof PlayerStats; multiplier: number }> = {
  toxis: { dpsStat: 'dpsToxis', multiplier: 1.0 },
  emi: { dpsStat: 'dpsEmi', multiplier: 1.0 },
  normal: { dpsStat: 'dpsExtro', multiplier: 0.10 },
  extro: { dpsStat: 'dpsFire', multiplier: 1.0 },
};

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
  damage: number; crit: number; armor: number; regen: number;
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
  activeEffects: ActiveEffect[];
  baseUpgrades: Record<string, number>;
  skillPoints: number;
  skills: Record<string, number>;
  pendingSkills: Record<string, number>;
  travel: TravelState; combat: CombatState;
  logs: LogEntry[]; logIdCounter: number;
  powerBreakdown: PowerBreakdown;
  explorationDeathTimestamp: number;

  addLog: (msg: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
  addExp: (amount: number) => void;
  addChips: (amount: number) => void;
  resetLevel: () => void;
  spendChips: (amount: number) => boolean;
  recalcStats: () => void;
  recalcAbilities: () => void;
  accessoryAbilities: (AccessoryAbility | null)[];

  equipItem: (slot: EquipmentSlot, item: Item) => boolean;
  unequipItem: (slot: EquipmentSlot) => Item | null;
  upgradeBase: (id: string) => void;
  spendSkillPoint: (skillId: string) => boolean;
  allocateSkill: (skillId: string) => void;
  deallocateSkill: (skillId: string) => void;
  applySkills: () => void;
  cancelSkills: () => void;
  resetSkills: () => void;
  skillBonuses: () => PlayerStats;
  skillUtility: () => SkillUtilityEffects;

  useConsumable: (item: Item) => void;
  addEffect: (effect: ActiveEffect) => void;
  removeEffect: (id: string) => void;
  tickEffects: () => void;
  baseUpgradeTick: () => void;

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
  damage: 0, crit: 0, armor: 0, regen: 0, evasion: 0, block: 0,
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

const sumItemStats = (items: (Item | null)[]): PlayerStats => {
  const total = { ...EMPTY_STATS };
  for (const item of items) {
    if (!item || !item.stats) continue;
    for (const [k, v] of Object.entries(item.stats)) {
      const val = typeof v === 'object' ? ((v as any)?.base || 0) : (v || 0);
      const mappedKey = STAT_KEY_MAP[k] || (k as keyof PlayerStats);
      if (mappedKey in total) (total as any)[mappedKey] += val;
    }
    // Sum stats from installed mods
    if (item.mods) {
      for (const mod of Object.values(item.mods)) {
        if (!mod || !mod.stats) continue;
        for (const [k, v] of Object.entries(mod.stats)) {
          const val = typeof v === 'object' ? ((v as any)?.base || 0) : (v || 0);
          const mappedKey = STAT_KEY_MAP[k] || (k as keyof PlayerStats);
          if (mappedKey in total) (total as any)[mappedKey] += val;
        }
      }
    }
  }
  return total;
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
  const blockRed = stats.block < 2.0 ? stats.block * 0.5 : stats.block < 3.0 ? 0.8 : 0.9;
  const armorEHP = stats.armor * FIGHT_TIME;
  const evasionEHP = stats.evasion < 1 ? 1000 * stats.evasion / (1 - stats.evasion) : Infinity;
  const blockEHP = blockRed < 1 ? 1000 * blockRed / (1 - blockRed) : Infinity;
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
  damage: 5, crit: 0.05, armor: 2, regen: 1, evasion: 0.05, block: 0,
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
      powerBreakdown: { offensiveScore: 0, defensiveScore: 0, abilityItems: [], itemPowers: [] },
      explorationDeathTimestamp: 0,

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
        const items = EQUIPMENT_SLOTS.map((slot) => s.equipment[slot]);
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
          maxHp: BASE_STATS.maxHp + lvl * 20 + equipBonus.maxHp + effectBonus.maxHp + skillBonus.maxHp + setBonus.maxHp,
          currentHp: 0,
          maxStamina: BASE_STATS.maxStamina + lvl * 5 + equipBonus.maxStamina + effectBonus.maxStamina + skillBonus.maxStamina + setBonus.maxStamina,
          stamina: 0,
          damage: Math.max(1, dps),
          crit: Math.max(0, BASE_STATS.crit + equipBonus.crit + effectBonus.crit + skillBonus.crit + setBonus.crit),
          armor: Math.max(0, BASE_STATS.armor + equipBonus.armor + effectBonus.armor + skillBonus.armor + setBonus.armor),
          regen: Math.max(0, BASE_STATS.regen + equipBonus.regen + effectBonus.regen + skillBonus.regen + setBonus.regen),
          evasion: Math.min(0.9, Math.max(0, BASE_STATS.evasion + equipBonus.evasion + effectBonus.evasion + skillBonus.evasion + setBonus.evasion)),
          block: Math.min(0.9, Math.max(0, BASE_STATS.block + equipBonus.block + effectBonus.block + skillBonus.block + setBonus.block)),
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

        // Ammo DPS stacking — each ammo slot adds its bonus
        for (const ammoSlot of AMMO_SLOTS) {
          const ammo = s.equipment[ammoSlot];
          if (ammo && ammo.damage && AMMO_BONUSES[ammo.damage]) {
            const bonus = AMMO_BONUSES[ammo.damage];
            newStats[bonus.dpsStat] += dps * bonus.multiplier;
          }
        }

        // Bullet passive amplification — double matching elemental DPS
        for (const ammoSlot of AMMO_SLOTS) {
          const ammo = s.equipment[ammoSlot];
          if (ammo && ammo.damage && ammo.damage !== 'normal') {
            const bonus = AMMO_BONUSES[ammo.damage];
            if (bonus && newStats[bonus.dpsStat] > 0) {
              newStats[bonus.dpsStat] *= 2;
            }
          }
        }

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

        // Power rating
        const { offensiveScore, defensiveScore } = computePowerFromStats(newStats);
        let powerFromAbilities = 0;
        const abilityItems: PowerBreakdownItem[] = [];
        for (const slot of AMMO_SLOTS) {
          const item = s.equipment[slot];
          if (item && item.abilityId && ABILITY_MAP[item.abilityId]) {
            const base = ABILITY_MAP[item.abilityId].powerRating;
            const levelFactor = 1 + (item.level - 1) * 0.05;
            const pwr = Math.round(base * levelFactor * 3);
            powerFromAbilities += pwr;
            abilityItems.push({ slot, itemName: item.displayName || item.name, abilityName: ABILITY_MAP[item.abilityId].name, power: pwr });
          }
        }
        const fullPower = offensiveScore + defensiveScore + powerFromAbilities;
        newStats.power = fullPower;

        const fresh = get().stats;
        newStats.currentHp = Math.min(fresh.currentHp, newStats.maxHp);
        newStats.stamina = Math.min(fresh.stamina, newStats.maxStamina);
        newStats.incomingDamageMult = Math.max(0, newStats.incomingDamageMult);

        // Per-item power contribution (delta: full - without this item)
        const itemPowers: PowerBreakdownItemPower[] = [];
        for (const slot of EQUIPMENT_SLOTS) {
          const item = s.equipment[slot];
          if (!item || !item.stats) continue;
          const woStats: PlayerStats = { ...newStats };
          for (const [k, v] of Object.entries(item.stats)) {
            const val = typeof v === 'object' ? ((v as any)?.base || 0) : (v || 0);
            const mappedKey = STAT_KEY_MAP[k] || (k as keyof PlayerStats);
            if (mappedKey in woStats && typeof woStats[mappedKey] === 'number') {
              (woStats as any)[mappedKey] -= val;
            }
          }
          if (item.mods) {
            for (const mod of Object.values(item.mods)) {
              if (!mod || !mod.stats) continue;
              for (const [k, v] of Object.entries(mod.stats)) {
                const val = typeof v === 'object' ? ((v as any)?.base || 0) : (v || 0);
                const mappedKey = STAT_KEY_MAP[k] || (k as keyof PlayerStats);
                if (mappedKey in woStats && typeof woStats[mappedKey] === 'number') {
                  (woStats as any)[mappedKey] -= val;
                }
              }
            }
          }
          woStats.damage = Math.max(1, woStats.damage);
          woStats.crit = Math.max(0, woStats.crit);
          woStats.armor = Math.max(0, woStats.armor);
          woStats.regen = Math.max(0, woStats.regen);
          woStats.evasion = Math.min(0.9, Math.max(0, woStats.evasion));
          woStats.block = Math.min(0.9, Math.max(0, woStats.block));
          woStats.punching = Math.max(0, woStats.punching);
          woStats.accuracy = Math.min(2, Math.max(0.1, woStats.accuracy));
          woStats.vampir = Math.min(5.0, Math.max(0, woStats.vampir));
          woStats.speed = Math.max(0, woStats.speed);
          woStats.dpsEmi = Math.max(0, woStats.dpsEmi);
          woStats.dpsToxis = Math.max(0, woStats.dpsToxis);
          woStats.dpsExtro = Math.max(0, woStats.dpsExtro);
          woStats.dpsFire = Math.max(0, woStats.dpsFire);

          const { offensiveScore: woOff, defensiveScore: woDef } = computePowerFromStats(woStats);

          // Subtract ability power for ammo slots
          let woAbility = 0;
          if (AMMO_SLOTS.includes(slot)) {
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
        const s = get();
        const abilities: (AccessoryAbility | null)[] = AMMO_SLOTS.map((slot) => {
          const item = s.equipment[slot];
          if (!item || !item.abilityId) return null;
          return ABILITY_MAP[item.abilityId] || null;
        });
        set({ accessoryAbilities: abilities });
      },

      equipItem: (slot, item) => {
        const s = get();
        if (s.equipment[slot]) {
          get().addLog(`❌ Слот ${slot} уже занят. Сначала снимите предмет.`, 'warning');
          return false;
        }
        set((state) => ({ equipment: { ...state.equipment, [slot]: item } }));
        get().addLog(`⛓️ ${item.displayName || item.name} экипирован в слот ${slot}.`, 'info');
        get().recalcStats();
        return true;
      },

      unequipItem: (slot) => {
        const s = get();
        const item = s.equipment[slot];
        if (!item) return null;
        set((state) => ({ equipment: { ...state.equipment, [slot]: null } }));
        get().addLog(`📦 ${item.displayName || item.name} снят со слота ${slot}.`, 'info');
        get().recalcStats();
        return item;
      },

      upgradeBase: (id) => set((s) => ({
        baseUpgrades: { ...s.baseUpgrades, [id]: (s.baseUpgrades[id] || 0) + 1 },
      })),

      spendSkillPoint: (skillId) => {
        const s = get();
        if (s.skillPoints <= 0) return false;
        const current = s.skills[skillId] || 0;
        set({ skillPoints: s.skillPoints - 1, skills: { ...s.skills, [skillId]: current + 1 } });
        get().recalcStats();
        return true;
      },

      allocateSkill: (skillId) => {
        const s = get();
        if (s.skillPoints <= 0) return;
        const pending = s.pendingSkills[skillId] || 0;
        const current = s.skills[skillId] || 0;
        const skillDef = SKILL_CLASSES.flatMap((c) => c.skills).find((sk) => sk.id === skillId);
        if (!skillDef) return;
        if (current + pending >= skillDef.maxPoints) return;
        const classDef = SKILL_CLASSES.find((c) => c.skills.some((sk) => sk.id === skillId));
        if (!classDef) return;
        const classTotal = classDef.skills.reduce((sum, sk) => sum + (s.skills[sk.id] || 0) + (s.pendingSkills[sk.id] || 0), 0);
        if (classTotal < skillDef.reqPoints && current + pending === 0) return;
        set({ skillPoints: s.skillPoints - 1, pendingSkills: { ...s.pendingSkills, [skillId]: pending + 1 } });
      },

      deallocateSkill: (skillId) => {
        const s = get();
        const pending = s.pendingSkills[skillId] || 0;
        if (pending <= 0) return;
        const next = pending - 1;
        const updated = { ...s.pendingSkills };
        if (next <= 0) delete updated[skillId];
        else updated[skillId] = next;
        set({ skillPoints: s.skillPoints + 1, pendingSkills: updated });
      },

      applySkills: () => {
        const s = get();
        const merged = { ...s.skills };
        for (const [id, pts] of Object.entries(s.pendingSkills)) {
          merged[id] = (merged[id] || 0) + pts;
        }
        set({ skills: merged, pendingSkills: {} });
        get().recalcStats();
        get().addLog('✅ Навыки применены!', 'info');
      },

      cancelSkills: () => {
        const s = get();
        const refund = Object.values(s.pendingSkills).reduce((a, b) => a + b, 0);
        set({ skillPoints: s.skillPoints + refund, pendingSkills: {} });
        get().addLog('🔄 Изменения отменены.', 'info');
      },

      resetSkills: () => {
        const s = get();
        const cost = 50 + s.level * 10;
        if (s.dataChips < cost) {
          get().addLog(`❌ Недостаточно 💾 для сброса навыков. Нужно ${cost} 💾 (есть ${s.dataChips})`, 'warning');
          return;
        }
        const spent = Object.values(s.skills).reduce((a, b) => a + b, 0);
        const pending = Object.values(s.pendingSkills).reduce((a, b) => a + b, 0);
        set({ skills: {}, pendingSkills: {}, skillPoints: s.skillPoints + spent + pending, dataChips: s.dataChips - cost });
        get().addLog(`🔄 Навыки сброшены. Списанo ${cost} 💾. Возвращено ${spent} очков.`, 'info');
        get().recalcStats();
      },

      skillBonuses: () => {
        const skills = get().skills;
        const total: PlayerStats = { ...EMPTY_STATS };
        const lvl = (id: string) => skills[id] || 0;

        // Soldier (DMG ×2, HP ×10)
        total.maxHp += lvl('soldier_toughened') * 100;
        total.damage += lvl('soldier_heavy_hand') * 2;
        total.crit += lvl('soldier_fighting_spirit') * 0.015;
        total.armor += lvl('soldier_iron_skin') * 2;
        total.speed += lvl('soldier_rage') * 0.015;
        total.crit += lvl('soldier_rage') * 0.015;
        total.damage += lvl('soldier_retaliation') * 4;
        total.block += lvl('soldier_unstoppable') * 0.015;
        total.maxHp += lvl('soldier_unstoppable') * 100;
        total.armor += lvl('soldier_juggernaut') * 3;
        total.evasion += lvl('soldier_juggernaut') * 0.015;
        if (lvl('soldier_capstone') > 0) {
          total.maxHp += 500; total.block += 0.05; total.speed += 0.03;
        }

        // Demolitionist (DMG ×2)
        total.damage += lvl('demo_explosives') * 2;
        total.dpsFire += lvl('demo_explosives') * 1;
        total.speed += lvl('demo_swift_hand') * 0.01;
        total.dpsFire += lvl('demo_burning') * 3;
        total.crit += lvl('demo_shrapnel') * 0.015;
        total.dpsFire += lvl('demo_fugas') * 3;
        total.punching += lvl('demo_fugas') * 0.015;
        total.damage += lvl('demo_molotov') * 4;
        total.accuracy += lvl('demo_molotov') * 0.01;
        total.dpsFire += lvl('demo_thermo') * 5;
        total.crit += lvl('demo_thermo') * 0.015;
        total.speed += lvl('demo_fireworks') * 0.015;
        total.damage += lvl('demo_fireworks') * 4;
        if (lvl('demo_capstone') > 0) {
          total.dpsFire += 20; total.crit += 0.05; total.damage += 10;
        }

        // Nightblade (DMG ×2)
        total.speed += lvl('night_shadow_step') * 0.015;
        total.crit += lvl('night_sharp_blades') * 0.015;
        total.damage += lvl('night_sharp_blades') * 2;
        total.evasion += lvl('night_dodge') * 0.015;
        total.accuracy += lvl('night_precise') * 0.015;
        total.vampir += lvl('night_poison') * 0.015;
        total.damage += lvl('night_poison') * 4;
        total.crit += lvl('night_bleeding') * 0.02;
        total.speed += lvl('night_bleeding') * 0.015;
        total.evasion += lvl('night_dark_mist') * 0.025;
        total.accuracy += lvl('night_dark_mist') * 0.015;
        total.speed += lvl('night_death_dance') * 0.02;
        total.crit += lvl('night_death_dance') * 0.02;
        if (lvl('night_capstone') > 0) {
          total.crit += 0.1; total.evasion += 0.08; total.damage += 20;
        }

        // Arcanist (HP ×10)
        total.armor += lvl('arcanist_shield') * 2;
        total.accuracy += lvl('arcanist_focus') * 0.015;
        total.regen += lvl('arcanist_regen') * 1;
        total.block += lvl('arcanist_barrier') * 0.015;
        total.maxHp += lvl('arcanist_life_force') * 100;
        total.regen += lvl('arcanist_life_force') * 0.5;
        total.evasion += lvl('arcanist_distortion') * 0.015;
        total.block += lvl('arcanist_distortion') * 0.015;
        total.armor += lvl('arcanist_aura') * 3;
        total.regen += lvl('arcanist_aura') * 1;
        total.maxHp += lvl('arcanist_restoration') * 150;
        total.regen += lvl('arcanist_restoration') * 2;
        if (lvl('arcanist_capstone') > 0) {
          total.maxHp += 500; total.regen += 10; total.block += 0.05;
        }

        // Occultist
        total.dpsEmi += lvl('occult_dark_energy') * 1;
        total.dpsToxis += lvl('occult_dark_energy') * 1;
        total.vampir += lvl('occult_blood_thirst') * 0.015;
        total.dpsExtro += lvl('occult_curse') * 2;
        total.vampir += lvl('occult_curse') * 0.01;
        total.crit += lvl('occult_ritual') * 0.015;
        total.damage += lvl('occult_ritual') * 2;
        total.dpsEmi += lvl('occult_corruption') * 2;
        total.dpsToxis += lvl('occult_corruption') * 2;
        total.dpsExtro += lvl('occult_corruption') * 2;
        total.dpsFire += lvl('occult_corruption') * 2;
        total.vampir += lvl('occult_corruption') * 0.015;
        total.regen += lvl('occult_necromancy') * 1;
        total.vampir += lvl('occult_necromancy') * 0.015;
        total.dpsEmi += lvl('occult_sacrifice') * 3;
        total.dpsToxis += lvl('occult_sacrifice') * 3;
        total.dpsExtro += lvl('occult_sacrifice') * 3;
        total.dpsFire += lvl('occult_sacrifice') * 3;
        total.crit += lvl('occult_sacrifice') * 0.02;
        total.dpsEmi += lvl('occult_demonic') * 2;
        total.dpsToxis += lvl('occult_demonic') * 2;
        total.dpsExtro += lvl('occult_demonic') * 2;
        total.dpsFire += lvl('occult_demonic') * 2;
        total.vampir += lvl('occult_demonic') * 0.02;
        if (lvl('occult_capstone') > 0) {
          total.dpsEmi += 10; total.dpsToxis += 10; total.dpsExtro += 10; total.dpsFire += 10;
          total.vampir += 0.08; total.crit += 0.05;
        }

        // Berserker (DMG ×2)
        total.damage += lvl('berserker_frenzy') * 2;
        total.speed += lvl('berserker_frenzy') * 0.01;
        total.vampir += lvl('berserker_bloodlust') * 0.015;
        total.damage += lvl('berserker_warcry') * 4;
        total.punching += lvl('berserker_warcry') * 0.015;
        total.crit += lvl('berserker_brutal') * 0.015;
        total.damage += lvl('berserker_brutal') * 2;
        total.speed += lvl('berserker_adrenaline') * 0.015;
        total.evasion += lvl('berserker_adrenaline') * 0.015;
        total.damage += lvl('berserker_berserk') * 4;
        total.crit += lvl('berserker_berserk') * 0.015;
        total.armor += lvl('berserker_unleashed') * 3;
        total.damage += lvl('berserker_unleashed') * 4;
        total.speed += lvl('berserker_eternal_rage') * 0.02;
        total.vampir += lvl('berserker_eternal_rage') * 0.02;
        if (lvl('berserker_capstone') > 0) {
          total.damage += 40; total.crit += 0.10; total.vampir += 0.05;
        }

        // Tank (DMG ×2, HP ×10)
        total.armor += lvl('tank_hardened') * 2;
        total.maxHp += lvl('tank_vitality') * 150;
        total.block += lvl('tank_shield_bash') * 0.015;
        total.damage += lvl('tank_shield_bash') * 2;
        total.armor += lvl('tank_iron_will') * 2;
        total.regen += lvl('tank_iron_will') * 0.5;
        total.maxHp += lvl('tank_fortress') * 150;
        total.armor += lvl('tank_fortress') * 2;
        total.block += lvl('tank_reflect') * 0.015;
        total.damage += lvl('tank_reflect') * 2;
        total.maxHp += lvl('tank_immortal') * 200;
        total.regen += lvl('tank_immortal') * 1;
        total.armor += lvl('tank_paladin') * 3;
        total.vampir += lvl('tank_paladin') * 0.015;
        if (lvl('tank_capstone') > 0) {
          total.maxHp += 1000; total.armor += 15; total.block += 0.05;
        }

        // Sniper (DMG ×2)
        total.accuracy += lvl('sniper_focus') * 0.015;
        total.crit += lvl('sniper_precision') * 0.015;
        total.damage += lvl('sniper_long_shot') * 2;
        total.accuracy += lvl('sniper_long_shot') * 0.015;
        total.crit += lvl('sniper_deadly_aim') * 0.015;
        total.damage += lvl('sniper_deadly_aim') * 4;
        total.dpsExtro += lvl('sniper_kill_zone') * 2;
        total.dpsFire += lvl('sniper_kill_zone') * 2;
        total.damage += lvl('sniper_executioner') * 6;
        total.crit += lvl('sniper_executioner') * 0.015;
        total.punching += lvl('sniper_armor_piercing') * 0.02;
        total.damage += lvl('sniper_armor_piercing') * 4;
        total.accuracy += lvl('sniper_nerves_steel') * 0.02;
        total.speed += lvl('sniper_nerves_steel') * 0.015;
        if (lvl('sniper_capstone') > 0) {
          total.damage += 30; total.crit += 0.10; total.accuracy += 0.10;
        }

        // Survivor (HP ×10)
        total.maxHp += lvl('survivor_toughness') * 100;
        total.evasion += lvl('survivor_dodge') * 0.015;
        total.regen += lvl('survivor_field_medic') * 1;
        total.armor += lvl('survivor_scavenger') * 2;
        total.evasion += lvl('survivor_scavenger') * 0.015;
        total.block += lvl('survivor_makeshift') * 0.015;
        total.regen += lvl('survivor_makeshift') * 0.5;
        total.evasion += lvl('survivor_camouflage') * 0.02;
        total.accuracy += lvl('survivor_camouflage') * 0.015;
        total.speed += lvl('survivor_windrunner') * 0.02;
        total.evasion += lvl('survivor_windrunner') * 0.02;
        total.regen += lvl('survivor_revitalize') * 2;
        total.maxHp += lvl('survivor_revitalize') * 150;
        if (lvl('survivor_capstone') > 0) {
          total.maxHp += 500; total.evasion += 0.10; total.regen += 10;
        }

        // Old merchant (DMG ×2, HP ×10)
        total.accuracy += lvl('merchant_diplomacy') * 0.015;
        total.damage += lvl('merchant_coin_throw') * 2;
        total.crit += lvl('merchant_insider') * 0.015;
        total.vampir += lvl('merchant_black_market') * 0.015;
        total.armor += lvl('merchant_protection') * 2;
        total.maxHp += lvl('merchant_protection') * 100;
        total.speed += lvl('merchant_money_talk') * 0.015;
        total.accuracy += lvl('merchant_money_talk') * 0.015;
        total.armor += lvl('merchant_armored_transport') * 3;
        total.block += lvl('merchant_armored_transport') * 0.015;
        total.evasion += lvl('merchant_lucky') * 0.02;
        total.crit += lvl('merchant_lucky') * 0.02;
        if (lvl('merchant_capstone') > 0) {
          total.maxHp += 500; total.crit += 0.10; total.damage += 10; total.accuracy += 0.10;
        }

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
        // Stamina drain during travel: 1% per second
        set((state) => ({
          stats: { ...state.stats, stamina: Math.max(0, state.stats.stamina - 1) },
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
            stats: { ...s.stats, stamina: s.stats.maxStamina },
          });
          get().addLog(`🏠 Вернулись на базу. Выносливость полностью восстановлена!`, 'heal');
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
        set((state) => ({
          stats: {
            ...state.stats,
            currentHp: Math.min(state.stats.maxHp, state.stats.currentHp + state.stats.regen * 3 + 5),
            stamina: Math.min(state.stats.maxStamina, state.stats.stamina + 2),
          },
        }));
        return false;
      },

      baseUpgradeTick: () => {
        const ui = useUiStore.getState();
        if (!ui.upgradingBase || ui.craftingTimer <= 0) return;
        const newTimer = ui.craftingTimer - 1;
        ui.setCraftingTimer(newTimer);
        if (newTimer <= 0) {
          const baseName = ui.upgradingBase;
          get().upgradeBase(baseName);
          const newLevel = get().baseUpgrades[baseName] || 0;
          get().addLog(`🏢 ${baseName} улучшена до уровня ${newLevel}!`, 'loot');
          ui.setCraftingType(null);
          ui.setCraftingLabel('');
          ui.setUpgradingBase(null);
        }
      },
    }),
    {
      name: 'remastered_player',
      version: 9,
      partialize: (state) => ({
        level: state.level, currentExp: state.currentExp, expToNext: state.expToNext,
        dataChips: state.dataChips, baseHealth: state.baseHealth,
        stats: state.stats, equipment: state.equipment,
        activeEffects: state.activeEffects,
        baseUpgrades: state.baseUpgrades,
        skillPoints: state.skillPoints, skills: state.skills, pendingSkills: state.pendingSkills,
        logs: pruneLogs(state.logs).slice(-LOG_MAX_SAVED), logIdCounter: state.logIdCounter,
        explorationDeathTimestamp: state.explorationDeathTimestamp,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.recalcStats();
      },
    },
  ),
);
