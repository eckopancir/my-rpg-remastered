import { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import {
  SNIPER_META, SNIPER_TIERS,
  sniperOfTier, sniperCanAllocate, sniperTierOpen, sniperRankText,
  type SniperAbilityDef, type SniperColumn,
} from '../../data/sniper';
import { getSniperImage, sniperSkillsBg } from '../../assets/index';
import { AbilityTooltip } from './AbilityTooltip';

const COL = SNIPER_META.color;

const frameFor = (rank: number, locked: boolean): string => {
  if (rank > 0) return `2px solid ${COL}`;
  if (locked) return '2px solid rgba(255,255,255,0.10)';
  return '2px solid rgba(255,255,255,0.28)';
};

/** Картинка способности (или эмодзи, если картинки нет) — 1в1 как у лесничего. */
const SniperDefIcon = ({ def, size }: { def: SniperAbilityDef; size: number }) => {
  const src = def.img ? getSniperImage(def.img) : undefined;
  if (src) return <img src={src} alt={def.name} draggable={false} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 6 }} />;
  return <span style={{ fontSize: size, lineHeight: 1 }}>{def.icon || '🎯'}</span>;
};

export const SniperCell = ({
  def, onHover, onLeave, compact, bare,
}: {
  def: SniperAbilityDef;
  onHover: (def: SniperAbilityDef, x: number, y: number) => void;
  onLeave: () => void;
  compact?: boolean;
  /** только картинка, без надписей */
  bare?: boolean;
}) => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const allocateSniper = usePlayerStore((s) => s.allocateSniper);
  const deallocateSniper = usePlayerStore((s) => s.deallocateSniper);

  const cur = skills[def.id] || 0;
  const pen = pendingSkills[def.id] || 0;
  const tot = cur + pen;
  const maxed = tot >= def.maxRanks;
  const check = sniperCanAllocate(def.id, skills, pendingSkills, skillPoints);
  const locked = tot === 0 && !check.ok;
  const frame = compact ? 48 : 60;

  // Только бонус за ранг + счётчик одним кеглем, без суммарного текста (сумма — в тултипе).
  const perRank = def.statsPerRank
    ? sniperRankText(def, 1).replace(/^\+/, '')
    : def.name;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: compact ? 110 : 130 }}>
      <div
        onMouseEnter={(e) => onHover(def, e.clientX, e.clientY)}
        onMouseMove={(e) => onHover(def, e.clientX, e.clientY)}
        onMouseLeave={onLeave}
        onClick={() => allocateSniper(def.id)}
        onContextMenu={(e) => { e.preventDefault(); deallocateSniper(def.id); }}
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
        <SniperDefIcon def={def} size={compact ? 40 : 52} />
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

const TierBlock = ({
  column, tier, label, onHover, onLeave,
}: {
  column: SniperColumn; tier: number; label: string;
  onHover: (def: SniperAbilityDef, x: number, y: number) => void;
  onLeave: () => void;
}) => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const list = sniperOfTier(column, tier);
  if (list.length === 0) return null;
  const gate = sniperTierOpen(column, tier, skills, pendingSkills);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
        {label}
        {!gate.open && <span style={{ color: '#f87171' }}>🔒 нужно {gate.need} {gate.label} ({gate.have})</span>}
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {list.map((def) => <SniperCell key={def.id} def={def} onHover={onHover} onLeave={onLeave} />)}
      </div>
    </div>
  );
};

export const SniperTree = () => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const [tip, setTip] = useState<{ def: SniperAbilityDef; x: number; y: number } | null>(null);

  const bg = sniperSkillsBg();

  const apFor = (def: SniperAbilityDef): number => {
    if (def.id === 'snp_d4_nest' || def.id === 'snp_d4_camo') {
      const d = Math.min(2, (skills['snp_a6_cheap'] || 0) + (pendingSkills['snp_a6_cheap'] || 0));
      return Math.max(0, def.apCost - d);
    }
    return def.apCost;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
      <div style={{
        width: '100%', maxWidth: 1100, borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.09)',
        backgroundImage: bg ? `url(${bg})` : undefined,
        backgroundSize: 'cover', backgroundPosition: 'center',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,10,0.72)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: 2, minWidth: 0, padding: 8 }}>
            <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#f87171', background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', borderRadius: '6px 6px 0 0', marginBottom: 6 }}>
              ⚔️ АТАКУЮЩИЕ
            </div>
            {SNIPER_TIERS.attack.map((t) => (
              <TierBlock key={t} column="attack" tier={t} label={`ТИР ${t}`} onHover={(def, x, y) => setTip({ def, x, y })} onLeave={() => setTip(null)} />
            ))}
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.14)', flexShrink: 0, margin: '8px 0' }} />
          <div style={{ flex: 1, minWidth: 0, padding: 8 }}>
            <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#60a5fa', background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', borderRadius: '6px 6px 0 0', marginBottom: 6 }}>
              🛡️ ЗАЩИТНЫЕ
            </div>
            {SNIPER_TIERS.defense.map((t) => (
              <TierBlock key={t} column="defense" tier={t} label={`ТИР ${t}`} onHover={(def, x, y) => setTip({ def, x, y })} onLeave={() => setTip(null)} />
            ))}
          </div>
        </div>
      </div>
      {tip && (
        <AbilityTooltip
          def={tip.def}
          rank={(skills[tip.def.id] || 0) + (pendingSkills[tip.def.id] || 0)}
          x={tip.x} y={tip.y}
          apCost={apFor(tip.def)}
          statusLine={(() => {
            const cur = (skills[tip.def.id] || 0) + (pendingSkills[tip.def.id] || 0);
            if (cur >= tip.def.maxRanks) return { text: '● Максимум', color: '#4ade80' };
            const chk = sniperCanAllocate(tip.def.id, skills, pendingSkills, skillPoints);
            if (!chk.ok) return { text: `🔒 ${chk.reason}`, color: '#f87171' };
            return { text: 'ЛКМ — вкачать · ПКМ — снять', color: '#4ade80' };
          })()}
        />
      )}
    </div>
  );
};
