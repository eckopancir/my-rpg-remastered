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

/** Standalone sound player — usable outside React hooks */
export const playCombatSound = (name: string, volume = 0.4) => {
  const soundEnabled = useUiStore.getState().soundEnabled;
  if (!soundEnabled) return;
  const src = audioMap.get(name);
  if (!src) return;
  const audio = getAudio(src);
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = volume;
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

  const playSound = useCallback(
    (name: string) => {
      if (!soundEnabled) return;
      const src = audioMap.get(name);
      if (!src) return;
      const audio = getAudio(src);
      if (!audio) return;
      audio.currentTime = 0;
      audio.volume = 0.5;
      audio.play().catch(() => {});
    },
    [soundEnabled],
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

  const playClick = useCallback(() => playSound('clickbutton'), [playSound]);
  const playCombat = useCallback(() => playSound('startbattle'), [playSound]);
  const playCraft = useCallback(() => playSound('craft'), [playSound]);
  const playEquip = useCallback(() => playSound('install'), [playSound]);

  return { playSound, stopSound, playClick, playCombat, playCraft, playEquip };
};
