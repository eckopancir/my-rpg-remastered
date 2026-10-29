/**
 * Карточный данж: забег, двери, бой, награды, кузница.
 *
 * Базовая версия живёт целиком на клиенте: состояние забега уходит в блоб
 * сейва (data.dungeon) и дублируется в localStorage. Серверная валидация —
 * позже, когда бэкенд переедет на Python.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CARDS, CARD_MAP, MAX_CARD_LEVEL, effectiveCard, type CardDef } from '../data/dungeon/cards';
import {
  ACT_MULT, actOfDoor, spawnEnemies, tierMult,
  type EnemyLogic, type EnemySeed,
} from '../data/dungeon/enemies';
import {
  mercStats, SLOTS, TEST_MERCS,
  type MercRole, type Slot,
} from '../data/dungeon/mercs';
import {
  cardChance, doorChips, generateDoors, rollEvent, rollRewardCards, upgradeCostFor,
  type DoorOption, type DoorType, type DungeonEvent,
} from '../data/dungeon/doors';
import { usePlayerStore } from './playerStore';
import { useInventoryStore } from './inventoryStore';
import { useAuthStore } from './authStore';
import { syncNow } from '../utils/serverSync';
import { removeItemFromGrid } from '../data/backpacks';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

export interface CardInstance {
  uid: string;
  defId: string;
  level: number;
}

export interface RunMerc {
  id: string;
  name: string;
  role: MercRole;
  stars: number;
  maxHp: number;
  hp: number;
  maxArmor: number;
  slot: Slot | null;
}

export interface BattleMerc extends RunMerc {
  armor: number;
  shield: number;
  alive: boolean;
}

export interface Intent {
  type: 'attack' | 'aoe' | 'buff' | 'summon' | 'stun';
  value: number;
  targetUid?: string;
}

export interface BattleEnemy {
  uid: string;
  defId: string;
  name: string;
  maxHp: number;
  hp: number;
  atk: number;
  logic: EnemyLogic;
  icon: string;
  color: string;
  vuln: number;
  weak: number;
  stun: number;
  intent: Intent | null;
  isBoss: boolean;
  isElite: boolean;
}

export interface Fx {
  id: number;
  targetUid: string;
  kind: 'hit' | 'heal' | 'shield' | 'buff' | 'stun';
  value: number;
}

export interface BattleState {
  mercs: BattleMerc[];
  enemies: BattleEnemy[];
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  energy: number;
  turn: number;
  phase: 'player' | 'enemy' | 'won' | 'lost';
  enemyQueue: string[];
  log: string[];
  fx: Fx | null;
  source: 'battle' | 'elite' | 'boss';
}

export interface RewardState {
  chips: number;
  cards: string[];
  source: 'battle' | 'elite' | 'boss';
}

export type RunPhase = 'setup' | 'doors' | 'battle' | 'reward' | 'forge' | 'rest' | 'event' | 'dead' | 'won';

export interface DungeonRun {
  id: string;
  userId: number;
  keyTier: number;
  keySlug: string;
  door: number;
  chips: number;
  roster: RunMerc[];
  mercs: RunMerc[];
  deck: string[];
  doors: DoorOption[];
  phase: RunPhase;
  battle: BattleState | null;
  reward: RewardState | null;
  event: DungeonEvent | null;
  ended: 'dead' | 'won' | 'abandoned' | null;
  enemyBoost: number;
  /** Время последнего изменения — чтобы блоб не затирал более свежий локальный забег. */
  updatedAt: number;
}

interface DungeonStore {
  open: boolean;
  run: DungeonRun | null;
  levels: Record<string, number>;

  openFromKey: (item: unknown) => void;
  openTest: () => void;
  openOverlay: () => void;
  ensureUser: (userId: number) => void;
  hydrate: (data: unknown) => void;
  close: () => void;

  toggleMerc: (id: string) => void;
  setSlot: (mercId: string, slot: Slot) => void;
  toggleDeckCard: (id: string) => void;
  startRun: () => void;

  chooseDoor: (id: string) => void;

  playCard: (uid: string, targetUid?: string) => void;
  endTurn: () => void;
  stepEnemy: () => void;

