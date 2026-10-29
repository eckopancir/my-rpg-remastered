import { useDungeonStore } from '../../stores/dungeonStore';
import styles from './dungeon.module.css';

export const RestScreen = () => {
  const run = useDungeonStore((s) => s.run);
  const restHeal = useDungeonStore((s) => s.restHeal);
  if (!run) return null;

  return (
    <div className={styles.centerBox}>
      <div className={styles.runEndIcon}>🔥</div>
      <h2 className={styles.title}>Привал</h2>
      <p className={styles.sub} style={{ maxWidth: 520, margin: 0 }}>
        Тёплый камень, тишина и немного времени. Наёмники перевязывают раны и проверяют броню.
        Все выжившие восстанавливают 30% HP.
      </p>

      <div className={styles.row} style={{ justifyContent: 'center' }}>
        {run.mercs.map((m) => (
          <span key={m.id} className={styles.pill} style={{ opacity: m.hp > 0 ? 1 : 0.45 }}>
            {m.name}: {Math.max(0, Math.round(m.hp))} / {m.maxHp}
          </span>
        ))}
      </div>

      <button type="button" className={styles.btn} onClick={restHeal}>
        Отдохнуть и идти дальше
      </button>
    </div>
  );
};
