import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { useSound } from '../../hooks/useSound';
import { getItemImage } from '../../assets/index';
import { getConsumableIcon } from '../../data/consumables';
import { AMMO_GROUP_MAP, type AmmoGroup } from '../../data/ammo';
import { backpackSlotsFor, backpackDefByName } from '../../data/backpacks';
import { getSellPrice } from '../../utils/sellPrice';
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
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, (window.innerWidth - 360) / 2),
    y: Math.max(0, (window.innerHeight - 480) / 2),
  }));
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });
  const [dragging, setDragging] = useState(false);

  const slots = backpackSlotsFor(backpack);
  const cells: (Item | null)[] = Array.from({ length: Math.max(slots, 1) }, (_, i) => contents[i] ?? null);

  // Инфо по рюкзаку: семейство, занятость, состав, стоимость содержимого.
  const info = useMemo(() => {
    const byType: Record<string, number> = {};
    let value = 0;
    let ammo = 0;
    for (const it of contents) {
      const t = it.type || 'прочее';
      byType[t] = (byType[t] || 0) + 1;
      value += getSellPrice(it);
      if (it.type === 'bullet') ammo += (it.quantity ?? 1) as number;
    }
    const def = backpack ? backpackDefByName(backpack.name || '') : undefined;
    return { byType, value, ammo, family: def?.family ?? '—', base: def?.baseSlots ?? slots };
  }, [contents, backpack, slots]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startPosX = pos.x;
    dragRef.current.startPosY = pos.y;
    setDragging(true);
    e.preventDefault();
  }, [pos.x, pos.y]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.startPosX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startPosY + e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => { dragRef.current.dragging = false; setDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;
    const msg = putInBackpack(itemId);
    playClick();
    addLog(msg, msg.startsWith('❌') || msg.startsWith('⚠️') ? 'warning' : 'info');
  };

  if (!backpack) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1400, pointerEvents: 'none', userSelect: 'none' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{ position: 'fixed', left: pos.x, top: pos.y, pointerEvents: 'auto', minWidth: 320, maxWidth: '92vw' }}
      >
        <WapHeader title={`🎒 ${backpack.displayName || backpack.name} (${contents.length}/${slots})`} glow="amber" onMouseDown={onMouseDown}
          style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))' }}>
          <span onClick={(e) => { e.stopPropagation(); playClick(); onClose(); }} style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}>✕</span>
        </WapHeader>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            background: 'linear-gradient(180deg, rgb(20,12,8), rgb(10,8,5))',
            border: '2px solid rgba(217,119,6,0.2)',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
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
                const body = emoji ? (
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
                ) : url ? (
                  <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} draggable={false} />
                ) : (
                  <span style={{ fontSize: 16, opacity: 0.2 }}>?</span>
                );
                return (
                  <div
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); }}
                    onDragEnd={() => {}}
                    title="Тяни в инвентарь"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}
                  >
                    {body}
                  </div>
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
        <div style={{
          marginTop: 6, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(217,119,6,0.25)',
          fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7,
        }}>
          <div>Семейство: <b style={{ color: 'var(--text-primary)' }}>{info.family}</b> (база {info.base} + качество)</div>
          <div>Занято: <b style={{ color: 'var(--text-primary)' }}>{contents.length}/{slots}</b> · патронов: <b style={{ color: 'var(--text-primary)' }}>{info.ammo}</b> · value: <b style={{ color: '#fbbf24' }}>💾{info.value.toLocaleString()}</b></div>
          <div>Состав: {Object.keys(info.byType).length > 0
            ? Object.entries(info.byType).map(([t, n]) => `${t} x${n}`).join(' · ')
            : 'пусто'}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Тяни предметы из инвентаря · двойной клик — вернуть обратно · таскается за шапку</div>
        </div>
        {tip && <ItemTooltip item={tip.item} x={tip.x} y={tip.y} />}
      </motion.div>
    </div>
  );
};
