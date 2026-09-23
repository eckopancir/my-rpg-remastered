import { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import {
  SHOOTER_META, SHOOTER_TIERS,
  shooterOfTier, shooterCanAllocate, shooterTierOpen, shooterRankText,
  type ShooterAbilityDef,
} from '../../data/shooter';

const COL = SHOOTER_META.color;

const frameFor = (rank: number, locked: boolean): string => {
  if (rank > 0) return `2px solid ${COL}`;
  if (locked) return '2px solid rgba(255,255,255,0.10)';
  return '2px solid rgba(255,255,255,0.28)';
};

export const ShooterCell = ({
  def, onHover, onLeave, compact, bare,
}: {
  def: ShooterAbilityDef;
  onHover: (def: ShooterAbilityDef, x: number, y: number) => void;
  onLeave: () => void;
  compact?: boolean;
  /** только картинка, без надписей */
  bare?: boolean;
}) => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const allocateShooter = usePlayerStore((s) => s.allocateShooter);
  const deallocateShooter = usePlayerStore((s) => s.deallocateShooter);

  const cur = skills[def.id] || 0;
  const pen = pendingSkills[def.id] || 0;
  const tot = cur + pen;
  const maxed = tot >= def.maxRanks;
  const check = shooterCanAllocate(def.id, skills, pendingSkills, skillPoints);
  const locked = tot === 0 && !check.ok;
  const frame = compact ? 48 : 60;

  const perRank = def.statsPerRank
    ? shooterRankText(def, 1).replace(/^\+/, '')
    : def.name;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: compact ? 110 : 130 }}>
      <div
        onMouseEnter={(e) => onHover(def, e.clientX, e.clientY)}
        onMouseMove={(e) => onHover(def, e.clientX, e.clientY)}
        onMouseLeave={onLeave}
        onClick={() => allocateShooter(def.id)}
        onContextMenu={(e) => { e.preventDefault(); deallocateShooter(def.id); }}
        title={def.name}
        style={{
          width: frame, height: frame, borderRadius: 8, overflow: 'hidden',
          border: frameFor(tot, locked),
          background: '#0e0e11',
          boxShadow: tot > 0 ? `0 0 8px ${COL}55` : '0 2px 6px rgba(0,0,0,0.5)',
          cursor: maxed ? 'default' : 'pointer',
          opacity: locked ? 0.45 : 1,
          transition: 'all 120ms',
          position: 'relative', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: compact ? 40 : 52, lineHeight: 1 }}>{def.icon}</span>
        {locked && (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, background: 'rgba(0,0,0,0.45)' }}>🔒</span>
        )}
      </div>
      {!bare && (
        <>
          <div style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: tot > 0 ? COL : 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 1.2 }}>
            {perRank}
          </div>
          <div style={{ fontSize: compact ? 10 : 11, fontFamily: 'var(--font-mono)', color: maxed ? '#4ade80' : 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 1.25 }}>
            {cur}/{def.maxRanks}{pen > 0 ? <span style={{ color: '#fbbf24' }}>+{pen}</span> : ''}
          </div>
        </>
      )}
    </div>
  );
};

const ShooterTierBlock = ({
  tier, label, onHover, onLeave,
}: {
  tier: number; label: string;
  onHover: (def: ShooterAbilityDef, x: number, y: number) => void;
  onLeave: () => void;
}) => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const list = shooterOfTier(tier);
  if (list.length === 0) return null;
  const gate = shooterTierOpen(tier, skills, pendingSkills);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
        {label}
        {!gate.open && <span style={{ color: '#f87171' }}>🔒 нужно {gate.need} {gate.label} ({gate.have})</span>}
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {list.map((def) => <ShooterCell key={def.id} def={def} onHover={onHover} onLeave={onLeave} />)}
      </div>
    </div>
  );
};

