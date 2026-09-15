import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { usePlayerStore } from '../stores/playerStore';
import { SKILL_CLASSES } from '../data/skills';

const formatCumulative = (stats: string[], level: number): string => {
  return stats.map((s) => {
    const m = s.match(/^([+-]\d+(?:\.\d+)?)(.*)$/);
    if (!m) return s;
    const num = parseFloat(m[1]) * level;
    return `${num > 0 ? '+' : ''}${num}${m[2]}`;
  }).join(' • ');
};

const getTier = (index: number, total: number): number => {
  // 140 per class -> 5 tiers as in stolen-realm
  if (total <= 14) {
    // original 14: map reqPoints to tier
    if (index < 3) return 1;
    if (index < 6) return 2;
    if (index < 9) return 3;
    if (index < 12) return 4;
    return 5;
  }
  // 140: 28 per tier
  return Math.floor(index / 28) + 1;
};

export const Skills = () => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const allocateSkill = usePlayerStore((s) => s.allocateSkill);
  const deallocateSkill = usePlayerStore((s) => s.deallocateSkill);
  const applySkills = usePlayerStore((s) => s.applySkills);
  const cancelSkills = usePlayerStore((s) => s.cancelSkills);
  const resetSkills = usePlayerStore((s) => s.resetSkills);
  const level = usePlayerStore((s) => s.level);

  const [selectedClass, setSelectedClass] = useState(SKILL_CLASSES[0].id);
  const cls = useMemo(() => SKILL_CLASSES.find(c => c.id === selectedClass) || SKILL_CLASSES[0], [selectedClass]);

  const pendingTotal = Object.values(pendingSkills).reduce((a, b) => a + b, 0);
  const hasPending = pendingTotal > 0;

  // Split into Active/Passive like stolen-realm: capstone + travel with icon • as passive, others as active/passive mix
  const activeSkills = useMemo(() => cls.skills.filter(s => s.id.includes('capstone') || s.icon === '💥' || s.icon === '🎯' || s.icon === '🗡️'), [cls]);
  const passiveSkills = useMemo(() => cls.skills.filter(s => !activeSkills.includes(s)), [cls, activeSkills]);

  const getPointsSpentInTree = (list: typeof cls.skills) => list.reduce((sum, s) => sum + (skills[s.id] || 0) + (pendingSkills[s.id] || 0), 0);
  const pointsInTree = getPointsSpentInTree(cls.skills);

  const isLearned = (id: string) => (skills[id] || 0) > 0 || (pendingSkills[id] || 0) > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>⭐ Древо навыков</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ур. {level} — <b style={{ color: '#4ade80' }}>{skillPoints} очков</b> {hasPending ? `(${pendingTotal} в ожидании)` : ''} · В ветке {pointsInTree}/{cls.skills.length}</span>
            {hasPending && (<><Button size="sm" variant="primary" onClick={applySkills}>✅ ПРИНЯТЬ</Button><Button size="sm" variant="ghost" onClick={cancelSkills}>❌ ОТМЕНА</Button></>)}
            <Button size="sm" variant="ghost" onClick={resetSkills} title={`Сброс за ${level * 100} 💾`}>🔄 Сброс · {level * 100}💾</Button>
          </div>
        </div>

        {/* Top class bar — like stolen-realm */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'thin' }}>
          {SKILL_CLASSES.map(c => {
            const spent = c.skills.reduce((s, sk) => s + (skills[sk.id] || 0) + (pendingSkills[sk.id] || 0), 0);
            const isActive = c.id === selectedClass;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedClass(c.id)}
                style={{
                  flex: '0 0 auto',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 12px', minWidth: 84,
                  background: isActive ? `${c.color}18` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? c.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  boxShadow: isActive ? `0 0 12px ${c.color}44` : 'none',
                  transition: 'all 120ms',
                }}
              >
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? c.color : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{spent}/{c.skills.length}</span>
              </button>
            );
          })}
        </div>
      </WapPanel>

      {/* Tree — Active | Passive like stolen-realm */}
      <div style={{ display: 'flex', gap: 12, minHeight: 520 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(25,25,25,0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#f59e0b', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right' }}>Активные</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 560 }}>
            {[1,2,3,4,5].map(tier => {
              const tierSkills = cls.skills.filter((_, idx) => getTier(idx, cls.skills.length) === tier).filter(s => activeSkills.includes(s));
              if (tierSkills.length === 0) return null;
              return (
                <div key={tier}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} /> ТИР {tier} <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
                    {tierSkills.map(sk => {
                      const cur = skills[sk.id] || 0, pen = pendingSkills[sk.id] || 0, tot = cur + pen, isMaxed = tot >= sk.maxPoints, locked = false;
                      const isTravel = sk.icon === '•';
                      return (
                        <div key={sk.id} onClick={() => { if (!isMaxed && skillPoints > 0) allocateSkill(sk.id); }} onContextMenu={e => { e.preventDefault(); if (pen > 0) deallocateSkill(sk.id); }} style={{
                          padding: '8px 8px', background: cur>0 ? `${cls.color}18` : pen>0 ? `${cls.color}10` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${pen>0 ? cls.color+'88' : cur>0 ? cls.color+'44' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: 6, cursor: isMaxed ? 'default' : 'pointer', opacity: isMaxed && cur===0 ? 0.5 : 1,
                          minHeight: 64,
                        }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 14, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isTravel ? 'rgba(255,255,255,0.06)' : `${cls.color}22`, borderRadius: 4, flexShrink: 0 }}>{sk.icon}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sk.name}</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.2 }}>{sk.desc}</div>
                              <div style={{ fontSize: 9, color: cur>0 ? cls.color : 'var(--text-muted)', marginTop: 2 }}>{formatCumulative(sk.statsPerPoint, 1)}</div>
                            </div>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isMaxed ? '#22c55e' : cls.color }}>{cur}/{sk.maxPoints}{pen>0 ? `+${pen}` : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, flexShrink: 0 }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(25,25,25,0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#a78bfa', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Пассивные</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 560 }}>
            {[1,2,3,4,5].map(tier => {
              const tierSkills = cls.skills.filter((_, idx) => getTier(idx, cls.skills.length) === tier).filter(s => passiveSkills.includes(s));
              if (tierSkills.length === 0) return null;
              return (
                <div key={tier}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} /> ТИР {tier} <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
                    {tierSkills.map(sk => {
                      const cur = skills[sk.id] || 0, pen = pendingSkills[sk.id] || 0, tot = cur + pen, isMaxed = tot >= sk.maxPoints;
                      const isTravel = sk.icon === '•';
                      const isCapstone = sk.id.includes('capstone');
                      return (
                        <div key={sk.id} onClick={() => { if (!isMaxed && skillPoints > 0) allocateSkill(sk.id); }} onContextMenu={e => { e.preventDefault(); if (pen > 0) deallocateSkill(sk.id); }} style={{
                          padding: isCapstone ? '10px 8px' : '8px 8px',
                          background: isCapstone ? (cur>0 ? 'linear-gradient(135deg, #fbbf2422, #92400e22)' : 'rgba(251,191,36,0.04)') : cur>0 ? `${cls.color}18` : pen>0 ? `${cls.color}10` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isCapstone ? (cur>0 ? '#fbbf24' : '#fbbf2466') : pen>0 ? cls.color+'88' : cur>0 ? cls.color+'44' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: 6, cursor: isMaxed ? 'default' : 'pointer',
                          boxShadow: isCapstone && cur>0 ? '0 0 10px rgba(251,191,36,0.2)' : 'none',
                          minHeight: 64,
                        }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: isCapstone ? 16 : 14, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isTravel ? 'rgba(255,255,255,0.06)' : `${cls.color}22`, borderRadius: 4, flexShrink: 0 }}>{sk.icon}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: isCapstone ? 700 : 600, lineHeight: 1.1, color: isCapstone && cur>0 ? '#fbbf24' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sk.name} {isCapstone ? '★' : ''}</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.2 }}>{sk.desc}</div>
                              <div style={{ fontSize: 9, color: cur>0 ? (isCapstone ? '#fbbf24' : cls.color) : 'var(--text-muted)', marginTop: 2 }}>{formatCumulative(sk.statsPerPoint, 1)}</div>
                              {isCapstone && <div style={{ fontSize: 8, color: '#fbbf24', marginTop: 2 }}>✨ Бесплатно на арене</div>}
                            </div>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isMaxed ? '#22c55e' : isCapstone ? '#fbbf24' : cls.color }}>{cur}/{sk.maxPoints}{pen>0 ? `+${pen}` : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {SKILL_CLASSES.map(c => {
          const spent = c.skills.reduce((s, sk) => s + (skills[sk.id] || 0) + (pendingSkills[sk.id] || 0), 0);
          return <div key={c.id} style={{ padding: '4px 8px', background: c.id===selectedClass ? `${c.color}18` : 'rgba(255,255,255,0.02)', border: `1px solid ${c.id===selectedClass ? c.color+'66' : 'rgba(255,255,255,0.06)'}`, borderRadius: 6, fontSize: 10, display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />{c.name} <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{spent}/{c.skills.length}</span></div>;
        })}
      </div>
    </motion.div>
  );
};
