import { useEffect, useRef } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useCombatGridStore } from '../../stores/combatGridStore';

const audioModules = import.meta.glob<{ default: string }>('../../assets/audio/**/*.mp3', { eager: true });

const getTrackSrc = (substring: string): string | undefined => {
  for (const [path, mod] of Object.entries(audioModules)) {
    if (path.toLowerCase().includes(substring)) return mod.default;
  }
  return undefined;
};

export const MusicPlayer = ({ track = 'track', forcePlay }: { track?: string; forcePlay?: boolean }) => {
  const musicEnabled = useUiStore((s) => s.musicEnabled);
  const musicVolume = useUiStore((s) => s.musicVolume);
  const duckMusicInCombat = useUiStore((s) => s.duckMusicInCombat);
  const combatActive = useCombatGridStore((s) => s.isActive);
  // Настройка «Тихая музыка в бою»: на арене громкость ×0.3.
  const effVolume = duckMusicInCombat && combatActive ? musicVolume * 0.3 : musicVolume;
  const elRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const src = getTrackSrc(track);
    if (!src) return;

    const el = document.createElement('audio');
    el.src = src;
    el.loop = true;
    el.volume = effVolume;
    el.style.display = 'none';
    document.body.appendChild(el);
    elRef.current = el;

    const shouldPlay = forcePlay || musicEnabled;
    if (shouldPlay) {
      el.muted = true;
      el.play().catch(() => {});
    }

    const onInteraction = () => {
      el.muted = false;
      el.volume = effVolume;
      el.play().catch(() => {});
    };

    if (forcePlay) {
      window.addEventListener('click', onInteraction);
      window.addEventListener('keydown', onInteraction);
    }

    return () => {
      el.pause();
      el.remove();
      elRef.current = null;
      if (forcePlay) {
        window.removeEventListener('click', onInteraction);
        window.removeEventListener('keydown', onInteraction);
      }
    };
  }, [musicEnabled, track, forcePlay]);

  useEffect(() => {
    if (elRef.current) {
      elRef.current.volume = effVolume;
    }
  }, [musicVolume, effVolume]);

  return null;
};
