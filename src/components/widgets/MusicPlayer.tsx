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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unmutedRef = useRef(false);

  const unmute = (audio: HTMLAudioElement) => {
    if (unmutedRef.current) return;
    audio.muted = false;
    audio.volume = musicVolume;
    unmutedRef.current = true;
  };

  useEffect(() => {
    const src = getTrackSrc(track);
    if (!src) return;

    if (!audioRef.current || audioRef.current.dataset.track !== track) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(src);
      audio.loop = true;
      audio.muted = true;
      audio.volume = 0;
      audio.dataset.track = track;
      audioRef.current = audio;
      unmutedRef.current = false;
    }

    const audio = audioRef.current;

    const shouldPlay = forcePlay || musicEnabled;

    if (!shouldPlay) {
      audio.pause();
      return;
    }

    if (!unmutedRef.current) {
      audio.muted = true;
      audio.volume = 0;
    }

    audio.play().catch(() => {});

    if (forcePlay) {
      const onInteraction = () => {
        unmute(audio);
        audio.removeEventListener('click', onInteraction);
        audio.removeEventListener('keydown', onInteraction);
      };
      document.addEventListener('click', onInteraction, { once: true });
      document.addEventListener('keydown', onInteraction, { once: true });
      return () => {
        document.removeEventListener('click', onInteraction);
        document.removeEventListener('keydown', onInteraction);
      };
    } else if (!unmutedRef.current) {
      unmute(audio);
    }
  }, [musicEnabled, track, forcePlay]);

  useEffect(() => {
    if (audioRef.current && unmutedRef.current) {
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
