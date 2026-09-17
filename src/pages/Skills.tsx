import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { SNIPER_META, SNIPER_ABILITIES, sniperMaxRanks, sniperOfTier, sniperCanAllocate, type SniperAbilityDef } from '../data/sniper';
import { PET_META, PET_ABILITIES, PET_FREE_DEFS, petMaxRanks, petCanAllocate, type PetAbilityDef } from '../data/pets';
import { SniperTree, SniperCell } from '../components/widgets/SniperTree';
import { BeastTree, PetCell, PetTooltip } from '../components/widgets/BeastTree';
import { AbilityTooltip } from '../components/widgets/AbilityTooltip';
import { sniperClassBg, beastClassBg } from '../assets/index';

/** Бейджи класса на тайле: ✅+✕ у выбранного, 🔒 у невыбранного. */
const ClassBadges = ({ chosen, onAbandon }: { chosen: boolean; onAbandon: () => void }) => (
  <>
    {chosen ? (
      <>
        <span style={{ position: 'absolute', top: 4, left: 6, fontSize: 13, textShadow: '0 1px 3px #000', zIndex: 1 }}>✅</span>
        <span
          onClick={(e) => { e.stopPropagation(); onAbandon(); }}
          title="Убрать класс (вкачанное останется, 3 очка не вернутся)"
          style={{ position: 'absolute', top: 2, right: 5, fontSize: 13, cursor: 'pointer', opacity: 0.75, zIndex: 1, textShadow: '0 1px 3px #000' }}
        >
          ✕
        </span>
      </>
    ) : (
      <span style={{ position: 'absolute', top: 4, left: 6, fontSize: 13, opacity: 0.85, zIndex: 1 }} title="Выбор класса стоит 3 очка">🔒</span>
    )}
  </>
);

