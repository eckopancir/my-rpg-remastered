import { useState } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { getItemImage } from '../../assets/index';
import { ItemTooltip } from './ItemTooltip';
import { WapHeader } from '../ui/WapHeader';
import type { Item } from '../../types/items';

const cellPx = 52;

/** Осмотр экипировки врага в бою (только чтение): папер-долл + наш тултип. */
export const EnemyGearModal = ({ enemyId, onClose }: { enemyId: number | string; onClose: () => void }) => {
  const enemy = useCombatGridStore((s) => s.enemies.find((e: any) => e.id === enemyId));
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  if (!enemy) return null;
  const gear: any[] = (enemy as any).gear ?? [];
  const gearFor = (key: string): any | null => {
    if (key === 'weapon') return gear.find((x: any) => x.slot === 'weapon1' || x.slot === 'weapon2') || null;
    return gear.find((x: any) => x.slot === key) || null;
  };
  const showTip = (item: any) => (e: React.MouseEvent) => setTip({ item, x: e.clientX, y: e.clientY });
  const moveTip = (e: React.MouseEvent) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  const cell = (key: string, label: string) => {
    const g = gearFor(key);
    const url = g ? (g.image || getItemImage(g.name, g.displayName, g.slot, g.type)) : undefined;
    return (
      <div key={key} title={label}
        onMouseEnter={g ? showTip(g) : undefined}
        onMouseMove={g ? moveTip : undefined}
        onMouseLeave={() => setTip(null)}
        style={{
          width: cellPx, height: cellPx, background: '#201c17',
          border: `1px solid ${(g as any)?.broken ? 'rgba(248,113,113,0.6)' : (g?.qualityColor || 'rgba(255,235,200,0.22)')}`,
          borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', fontSize: 9, color: 'rgba(255,255,255,0.35)',
        }}>
        {g && url ? (
          <img src={url} alt="" draggable={false} style={{ width: 42, height: 42, objectFit: 'contain', opacity: (g as any)?.broken ? 0.45 : 1 }} />
        ) : (
          <span>{g ? '?' : '—'}</span>
        )}
        {(g as any)?.broken && (
          <span style={{ position: 'absolute', bottom: 0, fontSize: 9, fontWeight: 800, color: '#f87171' }}>🔧</span>
        )}
      </div>
    );
  };
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'transparent', pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ pointerEvents: 'auto', minWidth: 300, background: '#14141c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}>
        <WapHeader title={`🛡️ Экипировка: ${(enemy as any).name}`} glow="amber"
          style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))', margin: 0, width: '100%' }}>
          <span onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}>✕</span>
        </WapHeader>
        <div style={{ padding: 14 }}>
          {gear.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Без экипировки</div>
          )}
          {/* Папер-долл: центр — шлем/броня/штаны/ботинки;
              перчатки слева и оружие справа — на уровне брони, щит — слева от штанов. */}
          <div style={{ display: 'grid', gridTemplateColumns: `${cellPx}px ${cellPx}px ${cellPx}px`, gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <div />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{cell('head', 'Шлем')}</div>
            <div />
            <div style={{ display: 'flex', justifyContent: 'center' }}>{cell('gloves', 'Перчатки')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{cell('armor', 'Броня')}</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>{cell('weapon', 'Оружие')}</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>{cell('shield', 'Щит')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{cell('pants', 'Штаны')}</div>
            <div />
            <div />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{cell('boots', 'Ботинки')}</div>
            <div />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            Наведи — тултип · снять можно только с трупа
          </div>
        </div>
        {tip && <ItemTooltip item={tip.item} x={tip.x} y={tip.y} />}
      </div>
    </div>
  );
};
