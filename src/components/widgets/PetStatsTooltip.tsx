export interface PetStatRow {
  label: string;
  value: string;
  /** прибавка от ветки (показывается зелёным +N) */
  bonus?: string;
}

/** Тултип характеристик питомца с учётом способностей из SKILLS. */
export const PetStatsTooltip = ({
  name, icon, color, rows, moodLine, x, y,
}: {
  name: string;
  icon: string;
  color: string;
  rows: PetStatRow[];
  moodLine?: { text: string; color: string };
  x: number;
  y: number;
}) => {
  const W = 280;
  const flipLeft = x + 16 + W > window.innerWidth;
  const tx = flipLeft ? Math.max(8, x - W - 16) : x + 16;
  const ty = Math.max(8, Math.min(y - 10, window.innerHeight - 320));
  return (
    <div style={{
      position: 'fixed', left: tx, top: ty, zIndex: 9999, width: W,
      background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 60%, #23272b 100%)',
      border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
      boxShadow: '0 16px 48px rgba(0,0,0,0.75)', pointerEvents: 'none',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ height: 3, background: color, opacity: 0.95, borderRadius: '10px 10px 0 0' }} />
      <div style={{ padding: '8px 14px 12px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color, textAlign: 'center' }}>
          {icon} {name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, lineHeight: 1.4 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-mono)' }}>
                {r.value}
                {r.bonus ? <span style={{ color: '#4ade80' }}> {r.bonus}</span> : null}
              </span>
            </div>
          ))}
        </div>
        {moodLine && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: moodLine.color, textAlign: 'center' }}>
            {moodLine.text}
          </div>
        )}
      </div>
    </div>
  );
};

/** Формат строки стата: доли — в %, плоские — как есть. */
export const fmtPetStat = (key: string, v: number): string => {
  if (['evasion', 'crit', 'vampir', 'speed', 'regen'].includes(key)) {
    const pct = v * 100;
    return `${pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%`;
  }
  return `${Math.round(v * 10) / 10}`;
};
