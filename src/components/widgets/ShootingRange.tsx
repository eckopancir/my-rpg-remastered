import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WapHeader } from '../ui/WapHeader';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { playCombatSound } from '../../hooks/useSound';
import { calculateCombatResult, calcPureDamage, shotKindForPlayerWeapon } from '../../stores/combatGridStore';
import { calcExtraShots } from '../../utils/itemPower';
import mannequinImg from '../../assets/images/ui/mannequin.png';
import bulletholeImg from '../../assets/images/ui/bullethole.png';
import crosshairImg from '../../assets/images/ui/pricel.png';

interface Props {
  onClose: () => void;
}

interface FloatNum {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: 'dmg' | 'crit' | 'miss' | 'block' | 'info';
}

interface Decal {
  id: number;
  x: number;
  y: number;
  rot: number;
}

interface LogEntry {
  id: number;
  text: string;
  kind: FloatNum['kind'];
}

interface DummyCfg {
  hp: number;
  armor: number;
  evasionPct: number;
  block: number;
}

type FactionId = 'none' | 'Мутанты' | 'Роботы' | 'Бандиты' | 'Военные';

const FACTIONS: { id: FactionId; label: string }[] = [
  { id: 'none', label: 'Физика' },
  { id: 'Мутанты', label: 'Мутанты' },
  { id: 'Роботы', label: 'Роботы' },
  { id: 'Бандиты', label: 'Бандиты' },
  { id: 'Военные', label: 'Военные' },
];

const RELOAD_MS = 1500;
const MAX_DECALS = 5;
const SHOT_SOUNDS = ['shot1', 'shot2'];

const FLOAT_COLORS: Record<FloatNum['kind'], { color: string; size: number }> = {
  dmg: { color: '#f87171', size: 18 },
  crit: { color: '#fbbf24', size: 22 },
  miss: { color: '#94a3b8', size: 15 },
  block: { color: '#60a5fa', size: 15 },
  info: { color: '#4ade80', size: 15 },
};

const round1 = (v: number) => Math.round(v * 10) / 10;