  claimReward: (cardId: string | null) => void;

  upgradeCard: (cardId: string) => void;
  leaveForge: () => void;
  restHeal: () => void;
  resolveEvent: (choice: number) => void;

  abandonRun: () => void;
  finishRun: () => void;
}

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

const uid = (): string => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const KEY_TIERS = ['Обычный', 'Редкий', 'Раритетный', 'Эпический', 'Смертоносный', 'Легендарный', 'Божественный'];

const keyTierFromItem = (item: any): number => {
  const img = String(item?.image || '');
  const m = img.match(/key-(\d)\.png/);
  if (m) return clamp(parseInt(m[1], 10), 1, 7);
  const idx = KEY_TIERS.indexOf(String(item?.quality || ''));
  return idx >= 0 ? idx + 1 : 1;
};

const keySlugFromItem = (item: any): string => {
  const n = String(item?.name || '');
  const m = n.match(/^legendary_key_(.+)$/);
  return m ? m[1] : 'spider_hive';
};

const makeRunMerc = (src: { id: string; name: string; role: MercRole; stars: number }, slot: Slot | null): RunMerc => {
  const st = mercStats(src.role, src.stars);
  return {
    id: src.id,
    name: src.name,
    role: src.role,
    stars: src.stars,
    maxHp: st.maxHp,
    hp: st.maxHp,
    maxArmor: st.maxArmor,
    slot,
  };
};

const firstFreeSlot = (mercs: RunMerc[]): Slot | null => {
  const used = new Set(mercs.map((m) => m.slot));
  return SLOTS.find((s) => !used.has(s)) ?? null;
};

const deckCost = (deck: string[]): number =>
  deck.reduce((sum, id) => sum + (CARD_MAP[id]?.power || 0), 0);

export const powerBudget = (): number => {
  const power = Number(usePlayerStore.getState().stats?.power || 0);
  return Math.max(600, Math.round(power));
};

const createRun = (tier: number, slug: string): DungeonRun => {
  const userId = Number(useAuthStore.getState().user?.id || 0);
  const owned = (usePlayerStore.getState().ownedMercs || []) as any[];
  const source = owned.length > 0
    ? owned.map((m) => ({ id: String(m.id), name: String(m.name || 'Наёмник'), role: m.role as MercRole, stars: Number(m.stars || 1) }))
    : TEST_MERCS;
  const roster = source.map((m) => makeRunMerc(m, null));
  const mercs = roster.slice(0, 4).map((m, i) => ({ ...m, slot: SLOTS[i] }));
  return {
    id: `run_${uid()}`,
    userId,
    keyTier: clamp(tier, 1, 7),
    keySlug: slug,
    door: 1,
    chips: 250 * clamp(tier, 1, 7),
    roster,
    mercs,
    deck: [],
    doors: [],
    phase: 'setup',
    battle: null,
    reward: null,
    event: null,
    ended: null,
    enemyBoost: 0,
    updatedAt: Date.now(),
  };
};

const cloneBattle = (b: BattleState): BattleState => ({
  ...b,
  mercs: b.mercs.map((m) => ({ ...m })),
  enemies: b.enemies.map((e) => ({ ...e, intent: e.intent ? { ...e.intent } : null })),
  hand: [...b.hand],
  drawPile: [...b.drawPile],
  discardPile: [...b.discardPile],
  enemyQueue: [...b.enemyQueue],
  log: [...b.log],
});

const pushLog = (b: BattleState, text: string): void => {
  b.log.push(text);
  if (b.log.length > 40) b.log.splice(0, b.log.length - 40);
};

const drawCards = (b: BattleState, n: number): void => {
  let left = n;
  while (left > 0 && b.hand.length < 10) {
    if (b.drawPile.length === 0) {
      if (b.discardPile.length === 0) break;
      b.drawPile = shuffle(b.discardPile);
      b.discardPile = [];
    }
    const card = b.drawPile.pop();
    if (!card) break;
    b.hand.push(card);
    left -= 1;
  }
};

