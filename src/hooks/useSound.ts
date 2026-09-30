import { useCallback } from 'react';
import { useUiStore } from '../stores/uiStore';

const audioModules = import.meta.glob<{ default: string }>('../assets/audio/**/*.{mp3,ogg}', { eager: true });

const audioMap = new Map<string, string>();
for (const [path, mod] of Object.entries(audioModules)) {
  const name = path.split('/').pop()?.replace(/\.(mp3|ogg)$/, '') || '';
  audioMap.set(name, mod.default);
}

const audioCache = new Map<string, HTMLAudioElement>();

// Пул перекрывающихся инстансов: очередь не режет сама себя,
// быстрые залпы (бонус-выстрелы, пулемёты) слышны каждый.
const POOL_SIZE = 4;
const overlapPools = new Map<string, HTMLAudioElement[]>();
const overlapIdx = new Map<string, number>();

const playPooled = (src: string, effective: number) => {
  let pool = overlapPools.get(src);
  if (!pool) {
    pool = [];
    overlapPools.set(src, pool);
  }
  const i = overlapIdx.get(src) || 0;
  let el = pool[i % POOL_SIZE];
  if (!el) {
    el = new Audio(src);
    el.preload = 'auto';
    pool[i % POOL_SIZE] = el;
  }
  overlapIdx.set(src, i + 1);
  try {
    el.currentTime = 0;
    el.volume = Math.max(0, Math.min(1, effective));
    el.play().catch(() => {});
  } catch { /* noop */ }
};

/** Прогрев звуков боя: убирает задержку декодирования первого выстрела. */
export const preloadCombatSounds = (names: string[]) => {
  try {
    for (const name of names) {
      const src = audioMap.get(name);
      if (!src || overlapPools.has(src)) continue;
      const el = new Audio(src);
      el.preload = 'auto';
      try { el.load(); } catch { /* noop */ }
      overlapPools.set(src, [el]);
    }
  } catch { /* noop */ }
};

const getAudio = (src: string): HTMLAudioElement | undefined => {
  const cached = audioCache.get(src);
  if (cached) return cached;
  const audio = new Audio(src);
  audioCache.set(src, audio);
  return audio;
};

/** Standalone sound player — usable outside React hooks.
 * channel 'arena' — бои на 2D-карте, 'range' — полигон с манекеном. */
export type SoundChannel = 'arena' | 'range';
export const playCombatSound = (name: string, volume = 0.4, channel: SoundChannel = 'arena') => {
  const ui = useUiStore.getState();
  if (!ui.soundEnabled) return;
  const channelVolume = channel === 'range' ? (ui.rangeVolume ?? 1) : (ui.arenaVolume ?? 1);
  const effective = volume * channelVolume;
  if (effective <= 0) return;
  const src = audioMap.get(name);
  if (!src) return;
  const audio = getAudio(src);
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = Math.max(0, Math.min(1, effective));
  audio.play().catch(() => {});
};

export const stopCombatSound = (name: string) => {
  const src = audioMap.get(name);
  if (!src) return;
  const audio = audioCache.get(src);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
};

const loopCache = new Map<string, HTMLAudioElement>();

/** Зацикленный звук (костёр и т.п.): играет пока не вызовут stopLoopSound. */
export const playLoopSound = (name: string, volume = 0.4) => {
  const ui = useUiStore.getState();
  if (!ui.soundEnabled) return;
  const src = audioMap.get(name);
  if (!src) return;
  let audio = loopCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    loopCache.set(src, audio);
  }
  audio.volume = Math.max(0, Math.min(1, volume * (ui.arenaVolume ?? 1)));
  audio.currentTime = 0;
  audio.play().catch(() => {});
};

export const stopLoopSound = (name: string) => {
  const src = audioMap.get(name);
  if (!src) return;
  const audio = loopCache.get(src);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
};

