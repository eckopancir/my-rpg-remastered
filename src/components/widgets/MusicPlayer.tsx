import { useEffect, useRef } from 'react';
import { useUiStore } from '../../stores/uiStore';

const audioModules = import.meta.glob<{ default: string }>('../../assets/audio/**/*.mp3', { eager: true });

const getTrackSrc = (substring: string): string | undefined => {
  for (const [path, mod] of Object.entries(audioModules)) {
    if (path.toLowerCase().includes(substring)) return mod.default;
  }
  return undefined;
};

export const MusicPlayer = ({ track = 'track' }: { track?: string }) => {
  const musicEnabled = useUiStore((s) => s.musicEnabled);
  const musicVolume = useUiStore((s) => s.musicVolume);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const src = getTrackSrc(track);
    if (!src) return;

    if (!audioRef.current || audioRef.current.dataset.track !== track) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = musicVolume;
      audio.dataset.track = track;
      audioRef.current = audio;
      startedRef.current = false;
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
  }, [musicEnabled, track]);

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