const aliveMercs = (b: BattleState): BattleMerc[] => b.mercs.filter((m) => m.alive);
const aliveEnemies = (b: BattleState): BattleEnemy[] => b.enemies.filter((e) => e.hp > 0);
const frontMercs = (b: BattleState): BattleMerc[] =>
  aliveMercs(b).filter((m) => m.slot === 'front1' || m.slot === 'front2');
const backMercs = (b: BattleState): BattleMerc[] =>
  aliveMercs(b).filter((m) => m.slot === 'back1' || m.slot === 'back2');

const pickTarget = (b: BattleState, logic: EnemyLogic): BattleMerc | null => {
  const all = aliveMercs(b);
  if (all.length === 0) return null;
  const front = frontMercs(b);
  const back = backMercs(b);
  if (logic === 'hunter') return (back.length ? back : front)[Math.floor(Math.random() * (back.length ? back.length : front.length))] ?? null;
  if (logic === 'aggressor') {
    const pool = front.length ? front : back;
    return [...pool].sort((a, c) => c.armor - a.armor)[0] ?? null;
  }
  if (logic === 'swarm') return [...all].sort((a, c) => a.hp - c.hp)[0] ?? null;
  if (logic === 'tactician') return [...all].sort((a, c) => a.hp - c.hp)[0] ?? null;
  // boss
  return (front.length ? front : back)[0] ?? null;
};

const intentFor = (b: BattleState, e: BattleEnemy): Intent => {
  if (e.stun > 0) return { type: 'stun', value: 0 };
  if (e.logic === 'boss') {
    const adds = b.enemies.filter((x) => x.hp > 0 && (x.defId === 'spiderling' || x.defId === 'worker')).length;
    if (b.turn % 3 === 0 && adds < 2) return { type: 'summon', value: 0 };
    if (e.hp / Math.max(1, e.maxHp) < 0.6 && b.turn % 3 === 1) {
      return { type: 'aoe', value: Math.max(6, Math.round(e.atk * 0.55)) };
    }
    const target = pickTarget(b, 'boss');
    return { type: 'attack', value: e.atk, targetUid: target?.id };
  }
  if (e.logic === 'tactician' && b.turn % 2 === 0) {
    return { type: 'buff', value: 2 };
  }
  const target = pickTarget(b, e.logic);
  return { type: 'attack', value: e.atk, targetUid: target?.id };
};

const computeIntents = (b: BattleState): void => {
  for (const e of b.enemies) {
    if (e.hp > 0) e.intent = intentFor(b, e);
  }
};

const makeEnemy = (seed: EnemySeed, boost: number): BattleEnemy => {
  const hpMult = 1 + 0.2 * boost;
  const atkMult = 1 + 0.15 * boost;
  const hp = Math.max(1, Math.round(seed.hp * hpMult));
  return {
    uid: `e_${uid()}`,
    defId: seed.defId,
    name: seed.name,
    maxHp: hp,
    hp,
    atk: Math.max(1, Math.round(seed.atk * atkMult)),
    logic: seed.logic,
    icon: seed.icon,
    color: seed.color,
    vuln: 0,
    weak: 0,
    stun: 0,
    intent: null,
    isBoss: seed.isBoss,
    isElite: seed.isElite,
  };
};

const grantChips = (amount: number): void => {
  const n = Math.max(0, Math.round(amount));
  if (n > 0) usePlayerStore.getState().addChips(n);
};

// ---------------------------------------------------------------------------
// Стор
// ---------------------------------------------------------------------------

