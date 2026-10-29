import { useDungeonStore } from '../../stores/dungeonStore';
import styles from './dungeon.module.css';

export const DoorScreen = () => {
  const run = useDungeonStore((s) => s.run);
  const chooseDoor = useDungeonStore((s) => s.chooseDoor);
  if (!run) return null;

  return (
    <div className={styles.doors}>
      <div style={{ textAlign: 'center' }}>
        <div className={styles.doorNum}>ДВЕРЬ {run.door} ИЗ 30</div>
        <h2 className={styles.title} style={{ marginTop: 6 }}>Куда идём?</h2>
        <p className={styles.sub} style={{ marginBottom: 0 }}>
          Один путь — одна дверь. Выбор нельзя отменить.
        </p>
      </div>

      <div className={styles.doorRow}>
        {run.doors.map((door) => (
          <button
            key={door.id}
            type="button"
            className={`${styles.door} ${door.type === 'boss' ? styles.doorBoss : ''}`}
            onClick={() => chooseDoor(door.id)}
          >
            <span className={styles.doorIcon} style={{ filter: `drop-shadow(0 0 18px ${door.color}55)` }}>{door.icon}</span>
            <span className={styles.doorTitle} style={{ color: door.color }}>{door.title}</span>
            <span className={styles.doorSub}>{door.subtitle}</span>
          </button>
        ))}
      </div>

      <div className={styles.row} style={{ justifyContent: 'center' }}>
        <span className={styles.pill}>Чипы забега: <b style={{ color: '#fbbf24' }}>{run.chips}</b></span>
        <span className={styles.pill}>Колода: {run.deck.length} карт</span>
        <span className={styles.pill}>Наёмники: {run.mercs.filter((m) => m.hp > 0).length}/{run.mercs.length}</span>
      </div>
    </div>
  );
};
