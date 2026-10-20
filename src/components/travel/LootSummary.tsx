import { useMemo } from 'react';
import { useExplorationStore } from '../../stores/explorationStore';
import { usePlayerStore } from '../../stores/playerStore';
import { backpackSlotsFor } from '../../data/backpacks';
import styles from './travel.module.css';

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м`;
  return `${Math.max(0, Math.round(sec))}с`;
};

export const LootSummary = () => {
  const totalChips = useExplorationStore((s) => s.totalChips);
  const totalExp = useExplorationStore((s) => s.totalExp);
  const totalItems = useExplorationStore((s) => s.totalItems);
  const consBuffs = useExplorationStore((s) => s.consBuffs);
  const phase = useExplorationStore((s) => s.phase);
  const isReturningHome = useExplorationStore((s) => s.isReturningHome);
  const serverOutcome = useExplorationStore((s) => s.serverOutcome);
  const cancelExploration = useExplorationStore((s) => s.cancelExploration);
  const completeExploration = useExplorationStore((s) => s.completeExploration);

  const grid = usePlayerStore((s) => s.backpackGrid);
  const backpack = usePlayerStore((s) => (s.equipment as any).backpack);

  const { used, cap } = useMemo(() => {
    const cells = grid?.cells ?? [];
    let taken = 0;
    for (const row of cells) for (const c of row) if (c) taken++;
    const capacity = Math.max(grid?.slots ?? 0, backpackSlotsFor(backpack as any));
    return { used: taken, cap: capacity };
  }, [grid, backpack]);

  const bagPct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const bagFull = cap > 0 && used >= cap;

  const buffs = useMemo(() => {
    const out: string[] = [];
    const b = consBuffs;
    if (!b) return out;
    if (b.regen) out.push(`♺ +${b.regen} реген/мин`);
    if (b.healPct) out.push(`❤ +${(b.healPct * 100).toFixed(1)}% хил`);
    if (b.legPct) out.push(`⚜ +${(b.legPct * 100).toFixed(1)}% легендарка`);
    if (b.expPct) out.push(`⚡ +${Math.round(b.expPct * 100)}% опыт`);
    if (b.chipsPct) out.push(`💾 +${Math.round(b.chipsPct * 100)}% чипы`);
    if (b.dmgTakenMult < 1) out.push(`🛡 −${Math.round((1 - b.dmgTakenMult) * 100)}% урон`);
    if (b.returnMult < 1) out.push(`🏠 −${Math.round((1 - b.returnMult) * 100)}% возврат`);
    return out;
  }, [consBuffs]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span>Сводка</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.sumBig}>
          <b style={{ color: '#fbbf24' }}>
            {totalChips >= 0 ? `+${totalChips}` : totalChips}
          </b>
          <span>чипов</span>
          <b style={{ color: '#c084fc', marginLeft: 'auto' }}>
            {totalExp >= 0 ? `+${totalExp}` : totalExp}
          </b>
          <span>опыта</span>
        </div>

        <div className={styles.sumGrid}>
          <div className={styles.sumTile}>
            <span>Находок</span>
            <b style={{ color: '#93c5fd' }}>{totalItems}</b>
          </div>
          <div className={styles.sumTile}>
            <span>Фаза</span>
            <b style={{ fontSize: 13 }}>
              {serverOutcome === 'dead' ? '💀 погиб' : phase === 'travel_back' ? '🏠 домой' : phase === 'travel_out' ? '🚀 в пути' : '🔍 в зоне'}
            </b>
          </div>
        </div>

        <div className={styles.sectionTitle}>Рюкзак</div>
        <div className={styles.barLabel}>
          <span>🎒 Занято</span>
          <b>{used} / {cap || '—'}</b>
        </div>
        <div className={styles.barTrack}>
          <div
            className={`${styles.barFill} ${styles.barBag}`}
            style={{ width: `${bagPct}%` }}
          />
        </div>
        {bagFull && (
          <div className={styles.warnBox}>
            ⚠ Рюкзак заполнен — добыча больше не поместится и будет потеряна.
          </div>
        )}

        {buffs.length > 0 && (
          <>
            <div className={styles.sectionTitle}>Бонусы рюкзака</div>
            <div className={styles.previewBox}>
              {buffs.map((b, i) => (
                <div key={i}>{b}</div>
              ))}
            </div>
          </>
        )}

        <div className={styles.btnRow}>
          {isReturningHome || phase === 'complete' ? (
            <button className={`${styles.btn} ${styles.btnOk}`} onClick={() => completeExploration()}>
              ✅ Завершить
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => {
                if (window.confirm('Прервать поездку? Добыча за рейд останется при тебе, но бонуса за длительность не будет.')) {
                  void cancelExploration();
                }
              }}
            >
              🛑 Отменить поездку
            </button>
          )}
        </div>

        {isReturningHome && (
          <div className={styles.warnBox}>
            🏠 Возвращение на базу — дорога займёт около часа.
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Рейд длится {fmtDur(useExplorationStore.getState().plannedSec || 180)}.
        </div>
      </div>
    </div>
  );
};
