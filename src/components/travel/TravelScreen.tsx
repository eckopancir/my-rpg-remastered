import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExplorationStore } from '../../stores/explorationStore';
import { ItemTooltip } from '../widgets/ItemTooltip';
import { ZONES } from '../../data/zones';
import { PartyPanel } from './PartyPanel';
import { RouteTimeline } from './RouteTimeline';
import { EventFeed } from './EventFeed';
import { LootSummary } from './LootSummary';
import { adaptEvent, parseServerTs } from './adaptEvent';
import { difficultyTraits, modifierTraits } from '../../data/travelModes';
import type { TravelRewardItem } from '../../types/travel';
import styles from './travel.module.css';

const DIFF_NAMES: Record<string, string> = {
  normal: 'Обычная',
  hard: 'Сложная',
  danger: 'Опасная',
  nightmare: 'Кошмар',
  hell: 'Ад на земле',
};
const DIFF_ICONS: Record<string, string> = {
  normal: '⚪', hard: '🟢', danger: '🔵', nightmare: '🟣', hell: '🔥',
};
const DIFF_COLORS: Record<string, string> = {
  normal: '#e2e8f0', hard: '#4ade80', danger: '#60a5fa', nightmare: '#a78bfa', hell: '#f87171',
};
const MOD_NAMES: Record<string, string> = {
  night: 'Ночь', silence: 'Тишина', ambush: 'Засада', fog: 'Туман', wind: 'Ветер',
  gnats: 'Мошка', lowtide: 'Отлив', frost: 'Стужа', plague: 'Заражение',
  compass: 'Компас', trail: 'Тропа', traps: 'Ловушки',
};
const MOD_ICONS: Record<string, string> = {
  night: '🌙', silence: '🤫', ambush: '🚧', fog: '🌫', wind: '🌪', gnats: '🦟',
  lowtide: '🌊', frost: '❄️', plague: '☣', compass: '🧭', trail: '⛰', traps: '🪤',
};

