import { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import {
  SNIPER_META, SNIPER_TIERS,
  sniperOfTier, sniperCanAllocate, sniperTierOpen,
  type SniperAbilityDef, type SniperColumn,
} from '../../data/sniper';
import { getSniperImage, sniperClassBg, sniperSkillsBg } from '../../assets/index';
import { AbilityTooltip } from './AbilityTooltip';

const COL = SNIPER_META.color;

const frameFor = (rank: number, maxed: boolean, locked: boolean): string => {
  if (rank > 0) return `2px solid ${COL}`;
  if (locked) return '2px solid rgba(255,255,255,0.10)';
  return '2px solid rgba(255,255,255,0.28)';
};

const SniperCell = ({
  def, onHover, onLeave,
}: {
  def: SniperAbilityDef;
  onHover: (def: SniperAbilityDef, x: number, y: number) => void;
  onLeave: () => void;
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
  const img = getSniperImage(def.img);

  const statusLine = tot > 0
    ? maxed
      ? { text: '● Максимум', color: '#4ade80' }
      : { text: 'ЛКМ — +ранг · ПКМ — снять', color: 'rgba(255,255,255,0.45)' }
    : !check.ok
      ? { text: `🔒 ${check.reason}`, color: '#f87171' }
      : { text: 'ЛКМ — вкачать', color: '#4ade80' };

  const apDiscount = def.id === 'snp_d4_nest' || def.id === 'snp_d4_camo'
    ? Math.min(2, (skills['snp_a6_cheap'] || 0) + (pendingSkills['snp_a6_cheap'] || 0))
    : 0;
  const apCost = Math.max(0, def.apCost - apDiscount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 118 }}>
      <div
        onMouseEnter={(e) => onHover(def, e.clientX, e.clientY)}
        onMouseMove={(e) => onHover(def, e.clientX, e.clientY)}
        onMouseLeave={onLeave}
        onClick={() => allocateSniper(def.id)}
        onContextMenu={(e) => { e.preventDefault(); deallocateSniper(def.id); }}
        title={def.name}
        style={{
          width: 96, height: 96, borderRadius: 10, overflow: 'hidden',
          border: frameFor(tot, maxed, locked),
          background: '#0e0e11',
          boxShadow: tot > 0 ? `0 0 14px ${COL}55` : '0 4px 12px rgba(0,0,0,0.5)',
          cursor: maxed ? 'default' : 'pointer',
          opacity: locked ? 0.45 : 1,
          transition: 'all 120ms',
          position: 'relative', flexShrink: 0,
        }}
      >
        {img
          ? <img src={img} alt={def.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 28 }}>🎯</span>}
        {locked && (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'rgba(0,0,0,0.45)' }}>🔒</span>
        )}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: tot > 0 ? COL : 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 1.2, minHeight: 24 }}>
        {def.name}
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: maxed ? '#4ade80' : COL }}>
        {cur}/{def.maxRanks}{pen > 0 ? <span style={{ color: '#fbbf24' }}>+{pen}</span> : ''}
      </div>
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
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
        {label}
        {!gate.open && <span style={{ color: '#f87171' }}>🔒 нужно {gate.need} в тире {tier - 1} ({gate.have})</span>}
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
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
  const headerBg = sniperClassBg();
  const panel = (title: string, titleColor: string) => ({
    flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 10, overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.09)',
    backgroundImage: bg ? `url(${bg})` : undefined,
    backgroundSize: 'cover', backgroundPosition: 'center',
    position: 'relative' as const,
  });

  const apFor = (def: SniperAbilityDef): number => {
    if (def.id === 'snp_d4_nest' || def.id === 'snp_d4_camo') {
      const d = Math.min(2, (skills['snp_a6_cheap'] || 0) + (pendingSkills['snp_a6_cheap'] || 0));
      return Math.max(0, def.apCost - d);
    }
    return def.apCost;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      {headerBg && (
        <div style={{
          width: '100%', maxWidth: 1100, height: 110, borderRadius: 10, overflow: 'hidden',
          backgroundImage: `url(${headerBg})`, backgroundSize: 'cover', backgroundPosition: 'center',
          border: '1px solid rgba(255,255,255,0.09)', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.55))',
            fontSize: 22, fontWeight: 800, letterSpacing: 4, color: COL, textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          }}>
            СНАЙПЕР
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 1100, alignItems: 'stretch' }}>
        <div style={{ ...panel(), flex: 2 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,10,0.72)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', padding: '10px 14px', fontSize: 12, fontWeight: 800, letterSpacing: 2, color: '#f87171', background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
            ⚔️ АТАКУЮЩИЕ
          </div>
          <div style={{ position: 'relative', padding: 14, overflowY: 'auto', maxHeight: 640 }}>
            {SNIPER_TIERS.attack.map((t) => (
              <TierBlock key={t} column="attack" tier={t} label={`ТИР ${t}`} onHover={(def, x, y) => setTip({ def, x, y })} onLeave={() => setTip(null)} />
            ))}
          </div>
        </div>
        <div style={{ ...panel(), flex: 1 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,10,0.72)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', padding: '10px 14px', fontSize: 12, fontWeight: 800, letterSpacing: 2, color: '#60a5fa', background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
            🛡️ ЗАЩИТНЫЕ
          </div>
          <div style={{ position: 'relative', padding: 14, overflowY: 'auto', maxHeight: 640 }}>
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
