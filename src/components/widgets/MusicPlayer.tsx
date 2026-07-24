import { useEffect, useRef } from 'react';
import { useUiStore } from '../../stores/uiStore';

const audioModules = import.meta.glob<{ default: string }>('../../assets/audio/**/*.mp3', { eager: true });

const getTrackSrc = (): string | undefined => {
  for (const [path, mod] of Object.entries(audioModules)) {
    if (path.toLowerCase().includes('track')) return mod.default;
  }
  return undefined;
};

const trackSrc = getTrackSrc();

export const MusicPlayer = () => {
  const musicEnabled = useUiStore((s) => s.musicEnabled);
  const musicVolume = useUiStore((s) => s.musicVolume);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!trackSrc) return;
    if (!audioRef.current) {
      const audio = new Audio(trackSrc);
      audio.loop = true;
      audio.volume = musicVolume;
      audioRef.current = audio;
    }
    const audio = audioRef.current;

    if (musicEnabled) {
      if (!startedRef.current) {
        audio.play().catch(() => {});
        startedRef.current = true;
      } else if (audio.paused) {
        audio.play().catch(() => {});
      }
    } else {
      audio.pause();
    }
  }, [musicEnabled]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return null;
};
