import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { usePlayerStore } from '../stores/playerStore';
import { SKILL_CLASSES, type SkillDef } from '../data/skills';

const formatCumulative = (stats: string[], level: number): string => {
  return stats.map((s) => {
    const m = s.match(/^([+-]\d+(?:\.\d+)?)(.*)$/);
    if (!m) return s;
    const num = parseFloat(m[1]) * level;
    return `${num > 0 ? '+' : ''}${num}${m[2]}`;
  }).join(' • ');
};

const getTotalSpent = (skills: Record<string, number>, classSkills: SkillDef[]): number => {
  return classSkills.reduce((sum, s) => sum + (skills[s.id] || 0), 0);
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
  const loadSkills = usePlayerStore((s) => s.loadSkills);
  const level = usePlayerStore((s) => s.level);
  const navigate = useNavigate();

  useEffect(() => { loadSkills(); }, []);

  const pendingTotal = Object.values(pendingSkills).reduce((a, b) => a + b, 0);

  const hasPending = pendingTotal > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>⭐ Древо навыков</div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/skills/zero')} style={{ border: '1px solid #00d4ff', color: '#00d4ff' }}>◈ ZeroTree</Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
              Ур. {level} — 🎯 {skillPoints} очков{hasPending ? ` (${pendingTotal} в ожидании)` : ''}
            </span>
            {hasPending && (
              <>
                <Button size="sm" variant="primary" onClick={applySkills}>
                  ✅ ПРИНЯТЬ
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelSkills}>
                  ❌ ОТМЕНА
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={resetSkills} title={`Сброс навыков за ${level * 100} 💾`}>
              🔄 Сброс · {level * 100}💾
            </Button>
          </div>
        </div>

        <div>
          {/* Все классы одной сеткой: 4 в ряд на широком, меньше — на узком */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {SKILL_CLASSES.map((cls) => {
            const combined = { ...skills };
            for (const sk of cls.skills) {
              const p = pendingSkills[sk.id] || 0;
              if (p > 0) combined[sk.id] = (combined[sk.id] || 0) + p;
            }
            const spent = getTotalSpent(combined, cls.skills);
            return (
              <div
                key={cls.id}
                style={{
                  minWidth: 0,
                  background: 'var(--bg-glass)',
                  border: `1px solid ${cls.color}33`,
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                }}
              >
                {/* Class header */}
                <div style={{
                  textAlign: 'center', padding: '8px 0 16px',
                  borderBottom: `1px solid ${cls.color}22`,
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{cls.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: cls.color }}>{cls.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {spent} / {cls.skills.reduce((s, sk) => s + sk.maxPoints, 0)} очков
                  </div>
                </div>

                {/* Skills — RPG tiers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0,2,5,10,20].map(tier => {
                    const tierSkills = cls.skills.filter(s => s.reqPoints === tier);
                    if (tierSkills.length === 0) return null;
                    const isCapstoneTier = tier === 20;
                    return (
                      <div key={tier}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ height: 1, flex: 1, background: `${cls.color}22` }} />
                          <span style={{ fontSize: 9, letterSpacing: 1, color: cls.color, fontWeight: 700 }}>{tier === 0 ? 'БАЗА' : tier === 20 ? '★ КЛЮЧ' : `ТИР ${tier}`}</span>
                          <span style={{ height: 1, flex: 1, background: `${cls.color}22` }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {tierSkills.map(sk => {
                            const current = skills[sk.id] || 0;
                            const pending = pendingSkills[sk.id] || 0;
                            const total = current + pending;
                            const isMaxed = total >= sk.maxPoints;
                            const locked = spent < sk.reqPoints && total === 0;
                            const isCapstone = sk.id.includes('capstone');
                            return (
                              <div
                                key={sk.id}
                                onClick={() => { if (!locked && !isMaxed && skillPoints > 0) allocateSkill(sk.id); }}
                                onContextMenu={e => { e.preventDefault(); if (pending > 0) deallocateSkill(sk.id); }}
                                style={{
                                  padding: isCapstone ? '10px 12px' : '8px 10px',
                                  background: isCapstone
                                    ? (current > 0 ? 'linear-gradient(135deg, #fbbf2422, #92400e22)' : pending > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.04)')
                                    : current > 0 ? `${cls.color}15` : pending > 0 ? `${cls.color}10` : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${isCapstone ? (current>0 ? '#fbbf24' : '#fbbf2466') : pending > 0 ? cls.color + '88' : current > 0 ? cls.color + '44' : locked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'}`,
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: locked || isMaxed || skillPoints <= 0 ? 'default' : 'pointer',
                                  opacity: locked ? 0.4 : 1,
                                  boxShadow: isCapstone && current>0 ? '0 0 12px rgba(251,191,36,0.25)' : 'none',
                                  transition: 'all 100ms',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: isCapstone ? 18 : 16, flexShrink: 0 }}>{sk.icon}</span>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: isCapstone ? 12 : 12, fontWeight: isCapstone ? 700 : 500, color: isCapstone && current>0 ? '#fbbf24' : undefined }}>{sk.name} {isCapstone && '★'}</div>
                                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sk.desc}</div>
                                      <div style={{ fontSize: 10, color: current > 0 ? (isCapstone ? '#fbbf24' : cls.color) : 'var(--text-muted)' }}>{formatCumulative(sk.statsPerPoint, current || 1)}</div>
                                      {isCapstone && <div style={{ fontSize: 9, color: '#fbbf24', marginTop: 2 }}>✨ Бесплатная способность на арене</div>}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: isMaxed ? 'var(--accent-success)' : isCapstone ? '#fbbf24' : cls.color, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span>{current}/{sk.maxPoints}</span>
                                    {pending > 0 && <span style={{ color: 'var(--accent-warning)' }}>+{pending}</span>}
                                  </div>
                                </div>
                                {sk.reqPoints > 0 && total === 0 && (
                                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>🔒 нужно {sk.reqPoints} очков в ветке</div>
                                )}
                              </div>
                            );
                          })}
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
      </WapPanel>
    </motion.div>
  );
};
