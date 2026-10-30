/**
 * Звук карт данжа.
 *
 * Звук выбирается по семье карты (`kind`) и сету — 300 карт не должны тянуть
 * 300 уникальных сэмплов. Ручные оверрайды — только у легендарок.
 *
 * Все имена — ключи из `audioMap` в `src/hooks/useSound.ts`
 * (имя файла без расширения).
 */
import { playCombatSound, playShotSound, preloadCombatSounds } from '../../hooks/useSound';
import type { CardDef } from './cards';

interface Sfx {
  name: string;
  volume: number;
  /** Гонять через playShotSound (режет длинные пулемётные сэмплы). */
  shot?: boolean;
  /** Задержка в мс — для слоёных звуков. */
  delay?: number;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const SHOT_POOL = [
  'shot1', 'shot2', 'shot3', 'shot4', 'shot5', 'shot6',
  'shot7', 'shot8', 'shot10', 'shot11', 'shot12', 'pistol', 'automat',
];
const SNIPE_POOL = ['snayperskoy', 'sniper', 'sniper3', 'aimShot'];
const WEB_POOL = ['melee', 'sherst--myagkiy-shoroh'];
const RELIC_POOL = ['Corruption', 'SkullBasher', 'Maim', 'Echo_Sabre'];
const ENG_POOL = ['1bbfc9b5f4347f2', 'arci'];
const AOE_POOL = ['grenadeBoom', 'grenadegun', 'bazooka_sound_effect'];
const SHIELD_POOL = ['block', 'Armlet', 'Buckler'];
const BUFF_POOL = ['Battle_Fury', 'Mask_of_Madness', 'ChallengingRoar'];
const DEBUFF_POOL = ['Corruption', 'Maim', 'arci'];
const CONTROL_POOL = ['invis', 'Blink', 'Phase_Boots'];
const UTILITY_POOL = ['reload', 'reloading', 'scroll'];
const HEAL_POOL = ['healer', 'medshot4'];

/** Легендарки и ключевые механики — ручные слои. */
const OVERRIDES: Record<string, Sfx[]> = {
  vitaChamber: [
    { name: 'LotusOrbcast', volume: 0.45 },
    { name: 'healer', volume: 0.35, delay: 140 },
  ],
  rebirth: [
    { name: 'LotusOrbcast', volume: 0.45 },
    { name: 'Battle_Fury', volume: 0.35, delay: 160 },
  ],
  queensTear: [
    { name: 'LotusOrbcast', volume: 0.4 },
    { name: 'healer', volume: 0.35, delay: 120 },
  ],
  queenWill: [{ name: 'ChallengingRoar', volume: 0.45 }],
  volatileBrew: [
    { name: 'grenadeBoom', volume: 0.35, shot: true },
    { name: 'arci', volume: 0.3, delay: 90 },
  ],
  broodHeart: [{ name: 'Battle_Fury', volume: 0.4 }],
  hiveMind: [{ name: 'open-magic-reveal-002379-', volume: 0.35 }],
  ancientEgg: [
    { name: 'Corruption', volume: 0.35 },
    { name: 'ChallengingRoar', volume: 0.3, delay: 140 },
  ],
};

const isSniperCard = (def: CardDef): boolean =>
  def.id === 'headshot' || def.id === 'snipe' || def.id === 'mark' ||
  def.id === 'aimedShot' || def.id === 'deadeye';

const baseSfx = (def: CardDef): Sfx => {
  if (def.kind === 'aoe') {
    if (def.set === 'chemistry') return { name: 'arci', volume: 0.3 };
    return { name: pick(AOE_POOL), volume: 0.32, shot: true };
  }
  if (def.kind === 'attack') {
    if (def.set === 'ballistics') {
      if (isSniperCard(def)) return { name: pick(SNIPE_POOL), volume: 0.4 };
      return { name: pick(SHOT_POOL), volume: 0.32, shot: true };
    }
    if (def.set === 'web') return { name: pick(WEB_POOL), volume: 0.32 };
    if (def.set === 'relics') return { name: pick(RELIC_POOL), volume: 0.35 };
    if (def.set === 'engineering') return { name: pick(ENG_POOL), volume: 0.32 };
    if (def.set === 'chemistry') return { name: 'arci', volume: 0.3 };
    if (def.set === 'tactics') return { name: pick(['melee', 'Maim']), volume: 0.32 };
    return { name: pick(SHOT_POOL), volume: 0.32, shot: true };
  }
  if (def.kind === 'heal') return { name: pick(HEAL_POOL), volume: 0.35 };
  if (def.kind === 'shield') {
    const hasMaxArmor = def.effects.some((e) => e.t === 'maxArmor');
    return { name: hasMaxArmor ? 'MaximumArmor' : pick(SHIELD_POOL), volume: 0.35 };
  }
  if (def.kind === 'buff') return { name: pick(BUFF_POOL), volume: 0.32 };
  if (def.kind === 'debuff') return { name: pick(DEBUFF_POOL), volume: 0.32 };
  if (def.kind === 'control') return { name: pick(CONTROL_POOL), volume: 0.3 };
  return { name: pick(UTILITY_POOL), volume: 0.22 };
};

const play = (s: Sfx): void => {
  if (s.shot) playShotSound(s.name, s.volume);
  else playCombatSound(s.name, s.volume);
};

/** Озвучить розыгрыш карты: базовый звук семьи + крит/ярость. */
export const playCardSfx = (def: CardDef, opts?: { crit?: boolean; rage?: boolean }): void => {
  const list = OVERRIDES[def.id] ?? [baseSfx(def)];
  for (const s of list) {
    if (s.delay) window.setTimeout(() => play(s), s.delay);
    else play(s);
  }
  if (opts?.crit) window.setTimeout(() => playCombatSound('crit', 0.45), 80);
  if (opts?.rage) window.setTimeout(() => playCombatSound('Battle_Fury', 0.4), 60);
};

export const playEnemyDeathSfx = (): void => {
  playCombatSound(
    pick(['wilhelm_scream', 'wilhelm_scream2', 'wilhelm_scream3', 'wilhelm_scream4', 'wilhelm_scream5']),
    0.22,
  );
};

export const playMercDeathSfx = (): void => {
  playCombatSound('kaban-vizjit-rezko-v-shvatke', 0.3);
};

export const playDodgeSfx = (): void => {
  playCombatSound('evasion', 0.3);
};

export const playRewardSfx = (): void => {
  playCombatSound('chips', 0.35);
};

export const playUpgradeSfx = (): void => {
  playCombatSound(pick(['craft', 'craft2', 'craft3', 'craft4']), 0.35);
};

export const playBattleStartSfx = (): void => {
  playCombatSound('startbattle', 0.4);
};

/** Отдых / лечение между дверями. */
export const playRestSfx = (): void => {
  playCombatSound('healer', 0.35);
};

/** Событие: свиток/записка с выбором. */
export const playEventSfx = (): void => {
  playCombatSound('scroll', 0.3);
};

/** Финал забега: победа — нарастающий звон, поражение — затухание питания. */
export const playRunEndSfx = (win: boolean): void => {
  if (win) {
    playCombatSound('open-magic-reveal-002379-', 0.4);
    window.setTimeout(() => playCombatSound('chips', 0.35), 180);
  } else {
    playCombatSound('off', 0.35);
  }
};

/** Прогрев сэмплов при входе в бой — чтобы первый выстрел не лагал. */
export const preloadDungeonSfx = (): void => {
  preloadCombatSounds([
    ...SHOT_POOL, ...SNIPE_POOL, ...WEB_POOL, ...RELIC_POOL, ...ENG_POOL,
    ...AOE_POOL, ...SHIELD_POOL, ...BUFF_POOL, ...DEBUFF_POOL, ...CONTROL_POOL,
    ...UTILITY_POOL, ...HEAL_POOL,
    'MaximumArmor', 'crit', 'evasion', 'chips', 'startbattle',
    'wilhelm_scream', 'wilhelm_scream2', 'wilhelm_scream3', 'wilhelm_scream4', 'wilhelm_scream5',
    'kaban-vizjit-rezko-v-shvatke',
    'LotusOrbcast', 'open-magic-reveal-002379-',
    'craft', 'craft2', 'craft3', 'craft4',
    'off', 'scroll',
  ]);
};