export const useDungeonStore = create<DungeonStore>()(
  persist(
    (set, get) => {
      const patchRun = (patch: Partial<DungeonRun>): void => {
        const run = get().run;
        if (!run) return;
        set({ run: { ...run, ...patch, updatedAt: Date.now() } });
      };

      const syncBattleToRun = (battle: BattleState): void => {
        const run = get().run;
        if (!run) return;
        const mercs = run.mercs.map((m) => {
          const bm = battle.mercs.find((x) => x.id === m.id);
          return bm ? { ...m, hp: Math.max(0, bm.hp) } : m;
        });
        patchRun({ mercs });
      };

      const loseRun = (): void => {
        const run = get().run;
        if (!run) return;
        grantChips(run.chips * 0.25);
        patchRun({ phase: 'dead', ended: 'dead', battle: run.battle ? { ...run.battle, phase: 'lost' } : null });
        syncNow();
      };

      const winRun = (): void => {
        const run = get().run;
        if (!run) return;
        grantChips(run.chips);
        patchRun({ phase: 'won', ended: 'won', battle: null, reward: null });
        syncNow();
      };

      const advanceDoor = (): void => {
        const run = get().run;
        if (!run) return;
        if (run.door >= 30) {
          winRun();
          return;
        }
        const next = run.door + 1;
        patchRun({
          door: next,
          doors: generateDoors(next, actOfDoor(next)),
          phase: 'doors',
          battle: null,
          reward: null,
          event: null,
          enemyBoost: 0,
        });
      };

      const startBattle = (source: 'battle' | 'elite' | 'boss'): void => {
        const run = get().run;
        if (!run) return;
        const seeds = spawnEnemies(run.door, run.keyTier, source);
        const enemies = seeds.map((s) => makeEnemy(s, run.enemyBoost || 0));
        const mercs: BattleMerc[] = run.mercs
          .filter((m) => m.hp > 0 && m.slot)
          .map((m) => ({ ...m, armor: m.maxArmor, shield: 0, alive: true }));
        const instances: CardInstance[] = run.deck.map((defId) => ({
          uid: uid(),
          defId,
          level: get().levels[defId] || 1,
        }));
        const battle: BattleState = {
          mercs,
          enemies,
          hand: [],
          drawPile: shuffle(instances),
          discardPile: [],
          energy: 5,
          turn: 1,
          phase: 'player',
          enemyQueue: [],
          log: [`Дверь ${run.door}: бой начался.`],
          fx: null,
          source,
        };
        drawCards(battle, 5);
        computeIntents(battle);
        patchRun({ phase: 'battle', battle });
      };

      const winBattle = (battle: BattleState): void => {
        const run = get().run;
        if (!run) return;
        syncBattleToRun(battle);
        const source = battle.source;
        const chips = doorChips(source, run.keyTier);
        const cards = Math.random() < cardChance(source) ? rollRewardCards(3) : [];
        patchRun({
          phase: 'reward',
          battle: { ...battle, phase: 'won' },
          reward: { chips, cards, source },
        });
      };

      const hitEnemy = (battle: BattleState, e: BattleEnemy, amount: number): number => {
        let dmg = Math.max(0, Math.round(amount));
        if (e.vuln > 0) dmg = Math.round(dmg * 1.5);
        e.hp = Math.max(0, e.hp - dmg);
        battle.fx = { id: Date.now() + Math.random(), targetUid: e.uid, kind: 'hit', value: dmg };
        if (e.hp <= 0) pushLog(battle, `${e.name} повержен.`);
        return dmg;
      };

      const hitMerc = (battle: BattleState, m: BattleMerc, amount: number): void => {
        let dmg = Math.max(0, Math.round(amount));
        const absorbedByShield = Math.min(m.shield, dmg);
        m.shield -= absorbedByShield;
        dmg -= absorbedByShield;
        const absorbedByArmor = Math.min(m.armor, dmg);
        m.armor -= absorbedByArmor;
        dmg -= absorbedByArmor;
        if (dmg > 0) m.hp = Math.max(0, m.hp - dmg);
        battle.fx = { id: Date.now() + Math.random(), targetUid: m.id, kind: 'hit', value: Math.round(amount) };
        if (m.hp <= 0) {
          m.alive = false;
          m.hp = 0;
          pushLog(battle, `${m.name} пал.`);
        }
      };

      const healMerc = (battle: BattleState, m: BattleMerc, amount: number): void => {
        if (!m.alive) return;
        const heal = Math.max(0, Math.round(amount));
        m.hp = Math.min(m.maxHp, m.hp + heal);
        battle.fx = { id: Date.now() + Math.random(), targetUid: m.id, kind: 'heal', value: heal };
      };

      const shieldMerc = (battle: BattleState, m: BattleMerc, amount: number): void => {
        if (!m.alive) return;
        const shield = Math.max(0, Math.round(amount));
        m.shield += shield;
        battle.fx = { id: Date.now() + Math.random(), targetUid: m.id, kind: 'shield', value: shield };
      };

      const playCard = (cardUid: string, targetUid?: string): void => {
        const run = get().run;
        if (!run?.battle || run.battle.phase !== 'player') return;
        const battle = cloneBattle(run.battle);
        const idx = battle.hand.findIndex((c) => c.uid === cardUid);
        if (idx < 0) return;
        const inst = battle.hand[idx];
        const def = CARD_MAP[inst.defId];
        if (!def) return;
        const eff = effectiveCard(def, inst.level);
        if (battle.energy < eff.cost) return;

        const targetEnemy = targetUid ? battle.enemies.find((e) => e.uid === targetUid && e.hp > 0) : undefined;
        const targetMerc = targetUid ? battle.mercs.find((m) => m.id === targetUid && m.alive) : undefined;
        const front = frontMercs(battle)[0] ?? backMercs(battle)[0];

        const attackOne = (e: BattleEnemy, base: number): void => {
          let dmg = base;
          if (eff.bonusLow && e.hp / Math.max(1, e.maxHp) < 0.5) dmg += eff.bonusLow;
          if (eff.bonusBoss && (e.isBoss || e.isElite)) dmg += eff.bonusBoss;
          if (eff.exec && e.hp / Math.max(1, e.maxHp) < eff.exec) dmg *= eff.execMult || 2;
          hitEnemy(battle, e, dmg);
        };

        switch (def.id) {
          case 'mark': {
            if (!targetEnemy) return;
            targetEnemy.vuln = Math.max(targetEnemy.vuln, eff.vuln || 2);
            battle.fx = { id: Date.now() + Math.random(), targetUid: targetEnemy.uid, kind: 'buff', value: eff.vuln || 2 };
            break;
          }
          case 'smoke': {
            for (const e of aliveEnemies(battle)) {
              e.weak = Math.max(e.weak, eff.weak || 2);
              if (eff.dmg) hitEnemy(battle, e, eff.dmg);
            }
            break;
          }
          case 'flashbang': {
            const targets = aliveEnemies(battle);
            for (const e of targets) hitEnemy(battle, e, eff.dmg || 0);
            const alive = aliveEnemies(battle);
            if (alive.length > 0) {
              const stunTarget = alive[Math.floor(Math.random() * alive.length)];
              stunTarget.stun = Math.max(stunTarget.stun, eff.stun || 1);
              battle.fx = { id: Date.now() + Math.random(), targetUid: stunTarget.uid, kind: 'stun', value: eff.stun || 1 };
            }
            break;
          }
          case 'dash': {
            if (!targetEnemy) return;
            attackOne(targetEnemy, eff.dmg || 0);
            if (front) shieldMerc(battle, front, eff.shield || 0);
            break;
          }
          case 'cover': {
            if (!targetMerc) return;
            shieldMerc(battle, targetMerc, eff.shield || 0);
            if (eff.maxArmor) targetMerc.maxArmor += eff.maxArmor;
            break;
          }
          case 'lastStand': {
            if (!targetMerc) return;
            const bonus = targetMerc.hp / Math.max(1, targetMerc.maxHp) < 0.3 ? (eff.woundedBonus || 0) : 0;
            shieldMerc(battle, targetMerc, (eff.shield || 0) + bonus);
            if (eff.maxArmor) targetMerc.maxArmor += eff.maxArmor;
            break;
          }
          case 'repair':
          case 'stim': {
            if (!targetMerc) return;
            healMerc(battle, targetMerc, eff.heal || 0);
            break;
          }
          case 'medkit': {
            for (const m of aliveMercs(battle)) healMerc(battle, m, eff.heal || 0);
            break;
          }
          case 'order':
          case 'scout': {
            battle.energy += eff.energy || 0;
            break;
          }
          default: {
            if (def.target === 'allEnemies') {
              for (const e of aliveEnemies(battle)) hitEnemy(battle, e, eff.dmg || 0);
            } else if (def.target === 'enemy') {
              if (!targetEnemy) return;
              for (let i = 0; i < Math.max(1, eff.hits || 1); i++) {
                if (targetEnemy.hp <= 0) break;
                attackOne(targetEnemy, eff.dmg || 0);
              }
            }
            break;
          }
        }

        battle.hand.splice(idx, 1);
        if (!eff.exhaust) battle.discardPile.push(inst);
        battle.energy = Math.max(0, battle.energy - eff.cost);
        if (eff.draw) drawCards(battle, eff.draw);

        if (aliveEnemies(battle).length === 0) {
          winBattle(battle);
          return;
        }
        if (aliveMercs(battle).length === 0) {
          set({ run: { ...run, battle: { ...battle, phase: 'lost' } } });
          loseRun();
          return;
        }
        computeIntents(battle);
        patchRun({ battle });
      };

      const finishEnemyTurn = (): void => {
        const run = get().run;
        if (!run?.battle) return;
        const battle = cloneBattle(run.battle);
        for (const e of battle.enemies) {
          if (e.vuln > 0) e.vuln -= 1;
          if (e.weak > 0) e.weak -= 1;
        }
        for (const m of battle.mercs) {
          if (!m.alive) continue;
          m.armor = m.maxArmor;
          m.shield = 0;
        }
        battle.turn += 1;
        battle.energy = 5;
        battle.phase = 'player';
        battle.enemyQueue = [];
        drawCards(battle, 5);
        computeIntents(battle);
        pushLog(battle, `Ход ${battle.turn}. Энергия восстановлена.`);
        patchRun({ battle });
      };

      const stepEnemy = (): void => {
        const run = get().run;
        if (!run?.battle || run.battle.phase !== 'enemy') return;
        const battle = cloneBattle(run.battle);
        const nextUid = battle.enemyQueue.shift();
        if (!nextUid) {
          finishEnemyTurn();
          return;
        }
        const enemy = battle.enemies.find((e) => e.uid === nextUid);
        if (!enemy || enemy.hp <= 0) {
          if (battle.enemyQueue.length === 0) finishEnemyTurn();
          else patchRun({ battle });
          return;
        }
        const intent = enemy.intent;

        if (enemy.stun > 0) {
          enemy.stun -= 1;
          pushLog(battle, `${enemy.name} оглушён и пропускает ход.`);
          battle.fx = { id: Date.now() + Math.random(), targetUid: enemy.uid, kind: 'stun', value: 1 };
        } else if (intent?.type === 'summon') {
          const tm = tierMult(run.keyTier);
          const act = ACT_MULT[actOfDoor(run.door)];
          const hp = Math.max(1, Math.round(30 * act.hp * tm.hp));
          const atk = Math.max(1, Math.round(8 * act.atk * tm.atk));
          battle.enemies.push({
            uid: `e_${uid()}`,
            defId: 'spiderling',
            name: 'Выводок',
            maxHp: hp,
            hp,
            atk,
            logic: 'swarm',
            icon: '🕷️',
            color: '#a3e635',
            vuln: 0,
            weak: 0,
            stun: 0,
            intent: null,
            isBoss: false,
            isElite: false,
          });
          pushLog(battle, `${enemy.name} призывает выводок.`);
        } else if (intent?.type === 'buff') {
          for (const e of aliveEnemies(battle)) e.atk += intent.value;
          pushLog(battle, `${enemy.name} усиливает стаю (+${intent.value} атаки).`);
          battle.fx = { id: Date.now() + Math.random(), targetUid: enemy.uid, kind: 'buff', value: intent.value };
        } else if (intent?.type === 'aoe') {
          for (const m of aliveMercs(battle)) hitMerc(battle, m, intent.value);
          pushLog(battle, `${enemy.name} бьёт по всем: ${intent.value}.`);
        } else {
          const target = (intent?.targetUid && battle.mercs.find((m) => m.id === intent.targetUid && m.alive))
            || pickTarget(battle, enemy.logic);
          if (target) {
            const dmg = Math.round((intent?.value || enemy.atk) * (enemy.weak > 0 ? 0.75 : 1));
            hitMerc(battle, target, dmg);
            pushLog(battle, `${enemy.name} бьёт ${target.name}: ${dmg}.`);
          }
        }

        if (aliveMercs(battle).length === 0) {
          set({ run: { ...run, battle: { ...battle, phase: 'lost' } } });
          loseRun();
          return;
        }
        if (battle.enemyQueue.length === 0) {
          patchRun({ battle });
          finishEnemyTurn();
          return;
        }
        patchRun({ battle });
      };

      return {
        open: false,
        run: null,
        levels: {},

        openFromKey: (rawItem) => {
          const item = rawItem as any;
          const existing = get().run;
          if (existing && existing.phase !== 'dead' && existing.phase !== 'won') {
            set({ open: true });
            return;
          }
          const tier = keyTierFromItem(item);
          const slug = keySlugFromItem(item);
          const ps = usePlayerStore.getState();
          const grid = ps.backpackGrid;
          if (grid && item?.id) {
            usePlayerStore.setState({ backpackGrid: removeItemFromGrid(grid, String(item.id)) });
          }
          // Ключ сгорает при входе: убираем его и из обычного инвентаря.
          if (item?.id) useInventoryStore.getState().removeItem(String(item.id));
          set({ run: createRun(tier, slug), open: true });
          syncNow();
        },

        openTest: () => {
          const existing = get().run;
          if (existing && existing.phase !== 'dead' && existing.phase !== 'won') {
            set({ open: true });
            return;
          }
          set({ run: createRun(1, 'spider_hive'), open: true });
        },

        openOverlay: () => set({ open: true }),

        ensureUser: (userId) => {
          const run = get().run;
          if (run && run.userId !== userId) {
            set({ run: null, open: false });
            return;
          }
          if (run && run.phase !== 'dead' && run.phase !== 'won') {
            set({ open: true });
          }
        },

        hydrate: (data) => {
          const d = data as any;
          if (!d) return;
          const levels = d.levels && typeof d.levels === 'object' ? d.levels : get().levels;
          const incoming = d.run && typeof d.run === 'object' ? d.run : null;
          const local = get().run;
          const run = incoming && (!local || (incoming.updatedAt || 0) >= (local.updatedAt || 0))
            ? incoming
            : local;
          set({
            levels,
            run,
            open: !!(run && run.phase !== 'dead' && run.phase !== 'won'),
          });
        },

        close: () => set({ open: false }),

        toggleMerc: (id) => {
          const run = get().run;
          if (!run || run.phase !== 'setup') return;
          const exists = run.mercs.find((m) => m.id === id);
          if (exists) {
            patchRun({ mercs: run.mercs.filter((m) => m.id !== id) });
            return;
          }
          if (run.mercs.length >= 4) return;
          const src = run.roster.find((m) => m.id === id);
          if (!src) return;
          const slot = firstFreeSlot(run.mercs);
          patchRun({ mercs: [...run.mercs, { ...src, slot }] });
        },

        setSlot: (mercId, slot) => {
          const run = get().run;
          if (!run || run.phase !== 'setup') return;
          const mercs = run.mercs.map((m) => ({ ...m }));
          const moving = mercs.find((m) => m.id === mercId);
          if (!moving) return;
          const occupied = mercs.find((m) => m.slot === slot && m.id !== mercId);
          const prev = moving.slot;
          moving.slot = slot;
          if (occupied) occupied.slot = prev;
          patchRun({ mercs });
        },

        toggleDeckCard: (id) => {
          const run = get().run;
          if (!run || run.phase !== 'setup') return;
          if (run.deck.includes(id)) {
            patchRun({ deck: run.deck.filter((c) => c !== id) });
            return;
          }
          if (run.deck.length >= 10) return;
          patchRun({ deck: [...run.deck, id] });
        },

        startRun: () => {
          const run = get().run;
          if (!run || run.phase !== 'setup') return;
          if (run.deck.length < 5 || run.deck.length > 10) return;
          if (deckCost(run.deck) > powerBudget()) return;
          if (run.mercs.length < 1) return;
          patchRun({
            phase: 'doors',
            door: 1,
            doors: generateDoors(1, 0),
          });
        },

        chooseDoor: (id) => {
          const run = get().run;
          if (!run || run.phase !== 'doors') return;
          const door = run.doors.find((d) => d.id === id);
          if (!door) return;
          if (door.type === 'battle' || door.type === 'elite' || door.type === 'boss') {
            startBattle(door.type);
          } else if (door.type === 'forge') {
            patchRun({ phase: 'forge' });
          } else if (door.type === 'rest') {
            patchRun({ phase: 'rest' });
          } else if (door.type === 'event') {
            patchRun({ phase: 'event', event: rollEvent() });
          }
        },

        playCard,
        endTurn: () => {
          const run = get().run;
          if (!run?.battle || run.battle.phase !== 'player') return;
          const battle = cloneBattle(run.battle);
          battle.discardPile.push(...battle.hand);
          battle.hand = [];
          battle.phase = 'enemy';
          battle.enemyQueue = aliveEnemies(battle).map((e) => e.uid);
          battle.fx = null;
          patchRun({ battle });
        },
        stepEnemy,

        claimReward: (cardId) => {
          const run = get().run;
          if (!run || run.phase !== 'reward' || !run.reward) return;
          const deck = [...run.deck];
          if (cardId && CARD_MAP[cardId] && deck.length < 12) deck.push(cardId);
          const chips = run.chips + run.reward.chips;
          const mercs = run.mercs.map((m) => {
            if (m.hp <= 0) return m;
            const heal = run.reward?.source === 'boss' ? Math.round(m.maxHp * 0.2) : 0;
            return { ...m, hp: Math.min(m.maxHp, m.hp + heal) };
          });
          patchRun({ chips, deck, mercs });
          if (run.door >= 30) {
            winRun();
            return;
          }
          advanceDoor();
        },

        upgradeCard: (cardId) => {
          const run = get().run;
          const def = CARD_MAP[cardId];
          if (!run || !def) return;
          const level = get().levels[cardId] || 1;
          if (level >= MAX_CARD_LEVEL) return;
          const cost = upgradeCostFor(def, level);
          if (run.chips < cost) return;
          set({
            levels: { ...get().levels, [cardId]: level + 1 },
            run: { ...run, chips: run.chips - cost, updatedAt: Date.now() },
          });
          syncNow();
        },

        leaveForge: () => advanceDoor(),
        restHeal: () => {
          const run = get().run;
          if (!run || run.phase !== 'rest') return;
          const mercs = run.mercs.map((m) => (
            m.hp > 0 ? { ...m, hp: Math.min(m.maxHp, m.hp + Math.round(m.maxHp * 0.3)) } : m
          ));
          patchRun({ mercs });
          advanceDoor();
        },

        resolveEvent: (choice) => {
          const run = get().run;
          if (!run || run.phase !== 'event' || !run.event) return;
          const id = run.event.id;
          let chips = run.chips;
          let mercs = run.mercs.map((m) => ({ ...m }));
          let deck = [...run.deck];
          let enemyBoost = run.enemyBoost;
          if (id === 'cache') {
            if (choice === 0) chips += 120;
            else mercs = mercs.map((m) => (m.hp > 0 ? { ...m, hp: Math.min(m.maxHp, m.hp + Math.round(m.maxHp * 0.25)) } : m));
          } else if (id === 'eggs') {
            if (choice === 0) {
              chips += 200;
              enemyBoost = 1;
            }
          } else if (id === 'silk') {
            if (choice === 0) {
              const pool = CARDS.filter((c) => !deck.includes(c.id));
              if (pool.length > 0 && deck.length < 12) deck.push(pool[Math.floor(Math.random() * pool.length)].id);
            } else {
              mercs = mercs.map((m) => (m.hp > 0 ? { ...m, hp: Math.min(m.maxHp, m.hp + Math.round(m.maxHp * 0.15)) } : m));
            }
          }
          patchRun({ chips, mercs, deck, enemyBoost });
          advanceDoor();
        },

        abandonRun: () => {
          const run = get().run;
          if (!run) return;
          grantChips(run.chips * 0.5);
          set({ run: null, open: false });
          syncNow();
        },

        finishRun: () => set({ run: null, open: false }),
      };
    },
    {
      name: 'dungeon-v1',
      partialize: (state) => ({ run: state.run, levels: state.levels }) as unknown as DungeonStore,
    },
  ),
);

export const dungeonDeckCost = deckCost;
export { CARD_MAP, MAX_CARD_LEVEL };
export type { CardDef, DoorOption, DoorType, DungeonEvent, MercRole, Slot };
