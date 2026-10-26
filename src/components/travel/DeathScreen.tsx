import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useExplorationStore, pickDeathFlavor } from '../../stores/explorationStore';
import { diffArtStyle } from '../../data/eventArt';
import { DIFF_NAMES } from '../../data/travelModes';
import styles from './DeathScreen.module.css';

/**
 * Экран смерти: картинка сложности из diff-sheet (5 ячеек — на каждую
 * сложность своя сцена смерти), причина, «спасательная» история и потери.
 * Рейд уже завершён сервером — здесь только показ и выход из рейда.
 */
export const DeathScreen = () => {
  const navigate = useNavigate();
  const serverOutcome = useExplorationStore((s) => s.serverOutcome);
  const deathInfo = useExplorationStore((s) => s.deathInfo);
  const deathSettled = useExplorationStore((s) => s.deathSettled);
  const difficulty = useExplorationStore((s) => s.difficulty);
  const completeExploration = useExplorationStore((s) => s.completeExploration);

  // Показываем только неподтверждённую смерть: после «Снова в путь»/F5
  // экран не должен всплывать снова из-за задержавшегося полла.
  const visible = serverOutcome === 'dead' && !deathSettled;
  const art = useMemo(
    () => (visible ? diffArtStyle(deathInfo?.difficulty ?? difficulty) : null),
    [visible, deathInfo?.difficulty, difficulty],
  );
  // Одна история на смерть (фиксируем на показ экрана).
  const flavor = useMemo(() => (visible ? pickDeathFlavor() : ''), [visible]);

  const finish = (to: string) => {
    completeExploration();
    navigate(to);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            className={`${styles.frame} ${art ? styles.frameWithArt : ''}`}
            style={art ? (art as Record<string, unknown>) : undefined}
            initial={{ scale: 0.93, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className={styles.veil} />
            <div className={styles.numeral}>💀</div>
            <div className={styles.title}>Вы погибли</div>
            {deathInfo?.difficulty && (
              <div className={styles.diffTag}>{DIFF_NAMES[deathInfo.difficulty] ?? deathInfo.difficulty}</div>
            )}

            {deathInfo?.cause && <div className={styles.cause}>{deathInfo.cause}</div>}
            <div className={styles.flavor}>{flavor}</div>

            <div className={styles.losses}>
              {deathInfo?.lostChips ? <div>💾 Теряете <b>{deathInfo.lostChips}</b> чипов</div> : null}
              {deathInfo?.lostItems ? <div>📦 Теряете <b>{deathInfo.lostItems}</b> предметов</div> : null}
              <div>🎒 Рюкзак обнулён</div>
              <div>❤️ Очнётесь с <b>1%</b> здоровья</div>
            </div>

            <div className={styles.btnRow}>
              <button className={`${styles.btn} ${styles.btnGh}`} onClick={() => finish('/dashboard')}>
                🏠 Очнуться на базе
              </button>
              <button className={`${styles.btn} ${styles.btnAgain}`} onClick={() => finish('/adventure')}>
                🚀 Снова в путь
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