export const ShootingRange = ({ onClose }: Props) => {
  const stats = usePlayerStore((s) => s.stats);
  const showDmgNums = useUiStore((s) => s.showDamageNumbers !== false);
  // Магазин — из активного оружия, как в арене.
  const weapon2 = usePlayerStore((s) => s.getActiveWeapon());
  const magSize = weapon2?.ammoCapacity || 30;

  const [cfg, setCfg] = useState<DummyCfg>({ hp: 250000, armor: 25, evasionPct: 0, block: 0 });
  const [faction, setFaction] = useState<FactionId>('none');
  const [hp, setHp] = useState(250000);
  const [ammo, setAmmo] = useState(magSize);
  const [reloading, setReloading] = useState(false);
  const [decals, setDecals] = useState<Decal[]>([]);
  const [floats, setFloats] = useState<FloatNum[]>([]);
  const [battleLog, setBattleLog] = useState<LogEntry[]>([]);
  const [hitSeq, setHitSeq] = useState(0);
  const [dead, setDead] = useState(false);
  const [totals, setTotals] = useState({ shots: 0, dmg: 0, crits: 0 });
  const [cross, setCross] = useState<{ x: number; y: number } | null>(null);
  const [shotAlt, setShotAlt] = useState(0);
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, (window.innerWidth - 1080) / 2),
    y: 24,
  }));

  const idRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; startPosX: number; startPosY: number }>({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach((t) => window.clearTimeout(t)); };
  }, []);

  // Смена оружия (или его вместимости) — полный магазин нового размера.
  useEffect(() => {
    setAmmo(magSize);
    setReloading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magSize]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [battleLog]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 300, dragRef.current.startPosX + e.clientX - dragRef.current.startX));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPosY + e.clientY - dragRef.current.startY));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startPosX = pos.x;
    dragRef.current.startPosY = pos.y;
    e.preventDefault();
  }, [pos]);

  const later = (ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const pushFloat = (x: number, y: number, text: string, kind: FloatNum['kind']) => {
    const id = ++idRef.current;
    setFloats((prev) => [...prev.slice(-11), { id, x, y, text, kind }]);
    later(1000, () => setFloats((prev) => prev.filter((f) => f.id !== id)));
  };

  const pushLog = (text: string, kind: LogEntry['kind']) => {
    const id = ++idRef.current;
    // Размер лога — из настроек.
    const logSize = useUiStore.getState().battleLogSize ?? 20;
    setBattleLog((prev) => [...prev.slice(-(logSize - 1)), { id, text, kind }]);
  };

  const resetDummy = () => {
    setHp(cfg.hp);
    setDecals([]);
    setFloats([]);
    setBattleLog([]);
    setDead(false);
    setTotals({ shots: 0, dmg: 0, crits: 0 });
    setAmmo(magSize);
    setReloading(false);
  };

  const startReload = () => {
    setReloading(true);
    playCombatSound('reloading', 0.24, 'range');
    pushFloat(50, 60, '🔁 ПЕРЕЗАРЯДКА…', 'info');
    pushLog('🔁 Перезарядка…', 'info');
    later(RELOAD_MS, () => {
      setAmmo(magSize);
      setReloading(false);
    });
  };

  // Физа идёт через формулу одна; стихия манекена — чистым уроном поверх
  // (мимо брони/блока/уворота; крит умножает всю сумму; промах гасит всё).
  const pureFaction = faction === 'none' ? undefined : faction;
  const pureDps = calcPureDamage(stats, pureFaction);

  // Эффективный шанс уклонения с учётом пробития меткостью (как в арене):
  // меткость >100% частично гасит уворот, 200% — гасит полностью.
  const effEvasionPct = (() => {
    const eva = Math.max(0, Math.min(1, cfg.evasionPct / 100));
    const acc = stats.accuracy || 0;
    if (acc >= 2) return 0;
    if (acc > 1) return eva * (2 - acc);
    return eva;
  })();

  const handleShot = (e: React.MouseEvent) => {
    if (reloading || dead) return;
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Паритет с BATTLE-ареной: стамина, малокалиберный бонус, доп. выстрелы
    // от скорости, вампиризм-хил, звук класса оружия.
    const pshot = shotKindForPlayerWeapon();
    const snd = pshot.sound || SHOT_SOUNDS[shotAlt % SHOT_SOUNDS.length];
    setShotAlt((v) => v + 1);

    let dps = stats.damage || 0;
    if (stats.stamina < 0.1 * (stats.maxStamina || 100)) dps *= 0.5;
    if ((magSize || 30) <= 3) dps *= 1.3;
    const shots = 1 + calcExtraShots(stats.speed || 0);

    const attackerStats = {
      dps,
      pure: pureDps,
      crit: stats.crit,
      accuracy: stats.accuracy,
      punching: stats.punching,
      vampir: stats.vampir,
      isPlayer: true,
    };
    const targetStats = {
      armor: cfg.armor,
      evasion: Math.max(0, Math.min(1, cfg.evasionPct / 100)),
      block: cfg.block,
    };

    let a = ammo;
    let h = hp;
    let dealtTotal = 0;
    let shotCount = 0;
    let critCount = 0;
    let healTotal = 0;

    for (let sIdx = 0; sIdx < shots; sIdx++) {
      if (a <= 0 || h <= 0) break;
      a -= 1;
      playCombatSound(snd, 0.27, 'range');
      const result = calculateCombatResult(attackerStats, targetStats);
      shotCount += 1;

      if (result.type === 'CRIT') {
        playCombatSound('crit', 0.27, 'range');
        critCount += 1;
      } else if (result.type === 'BLOCK') {
        playCombatSound('block', 0.24, 'range');
      }
      dealtTotal += result.damage;

      const kind: FloatNum['kind'] =
        result.type === 'CRIT' ? 'crit'
        : result.type === 'BLOCK' ? 'block'
        : result.type === 'MISS' || result.type === 'EVASION' ? 'miss'
        : 'dmg';
      const tag = shots > 1 ? ` [${sIdx + 1}/${shots}]` : '';
      if (kind === 'info' || showDmgNums) pushFloat(x + sIdx * 1.5, Math.max(4, y - 4), result.text, kind);
      pushLog(`#${totals.shots + shotCount}${tag} ${result.text}`, kind);

      // Вампиризм лечит стрелка (видно в бою) — показываем и тут.
      const hv = Math.round(result.damage * (stats.vampir || 0));
      if (hv > 0) healTotal += hv;

      // След от выстрела: максимум 5, новый вытесняет старый.
      const decalId = ++idRef.current;
      const rot = Math.floor(Math.random() * 360);
      setDecals((prev) => [...prev.slice(-(MAX_DECALS - 1)), { id: decalId, x, y, rot }]);
    }

    // Отдача манекена: дёргание в сторону с возвратом.
    if (shotCount > 0) setHitSeq((v) => v + 1);
    setAmmo(a);
    setTotals((t) => ({ shots: t.shots + shotCount, dmg: t.dmg + dealtTotal, crits: t.crits + critCount }));
    const newHp = Math.max(0, h - dealtTotal);
    setHp(newHp);
    if (healTotal > 0) {
      usePlayerStore.setState((st: any) => ({
        stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + healTotal) },
      }));
      pushFloat(x, Math.max(4, y - 10), `+${healTotal} 🩸`, 'info');
      pushLog(`🩸 Вампиризм: +${healTotal} HP тебе`, 'info');
    }
    if (newHp <= 0 && dealtTotal > 0) {
      setDead(true);
      playCombatSound('wilhelm_scream', 0.15, 'range');
      pushFloat(50, 30, '💀 МАНЕКЕН УНИЧТОЖЕН', 'crit');
      pushLog('💀 Манекен уничтожен', 'crit');
    }

    if (a <= 0 && newHp > 0) startReload();
  };

  const hpPct = cfg.hp > 0 ? Math.max(0, Math.min(100, (hp / cfg.hp) * 100)) : 0;

  // Текущий билд одной строкой для панели статов.
  const buildDps = Math.max(
    stats.damage || 0,
    stats.dpsEmi || 0,
    stats.dpsToxis || 0,
    stats.dpsExtro || 0,
    stats.dpsFire || 0,
  );
  const critChancePct = Math.min(100, Math.round((stats.crit || 0) * 100));

  // Степпер с ручным вводом: значение — инпут, коммит по Enter/blur, Esc — отмена.
  const StepperField = ({
    label, value, step, min, max, format, onCommit,
  }: {
    label: string; value: number; step: number; min: number; max: number;
    format: (v: number) => string; onCommit: (v: number) => void;
  }) => {
    const [draft, setDraft] = useState<string | null>(null);
    useEffect(() => { setDraft(null); }, [value]);
    const commit = () => {
      if (draft === null) return;
      const num = parseFloat(draft.replace(',', '.').replace(/[^\d.\-]/g, ''));
      if (Number.isFinite(num)) onCommit(round1(Math.max(min, Math.min(max, num))));
      setDraft(null);
    };
    const btn: React.CSSProperties = {
      flex: '0 0 34px', padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontSize: 15, fontWeight: 700,
      border: '1px solid rgba(217,119,6,0.5)', background: 'linear-gradient(180deg, rgb(180,100,10), rgb(120,60,8))',
      color: '#fff', lineHeight: 1,
    };
    return (
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
          <button onClick={() => onCommit(round1(Math.max(min, Math.min(max, value - step))))} style={btn}>−</button>
          <input
            value={draft ?? format(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setDraft(null);
            }}
            inputMode="decimal"
            title="Можно вписать число вручную"
            style={{
              flex: 1, minWidth: 0, textAlign: 'center',
              fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
              padding: '6px 2px', outline: 'none',
            }}
          />
          <button onClick={() => onCommit(round1(Math.max(min, Math.min(max, value + step))))} style={btn}>+</button>
        </div>
      </div>
    );
  };

  const commitCfg = (key: keyof DummyCfg, v: number) => {
    setCfg((prev) => {
      if (key === 'hp') setHp(v);
      return { ...prev, [key]: v };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 2000, userSelect: 'none' }}
    >
      <WapHeader title="🎯 SHOOTING RANGE" glow="amber" onMouseDown={onMouseDown}
        style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-mono)', padding: '0 4px' }}>
          🔫 {reloading ? '···' : `${ammo}/${magSize}`}
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); resetDummy(); }}
          title="Сбросить манекен"
          style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', padding: '0 4px' }}
        >
          ↺
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}
        >
          ✕
        </span>
      </WapHeader>

      <div style={{
        background: 'linear-gradient(180deg, rgb(20,12,8), rgb(10,8,5))',
        border: '2px solid rgba(217,119,6,0.2)',
        borderRadius: '0 0 8px 8px',
        boxShadow: '0 0 0 1px rgba(217,119,6,0.3), 0 12px 48px rgba(0,0,0,0.6)',
        padding: 16,
        display: 'flex', gap: 16, width: 1060, maxWidth: '96vw',
      }}>
        {/* LEFT: конфиг манекена */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--text-muted)' }}>ВРАГ-МАНЕКЕН</div>
          <StepperField label="HP" value={cfg.hp} step={5000} min={1} max={10000000}
            format={(v) => Math.round(v).toLocaleString()} onCommit={(v) => commitCfg('hp', v)} />
          <StepperField label="БРОНЯ" value={cfg.armor} step={10} min={0} max={100000}
            format={(v) => Math.round(v).toLocaleString()} onCommit={(v) => commitCfg('armor', v)} />
          <StepperField label="УКЛОНЕНИЕ, %" value={cfg.evasionPct} step={5} min={0} max={100}
            format={(v) => String(Math.round(v))} onCommit={(v) => commitCfg('evasionPct', v)} />
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: -6 }}>
            По факту сработает: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(effEvasionPct * 100)}%
            </b>{(stats.accuracy || 0) >= 2 && ' (меткость 200% пробивает уворот полностью)'}
          </div>
          <StepperField label="БЛОК (0–3)" value={cfg.block} step={0.5} min={0} max={3}
            format={(v) => String(round1(v))} onCommit={(v) => commitCfg('block', v)} />
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>ТИП МАНЕКЕНА</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FACTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFaction(f.id)}
                  style={{
                    padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                    border: `1px solid ${faction === f.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}`,
                    background: faction === f.id ? 'rgba(217,119,6,0.15)' : 'transparent',
                    color: faction === f.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
              Урон: <b style={{ color: '#f87171', fontFamily: 'var(--font-mono)' }}>
                {Math.round(physDps).toLocaleString()} физ. + {Math.round(pureDps).toLocaleString()} чист.
                {' = '}{Math.round(physDps + pureDps).toLocaleString()}
              </b>
            </div>
          </div>
          <div style={{
            marginTop: 0, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            <div>Выстрелов: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{totals.shots}</b></div>
            <div>Суммарно: <b style={{ color: '#f87171', fontFamily: 'var(--font-mono)' }}>{totals.dmg.toLocaleString()}</b></div>
            <div>Критов: <b style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{totals.crits}</b></div>
            <div>Средний: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {totals.shots > 0 ? Math.round(totals.dmg / totals.shots).toLocaleString() : '—'}
            </b></div>
          </div>
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>МОЙ БИЛД</div>
            <div>Оружие: <b style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }} title={weapon2?.name || 'Без оружия'}>
              {(weapon2?.name || '—').length > 22 ? `${(weapon2?.name || '—').slice(0, 21)}…` : (weapon2?.name || '—')} ({magSize})
            </b></div>
            <div>DPS: <b style={{ color: '#f87171', fontFamily: 'var(--font-mono)' }}>{Math.round(buildDps).toLocaleString()}</b></div>
            <div>Крит: <b style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{critChancePct}%</b></div>
            <div>Меткость: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((stats.accuracy || 0) * 100)}%</b></div>
            <div>Пробитие: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Number((stats.punching || 0).toFixed(3))}</b></div>
            <div>Вампиризм: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((stats.vampir || 0) * 100)}%</b></div>
          </div>
        </div>

        {/* CENTER: мишень (сдвинута влево логом) */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 14, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${hpPct}%`, borderRadius: 7,
                background: hpPct > 50 ? 'linear-gradient(90deg,#16a34a,#4ade80)' : hpPct > 20 ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#dc2626,#f87171)',
                transition: 'width 150ms',
              }} />
            </div>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {Math.round(hp).toLocaleString()} / {Math.round(cfg.hp).toLocaleString()}
            </span>
          </div>

          <div
            ref={boxRef}
            onClick={handleShot}
            onMouseMove={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setCross({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setCross(null)}
            style={{
              position: 'relative', width: '100%', height: 540,
              background: 'radial-gradient(ellipse at center, rgba(60,40,25,0.55), rgba(0,0,0,0.55))',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
              overflow: 'hidden', cursor: 'none',
            }}
          >
            {/* Обёртка центрирует, анимируется только внутренний блок:
                иначе framer-motion своим transform затрёт translate(-50%,-50%) */}
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 360, height: 470, transform: 'translate(-50%, -50%)',
            }}>
            <motion.div
              key={hitSeq}
              initial={{ x: 0 }}
              animate={{ x: [0, -8, 5, -2, 0] }}
              transition={{ duration: 0.28 }}
              style={{ width: '100%', height: '100%' }}
            >
              <img
                src={mannequinImg}
                alt="Манекен"
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', opacity: dead ? 0.45 : 1 }}
              />
            </motion.div>
            </div>

            {decals.map((d) => (
              <img
                key={d.id}
                src={bulletholeImg}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute', left: `${d.x}%`, top: `${d.y}%`,
                  width: 32, height: 32, transform: `translate(-50%, -50%) rotate(${d.rot}deg)`,
                  pointerEvents: 'none', opacity: 0.92,
                }}
              />
            ))}

            <AnimatePresence>
              {floats.map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 1, y: 0, scale: f.kind === 'crit' ? 1.15 : 1 }}
                  animate={{ opacity: 0, y: -48 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', left: `${f.x}%`, top: `${f.y}%`,
                    transform: 'translate(-50%, -50%)', pointerEvents: 'none',
                    fontSize: FLOAT_COLORS[f.kind].size, fontWeight: 800,
                    color: FLOAT_COLORS[f.kind].color,
                    textShadow: '0 2px 6px rgba(0,0,0,0.9)', whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {f.text}
                </motion.div>
              ))}
            </AnimatePresence>

            {cross && !dead && (
              <img
                src={crosshairImg}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute', left: cross.x, top: cross.y,
                  width: 58, height: 58, transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none', opacity: 0.95,
                }}
              />
            )}

            {dead && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', pointerEvents: 'none',
              }}>
                <span style={{
                  fontSize: 20, fontWeight: 800, color: '#fbbf24',
                  textShadow: '0 2px 10px rgba(0,0,0,0.9)',
                  background: 'rgba(0,0,0,0.55)', padding: '8px 18px', borderRadius: 8,
                }}>
                  💀 МАНЕКЕН УНИЧТОЖЕН — жми «Сбросить»
                </span>
              </div>
            )}

            {reloading && (
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                fontSize: 12, fontWeight: 700, color: '#fbbf24',
                background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 6,
                pointerEvents: 'none',
              }}>
                🔁 ПЕРЕЗАРЯДКА…
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Кликай по манекену — урон считается формулой арены по выбранному пулу
          </div>
        </div>

        {/* RIGHT: лог боя */}
        <div style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--text-muted)' }}>📜 ЛОГ БОЯ</div>
          <div
            ref={logRef}
            style={{
              flex: 1, minHeight: 200, maxHeight: 560, overflowY: 'auto',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '8px 10px',
              display: 'flex', flexDirection: 'column', gap: 3,
              fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.5,
            }}
          >
            {battleLog.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Пока тихо… стреляй.</div>
            )}
            {battleLog.map((e) => (
              <div key={e.id} style={{ color: FLOAT_COLORS[e.kind].color, overflowWrap: 'break-word' }}>
                {e.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
