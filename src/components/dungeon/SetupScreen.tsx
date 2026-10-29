import { useState } from 'react';
import { CARD_MAP, MAX_CARD_LEVEL } from '../../data/dungeon/cards';
import { upgradeCostFor } from '../../data/dungeon/doors';
import { ROLE_COLOR, ROLE_ICON, ROLE_NAME, SLOTS, SLOT_LABEL, mercStats, starsText, type Slot } from '../../data/dungeon/mercs';
import { usePlayerStore } from '../../stores/playerStore';
import { dungeonDeckCost, useDungeonStore } from '../../stores/dungeonStore';
import { CardView } from './CardView';
import styles from './dungeon.module.css';

type Tab = 'deck' | 'forge';

export const SetupScreen = () => {
  const run = useDungeonStore((s) => s.run);
  const levels = useDungeonStore((s) => s.levels);
  const toggleMerc = useDungeonStore((s) => s.toggleMerc);
  const setSlot = useDungeonStore((s) => s.setSlot);
  const toggleDeckCard = useDungeonStore((s) => s.toggleDeckCard);
  const startRun = useDungeonStore((s) => s.startRun);
  const upgradeCard = useDungeonStore((s) => s.upgradeCard);
  const power = usePlayerStore((s) => s.stats.power);

  const [tab, setTab] = useState<Tab>('deck');
  const [moving, setMoving] = useState<string | null>(null);

  if (!run) return null;

  const budget = Math.max(600, Math.round(power || 0));
  const cost = dungeonDeckCost(run.deck);
  const overBudget = cost > budget;
  const deckOk = run.deck.length >= 5 && run.deck.length <= 10 && !overBudget;
  const mercsOk = run.mercs.length >= 1;
  const canStart = deckOk && mercsOk;

  const deckCards = run.deck
    .map((id) => CARD_MAP[id])
    .filter(Boolean);

  const slotMerc = (slot: Slot) => run.mercs.find((m) => m.slot === slot);

  return (
    <div className={styles.setup}>
      <div className={styles.setupCols}>
        {/* ---------------- Наёмники ---------------- */}
        <div className={styles.panel}>
          <h2 className={styles.title}>Наёмники</h2>
          <p className={styles.sub}>
            Возьмите до четырёх. Наёмники — «губки» для урона: только HP и броня. Броня восстанавливается в конце каждого хода.
          </p>

          <div className={styles.slots}>
            {SLOTS.map((slot) => {
              const merc = slotMerc(slot);
              const isMoving = !!merc && moving === merc.id;
              return (
                <div
                  key={slot}
                  className={`${styles.slotBox} ${merc ? styles.slotBoxOn : ''}`}
                  onClick={() => {
                    if (!merc) {
                      if (moving) {
                        setSlot(moving, slot);
                        setMoving(null);
                      }
                      return;
                    }
                    if (moving && moving !== merc.id) {
                      setSlot(moving, slot);
                      setMoving(null);
                      return;
                    }
                    setMoving(isMoving ? null : merc.id);
                  }}
                  style={isMoving ? { borderColor: '#fbbf24', boxShadow: '0 0 16px rgba(251,191,36,0.25)' } : undefined}
                >
                  <span className={styles.slotTitle}>{SLOT_LABEL[slot]}</span>
                  {merc ? (
                    <>
                      <span className={styles.slotName}>
                        {ROLE_ICON[merc.role]} {merc.name}
                      </span>
                      <span className={styles.rosterStats}>
                        {starsText(merc.stars)} · {merc.maxHp} HP · {merc.maxArmor} брони
                      </span>
                      <div className={styles.slotBtns}>
                        <button
                          type="button"
                          className={styles.slotBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMerc(merc.id);
                            setMoving(null);
                          }}
                        >
                          убрать
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className={styles.slotEmpty}>{moving ? 'поставить сюда' : 'пусто'}</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className={styles.sub} style={{ marginTop: 12, marginBottom: 6 }}>
            Состав ({run.mercs.length}/4){moving ? ' · выберите слот для перемещения' : ' · клик по слоту — переместить'}
          </p>
          <div className={styles.roster}>
            {run.roster.map((m) => {
              const picked = run.mercs.some((x) => x.id === m.id);
              const st = mercStats(m.role, m.stars);
              return (
                <div
                  key={m.id}
                  className={`${styles.rosterCard} ${picked ? styles.rosterCardOn : ''}`}
                  onClick={() => { setMoving(null); toggleMerc(m.id); }}
                >
                  <div className={styles.rosterName} style={{ color: ROLE_COLOR[m.role] }}>
                    {ROLE_ICON[m.role]} {m.name}
                  </div>
                  <div className={styles.rosterStats}>{ROLE_NAME[m.role]} · {starsText(m.stars)}</div>
                  <div className={styles.rosterStats}>{st.maxHp} HP · {st.maxArmor} брони</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- Колода / кузница ---------------- */}
        <div className={styles.panel} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${tab === 'deck' ? styles.tabActive : ''}`}
              onClick={() => setTab('deck')}
            >
              Колода
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === 'forge' ? styles.tabActive : ''}`}
              onClick={() => setTab('forge')}
            >
              Кузница
            </button>
            <span className={styles.pill} style={{ marginLeft: 'auto' }}>чипы забега: <b style={{ color: '#fbbf24' }}>{run.chips}</b></span>
          </div>

          {tab === 'deck' ? (
            <>
              <div className={styles.budget} style={{ marginTop: 12 }}>
                <span>Мощность: {cost} / {budget}</span>
                <div className={styles.budgetBar}>
                  <div
                    className={`${styles.budgetFill} ${overBudget ? styles.budgetOver : ''}`}
                    style={{ width: `${Math.min(100, (cost / budget) * 100)}%` }}
                  />
                </div>
                <span>{run.deck.length} / 10 карт</span>
              </div>
              <div className={styles.cardGrid}>
                {Object.values(CARD_MAP).map((def) => {
                  const inDeck = run.deck.includes(def.id);
                  return (
                    <CardView
                      key={def.id}
                      defId={def.id}
                      level={levels[def.id] || 1}
                      selected={inDeck}
                      disabled={!inDeck && run.deck.length >= 10}
                      onClick={() => toggleDeckCard(def.id)}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className={styles.sub} style={{ marginTop: 12 }}>
                Апгрейд карты навсегда повышает её числа. Цена в мощности не меняется.
              </p>
              {deckCards.length === 0 ? (
                <p className={styles.sub}>Сначала соберите колоду.</p>
              ) : (
                <div className={styles.forgeList}>
                  {deckCards.map((def) => {
                    const lvl = levels[def.id] || 1;
                    const max = lvl >= MAX_CARD_LEVEL;
                    const price = max ? 0 : upgradeCostFor(def, lvl);
                    const affordable = !max && run.chips >= price;
                    return (
                      <div key={def.id} className={styles.forgeRow}>
                        <span className={styles.forgeName}>{def.icon} {def.name}</span>
                        <span className={styles.forgeMeta}>ур. {lvl} → {max ? 'макс' : lvl + 1} · мощность {def.power}</span>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          disabled={!affordable}
                          onClick={() => upgradeCard(def.id)}
                        >
                          {max ? 'макс' : `${price} чипов`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className={styles.row} style={{ justifyContent: 'flex-end' }}>
        <span className={styles.sub} style={{ margin: 0 }}>
          {!mercsOk ? 'Нужен хотя бы один наёмник. ' : ''}
          {run.deck.length < 5 ? 'В колоде минимум 5 карт. ' : ''}
          {overBudget ? 'Колода дороже мощности. ' : ''}
          {run.deck.length > 10 ? 'В стартовой колоде максимум 10 карт.' : ''}
        </span>
        <button type="button" className={styles.btn} disabled={!canStart} onClick={startRun}>
          Войти в данж
        </button>
      </div>
    </div>
  );
};