/** Акцентный цвет зоны — по её классу из data/zones. */const ZONE_COLORS: Record<string, string> = {
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

const zoneColorOf = (zoneName: string | null): string => {
  const z = ZONES.find((x) => x.name === zoneName);
  return ZONE_COLORS[z?.className ?? ''] ?? '#818cf8';
};

const PHASE_TEXT: Record<string, string> = {
  travel_out: '🚀 Путь туда',
  exploring: '🔍 Исследование',
  travel_back: '🏠 Путь обратно',
  complete: '✅ Завершено',
};

export const TravelScreen = () => {
  const navigate = useNavigate();
  const isExploring = useExplorationStore((s) => s.isExploring);
  const zoneName = useExplorationStore((s) => s.zoneName);
  const phase = useExplorationStore((s) => s.phase);
  const timeLeft = useExplorationStore((s) => s.timeLeft);
  const plannedSec = useExplorationStore((s) => s.plannedSec);
  const consBuffs = useExplorationStore((s) => s.consBuffs);
  const eventLog = useExplorationStore((s) => s.eventLog);
  const totalEvents = useExplorationStore((s) => s.totalEvents);
  const hasMoreEvents = useExplorationStore((s) => s.hasMoreEvents);
  const loadOlderEvents = useExplorationStore((s) => s.loadOlderEvents);
  const debtSec = useExplorationStore((s) => s.debtSec);
  const bulkMode = useExplorationStore((s) => s.bulkMode);
  const rewardItems = useExplorationStore((s) => s.eventRewardItems);
  const difficulty = useExplorationStore((s) => s.difficulty);
  const modifier = useExplorationStore((s) => s.modifier);
  const difficultyInfo = useExplorationStore((s) => s.difficultyInfo);
  const modifierInfo = useExplorationStore((s) => s.modifierInfo);

  const [tooltipItem, setTooltipItem] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const startTs = useMemo(() => {
    if (eventLog.length === 0) return Date.now();
    let min = Number.MAX_SAFE_INTEGER;
    for (const e of eventLog) {
      const t = parseServerTs(e.created_at);
      if (t < min) min = t;
    }
    return min === Number.MAX_SAFE_INTEGER ? Date.now() : min;
  }, [eventLog]);

  const events = useMemo(
    () =>
      eventLog.map((row) => {
        const ev = adaptEvent(row, {
          startTs,
          rewardItems: (rewardItems[row.id]?.items ?? []) as TravelRewardItem[],
        });
        return ev;
      }),
    [eventLog, startTs, rewardItems],
  );

  const hiddenCount = Math.max(0, (totalEvents || 0) - eventLog.length);
  const accent = zoneColorOf(zoneName);
  const phaseColor =
    phase === 'travel_back' ? '#fb923c' : phase === 'exploring' ? '#4ade80' : phase === 'complete' ? '#94a3b8' : '#60a5fa';

  // Нет активного рейда — показываем заглушку вместо пустых панелей.
  if (!isExploring && phase !== 'complete') {
    return (
      <div className={styles.screen}>
        <div className={styles.columns} style={{ gridTemplateColumns: '1fr' }}>
          <div className={styles.panel}>
            <div className={styles.panelHead}><span>Журнал рейда</span></div>
            <div className={styles.panelBody} style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>🧭</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                Активного путешествия нет
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
                Выбери зону, собери снаряжение и отправь отряд в путь.
              </div>
              <button
                className={`${styles.btn} ${styles.btnOk}`}
                style={{ maxWidth: 260, margin: '0 auto' }}
                onClick={() => navigate('/adventure')}
              >
                🗺 К плану рейда
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topbar} style={{ ['--accent' as any]: accent }}>
        <div>
          <div className={styles.zoneBadge} style={{ color: accent }}>
            <span className={styles.zoneDot} />
            {zoneName || 'Путешествие'}
          </div>
          <div className={styles.zoneSub}>
            {phase === 'exploring'
              ? `План: ${Math.round((plannedSec || 0) / 3600)} ч · события идут в реальном времени`
              : PHASE_TEXT[phase] ?? phase}
          </div>
        </div>

        {debtSec > 0 && (
          <div className={styles.debtNote}>
            ⏳ Догоняем пропущенное: ~{Math.floor(debtSec / 60)} мин
            {bulkMode === 'partial' ? ' (пакетная обработка…)' : ''}
          </div>
        )}

        <div className={styles.runBadges}>
          <span className={styles.runDiff} style={{ color: DIFF_COLORS[difficulty] ?? '#e2e8f0' }}>
            {DIFF_ICONS[difficulty] ?? '⚪'} {DIFF_NAMES[difficulty] ?? 'Обычная'}
          </span>
          {modifier && (
            <span className={styles.runMod}>
              {MOD_ICONS[modifier] ?? '•'} {MOD_NAMES[modifier] ?? modifier}
            </span>
          )}
        </div>

        <div className={styles.phasePill} style={{ color: phaseColor }}>
          {PHASE_TEXT[phase] ?? phase}
        </div>
      </div>

      <div className={styles.modeStrip}>
        <div
          className={styles.modeCard}
          style={{ ['--modeColor' as any]: difficultyInfo?.color ?? DIFF_COLORS[difficulty] ?? '#e2e8f0' }}
        >
          <div className={styles.modeHead}>
            <span className={styles.modeIcon}>{difficultyInfo?.icon ?? DIFF_ICONS[difficulty] ?? '⚪'}</span>
            <span className={styles.modeName}>{difficultyInfo?.name ?? DIFF_NAMES[difficulty] ?? 'Обычная'}</span>
            <span className={styles.modeTag}>сложность</span>
          </div>
          <div className={styles.traitRow}>
            {difficultyTraits(difficultyInfo).map((t) => (
              <span key={`d-${t.label}`} className={`${styles.trait} ${styles[`trait${t.tone === 'up' ? 'Up' : t.tone === 'down' ? 'Down' : 'Flat'}`]}`}>
                {t.label} <b>{t.value}</b>
              </span>
            ))}
          </div>
          {difficultyInfo?.desc && <div className={styles.modeDesc}>{difficultyInfo.desc}</div>}
        </div>

        {modifier && (
          <div
            className={styles.modeCard}
            style={{ ['--modeColor' as any]: modifierInfo?.color ?? '#a5b4fc' }}
          >
            <div className={styles.modeHead}>
              <span className={styles.modeIcon}>{modifierInfo?.icon ?? MOD_ICONS[modifier] ?? '•'}</span>
              <span className={styles.modeName}>{modifierInfo?.name ?? MOD_NAMES[modifier] ?? modifier}</span>
              <span className={styles.modeTag}>характер пути</span>
            </div>
            <div className={styles.traitRow}>
              {modifierTraits(modifierInfo).map((t) => (
                <span key={`m-${t.label}`} className={`${styles.trait} ${styles[`trait${t.tone === 'up' ? 'Up' : t.tone === 'down' ? 'Down' : 'Flat'}`]}`}>
                  {t.label} <b>{t.value}</b>
                </span>
              ))}
            </div>
            {modifierInfo?.desc && <div className={styles.modeDesc}>{modifierInfo.desc}</div>}
          </div>
        )}
      </div>

      <div className={styles.panel} style={{ padding: '8px 12px' }}>
        <RouteTimeline
          phase={phase}
          timeLeft={timeLeft}
          plannedSec={plannedSec}
          returnMult={consBuffs?.returnMult ?? 1}
        />
      </div>

      <div className={styles.columns}>
        <PartyPanel />

        <EventFeed
          events={events}
          hiddenCount={hiddenCount}
          onLoadOlder={hasMoreEvents ? () => void loadOlderEvents() : undefined}
          onItemHover={(item, e) => {
            setTooltipItem(item);
            setTooltipPos({ x: e.clientX, y: e.clientY });
          }}
          onItemMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
          onItemLeave={() => setTooltipItem(null)}
        />

        <LootSummary />
      </div>

      {tooltipItem && <ItemTooltip item={tooltipItem} x={tooltipPos.x} y={tooltipPos.y} />}
    </div>
  );
};
