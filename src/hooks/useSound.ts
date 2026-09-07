import { useCallback } from 'react';
import { useUiStore } from '../stores/uiStore';

const audioModules = import.meta.glob<{ default: string }>('../assets/audio/**/*.mp3', { eager: true });

const audioMap = new Map<string, string>();
for (const [path, mod] of Object.entries(audioModules)) {
  const name = path.split('/').pop()?.replace(/\.mp3$/, '') || '';
  audioMap.set(name, mod.default);
}

const audioCache = new Map<string, HTMLAudioElement>();

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
      const audio = getAudio(src);
      if (!audio) return;
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, effective));
      audio.play().catch(() => {});
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
