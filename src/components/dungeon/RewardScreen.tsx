import { useDungeonStore } from '../../stores/dungeonStore';
import { CardView } from './CardView';
import styles from './dungeon.module.css';

const SOURCE_TITLE: Record<string, string> = {
  battle: 'Бой пройден',
  elite: 'Элита повержена',
  boss: 'Босс повержен',
};

export const RewardScreen = () => {
  const run = useDungeonStore((s) => s.run);
  const levels = useDungeonStore((s) => s.levels);
  const claimReward = useDungeonStore((s) => s.claimReward);
  if (!run || !run.reward) return null;

  const { chips, cards, source } = run.reward;
  const deckFull = run.deck.length >= 12;

  return (
    <div className={styles.centerBox}>
      <h2 className={styles.title}>{SOURCE_TITLE[source] ?? 'Награда'}</h2>
      <p className={styles.sub} style={{ margin: 0 }}>
        {source === 'boss' ? 'Все выжившие наёмники лечатся на 20% HP. ' : ''}
        Дверь {run.door} из 30.
      </p>

      <div className={styles.rewardChip}>+{chips} чипов забега</div>

      {cards.length > 0 ? (
        <>
          <p className={styles.sub} style={{ margin: 0 }}>
            Возьмите одну карту{deckFull ? ' (колода заполнена — карта не поместится)' : ''}:
          </p>
          <div className={styles.rewardCards}>
            {cards.map((id) => (
              <CardView
                key={id}
                defId={id}
                level={levels[id] || 1}
                onClick={() => claimReward(id)}
              />
            ))}
          </div>
          <button type="button" className={styles.btnGhost} onClick={() => claimReward(null)}>
            Пропустить карту
          </button>
        </>
      ) : (
        <button type="button" className={styles.btn} onClick={() => claimReward(null)}>
          Забрать награду
        </button>
      )}
    </div>
  );
};
