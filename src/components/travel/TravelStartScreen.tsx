import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExplorationStore, calcConsBuffs } from '../../stores/explorationStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useAuthStore } from '../../stores/authStore';
import { ZONES } from '../../data/zones';
import { TRAVEL_OUT_SEC, TRAVEL_BACK_SEC } from '../../data/travelTuning';
import { getItemImage } from '../../assets/index';
import styles from './travel.module.css';

/** Секунды → «2 мин» / «45с». */
const fmtShort = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} с`;
  const m = Math.round(s / 60);
  return `${m} мин`;
};

const LOCKED_ZONES = new Set([
  'Болото', 'Свалка мусора', 'Темный лес',
  'База бандитов', 'Руины города', 'Старый завод',
]);

/** Только материалы для базы/рейда (остальное в рюкзак не берём). */
const BASE_PACK_MATS = [
  'Батарейки', 'Вода', 'Гвозди', 'Дерево', 'Железо', 'Изолента',
  'Инструменты', 'Консервы', 'Лекарства', 'Пластмасса', 'Топливо',
];

/** Зеркало durationBonusPct() из api/exploration/engine_config.php. */
const durationBonusPct = (hours: number) =>
  hours >= 18 ? 100 : hours >= 12 ? 60 : hours >= 6 ? 30 : 10;

const ZONE_COLORS: Record<string, string> = {
  'zone-base': '#818cf8',
  'zone-swamp': '#4ade80',
  'zone-factory': '#fb923c',
  'zone-forest': '#34d399',
  'zone-military': '#f87171',
  'zone-market': '#fbbf24',
  'zone-cars': '#a78bfa',
  'zone-dump': '#94a3b8',
  'zone-village': '#60a5fa',
};

/** Что даёт материал: зеркало expeditionBuffs() (превью в рейд-UI). */
const packBonusText = (name: string, qty: number): string => {
  // Пока ничего не берём — показываем только суть бонуса, без «→ −0%».
  const tail = (v: string) => (qty > 0 ? ` → ${v}` : '');
  switch (name) {
    case 'Лекарства': return `+1 реген/шт (макс +10)${tail(`+${Math.min(qty, 10)}`)}`;
    case 'Вода':
    case 'Консервы': return `+0.1% хил/шт (макс +5%)${tail(`+${(Math.min(qty, 50) * 0.1).toFixed(1)}%`)}`;
    case 'Батарейки': return `+0.1% шанс легендарки (макс +3%)${tail(`+${(Math.min(qty, 30) * 0.1).toFixed(1)}%`)}`;
    case 'Дерево':
    case 'Гвозди': return `+0.2% опыта (макс +10%)${tail(`+${(Math.min(qty, 50) * 0.2).toFixed(1)}%`)}`;
    case 'Инструменты':
    case 'Пластмасса': return `+0.2% чипов (макс +10%)${tail(`+${(Math.min(qty, 50) * 0.2).toFixed(1)}%`)}`;
    case 'Изолента':
    case 'Железо': return `−1% входящего урона (макс −20%)${tail(`−${Math.min(qty, 20)}%`)}`;
    case 'Топливо': return `−5% времени возврата (макс −50%)${tail(`−${Math.min(qty, 10) * 5}%`)}`;
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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const TravelStartScreen = () => {
  const navigate = useNavigate();
  const isExploring = useExplorationStore((s) => s.isExploring);
  const startExploration = useExplorationStore((s) => s.startExploration);
  const token = useAuthStore((s) => s.token);
  const materials = useInventoryStore((s) => s.items);

  const [selected, setSelected] = useState<string | null>(null);
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

  const zones = useMemo(
    () => ZONES.filter((z) => z.name !== 'Наша база' && z.name !== 'Базар'),
    [],
  );
  const zone = zones.find((z) => z.name === selected) ?? null;

  const packMats = useMemo(() => {
    const map = new Map<string, { name: string; have: number; img?: string }>();
    for (const it of materials) {
      if (it.type !== 'material') continue;
      if (!BASE_PACK_MATS.includes(it.name)) continue;
      const qty = it.quantity || 1;
      const cur = map.get(it.name);
      if (cur) cur.have += qty;
      else map.set(it.name, { name: it.name, have: qty, img: getItemImage(it.name) });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [materials]);

  const packBuffs = calcConsBuffs(pack);
  const packPreview: string[] = [];
  if (packBuffs.regen > 0) packPreview.push(`+${packBuffs.regen} реген`);
  if (packBuffs.healPct > 0) packPreview.push(`+${(packBuffs.healPct * 100).toFixed(1)}% хил`);
  if (packBuffs.legPct > 0) packPreview.push(`+${(packBuffs.legPct * 100).toFixed(1)}% легендарка`);
  if (packBuffs.expPct > 0) packPreview.push(`+${Math.round(packBuffs.expPct * 100)}% опыт`);
  if (packBuffs.chipsPct > 0) packPreview.push(`+${Math.round(packBuffs.chipsPct * 100)}% чипы`);
  if (packBuffs.dmgTakenMult < 1) packPreview.push(`−${Math.round((1 - packBuffs.dmgTakenMult) * 100)}% урон`);
  if (packBuffs.returnMult < 1) packPreview.push(`−${Math.round((1 - packBuffs.returnMult) * 100)}% возврат`);

  // Прогноз рейда: чем дольше и опаснее зона — тем выше риск и доход.
  const sl = zone?.difficulty ?? 0;
  const slNorm = clamp01(sl / 25);
  const timeNorm = clamp01(hours / 24);
  const risk = clamp01(0.08 + 0.55 * slNorm + 0.37 * timeNorm);
  const reward = clamp01(0.18 + 0.5 * slNorm + 0.32 * timeNorm);
  const estEvents = Math.round((hours * 3600) / 1800);
  const estFinds = Math.round(estEvents * 0.45);

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

  const go = async () => {
    if (!zone || starting) return;
    setStarting(true);
    const list = Object.entries(pack)
      .filter(([, q]) => q > 0)
      .map(([name, qty]) => ({ name, qty }));
    await startExploration(zone.name, hours, true, list);
    setStarting(false);
    navigate(`/explore?zone=${encodeURIComponent(zone.name)}`);
  };

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
            Выбери зону, длительность и снаряжение — остальное сделает отряд.
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
                const active = selected === z.name;
                const color = ZONE_COLORS[z.className] ?? '#818cf8';
                const zRisk = clamp01(0.08 + 0.55 * clamp01(z.difficulty / 25) + 0.37 * timeNorm);
                const zReward = clamp01(0.18 + 0.5 * clamp01(z.difficulty / 25) + 0.32 * timeNorm);
                return (
                  <div
                    key={z.name}
                    className={`${styles.zoneCard} ${active ? styles.zoneCardActive : ''} ${locked ? styles.zoneCardLocked : ''}`}
                    style={{ ['--zoneColor' as any]: color }}
                    onClick={() => !locked && setSelected(z.name)}
                  >
                    <div className={styles.zoneName} style={{ color }}>
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
                    <div className={styles.meter}>
                      <div className={styles.meterLabel}>
                        <span>Риск</span>
                        <span>{Math.round(zRisk * 100)}%</span>
                      </div>
                      <div className={styles.meterTrack}>
                        <div
                          className={styles.meterFill}
                          style={{ width: `${zRisk * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#f87171)' }}
                        />
                      </div>
                    </div>
                    <div className={styles.meter}>
                      <div className={styles.meterLabel}>
                        <span>Награда</span>
                        <span>{Math.round(zReward * 100)}%</span>
                      </div>
                      <div className={styles.meterTrack}>
                        <div
                          className={styles.meterFill}
                          style={{ width: `${zReward * 100}%`, background: 'linear-gradient(90deg,#22c55e,#fbbf24)' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
              <span className={styles.planValue} style={{ color: zone ? (ZONE_COLORS[zone.className] ?? '#fff') : 'var(--text-muted)' }}>
                {zone ? zone.name : 'не выбрана'}
              </span>
            </div>

            <div className={styles.planRow}>
              <span className={styles.planLabel}>Прогноз</span>
              <span className={styles.planValue}>
                риск {Math.round(risk * 100)}% · награда {Math.round(reward * 100)}%
              </span>
            </div>

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
                ≈ {estEvents} крупных событий · ≈ {estFinds} находок ·
                {' '}дорога туда {fmtShort(TRAVEL_OUT_SEC)}, обратно ≈ {fmtShort(Math.round(TRAVEL_BACK_SEC * packBuffs.returnMult))}
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
              <div style={{ maxHeight: 230, overflowY: 'auto', paddingRight: 2 }}>
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

            <button className={styles.cta} disabled={!zone || starting} onClick={go}>
              {starting ? '⏳ Выдвигаемся…' : '🚀  ВЫДВИНУТЬСЯ'}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- История ---------- */}
      {history.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelHead}><span>История путешествий</span></div>
          <div className={styles.panelBody} style={{ maxHeight: 220 }}>
            {history.slice(0, 12).map((h) => (
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
