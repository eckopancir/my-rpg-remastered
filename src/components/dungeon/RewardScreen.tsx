import { useState } from 'react';
import { CARD_MAP, MAX_DECK } from '../../data/dungeon/cards';
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
  const [pendingCard, setPendingCard] = useState<string | null>(null);

  if (!run || !run.reward) return null;

  const { chips, cards, source } = run.reward;
  const deckFull = run.deck.length >= MAX_DECK;

  const takeCard = (id: string) => {
    if (deckFull) {
      setPendingCard(id);
      return;
    }
    claimReward(id);
  };

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
            Возьмите одну карту{deckFull ? ' (колода заполнена — придётся заменить)' : ''}:
          </p>
          <div className={styles.rewardCards}>
            {cards.map((id) => (
              <CardView
                key={id}
                defId={id}
                level={levels[id] || 1}
                onClick={() => takeCard(id)}
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

      {pendingCard && (
        <div className={styles.modalBackdrop} onClick={() => setPendingCard(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.title} style={{ fontSize: 18 }}>Колода заполнена</h3>
            <p className={styles.sub} style={{ marginTop: 0 }}>
              В колоде {MAX_DECK} карт. Заменить одну на
              {' '}<b style={{ color: '#fbbf24' }}>{CARD_MAP[pendingCard]?.name}</b>?
            </p>
            <div className={styles.modalList}>
              {run.deck.map((id, i) => {
                const def = CARD_MAP[id];
                if (!def) return null;
                return (
                  <button
                    key={`${id}-${i}`}
                    type="button"
                    className={styles.modalItem}
                    onClick={() => claimReward(pendingCard, id)}
                  >
                    <span>{def.icon} {def.name}</span>
                    <span className={styles.modalMeta}>{def.cost}⚡ · {def.power}</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.row} style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className={styles.btnGhost} onClick={() => setPendingCard(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
