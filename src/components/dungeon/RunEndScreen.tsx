import { useDungeonStore } from '../../stores/dungeonStore';
import styles from './dungeon.module.css';

export const RunEndScreen = () => {
  const run = useDungeonStore((s) => s.run);
  const finishRun = useDungeonStore((s) => s.finishRun);
  if (!run) return null;

  const won = run.ended === 'won';
  const banked = won ? run.chips : Math.round(run.chips * 0.25);

  return (
    <div className={styles.centerBox}>
      <div className={styles.runEnd}>
        <div className={styles.runEndIcon}>{won ? '🏆' : '💀'}</div>
        <h2 className={styles.title}>{won ? 'Данж пройден' : 'Забег окончен'}</h2>
        <p className={styles.sub} style={{ fontSize: 13 }}>
          {won
            ? 'Матка мертва, улей затих. Ключ сгорел, но добыча ваша.'
            : 'Все наёмники погибли. Ключ остался в паутине — назад дороги нет.'}
        </p>

        <div className={styles.row} style={{ justifyContent: 'center', margin: '10px 0 18px' }}>
          <span className={styles.pill}>Дверь {run.door} / 30</span>
          <span className={styles.pill}>Колода: {run.deck.length}</span>
          <span className={styles.pill} style={{ color: '#fbbf24' }}>
            В общий кошелёк: +{banked} чипов ({won ? '100%' : '25%'})
          </span>
        </div>

        <button type="button" className={styles.btn} onClick={finishRun}>
          Выйти из данжа
        </button>
      </div>
    </div>
  );
};