/** Длинные выстрелы: играют максимум N мс, дальше стоп (пулемёт 1.2с, глушитель 0.3с). */
const CAPPED_DEFAULT_MS = 1200;
const cappedTimers = new Map<string, any>();
const LONG_SHOT_SOUNDS = new Set(['пулемет']);
const SHORT_CAPPED_SOUNDS = new Set(['automatic-shots-burst-with-a-silencer']);
/** Фиксированная длительность отдельных сэмплов (мс). */
const FIXED_SHOT_MS: Record<string, number> = {
  'пистолет с глушителем': 800,
};
export const playCappedSound = (name: string, volume = 0.4, ms = CAPPED_DEFAULT_MS, channel: SoundChannel = 'arena') => {
  playCombatSound(name, volume, channel);
  const t = cappedTimers.get(name);
  if (t) clearTimeout(t);
  cappedTimers.set(name, setTimeout(() => { stopCombatSound(name); cappedTimers.delete(name); }, ms));
};
/** Выстрел с учётом длины: длинные режутся, короткие как были. */
export const playShotSound = (name: string, volume = 0.4, channel: SoundChannel = 'arena') => {
  if (name in FIXED_SHOT_MS) playCappedSound(name, volume, FIXED_SHOT_MS[name], channel);
  else if (SHORT_CAPPED_SOUNDS.has(name)) playCappedSound(name, volume, 300, channel);
  else if (LONG_SHOT_SOUNDS.has(name)) playCappedSound(name, volume, CAPPED_DEFAULT_MS, channel);
  else playCombatSound(name, volume, channel);
};
/** Плейлист карты: два трека одновременно слоем (эмбиент + музыка). */
let playlistNames: string[] = [];
export const stopPlaylist = () => {
  try {
    for (const n of playlistNames) stopLoopSound(n);
  } catch { /* noop */ }
  playlistNames = [];
};
export const playPlaylist = (a: string, b: string, volume = 0.35) => {
  stopPlaylist();
  const ui = useUiStore.getState();
  if (!ui.soundEnabled) return;
  playlistNames = a === b ? [a] : [a, b];
  for (const n of playlistNames) {
    try { playLoopSound(n, volume); } catch { /* noop */ }
  }
};
/** Музыка карты: нет / один трек лупом / два одновременно слоем. */
export const startMapMusic = (music?: string, music2?: string, volume = 0.35) => {
  stopPlaylist();
  const a = (music || '').trim();
  const b = (music2 || '').trim();
  if (a && a !== '__none' && b && b !== '__none') {
    playPlaylist(a, b, volume);
  } else if (a && a !== '__none') {
    try { playLoopSound(a, volume); } catch { /* noop */ }
  } else if (b && b !== '__none') {
    try { playLoopSound(b, volume); } catch { /* noop */ }
  }
};

/** Дождь: первый проход с начала, дальше — с 1:20 (там ровный шум без вступления). */
let rainAudio: HTMLAudioElement | null = null;
export const playRainLoop = (volume = 0.25) => {
  const ui = useUiStore.getState();
  if (!ui.soundEnabled) return;
  const src = audioMap.get('zvuki-prirody-1_-kapli-dozhdya');
  if (!src) return;
  if (rainAudio && !rainAudio.paused) return;
  stopRainLoop();
  try {
    const el = new Audio(src);
    el.volume = Math.max(0, Math.min(1, volume * (ui.arenaVolume ?? 1)));
    el.onended = () => {
      try {
        el.currentTime = el.duration > 85 ? 80 : 0;
        el.play().catch(() => {});
      } catch { /* noop */ }
    };
    rainAudio = el;
    el.play().catch(() => {});
  } catch { /* noop */ }
};

export const stopRainLoop = () => {
  try {
    if (rainAudio) {
      rainAudio.onended = null;
      rainAudio.pause();
    }
  } catch { /* noop */ }
  rainAudio = null;
};

/** Птицы на карте: играет без остановки, пока нет дождя. */
const BIRD_KEY = 'forest-birds-singmp3';
export const playBirdLoop = (volume = 0.2) => {
  const ui = useUiStore.getState();
  if (!ui.soundEnabled) return;
  const src = audioMap.get(BIRD_KEY);
  if (!src) return;
  let audio = loopCache.get(src);
  if (audio && !audio.paused) return;
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    loopCache.set(src, audio);
  }
  audio.volume = Math.max(0, Math.min(1, volume * (ui.arenaVolume ?? 1)));
  audio.currentTime = 0;
  audio.play().catch(() => {});
};

export const stopBirdLoop = () => {
  const src = audioMap.get(BIRD_KEY);
  if (!src) return;
  const audio = loopCache.get(src);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
};

/** Сверчки: ночью всегда (дождя ночью не бывает). */
const CRICKET_KEY = 'zvuki-sverchkov1';
export const playCricketLoop = (volume = 0.2) => {
  const ui = useUiStore.getState();
  if (!ui.soundEnabled) return;
  const src = audioMap.get(CRICKET_KEY);
  if (!src) return;
  let audio = loopCache.get(src);
  if (audio && !audio.paused) return;
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    loopCache.set(src, audio);
  }
  audio.volume = Math.max(0, Math.min(1, volume * (ui.arenaVolume ?? 1)));
  audio.currentTime = 0;
  audio.play().catch(() => {});
};

export const stopCricketLoop = () => {
  const src = audioMap.get(CRICKET_KEY);
  if (!src) return;
  const audio = loopCache.get(src);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
};

export const useSound = () => {
  const soundEnabled = useUiStore((s) => s.soundEnabled);
  const uiVolume = useUiStore((s) => s.uiVolume ?? 1);

  const playSound = useCallback(
    (name: string, volume = 0.5) => {
      if (!soundEnabled) return;
      const effective = volume * uiVolume;
      if (effective <= 0) return;
      const src = audioMap.get(name);
      if (!src) return;
      playPooled(src, effective);
    },
    [soundEnabled, uiVolume],
  );

  const stopSound = useCallback((name: string) => {
    const src = audioMap.get(name);
    if (!src) return;
    const audio = audioCache.get(src);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  // Клик тихий (-80%): навигация по панелям не должна бить по ушам.
  const playClick = useCallback(() => playSound('clickbutton', 0.1), [playSound]);
  const playCombat = useCallback(() => playSound('startbattle'), [playSound]);
  const playCraft = useCallback(() => playSound('craft'), [playSound]);
  const playEquip = useCallback(() => playSound('install'), [playSound]);

  return { playSound, stopSound, playClick, playCombat, playCraft, playEquip };
};
