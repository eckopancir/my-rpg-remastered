import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useSound } from '../../hooks/useSound';
import { getItemImage } from '../../assets/index';
import {
  CHEST_ART, artForQuality, getChestQuality, getChestLevel,
  rollChestLoot, makeResourceItem, type ChestDrop,
} from '../../data/chests';
import type { Item } from '../../types/items';

interface Props {
  chest: Item;
  onClose: () => void;
}

const RING_SECONDS = 26;

export const ChestOpening = ({ chest, onClose }: Props) => {
  const quality = getChestQuality(chest);
  const level = getChestLevel(chest);
  const art = CHEST_ART[artForQuality(quality)];
  const drops = useMemo(() => rollChestLoot(chest), [chest]);
  const [phase, setPhase] = useState<'opening' | 'opened'>('opening');
  const [remaining, setRemaining] = useState<ChestDrop[]>(drops);
  const [collected, setCollected] = useState(0);
  const { playSound } = useSound();
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  // Анимация открытия ~1.4с, затем лут.
  useEffect(() => {
    playSound('zvuk-otkrytiya-keysa-v-igre-counter-strike-16(hugesounds.com)', 0.5);
    const t = setTimeout(() => {
      setPhase('opened');
      playSound('open-magic-reveal-002379-', 0.5);
    }, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takeDrop = (drop: ChestDrop) => {
    if (drop.kind === 'item') {
      useInventoryStore.getState().addItem(drop.item as unknown as Item);
      usePlayerStore.getState().addLog(`📦 Из сундука: ${drop.item.displayName || drop.item.name} (${drop.item.quality})`, 'loot');
    } else if (drop.kind === 'resource') {
      useInventoryStore.getState().addItem(makeResourceItem(drop.def, drop.quantity));
      usePlayerStore.getState().addLog(`📦 Из сундука: ${drop.def.name} x${drop.quantity}`, 'loot');
    } else {
      usePlayerStore.getState().addChips(drop.amount);
      usePlayerStore.getState().addLog(`📦 Из сундука: 💾${drop.amount} чипов`, 'loot');
    }
  };

  const collect = (key: string) => {
    const drop = remainingRef.current.find((d) => d.key === key);
    if (!drop) return;
    takeDrop(drop);
    setRemaining((prev) => prev.filter((d) => d.key !== key));
    setCollected((c) => c + 1);
    playSound('clickbutton', 0.5);
  };

  // Закрытие (и размонтирование) — несобранное долетает само, ничего не сгорает.
  const collectRest = () => {
    const rest = remainingRef.current;
    rest.forEach(takeDrop);
    if (rest.length > 0) setCollected((c) => c + rest.length);
    setRemaining([]);
  };
  useEffect(() => () => {
    remainingRef.current.forEach(takeDrop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    collectRest();
    onClose();
  };

  const total = drops.length;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: 'var(--accent-primary)', marginBottom: 4 }}>
        📦 {chest.displayName || chest.name}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        {phase === 'opening' ? 'Открываем…' : `Собрано: ${collected}/${total} — кликай по луту`}
      </div>

      <div style={{ position: 'relative', width: 560, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'opening' ? (
          <motion.img
            src={art.closed}
            alt=""
            draggable={false}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [0.7, 1, 1.06, 1, 1.1, 1], x: [0, -10, 10, -7, 7, 0], rotate: [0, -2, 2, -1, 1, 0] }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
            style={{ width: 150, filter: 'drop-shadow(0 0 24px rgba(217,119,6,0.55))' }}
          />
        ) : (
          <>
            <motion.img
              src={art.open}
              alt=""
              draggable={false}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 160, damping: 14 }}
              style={{ width: 280, filter: 'drop-shadow(0 0 34px rgba(217,119,6,0.65))' }}
            />
            {/* Орбита лута вокруг открытого сундука */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: RING_SECONDS, ease: 'linear', repeat: Infinity }}
              style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}
            >
              {drops.map((drop, i) => {
                const angle = (-90 + (i * 360) / Math.max(1, drops.length)) * (Math.PI / 180);
                const r = 195;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r * 0.82;
                const taken = !remaining.some((d) => d.key === drop.key);
                return (
                  <motion.div
                    key={drop.key}
                    animate={{ rotate: -360 }}
                    transition={{ duration: RING_SECONDS, ease: 'linear', repeat: Infinity }}
                    style={{ position: 'absolute', left: x, top: y }}
                  >
                    <motion.div
                      animate={{ y: [0, -7, 0] }}
                      transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity, delay: i * 0.25 }}
                      onClick={() => collect(drop.key)}
                      title={drop.kind === 'item' ? (drop.item.displayName || drop.item.name) : drop.kind === 'resource' ? `${drop.def.name} x${drop.quantity}` : `💾${drop.amount} чипов`}
                      style={{
                        transform: 'translate(-50%, -50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        cursor: taken ? 'default' : 'pointer',
                        opacity: taken ? 0 : 1,
                        transition: 'opacity 200ms',
                        pointerEvents: taken ? 'none' : 'auto',
                      }}
                    >
                      {drop.kind === 'chips' ? (
                        <div style={{ fontSize: 34, lineHeight: 1, filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.7))' }}>💾</div>
                      ) : (
                        <img
                          src={drop.kind === 'item'
                            ? (drop.item.image || getItemImage(drop.item.name, drop.item.displayName))
                            : drop.def.image}
                          alt=""
                          draggable={false}
                          style={{
                            width: 46, height: 46, objectFit: 'contain',
                            filter: `drop-shadow(0 0 8px ${drop.kind === 'item' ? (drop.item.qualityColor || '#fff') : 'rgba(255,255,255,0.4)'})`,
                          }}
                        />
                      )}
                      <div style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap',
                        color: '#fff', background: 'rgba(0,0,0,0.7)', padding: '0 6px', borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}>
                        {drop.kind === 'item'
                          ? (drop.item.displayName || drop.item.name)
                          : drop.kind === 'resource'
                            ? `${drop.def.name} x${drop.quantity}`
                            : `💾${drop.amount}`}
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}
      </div>

      {phase === 'opened' && (
        <button
          onClick={handleClose}
          style={{
            marginTop: 16, padding: '10px 28px', borderRadius: 8, cursor: 'pointer',
            fontSize: 14, fontWeight: 700,
            border: '1px solid rgba(217,119,6,0.5)', background: 'linear-gradient(180deg, rgb(180,100,10), rgb(120,60,8))',
            color: '#fff',
          }}
        >
          {remaining.length === 0 ? 'Готово — закрыть' : `Забрать всё (${remaining.length}) и закрыть`}
        </button>
      )}
      <div
        onClick={phase === 'opened' ? handleClose : undefined}
        style={{ position: 'absolute', top: 14, right: 18, cursor: phase === 'opened' ? 'pointer' : 'default', fontSize: 18, color: '#fff', opacity: phase === 'opened' ? 0.8 : 0.25, padding: 4 }}
      >
        ✕
      </div>
    </div>
  );
};
