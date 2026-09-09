import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useSound } from '../../hooks/useSound';
import { getItemImage } from '../../assets/index';
import { getConsumableIcon } from '../../data/consumables';
import { AMMO_GROUP_MAP, type AmmoGroup } from '../../data/ammo';
import { backpackSlotsFor } from '../../data/backpacks';
import { ItemTooltip } from './ItemTooltip';
import { WapHeader } from '../ui/WapHeader';
import type { Item } from '../../types/items';

interface Props {
  onClose: () => void;
}

const cellSize = 48;

const cellIcon = (item: Item): string | null => {
  if (item.image) return null;
  if (item.type === 'consumable') return getConsumableIcon(item);
  if (item.type === 'backpack') return '🎒';
  if (item.type === 'bullet') return AMMO_GROUP_MAP[(item as any).ammoGroup as AmmoGroup]?.icon ?? '🔸';
  if (item.type === 'chest') return null;
  return null;
};

export const BackpackWindow = ({ onClose }: Props) => {
  const backpack = usePlayerStore((s) => s.equipment.backpack);
  const contents = usePlayerStore((s) => s.backpackContents);
  const putInBackpack = usePlayerStore((s) => s.putInBackpack);
  const takeOutBackpack = usePlayerStore((s) => s.takeOutBackpack);
  const addLog = usePlayerStore((s) => s.addLog);
  const { playClick } = useSound();
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);

  const slots = backpackSlotsFor(backpack);
  const cells: (Item | null)[] = Array.from({ length: Math.max(slots, 1) }, (_, i) => contents[i] ?? null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;
    const msg = putInBackpack(itemId);
    playClick();
    addLog(msg, msg.startsWith('❌') || msg.startsWith('⚠️') ? 'warning' : 'info');
  };

  if (!backpack) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <div style={{ background: '#12121a', border: '1px solid var(--border-glass)', borderRadius: 8, padding: 24, color: 'var(--text-primary)' }}>
          ❌ Нет рюкзака! Надень рюкзак в экипировку.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 320, maxWidth: '92vw' }}
      >
        <WapHeader title={`🎒 ${backpack.displayName || backpack.name} (${contents.length}/${slots})`} glow="amber" onMouseDown={() => {}}>
          <span onClick={(e) => { e.stopPropagation(); playClick(); onClose(); }} style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}>✕</span>
        </WapHeader>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            background: 'linear-gradient(180deg, rgb(20,12,8), rgb(10,8,5))',
            border: '2px solid rgba(217,119,6,0.2)',
            borderRadius: '0 0 8px 8px',
            padding: 12,
            display: 'grid',
            gridTemplateColumns: `repeat(5, ${cellSize}px)`,
            gap: 4,
            justifyContent: 'center',
          }}
        >
          {cells.map((item, i) => (
            <div
              key={item ? item.id : `empty-${i}`}
              onDoubleClick={() => { if (item) { takeOutBackpack(item.id); playClick(); } }}
              onMouseEnter={(e) => { if (item) setTip({ item, x: e.clientX, y: e.clientY }); }}
              onMouseMove={(e) => { if (item) setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t)); }}
              onMouseLeave={() => setTip(null)}
              title={item ? 'Двойной клик — вернуть в инвентарь' : 'Перетащи сюда из инвентаря'}
              style={{
                width: cellSize, height: cellSize,
                background: '#0f0f15',
                border: `1px solid ${item?.qualityColor || 'rgba(255,255,255,0.08)'}`,
                borderRadius: 3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: item ? 'pointer' : 'default', position: 'relative',
              }}
            >
              {item && (() => {
                const emoji = cellIcon(item);
                const url = emoji ? undefined : (item.image || getItemImage(item.name, item.displayName));
                return emoji ? (
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
                ) : url ? (
                  <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} draggable={false} />
                ) : (
                  <span style={{ fontSize: 16, opacity: 0.2 }}>?</span>
                );
              })()}
              {item && ((item.quantity ?? 1) > 1 || item.type === 'bullet') && (
                <div style={{
                  position: 'absolute', bottom: 1, right: 2,
                  fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  color: '#fff', background: 'rgba(0,0,0,0.65)',
                  borderRadius: 2, padding: '0 3px', lineHeight: '13px',
                }}>
                  x{item.quantity ?? 1}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          Тяни предметы из инвентаря · двойной клик — вернуть обратно
        </div>
        {tip && <ItemTooltip item={tip.item} x={tip.x} y={tip.y} />}
      </motion.div>
    </div>
  );
};
