import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExplorationStore, calcConsBuffs } from '../../stores/explorationStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useAuthStore } from '../../stores/authStore';
import { ZONES } from '../../data/zones';
import { TRAVEL_OUT_SEC, TRAVEL_BACK_SEC } from '../../data/travelTuning';
import { getItemImage } from '../../assets/index';
import styles from './travel.module.css';

const LOCKED_ZONES = new Set([
  'Болото', 'Свалка мусора', 'Темный лес',
  'База бандитов', 'Руины города', 'Старый завод',
]);

/** Что даёт материал: зеркало expeditionBuffs() (превью в рейд-UI). */
const packBonusText = (name: string, qty: number): string => {
  const tail = (v: string) => (qty > 0 ? ` → ${v}` : '');
  switch (name) {
    case 'Лекарства': return `+5 реген/мин (макс +30)${tail(`+${Math.min(qty, 6) * 5}/мин`)}`;
    case 'Вода':
    case 'Консервы': return `+5% хил (макс +30%)${tail(`+${(Math.min(qty, 6) * 5).toFixed(0)}%`)}`;
    case 'Батарейки': return `+3% шанс легендарки (макс +15%)${tail(`+${(Math.min(qty, 5) * 3).toFixed(0)}%`)}`;
    case 'Дерево':
    case 'Гвозди': return `+10% опыта (макс +100%)${tail(`+${(Math.min(qty, 5) * 10).toFixed(0)}%`)}`;
    case 'Инструменты':
    case 'Пластмасса': return `+10% чипов (макс +100%)${tail(`+${(Math.min(qty, 5) * 10).toFixed(0)}%`)}`;
    case 'Изолента':
    case 'Железо': return `−5% входящего урона (макс −50%)${tail(`−${Math.min(qty, 5) * 5}%`)}`;
    case 'Топливо': return `−15% времени возврата (макс −75%)${tail(`−${Math.min(qty, 5) * 15}%`)}`;
    default: return 'без пассивного бонуса';
  }
};

interface HistoryEntry {
  id: number;
  zone: string;
  outcome: string;
  total_chips: number;
  total_exp: number;
  total_items: number;
  duration_seconds: number;
  ended_at: string;
}

interface TripCard {
  id: string;
  zone: string;
  difficulty: string;
  difficultyName: string;
  difficultyIcon: string;
  difficultyColor: string;
  damageMult: number;
  rewardMult: number;
  qualityCap: string;
  difficultyDesc: string;
  modifier: string;
  modifierName: string;
  modifierIcon: string;
  modifierDesc: string;
  hours: number;
  refreshIn: number;
}

