import { useState } from 'react';
import { CARD_MAP, MAX_CARD_LEVEL, MAX_DECK, SET_META, type CardSet } from '../../data/dungeon/cards';
import { upgradeCostFor } from '../../data/dungeon/doors';
import { ROLE_COLOR, ROLE_ICON, ROLE_NAME, SLOTS, SLOT_LABEL, mercStats, starsText, type Slot } from '../../data/dungeon/mercs';
import { dungeonDeckCost, powerBudget, useDungeonStore } from '../../stores/dungeonStore';
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

  const [tab, setTab] = useState<Tab>('deck');
  const [moving, setMoving] = useState<string | null>(null);
  /** Карта, которую пытаемся добавить в полную колоду. */
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [setFilter, setSetFilter] = useState<CardSet | 'all'>('all');
  const [onlyDeck, setOnlyDeck] = useState(false);

  if (!run) return null;

  const budget = powerBudget();
  const cost = dungeonDeckCost(run.deck);
  const overBudget = cost > budget;
  const deckOk = run.deck.length >= 5 && run.deck.length <= MAX_DECK && !overBudget;
  const mercsOk = run.mercs.length >= 1;
  const canStart = deckOk && mercsOk;

  const deckCards = run.deck
    .map((id) => CARD_MAP[id])
    .filter(Boolean);

  const needle = query.trim().toLowerCase();
  const filteredCards = Object.values(CARD_MAP).filter((def) => {
    if (setFilter !== 'all' && def.set !== setFilter) return false;
    if (onlyDeck && !run.deck.includes(def.id)) return false;
    if (needle && !def.name.toLowerCase().includes(needle)) return false;
    return true;
  });

  const slotMerc = (slot: Slot) => run.mercs.find((m) => m.slot === slot);

  const addCard = (id: string) => {
    if (run.deck.includes(id)) {
      toggleDeckCard(id);
      return;
    }
    if (run.deck.length >= MAX_DECK) {
      setPendingAdd(id);
      return;
    }
    toggleDeckCard(id);
  };

  const swapCard = (removeId: string) => {
    if (!pendingAdd) return;
    toggleDeckCard(removeId);
    toggleDeckCard(pendingAdd);
    setPendingAdd(null);
  };

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
                <span>{run.deck.length} / {MAX_DECK} карт</span>
              </div>

              <div className={styles.deckFilters}>
                <input
                  className={styles.search}
                  type="search"
                  placeholder="Поиск карты…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  type="button"
                  className={`${styles.filterChip} ${onlyDeck ? styles.filterChipOn : ''}`}
                  onClick={() => setOnlyDeck((v) => !v)}
                >
                  в колоде {run.deck.length}
                </button>
              </div>

              <div className={styles.setChips}>
                <button
                  type="button"
                  className={`${styles.setChip} ${setFilter === 'all' ? styles.setChipOn : ''}`}
                  onClick={() => setSetFilter('all')}
                >
                  все
                </button>
                {(Object.keys(SET_META) as (keyof typeof SET_META)[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.setChip} ${setFilter === key ? styles.setChipOn : ''}`}
                    style={setFilter === key ? { borderColor: SET_META[key].color, color: SET_META[key].color } : undefined}
                    onClick={() => setSetFilter(setFilter === key ? 'all' : key)}
                  >
                    {SET_META[key].icon} {SET_META[key].label}
                  </button>
                ))}
              </div>

              <div className={styles.cardGrid}>
                {filteredCards.map((def) => {
                  const inDeck = run.deck.includes(def.id);
                  return (
                    <CardView
                      key={def.id}
                      defId={def.id}
                      level={levels[def.id] || 1}
                      selected={inDeck}
                      onClick={() => addCard(def.id)}
                    />
                  );
                })}
                {filteredCards.length === 0 && (
                  <p className={styles.sub} style={{ margin: 8 }}>Ничего не нашлось.</p>
                )}
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
        </span>
        <button type="button" className={styles.btn} disabled={!canStart} onClick={startRun}>
          Войти в данж
        </button>
      </div>

      {pendingAdd && (
        <div className={styles.modalBackdrop} onClick={() => setPendingAdd(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.title} style={{ fontSize: 18 }}>Колода заполнена</h3>
            <p className={styles.sub} style={{ marginTop: 0 }}>
              В колоде уже {MAX_DECK} карт. Выберите карту, которую заменить на
              {' '}<b style={{ color: '#fbbf24' }}>{CARD_MAP[pendingAdd]?.name}</b>.
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
                    onClick={() => swapCard(id)}
                  >
                    <span>{def.icon} {def.name}</span>
                    <span className={styles.modalMeta}>{def.cost}⚡ · {def.power}</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.row} style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className={styles.btnGhost} onClick={() => setPendingAdd(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
