import { useState, Fragment } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import {
  PET_META, PET_BRANCHES, PET_TIERS, PET_ABILITIES,
  petOfTier, petCanAllocate, petTierOpen, petRankText,
  type PetAbilityDef, type PetBranch,
} from '../../data/pets';
import { beastSkillsBg, getLesnikImage } from '../../assets/index';

/** Картинка способности (или эмодзи, если картинки нет). */
export const PetDefIcon = ({ def, size }: { def: PetAbilityDef; size: number }) => {
  const src = def.image ? getLesnikImage(def.image) : undefined;
  if (src) return <img src={src} alt={def.name} draggable={false} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 6 }} />;
  return <span style={{ fontSize: size, lineHeight: 1 }}>{def.icon}</span>;
};

export const PetCell = ({
  def, onHover, onLeave, compact, bare,
}: {
  def: PetAbilityDef;
  onHover: (def: PetAbilityDef, x: number, y: number) => void;
  onLeave: () => void;
  compact?: boolean;
  /** только картинка, без надписей */
  bare?: boolean;
}) => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const allocatePet = usePlayerStore((s) => s.allocatePet);
  const deallocatePet = usePlayerStore((s) => s.deallocatePet);

  const cur = skills[def.id] || 0;
  const pen = pendingSkills[def.id] || 0;
  const tot = cur + pen;
  const maxed = tot >= def.maxRanks;
  const check = petCanAllocate(def.id, skills, pendingSkills, skillPoints);
  const locked = tot === 0 && !check.ok;
  const meta = PET_META[def.branch];
  const perRank = def.statsPerRank
    ? petRankText(def, 1).replace(/^\+/, '')
    : def.name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: compact ? 110 : 130 }}>
      <div
        onMouseEnter={(e) => onHover(def, e.clientX, e.clientY)}
        onMouseMove={(e) => onHover(def, e.clientX, e.clientY)}
        onMouseLeave={onLeave}
        onClick={() => allocatePet(def.id)}
        onContextMenu={(e) => { e.preventDefault(); deallocatePet(def.id); }}
        title={def.name}
        style={{
          width: compact ? 48 : 60, height: compact ? 48 : 60, borderRadius: 8, overflow: 'hidden',
          border: tot > 0 ? `2px solid ${meta.color}` : locked ? '2px solid rgba(255,255,255,0.10)' : '2px solid rgba(255,255,255,0.28)',
          background: '#0e0e11',
          boxShadow: tot > 0 ? `0 0 8px ${meta.color}55` : '0 2px 6px rgba(0,0,0,0.5)',
          cursor: maxed ? 'default' : 'pointer',
          opacity: locked ? 0.45 : 1,
          transition: 'all 120ms',
          position: 'relative', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <PetDefIcon def={def} size={compact ? 40 : 52} />
        {locked && (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, background: 'rgba(0,0,0,0.45)' }}>🔒</span>
        )}
      </div>
      {!bare && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: tot > 0 ? meta.color : 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 1.2 }}>
            {def.name}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: maxed ? '#4ade80' : 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 1.25 }}>
            {cur}/{def.maxRanks}{pen > 0 ? <span style={{ color: '#fbbf24' }}>+{pen}</span> : ''}
          </div>
        </>
      )}
    </div>
  );
};

const PetTierBlock = ({
  branch, tier, label, onHover, onLeave,
}: {
  branch: PetBranch; tier: number; label: string;
  onHover: (def: PetAbilityDef, x: number, y: number) => void;
  onLeave: () => void;
}) => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const list = petOfTier(branch, tier);
  if (list.length === 0) return null;
  const gate = petTierOpen(branch, tier, skills, pendingSkills);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
        {label}
        {!gate.open && <span style={{ color: '#f87171' }}>🔒 нужно {gate.need} {gate.label} ({gate.have})</span>}
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {list.map((def) => <PetCell key={def.id} def={def} onHover={onHover} onLeave={onLeave} />)}
      </div>
    </div>
  );
};

