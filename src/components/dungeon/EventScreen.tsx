import { useDungeonStore } from '../../stores/dungeonStore';
import styles from './dungeon.module.css';

export const EventScreen = () => {
  const run = useDungeonStore((s) => s.run);
  const resolveEvent = useDungeonStore((s) => s.resolveEvent);
  if (!run || !run.event) return null;

  return (
    <div className={styles.centerBox}>
      <div className={styles.eventBox}>
        <div className={styles.runEndIcon} style={{ fontSize: 40 }}>❓</div>
        <h2 className={styles.title}>{run.event.title}</h2>
        <p className={styles.eventText}>{run.event.text}</p>
        <div className={styles.choices}>
          {run.event.choices.map((choice, i) => (
            <button
              key={choice.label}
              type="button"
              className={styles.choice}
              onClick={() => resolveEvent(i)}
            >
              <span>{choice.label}</span>
              <span className={styles.choiceHint}>{choice.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