export const ShooterTooltip = ({
  def, rank, x, y, statusLine, apCost,
}: {
  def: ShooterAbilityDef;
  rank: number;
  x: number; y: number;
  statusLine?: { text: string; color: string };
  apCost?: number;
}) => {
  const TOOLTIP_W = 360;
  const flipLeft = x + 16 + TOOLTIP_W > window.innerWidth;
  const tooltipX = flipLeft ? Math.max(8, x - TOOLTIP_W - 16) : x + 16;
  const tooltipY = Math.max(8, Math.min(y - 10, window.innerHeight - 340));
  const shown = Math.max(1, rank);
  return (
    <div style={{
      position: 'fixed', left: tooltipX, top: tooltipY, zIndex: 9999,
      width: 'fit-content', minWidth: 300, maxWidth: 360,
      background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
      border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
      boxShadow: '0 16px 48px rgba(0,0,0,0.75)', pointerEvents: 'none',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ height: 3, background: COL, opacity: 0.95 }} />
      <div style={{ background: `linear-gradient(180deg, ${COL}26 0%, ${COL}14 32%, ${COL}07 58%, transparent 92%)`, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <span style={{ fontSize: 64, lineHeight: 1 }}>{def.icon}</span>
        </div>
        <div style={{ padding: '8px 14px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COL, lineHeight: 1.2 }}>
            {def.name}
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
            {Array.from({ length: def.maxRanks }).map((_, i) => (
              <span key={i} style={{
                width: 18, height: 6, borderRadius: 3,
                background: i < rank ? COL : 'rgba(255,255,255,0.12)',
                boxShadow: i < rank ? `0 0 6px ${COL}` : 'none',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span>Тир {def.tier}</span>
            <span>• Стрелок</span>
            {(def.kind === 'active' || def.kind === 'ulta') && (apCost ?? def.apCost) > 0 ? <span>• {apCost ?? def.apCost}AP</span> : null}
            {def.cooldown > 0 ? <span>• КД {def.cooldown}</span> : null}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 14px 12px', maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>◇</span>
          <span style={{ flex: 1, color: 'rgba(255,255,255,0.82)' }}>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>{shooterRankText(def, shown)}</span>
          </span>
        </div>
        {rank < def.maxRanks && def.statsPerRank && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>◇</span>
            <span style={{ flex: 1, color: 'rgba(255,255,255,0.82)' }}>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>След.: </span>
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>{shooterRankText(def, rank + 1)}</span>
            </span>
          </div>
        )}
        {def.mechanic && def.kind !== 'stat' && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.38)', fontStyle: 'italic', lineHeight: 1.4 }}>
            {def.mechanic}
          </div>
        )}
        {statusLine && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: statusLine.color }}>
            {statusLine.text}
          </div>
        )}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '10px 0 8px' }} />
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
          Клик — вкачать · ПКМ — снять ожидание
        </div>
      </div>
    </div>
  );
};

export const ShooterTree = () => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const [tip, setTip] = useState<{ def: ShooterAbilityDef; x: number; y: number } | null>(null);

  const onHover = (def: ShooterAbilityDef, x: number, y: number) => setTip({ def, x, y });
  const onLeave = () => setTip(null);

  // Профессиональные рефлексы: все способности класса стоят 0 AP.
  const reflexes = ((skills['sht_reflexes'] || 0) + (pendingSkills['sht_reflexes'] || 0)) > 0;
  const apFor = (def: ShooterAbilityDef): number => {
    if (def.kind !== 'active' && def.kind !== 'ulta') return def.apCost;
    return reflexes ? 0 : def.apCost;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
      <div style={{
        width: '100%', maxWidth: 1100, borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.09)',
        background: 'linear-gradient(180deg, #101722 0%, #0e1116 60%, #0b0c0e 100%)',
        position: 'relative',
      }}>
        <div style={{ position: 'relative', padding: 8 }}>
          <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 800, letterSpacing: 2, color: COL, background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', borderRadius: '6px 6px 0 0', marginBottom: 6 }}>
            🔫 СТРЕЛОК
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 8, lineHeight: 1.5 }}>
            Автомат / пистолет / тяжёлое — урон и дальность по классам · Все активные способности: КД по описанию
          </div>
          {SHOOTER_TIERS.map((t) => (
            <ShooterTierBlock key={t} tier={t} label={`ТИР ${t}`} onHover={onHover} onLeave={onLeave} />
          ))}
        </div>
      </div>
      {tip && (
        <ShooterTooltip
          def={tip.def}
          rank={(skills[tip.def.id] || 0) + (pendingSkills[tip.def.id] || 0)}
          x={tip.x} y={tip.y}
          apCost={apFor(tip.def)}
          statusLine={(() => {
            const cur = (skills[tip.def.id] || 0) + (pendingSkills[tip.def.id] || 0);
            if (cur >= tip.def.maxRanks) return { text: '● Максимум', color: '#4ade80' };
            const chk = shooterCanAllocate(tip.def.id, skills, pendingSkills, skillPoints);
            if (!chk.ok) return { text: `🔒 ${chk.reason}`, color: '#f87171' };
            return { text: tip.def.freeTake ? 'ЛКМ — взять (бесплатно)' : 'ЛКМ — вкачать · ПКМ — снять', color: '#4ade80' };
          })()}
        />
      )}
    </div>
  );
};