export const PetTooltip = ({
  def, rank, x, y, statusLine,
}: {
  def: PetAbilityDef;
  rank: number;
  x: number; y: number;
  statusLine?: { text: string; color: string };
}) => {
  const TOOLTIP_W = 340;
  const flipLeft = x + 16 + TOOLTIP_W > window.innerWidth;
  const tooltipX = flipLeft ? Math.max(8, x - TOOLTIP_W - 16) : x + 16;
  const tooltipY = Math.max(8, Math.min(y - 10, window.innerHeight - 320));
  const meta = PET_META[def.branch];
  const shown = Math.max(0, rank);
  return (
    <div style={{
      position: 'fixed', left: tooltipX, top: tooltipY, zIndex: 9999,
      width: 'fit-content', minWidth: 280, maxWidth: 340,
      background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
      border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
      boxShadow: '0 16px 48px rgba(0,0,0,0.75)', pointerEvents: 'none',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ height: 3, background: meta.color, opacity: 0.95, borderRadius: '10px 10px 0 0' }} />
        <div style={{ padding: '8px 14px 12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><PetDefIcon def={def} size={64} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: meta.color, lineHeight: 1.2 }}>
          {def.name}
        </div>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
          {Array.from({ length: def.maxRanks }).map((_, i) => (
            <span key={i} style={{
              width: 18, height: 6, borderRadius: 3,
              background: i < rank ? meta.color : 'rgba(255,255,255,0.12)',
              boxShadow: i < rank ? `0 0 6px ${meta.color}` : 'none',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>Тир {def.tier}</span>
          <span>• {meta.name}</span>
          {def.petApCost > 0 ? <span>• {def.petApCost}AP питомца</span> : null}
          {def.cooldown > 0 ? <span>• КД {def.cooldown}</span> : null}
        </div>
      </div>
      <div style={{ padding: '0 14px 12px', maxWidth: 340 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>◇</span>
          <span style={{ flex: 1, color: 'rgba(255,255,255,0.82)' }}>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>{petRankText(def, shown)}</span>
          </span>
        </div>
        {rank < def.maxRanks && def.statsPerRank && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>◇</span>
            <span style={{ flex: 1, color: 'rgba(255,255,255,0.82)' }}>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>След.: </span>
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>{petRankText(def, rank + 1)}</span>
            </span>
          </div>
        )}
        {def.mechanic && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.38)', fontStyle: 'italic', lineHeight: 1.4 }}>
            {def.mechanic}
          </div>
        )}
        {def.aura && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#a78bfa' }}>
            🌙 Аура: союзникам, пока зверь активен
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

export const BeastTree = () => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const [tip, setTip] = useState<{ def: PetAbilityDef; x: number; y: number } | null>(null);

  const onHover = (def: PetAbilityDef, x: number, y: number) => setTip({ def, x, y });
  const onLeave = () => setTip(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
      {/* 3 ветки рядом, как у снайпера */}
      <div style={{
        borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.09)',
        backgroundImage: beastSkillsBg() ? `url(${beastSkillsBg()})` : undefined,
        backgroundSize: 'cover', backgroundPosition: 'center',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,10,0.72)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
          {PET_BRANCHES.map((b, idx) => (
            <Fragment key={b}>
              <div style={{ flex: 1, minWidth: 0, padding: 8 }}>
                <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 800, letterSpacing: 2, color: PET_META[b].color, background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', borderRadius: '6px 6px 0 0', marginBottom: 6 }}>
                  {PET_META[b].icon} {PET_META[b].name.toUpperCase()}
                </div>
                {[1, 2, 3, 4, 5, 6, 7].map((t) => (
                  <PetTierBlock key={t} branch={b} tier={t} label={`ТИР ${t}`} onHover={onHover} onLeave={onLeave} />
                ))}
              </div>
              {idx < PET_BRANCHES.length - 1 && <div style={{ width: 1, background: 'rgba(255,255,255,0.14)', flexShrink: 0, margin: '8px 0' }} />}
            </Fragment>
          ))}
        </div>
      </div>
      {tip && (
        <PetTooltip
          def={tip.def}
          rank={(skills[tip.def.id] || 0) + (pendingSkills[tip.def.id] || 0)}
          x={tip.x} y={tip.y}
          statusLine={(() => {
            const cur = (skills[tip.def.id] || 0) + (pendingSkills[tip.def.id] || 0);
            if (cur >= tip.def.maxRanks) return { text: '● Максимум', color: '#4ade80' };
            const chk = petCanAllocate(tip.def.id, skills, pendingSkills, skillPoints);
            if (!chk.ok) return { text: `🔒 ${chk.reason}`, color: '#f87171' };
            return { text: tip.def.freeTake ? 'ЛКМ — взять (бесплатно)' : 'ЛКМ — вкачать · ПКМ — снять', color: '#4ade80' };
          })()}
        />
      )}
    </div>
  );
};
