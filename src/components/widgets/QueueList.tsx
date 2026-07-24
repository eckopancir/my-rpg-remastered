import { useUiStore } from '../../stores/uiStore';
import styles from './QueueList.module.css';

export const QueueList = () => {
  const queue = useUiStore((s) => s.queue);
  const removeFromQueue = useUiStore((s) => s.removeFromQueue);

  if (queue.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>Expedition Queue</div>
      {queue.map((entry) => (
        <div
          key={entry.id}
          className={`${styles.item} ${entry.status === 'active' ? styles.active : ''}`}
        >
          <div className={styles.itemName}>{entry.zoneName}</div>
          <div className={styles.itemStatus}>{entry.status}</div>
          <button
            className={styles.removeBtn}
            onClick={() => removeFromQueue(entry.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