const fmtShort = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} с`;
  const m = Math.round(s / 60);
  return `${m} мин`;
};

export const TravelStartScreen = () => {
  const navigate = useNavigate();
  const isExploring = useExplorationStore((s) => s.isExploring);
  const startExploration = useExplorationStore((s) => s.startExploration);
  const token = useAuthStore((s) => s.token);
  const materials = useInventoryStore((s) => s.items);

  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [cards, setCards] = useState<TripCard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [hours, setHours] = useState(12);
  const [pack, setPack] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/exploration/history.php', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.history) setHistory(data.history); })
      .catch(() => {});
  }, [token]);

  // Карточки рейдов для выбранной зоны.
  useEffect(() => {
    if (!selectedZone || !token) { setCards([]); return; }
    setCardsLoading(true);
    fetch(`/api/exploration/trip_cards.php?zone=${encodeURIComponent(selectedZone)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list: TripCard[] = data.cards || [];
        setCards(list);
        setCardIdx(0);
        if (list[0]) setHours(list[0].hours);
      })
      .catch(() => setCards([]))
      .finally(() => setCardsLoading(false));
  }, [selectedZone, token]);

  const card = cards[cardIdx] ?? null;

  const zones = useMemo(
    () => ZONES.filter((z) => z.name !== 'Наша база' && z.name !== 'Базар'),
    [],
  );

  const packMats = useMemo(() => {
    const map = new Map<string, { name: string; have: number; img?: string }>();
    for (const it of materials) {
      if (it.type !== 'material') continue;
      if (!['Батарейки', 'Вода', 'Гвозди', 'Дерево', 'Железо', 'Изолента', 'Инструменты', 'Консервы', 'Лекарства', 'Пластмасса', 'Топливо'].includes(it.name)) continue;
      const qty = it.quantity || 1;
      const cur = map.get(it.name);
      if (cur) cur.have += qty;
      else map.set(it.name, { name: it.name, have: qty, img: getItemImage(it.name) });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [materials]);

  const packBuffs = calcConsBuffs(pack);
  const packPreview: string[] = [];
  if (packBuffs.regen) packPreview.push(`+${packBuffs.regen} реген/мин`);
  if (packBuffs.healPct) packPreview.push(`+${(packBuffs.healPct * 100).toFixed(0)}% хил`);
  if (packBuffs.legPct) packPreview.push(`+${(packBuffs.legPct * 100).toFixed(0)}% легендарка`);
  if (packBuffs.expPct) packPreview.push(`+${Math.round(packBuffs.expPct * 100)}% опыт`);
  if (packBuffs.chipsPct) packPreview.push(`+${Math.round(packBuffs.chipsPct * 100)}% чипы`);
  if (packBuffs.dmgTakenMult < 1) packPreview.push(`−${Math.round((1 - packBuffs.dmgTakenMult) * 100)}% урон`);
  if (packBuffs.returnMult < 1) packPreview.push(`−${Math.round((1 - packBuffs.returnMult) * 100)}% возврат`);

  const stepPack = (name: string, delta: number, have: number) => {
    setPack((prev) => {
      const cur = prev[name] || 0;
      const next = Math.max(0, Math.min(have, cur + delta));
      if (next === cur) return prev;
      const nextState = { ...prev };
      if (next === 0) delete nextState[name];
      else nextState[name] = next;
      return nextState;
    });
  };

  const go = useCallback(async () => {
    if (!selectedZone || !card || starting) return;
    setStarting(true);
    const list = Object.entries(pack)
      .filter(([, q]) => q > 0)
      .map(([name, qty]) => ({ name, qty }));
    await startExploration(selectedZone, hours, true, list, card.difficulty, card.modifier);
    setStarting(false);
    navigate(`/explore?zone=${encodeURIComponent(selectedZone)}`);
  }, [selectedZone, card, hours, pack, starting, startExploration, navigate]);

  // Активная вылазка — сразу в журнал рейда.
  useEffect(() => {
    if (isExploring) navigate('/explore');
  }, [isExploring, navigate]);

  if (isExploring) {
    return (
      <div className={styles.screen}>
        <div className={styles.columns} style={{ gridTemplateColumns: '1fr' }}>
          <div className={styles.panel}>
            <div className={styles.panelHead}><span>Журнал рейда</span></div>
            <div className={styles.panelBody} style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
                Отряд в пути — открываем журнал рейда…
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.zoneBadge} style={{ color: '#fbbf24' }}>
            <span className={styles.zoneDot} />
            План рейда
          </div>
          <div className={styles.zoneSub}>
            Выбери зону и карточку рейда: сложность, характер и длительность.
          </div>
        </div>
      </div>

      <div className={styles.start}>
        {/* ---------- Зоны ---------- */}
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Зоны</span>
            <span style={{ color: 'var(--text-secondary)', letterSpacing: 0, textTransform: 'none' }}>
              {zones.length} шт.
            </span>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.zoneList}>
              {zones.map((z) => {
                const locked = LOCKED_ZONES.has(z.name);
                const active = selectedZone === z.name;
                return (
                  <div
                    key={z.name}
                    className={`${styles.zoneCard} ${active ? styles.zoneCardActive : ''} ${locked ? styles.zoneCardLocked : ''}`}
                    onClick={() => !locked && setSelectedZone(z.name)}
                  >
                    <div className={styles.zoneName}>
                      {z.name}
                      {locked && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔒</span>}
                    </div>
                    <div className={styles.zoneDesc}>{z.description}</div>
                    <div className={styles.zoneTags}>
                      <span className={styles.tag}>SL {z.difficulty}</span>
                      {z.allowedFactions.map((f) => (
                        <span key={f} className={styles.tag}>{f}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ---------- Карточки рейдов ---------- */}
            {selectedZone && (
              <div style={{ marginTop: 16 }}>
                <div className={styles.sectionTitle}>
                  Карточки рейдов
                  <span style={{ float: 'right', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    {cardsLoading ? 'загрузка…' : `обновление через ${fmtShort(cards[0]?.refreshIn ?? 600)}`}
                  </span>
                </div>
                {!cardsLoading && cards.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Карточки не пришли — обнови страницу.</div>
                )}
                <div className={styles.cardRow}>
                  {cards.map((c, i) => (
                    <div
                      key={c.id}
                      className={`${styles.tripCard} ${i === cardIdx ? styles.tripCardActive : ''}`}
                      style={{ ['--diffColor' as any]: c.difficultyColor }}
                      onClick={() => { setCardIdx(i); setHours(c.hours); }}
                    >
                      <div className={styles.tripCardDiff}>
                        <span style={{ fontSize: 18 }}>{c.difficultyIcon}</span>
                        <span style={{ color: c.difficultyColor }}>{c.difficultyName}</span>
                      </div>
                      <div className={styles.tripCardMod}>
                        <span>{c.modifierIcon}</span> {c.modifierName}
                      </div>
                      <div className={styles.tripCardDesc}>{c.modifierDesc}</div>
                      <div className={styles.tripCardMeta}>
                        <span>⏱ {c.hours} ч</span>
                        <span>урон ×{c.damageMult}</span>
                        <span>награда ×{c.rewardMult}</span>
                      </div>
                      <div className={styles.tripCardCap}>потолок: {c.qualityCap}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- План рейда ---------- */}
        <div className={`${styles.panel} ${styles.plan}`}>
          <div className={styles.panelHead}>
            <span>План рейда</span>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.planRow}>
              <span className={styles.planLabel}>Зона</span>
              <span className={styles.planValue}>{selectedZone ?? 'не выбрана'}</span>
            </div>
            {card && (
              <>
                <div className={styles.planRow}>
                  <span className={styles.planLabel}>Сложность</span>
                  <span className={styles.planValue} style={{ color: card.difficultyColor }}>
                    {card.difficultyIcon} {card.difficultyName}
                  </span>
                </div>
                <div className={styles.planRow}>
                  <span className={styles.planLabel}>Характер</span>
                  <span className={styles.planValue}>{card.modifierIcon} {card.modifierName}</span>
                </div>
                <div className={styles.planRow}>
                  <span className={styles.planLabel}>Урон / награда</span>
                  <span className={styles.planValue}>×{card.damageMult} / ×{card.rewardMult}</span>
                </div>
              </>
            )}

            <div style={{ padding: '8px 0' }}>
              <div className={styles.planRow} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <span className={styles.planLabel}>Длительность в зоне</span>
                <span className={styles.planValue}>{hours} ч</span>
              </div>
              <input
                className={styles.slider}
                type="range"
                min={2}
                max={24}
                step={1}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
              <div style={{ fontSize: 11, color: '#4ade80' }}>
                🏆 Бонус за полную зачистку: +{durationBonusPct(hours)}% к чипам и опыту
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                ≈ {Math.round((hours * 3600) / 1800)} крупных событий · дорога туда {fmtShort(TRAVEL_OUT_SEC)},
                {' '}обратно ≈ {fmtShort(TRAVEL_BACK_SEC * packBuffs.returnMult)}
              </div>
            </div>

            <div className={styles.sectionTitle}>Снаряжение рейда</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
              Материалы сгорают на старте и дают баффы на весь рейд. В пути ресурсы не тратятся.
            </div>

            {packMats.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                В инвентаре нет материалов — нечего взять.
              </div>
            ) : (
              <div style={{ maxHeight: 210, overflowY: 'auto', paddingRight: 2 }}>
                {packMats.map((m) => {
                  const sel = pack[m.name] || 0;
                  return (
                    <div key={m.name} className={styles.packRow}>
                      {m.img
                        ? <img className={styles.packImg} src={m.img} alt="" />
                        : <span style={{ fontSize: 16, width: 26, textAlign: 'center' }}>📦</span>}
                      <div className={styles.packInfo}>
                        <div className={styles.packName}>{m.name}</div>
                        <div className={styles.packHint}>{packBonusText(m.name, sel)}</div>
                      </div>
                      <div className={styles.packCtr}>
                        <button className={`${styles.packBtn} ${styles.packMinus}`} onClick={() => stepPack(m.name, -1, m.have)}>−</button>
                        <span>{sel}/{m.have}</span>
                        <button className={`${styles.packBtn} ${styles.packPlus}`} onClick={() => stepPack(m.name, 1, m.have)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {packPreview.length > 0 && (
              <div className={styles.previewBox} style={{ marginTop: 10 }}>
                🎒 Баффы рейда: {packPreview.join(' · ')}
              </div>
            )}

            <button className={styles.cta} disabled={!selectedZone || !card || starting} onClick={go}>
              {starting ? '⏳ Выдвигаемся…' : '🚀  ВЫДВИНУТЬСЯ'}
            </button>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelHead}><span>История путешествий</span></div>
          <div className={styles.panelBody} style={{ maxHeight: 200 }}>
            {history.slice(0, 10).map((h) => (
              <div key={h.id} className={styles.historyRow}>
                <span>{h.outcome === 'dead' ? '💀' : h.outcome === 'cancelled' ? '🛑' : '🏁'}</span>
                <b>{h.zone}</b>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                  💾{h.total_chips} ⚡{h.total_exp} 📦{h.total_items}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {Math.round(h.duration_seconds / 60)} мин
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Зеркало durationBonusPct() из api/exploration/engine_config.php. */
const durationBonusPct = (hours: number) =>
  hours >= 18 ? 100 : hours >= 12 ? 60 : hours >= 6 ? 30 : 10;