export const Skills = () => {
  const skills = usePlayerStore((s) => s.skills);
  const pendingSkills = usePlayerStore((s) => s.pendingSkills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const applySkills = usePlayerStore((s) => s.applySkills);
  const cancelSkills = usePlayerStore((s) => s.cancelSkills);
  const resetSkills = usePlayerStore((s) => s.resetSkills);
  const level = usePlayerStore((s) => s.level);
  const migrateSniper = usePlayerStore((s) => s.migrateSniper);

  const [selectedClass, setSel] = useState(SNIPER_META.id);
  const chosenClasses = usePlayerStore((s) => s.chosenClasses);
  const pickClass = usePlayerStore((s) => s.pickClass);
  const abandonClass = usePlayerStore((s) => s.abandonClass);
  // Ручной выбор запоминаем; пока его нет — показываем доминантную (прокачанную) ветку.
  const userPicked = useRef(false);
  const setSelectedClass = (id: string) => { userPicked.current = true; setSel(id); };
  useEffect(() => {
    if (userPicked.current) return;
    let bestId = SNIPER_META.id;
    let best = 0;
    const snpSpent = SNIPER_ABILITIES.reduce((s, a) => s + (skills[a.id] || 0) + (pendingSkills[a.id] || 0), 0);
    if (snpSpent > best) { best = snpSpent; bestId = SNIPER_META.id; }
    const petSpent = PET_ABILITIES.reduce((s, a) => s + (skills[a.id] || 0) + (pendingSkills[a.id] || 0), 0);
    if (petSpent > best) { bestId = 'lesnichiy'; }
    setSel(bestId);
  }, [skills, pendingSkills]);
  const [baseTip, setBaseTip] = useState<{ def: SniperAbilityDef; x: number; y: number } | null>(null);
  const [petTip, setPetTip] = useState<{ def: PetAbilityDef; x: number; y: number } | null>(null);
  const basePair = sniperOfTier('attack', 0);
  // Клик по тайлу: добрать класс (с вопросом, макс. 2, 3 очка) + показать ветку.
  const [confirmDlg, setConfirmDlg] = useState<null | { kind: 'pick' | 'abandon'; id: string; name: string; color: string }>(null);
  const classMetaOf = (id: string): { name: string; color: string } => {
    if (id === SNIPER_META.id) return { name: SNIPER_META.name, color: SNIPER_META.color };
    if (id === 'lesnichiy') return { name: 'Лесничий', color: '#a16207' };
    return { name: id, color: '#888' };
  };
  const clickTile = (id: string, name: string) => {
    if (!chosenClasses.includes(id)) {
      const meta = classMetaOf(id);
      setConfirmDlg({ kind: 'pick', id, name, color: meta.color });
    }
    setSelectedClass(id);
  };
  const askAbandon = (id: string) => {
    const meta = classMetaOf(id);
    setConfirmDlg({ kind: 'abandon', id, name: meta.name, color: meta.color });
  };
  const confirmOk = () => {
    if (!confirmDlg) return;
    if (confirmDlg.kind === 'pick') pickClass(confirmDlg.id, confirmDlg.name);
    else abandonClass(confirmDlg.id);
    setConfirmDlg(null);
  };
  const isSniper = selectedClass === SNIPER_META.id;

  useEffect(() => { migrateSniper(); }, [migrateSniper]);

  const pendingTotal = Object.values(pendingSkills).reduce((a, b) => a + b, 0);
  const hasPending = pendingTotal > 0;

  const pointsInTree = selectedClass === 'lesnichiy'
    ? PET_ABILITIES.reduce((sum, a) => sum + (skills[a.id] || 0) + (pendingSkills[a.id] || 0), 0)
    : SNIPER_ABILITIES.reduce((sum, a) => sum + (skills[a.id] || 0) + (pendingSkills[a.id] || 0), 0);
  const pointsMax = selectedClass === 'lesnichiy' ? petMaxRanks() : sniperMaxRanks();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start' }}>
        {/* Меню классов слева — квадратные тайлы */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
          {(() => {
            const snpSpent = SNIPER_ABILITIES.reduce((s, a) => s + (skills[a.id] || 0) + (pendingSkills[a.id] || 0), 0);
            const isActive = selectedClass === SNIPER_META.id;
  const snpImg = sniperClassBg();
  const beastImg = beastClassBg();
            return (
              <button
                key={SNIPER_META.id}
                onClick={() => clickTile(SNIPER_META.id, SNIPER_META.name)}
                style={{
                  width: 152, height: 152, padding: 0, position: 'relative', overflow: 'hidden',
                  backgroundColor: '#0b0d10',
                  border: `2px solid ${isActive ? SNIPER_META.color : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 10, cursor: 'pointer',
                  boxShadow: isActive ? `0 0 14px ${SNIPER_META.color}55` : 'none',
                  transition: 'all 120ms', flexShrink: 0,
                }}
              >
                <ClassBadges chosen={chosenClasses.includes(SNIPER_META.id)} onAbandon={() => askAbandon(SNIPER_META.id)} />
                {snpImg && (
                  <img src={snpImg} alt={SNIPER_META.name} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                )}
                <span style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  padding: '6px 4px', fontSize: 13, fontWeight: 700, color: '#fff',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)', fontFamily: 'var(--font-mono)',
                }}>
                  {SNIPER_META.name} {snpSpent}/{sniperMaxRanks()}
                  {!chosenClasses.includes(SNIPER_META.id) && (
                    <span style={{ display: 'block', fontSize: 9, color: '#fbbf24' }}>🔒 выбор — 3 очк.</span>
                  )}
                </span>
              </button>
            );
          })()}
          {/* База класса вне тиров — только картинки, вплотную справа от снайпера */}
          {basePair.length > 0 && (
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
              {basePair.map((def) => (
                <SniperCell
                  key={def.id}
                  def={def}
                  compact
                  bare
                  onHover={(d, x, y) => setBaseTip({ def: d, x, y })}
                  onLeave={() => setBaseTip(null)}
                />
              ))}
            </div>
          )}
          </div>
          {(() => {
            const petSpent = PET_ABILITIES.reduce((s, a) => s + (skills[a.id] || 0) + (pendingSkills[a.id] || 0), 0);
            const isActive = selectedClass === 'lesnichiy';
            const chosen = chosenClasses.includes('lesnichiy');
            const beastImg = beastClassBg();
            return (
              <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
              <button
                key="lesnichiy"
                onClick={() => clickTile('lesnichiy', 'Лесничий')}
                style={{
                  width: 152, height: 152, padding: 0, position: 'relative', overflow: 'hidden',
                  backgroundColor: '#0b0d10',
                  border: `2px solid ${isActive ? '#a16207' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 10, cursor: 'pointer',
                  boxShadow: isActive ? '0 0 14px rgba(161,98,7,0.33)' : 'none',
                  transition: 'all 120ms', flexShrink: 0,
                }}
              >
                <ClassBadges chosen={chosen} onAbandon={() => askAbandon('lesnichiy')} />
                {beastImg && (
                  <img src={beastImg} alt="Лесничий" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                )}
                <span style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  padding: '6px 4px', fontSize: 13, fontWeight: 700, color: '#fff',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)', fontFamily: 'var(--font-mono)',
                }}>
                  Лесничий {petSpent}/{petMaxRanks()}
                  {!chosen && (
                    <span style={{ display: 'block', fontSize: 9, color: '#fbbf24' }}>🔒 выбор — 3 очк.</span>
                  )}
                </span>
              </button>
              {/* Бесплатные базы лесничего — справа от картинки класса */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                {PET_FREE_DEFS.map((def) => (
                  <PetCell
                    key={def.id}
                    def={def}
                    compact
                    bare
                    onHover={(d, x, y) => setPetTip({ def: d, x, y })}
                    onLeave={() => setPetTip(null)}
                  />
                ))}
              </div>
            </div>
            );
          })()}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tree — Active | Passive like stolen-realm (снайпер — новая модель) */}
      {selectedClass === 'lesnichiy' ? <BeastTree /> : <SniperTree />}
      </div>
      {/* Инфо справа — вертикально */}
      <div style={{ width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 12 }}>
        <div style={{ padding: '8px 10px 10px', background: 'linear-gradient(180deg, #262b33, #16181d)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>УРОВЕНЬ</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{level}</div>
        </div>
        <div style={{ padding: '8px 10px 10px', background: 'linear-gradient(180deg, #232b22, #141a13)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 10, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(74,222,128,0.6)', marginBottom: 2 }}>ОЧКИ</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{skillPoints}{hasPending ? <span style={{ fontSize: 12, color: '#fbbf24' }}> ({pendingTotal}⏳)</span> : ''}</div>
        </div>
        <div style={{ padding: '8px 10px 10px', background: 'linear-gradient(180deg, #262b33, #16181d)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>В ВЕТКЕ</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{pointsInTree}/{pointsMax}</div>
        </div>
        <div style={{ padding: '8px 10px 10px', background: 'linear-gradient(180deg, #2b2320, #171310)', border: '1px solid rgba(251,191,36,0.30)', borderRadius: 10, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(251,191,36,0.6)', marginBottom: 2 }}>КЛАССЫ</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{chosenClasses.length}/2</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.4 }}>
            Выбор класса — 3 очк.<br />Клик по ✕ — убрать
          </div>
        </div>
        {hasPending && (
          <>
            <Button size="sm" variant="primary" onClick={applySkills}>✅ ПРИНЯТЬ</Button>
            <Button size="sm" variant="ghost" onClick={cancelSkills}>❌ ОТМЕНА</Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={resetSkills} title={`Сброс за ${level * 100} 💾`}>🔄 Сброс · {level * 100}💾</Button>
      </div>
      </div>
      {/* Сохранённые билды */}
      <BuildsSection />
      {/* Подтверждение класса — игровая модалка вместо confirm() */}
      {confirmDlg && (
        <div
          onClick={() => setConfirmDlg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 380, maxWidth: '92vw',
              background: 'linear-gradient(180deg, #23272e, #14161a)',
              border: '1px solid rgba(217,119,6,0.5)', borderRadius: 12,
              boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 24px rgba(217,119,6,0.12)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '10px 16px', background: 'rgba(217,119,6,0.15)',
              borderBottom: '1px solid rgba(217,119,6,0.35)',
              fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#fbbf24', textAlign: 'center',
            }}>
              {confirmDlg.kind === 'pick' ? '🎓 НОВЫЙ КЛАСС' : '🚪 УБРАТЬ КЛАСС'}
            </div>
            <div style={{ padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: confirmDlg.color, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                «{confirmDlg.name}»
              </div>
              {confirmDlg.kind === 'pick' ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                  Стоимость — <b style={{ color: '#4ade80' }}>3 очка</b> (есть <b style={{ fontFamily: 'var(--font-mono)' }}>{skillPoints}</b>)<br />
                  Одновременно — максимум <b>2 класса</b> (занято <b style={{ fontFamily: 'var(--font-mono)' }}>{chosenClasses.length}</b>)<br />
                  Качать можно только выбранные классы
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                  Вкачанное останется, но качать дальше будет нельзя.<br />
                  3 очка <b>не возвращаются</b>.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {(() => {
                  const canPick = confirmDlg.kind === 'abandon' || (chosenClasses.length < 2 && skillPoints >= 3);
                  return (
                    <>
                      <Button
                        size="sm" variant="primary" onClick={confirmOk} style={{ flex: 1 }}
                        {...(!canPick ? { disabled: true } : {})}
                      >
                        {confirmDlg.kind === 'pick' ? '✅ ПРИНЯТЬ' : 'УБРАТЬ'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDlg(null)} style={{ flex: 1 }}>ОТМЕНА</Button>
                    </>
                  );
                })()}
              </div>
              {confirmDlg.kind === 'pick' && !(chosenClasses.length < 2 && skillPoints >= 3) && (
                <div style={{ fontSize: 11, color: '#f87171' }}>
                  {chosenClasses.length >= 2 ? 'Сначала убери один класс (✕ на тайле)' : 'Не хватает очков'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {baseTip && (
        <AbilityTooltip
          def={baseTip.def}
          rank={(skills[baseTip.def.id] || 0) + (pendingSkills[baseTip.def.id] || 0)}
          x={baseTip.x} y={baseTip.y}
          apCost={baseTip.def.apCost}
          statusLine={(() => {
            const cur = (skills[baseTip.def.id] || 0) + (pendingSkills[baseTip.def.id] || 0);
            if (cur >= baseTip.def.maxRanks) return { text: '● Выбрано (вторая серая)', color: '#4ade80' };
            const chk = sniperCanAllocate(baseTip.def.id, skills, pendingSkills, skillPoints);
            if (!chk.ok) return { text: `🔒 ${chk.reason}`, color: '#f87171' };
            return { text: 'ЛКМ — выбрать (бесплатно) · ПКМ — снять', color: '#4ade80' };
          })()}
        />
      )}
      {petTip && (
        <PetTooltip
          def={petTip.def}
          rank={(skills[petTip.def.id] || 0) + (pendingSkills[petTip.def.id] || 0)}
          x={petTip.x} y={petTip.y}
          statusLine={(() => {
            const cur = (skills[petTip.def.id] || 0) + (pendingSkills[petTip.def.id] || 0);
            if (cur >= petTip.def.maxRanks) return { text: '● Взято', color: '#4ade80' };
            const chk = petCanAllocate(petTip.def.id, skills, pendingSkills, skillPoints);
            if (!chk.ok) return { text: `🔒 ${chk.reason}`, color: '#f87171' };
            return { text: 'ЛКМ — взять (бесплатно)', color: '#4ade80' };
          })()}
        />
      )}
    </motion.div>
  );
};

const BuildsSection = () => {
  const skillBuilds = useUiStore((s) => s.skillBuilds);
  const saveSkillBuild = usePlayerStore((s) => s.saveSkillBuild);
  const deleteSkillBuild = usePlayerStore((s) => s.deleteSkillBuild);
  const loadSkillBuild = usePlayerStore((s) => s.loadSkillBuild);
  const snpImg = sniperClassBg();

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)' }}>
          💾 БИЛДЫ ({skillBuilds.length}/5)
        </span>
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="primary" onClick={() => saveSkillBuild()}>💾 Сохранить текущий</Button>
      </div>
      {skillBuilds.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Расставь очки и сохрани раскладку — потом вернёшь её в один клик (сначала спросим про сброс).
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {skillBuilds.map((b) => {
            const isSnp = b.classId === SNIPER_META.id;
            const petKind = b.classId.startsWith('pet_') ? b.classId.slice(4) : null;
            const petMeta = petKind ? (PET_META as any)[petKind] : null;
            const color = isSnp ? SNIPER_META.color : (petMeta?.color || '#888');
            const icon = isSnp ? null : (petMeta?.icon || '❓');
            return (
              <div key={b.id} style={{ width: 150, background: 'rgba(0,0,0,0.35)', border: `1px solid ${color}55`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ height: 84, position: 'relative', background: '#0b0d10', overflow: 'hidden' }}>
                  {isSnp && snpImg ? (
                    <img src={snpImg} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : petMeta && beastImg ? (
                    <img src={beastImg} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18` }}>
                      <span style={{ fontSize: 44 }}>{icon}</span>
                    </div>
                  )}
                  <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 6px 4px', fontSize: 11, fontWeight: 800, color: '#fff', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.name}
                  </span>
                </div>
                <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {b.total} очк. · {new Date(b.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" variant="primary" onClick={() => loadSkillBuild(b.id)} style={{ flex: 1 }}>📥 Взять</Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Удалить билд «${b.name}»?`)) deleteSkillBuild(b.id); }}>✕</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
