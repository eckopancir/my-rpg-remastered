import { useState } from 'react';
import { ACT_NAMES, actOfDoor } from '../../data/dungeon/enemies';
import { useDungeonStore } from '../../stores/dungeonStore';
import bgA from '../../assets/images/dungeon/spider-lair.png';
import bgB from '../../assets/images/dungeon/spider-lair-2.png';
import { BattleScreen } from './BattleScreen';
import { DoorScreen } from './DoorScreen';
import { EventScreen } from './EventScreen';
import { ForgeScreen } from './ForgeScreen';
import { RestScreen } from './RestScreen';
import { RewardScreen } from './RewardScreen';
import { RunEndScreen } from './RunEndScreen';
import { SetupScreen } from './SetupScreen';
import styles from './dungeon.module.css';

const KEY_TIERS = ['Обычный', 'Редкий', 'Раритетный', 'Эпический', 'Смертоносный', 'Легендарный', 'Божественный'];

export const DungeonOverlay = () => {
  const open = useDungeonStore((s) => s.open);
  const run = useDungeonStore((s) => s.run);
  const close = useDungeonStore((s) => s.close);
  const openTest = useDungeonStore((s) => s.openTest);
  const abandonRun = useDungeonStore((s) => s.abandonRun);
  const [bg] = useState(() => (Math.random() < 0.5 ? bgA : bgB));

  if (!open) return null;

  const phase = run?.phase ?? null;

  return (
    <div className={styles.overlay}>
      <div className={styles.bg} style={{ backgroundImage: `url(${bg})` }} />
      <div className={styles.vignette} />

      <div className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>ЛОГОВО ПАУКОВ</span>
          <span className={styles.brandSub}>карточный данж · базовая версия</span>
        </div>

        <div className={styles.meta}>
          {run && (
            <>
              <span className={`${styles.pill} ${styles.pillTier}`}>
                {KEY_TIERS[Math.max(0, Math.min(6, run.keyTier - 1))]} ключ
              </span>
              <span className={styles.pill}>Дверь {run.door} / 30</span>
              <span className={styles.pill}>{ACT_NAMES[actOfDoor(run.door)]}</span>
              <span className={`${styles.pill} ${styles.pillChips}`}>⬢ {run.chips}</span>
            </>
          )}
          {run && phase !== 'dead' && phase !== 'won' && phase !== 'setup' && (
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => {
                if (window.confirm('Выйти из данжа? Забег завершится, вы получите 50% чипов забега.')) abandonRun();
              }}
            >
              Покинуть данж
            </button>
          )}
          <button type="button" className={styles.close} onClick={close} title="Свернуть (забег сохранится)">✕</button>
        </div>
      </div>

      <div className={styles.screen}>
        {!run && (
          <div className={styles.centerBox}>
            <div className={styles.runEndIcon}>🗝️</div>
            <h2 className={styles.title}>Данж не начат</h2>
            <p className={styles.sub} style={{ maxWidth: 560 }}>
              Откройте рюкзак, найдите легендарный ключ и выберите «Войти в данж».
              Ключ сгорит при входе. Смерть всех наёмников означает конец забега.
            </p>
            <div className={styles.row} style={{ justifyContent: 'center' }}>
              <button type="button" className={styles.btn} onClick={openTest}>
                Тестовый забег
              </button>
              <button type="button" className={styles.btnGhost} onClick={close}>Закрыть</button>
            </div>
          </div>
        )}

        {run && phase === 'setup' && <SetupScreen />}
        {run && phase === 'doors' && <DoorScreen />}
        {run && phase === 'battle' && <BattleScreen />}
        {run && phase === 'reward' && <RewardScreen />}
        {run && phase === 'forge' && <ForgeScreen />}
        {run && phase === 'rest' && <RestScreen />}
        {run && phase === 'event' && <EventScreen />}
        {run && (phase === 'dead' || phase === 'won') && <RunEndScreen />}
      </div>
    </div>
  );
};
