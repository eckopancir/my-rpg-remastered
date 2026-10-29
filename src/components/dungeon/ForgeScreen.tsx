import { CARD_MAP, MAX_CARD_LEVEL } from '../../data/dungeon/cards';
import { upgradeCostFor } from '../../data/dungeon/doors';
import { useDungeonStore } from '../../stores/dungeonStore';
import styles from './dungeon.module.css';

export const ForgeScreen = () => {
  const run = useDungeonStore((s) => s.run);
  const levels = useDungeonStore((s) => s.levels);
  const upgradeCard = useDungeonStore((s) => s.upgradeCard);
  const leaveForge = useDungeonStore((s) => s.leaveForge);
  if (!run) return null;

  const deckCards = run.deck.map((id) => CARD_MAP[id]).filter(Boolean);

  return (
    <div className={styles.centerBox} style={{ justifyContent: 'flex-start', alignItems: 'stretch', maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 className={styles.title}>🔨 Кузница</h2>
        <p className={styles.sub} style={{ margin: 0 }}>
          Апгрейд карт тратит чипы забега и остаётся навсегда. Мощность карты не растёт.
        </p>
        <div className={styles.rewardChip} style={{ fontSize: 18, margin: '10px 0' }}>{run.chips} чипов</div>
      </div>

      <div className={styles.forgeList}>
        {deckCards.map((def) => {
          const lvl = levels[def.id] || 1;
          const max = lvl >= MAX_CARD_LEVEL;
          const price = max ? 0 : upgradeCostFor(def, lvl);
          const affordable = !max && run.chips >= price;
          return (
            <div key={def.id} className={styles.forgeRow}>
              <span className={styles.forgeName}>{def.icon} {def.name}</span>
              <span className={styles.forgeMeta}>
                ур. {lvl} → {max ? 'макс' : lvl + 1} · мощность {def.power} · цена не меняется
              </span>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={!affordable}
                onClick={() => upgradeCard(def.id)}
              >
                {max ? 'максимум' : `${price} чипов`}
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.row} style={{ justifyContent: 'center', marginTop: 14 }}>
        <button type="button" className={styles.btn} onClick={leaveForge}>
          Идти дальше
        </button>
      </div>
    </div>
  );
};
