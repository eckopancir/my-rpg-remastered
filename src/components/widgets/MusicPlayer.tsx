import { useEffect, useRef } from 'react';
import { useUiStore } from '../../stores/uiStore';

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
  const elRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const src = getTrackSrc(track);
    if (!src) return;

    const el = document.createElement('audio');
    el.src = src;
    el.loop = true;
    el.volume = musicVolume;
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
      el.volume = musicVolume;
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
      elRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  return null;
};
