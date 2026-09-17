import { getSniperImage } from '../../assets/index';
import type { SniperAbilityDef } from '../../data/sniper';
import { sniperRankText, SNIPER_META } from '../../data/sniper';

interface AbilityTooltipProps {
  def: SniperAbilityDef;
  /** текущий ранг (0 = превью) */
  rank: number;
  x: number;
  y: number;
  /** строка состояния: гейт/конфликт/доступно */
  statusLine?: { text: string; color: string };
  /** фактическая цена AP (со скидкой 6.2) */
  apCost?: number;
  /** подпись внизу (по умолчанию — про дерево навыков) */
  footerText?: string;
}

/** Тултип способности в стиле ItemTooltip: картинка тира, имя, ранги, эффект. */
export const AbilityTooltip = ({ def, rank, x, y, statusLine, apCost, footerText }: AbilityTooltipProps) => {
  const TOOLTIP_W = 360;
  const flipLeft = x + 16 + TOOLTIP_W > window.innerWidth;
  const tooltipX = flipLeft ? Math.max(8, x - TOOLTIP_W - 16) : x + 16;
  const tooltipY = Math.max(8, Math.min(y - 10, window.innerHeight - 340));
  const hex = SNIPER_META.color;
  const imgUrl = getSniperImage(def.img);
  const shown = Math.max(1, rank);

  return (
    <div
      style={{
        position: 'fixed', left: tooltipX, top: tooltipY, zIndex: 9999,
        width: 'fit-content', minWidth: 300, maxWidth: 360,
        background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.75), 0 2px 0 rgba(255,255,255,0.04) inset',
        pointerEvents: 'none',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ height: 3, background: hex, opacity: 0.95 }} />
      <div style={{ background: `linear-gradient(180deg, ${hex}26 0%, ${hex}14 32%, ${hex}07 58%, transparent 92%)`, position: 'relative' }}>
        {imgUrl && (
          <div style={{ textAlign: 'center', padding: '4px 14px 0', position: 'relative' }}>
            <img src={imgUrl} alt="" style={{ width: '100%', height: 150, objectFit: 'contain', padding: 4, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.6))' }} />
          </div>
        )}
        <div style={{ padding: '8px 14px 12px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: hex, lineHeight: 1.2, textShadow: '0 1px 0 rgba(0,0,0,0.6)', textAlign: 'center', whiteSpace: 'nowrap' }}>
            {def.name}
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
            {Array.from({ length: def.maxRanks }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 18, height: 6, borderRadius: 3,
                  background: i < rank ? hex : 'rgba(255,255,255,0.12)',
                  boxShadow: i < rank ? `0 0 6px ${hex}` : 'none',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span>Тир {def.tier}</span>
            <span>• {def.column === 'attack' ? 'Атака' : 'Защита'}</span>
            {(def.kind === 'active' || def.kind === 'ulta') && (apCost ?? def.apCost) > 0 ? <span>• {apCost ?? def.apCost}AP</span> : null}
            {def.cooldown > 0 ? <span>• КД {def.cooldown}</span> : null}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 14px 12px', maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>◇</span>
          <span style={{ flex: 1, color: 'rgba(255,255,255,0.82)' }}>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>{sniperRankText(def, shown)}</span>
          </span>
        </div>
        {rank < def.maxRanks && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>◇</span>
            <span style={{ flex: 1, color: 'rgba(255,255,255,0.82)' }}>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>След.: </span>
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>{sniperRankText(def, rank + 1)}</span>
            </span>
          </div>
        )}
        {def.mechanic && def.kind !== 'stat' && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.38)', fontStyle: 'italic', lineHeight: 1.4 }}>
            {def.mechanic}
          </div>
        )}
        {statusLine && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: statusLine.color }}>
            {statusLine.text}
          </div>
        )}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '10px 0 8px' }} />
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
          {footerText ?? 'Клик — вкачать · ПКМ — снять ожидание'}
        </div>
      </div>
    </div>
  );
};
