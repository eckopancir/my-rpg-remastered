import { getItemImage, images } from '../../assets/index';
import type { Item } from '../../types/items';
import { ABILITY_MAP } from '../../data/accessoryAbilities';
import { calcItemPower } from '../../utils/itemPower';
import { getSellPrice } from '../../utils/sellPrice';
import { SET_BONUSES } from '../../data/GameItems';
import { usePlayerStore } from '../../stores/playerStore';

interface ItemTooltipProps {
  item: Item;
  x: number;
  y: number;
}

const STAT_LABELS: Record<string, string> = {
  damage: 'Урон', crit: 'Крит. шанс', armor: 'Броня', regen: 'Регенерация',
  evasion: 'Уклонение', block: 'Блок', punching: 'Дробящий', accuracy: 'Точность',
  vampir: 'Вампиризм', speed: 'Скорость', health: 'Здоровье', maxHp: 'Макс. HP',
  stamina: 'Выносливость', dpsEmi: 'ЭМИ урон', dpsToxis: 'Токсичный урон',
  dpsExtro: 'Экстро урон', dpsFire: 'Огненный урон', luck: 'Удача',
};

const SLOT_LABELS: Record<string, string> = {
  weapon1: 'Оружие (холодное)', weapon2: 'Оружие (огнестрельное)',
  head: 'Шлем', armor: 'Броня', gloves: 'Перчатки', boots: 'Ботинки',
  ammo1: 'Патроны 1', ammo2: 'Патроны 2', ammo3: 'Патроны 3', ammo4: 'Патроны 4',
  any: 'Универсально',
  mod_scope: 'Прицел', mod_barrel: 'Ствол', mod_receiver: 'Ресивер',
  mod_muzzle: 'Дуло', mod_magazine: 'Магазин', mod_stock: 'Приклад',
  mod_blade: 'Лезвие', mod_handle: 'Рукоять', mod_pommel: 'Обух', mod_harness: 'Крепление',
  mod_lining: 'Подкладка', mod_hardshell: 'Накладка', mod_utility: 'Система', mod_patch: 'Усиление',
};

const QUALITY_STARS: Record<string, number> = {
  'Обычный': 1, 'Редкий': 2, 'Раритетный': 3, 'Эпический': 4,
  'Смертоносный': 5, 'Легендарный': 6, 'Божественный': 7,
};

const formatStat = (k: string, v: number): string => {
  const label = STAT_LABELS[k] || k;
  const absVal = Math.abs(v);
  const val = typeof v === 'number' ? (absVal >= 1 ? absVal.toFixed(1) : absVal.toFixed(3)) : v;
  if (v === 0) return '';
  const sign = v > 0 ? '+' : '-';
  return `${label}: ${sign}${val}`;
};

export const ItemTooltip = ({ item, x, y }: ItemTooltipProps) => {
  const tooltipX = Math.min(x + 16, window.innerWidth - 280);
  const tooltipY = Math.min(y - 10, window.innerHeight - 340);
  const imgUrl = getItemImage(item.name, item.displayName);
  const itemPower = calcItemPower(item);
  const equipment = usePlayerStore((s) => s.equipment);
  const equippedSetCount = item.set
    ? Object.values(equipment).filter((eq) => eq?.set === item.set).length
    : 0;

  return (
    <div
      style={{
        position: 'fixed', left: tooltipX, top: tooltipY, zIndex: 9999,
        width: 260,
        background: images.tooltip ? `url(${images.tooltip}) no-repeat center / 100% 100%, #12121a` : '#12121a',
        border: `1.5px solid ${item.qualityColor || '#818cf8'}`,
        borderRadius: 'var(--radius-md)',
        padding: 14,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 12px ${item.qualityColor || '#818cf8'}33`,
        pointerEvents: 'none',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {imgUrl && (
        <div style={{ textAlign: 'center', marginBottom: 10, position: 'relative' }}>
          <img src={imgUrl} alt="" style={{ width: 64, height: 64, objectFit: 'contain', imageRendering: 'pixelated', borderRadius: 8, background: 'rgba(0,0,0,0.3)', padding: 4 }} />
          {item.quality && QUALITY_STARS[item.quality] ? (
            <div style={{ position: 'absolute', top: -4, left: -4, display: 'flex', gap: 1 }}>
              {Array.from({ length: QUALITY_STARS[item.quality] }).map((_, i) => (
                <span key={i} style={{ fontSize: 10, color: '#fbbf24', textShadow: '0 0 4px rgba(251,191,36,0.6)' }}>★</span>
              ))}
            </div>
          ) : null}
          <div style={{ position: 'absolute', top: -4, right: -4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', background: 'rgba(0,0,0,0.7)', padding: '1px 5px', borderRadius: 4, border: '1px solid rgba(251,191,36,0.3)' }}>
              ⚡{itemPower}
            </div>
          </div>
        </div>
      )}
      <div style={{
        fontSize: 14, fontWeight: 600, color: item.qualityColor || 'var(--text-primary)',
        marginBottom: 6, lineHeight: 1.3,
      }}>
        {item.displayName || item.name}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>Lv.{item.level || 1}</span>
        {item.slot && (
          <span>• Слот: {SLOT_LABELS[item.slot] || item.slot}</span>
        )}
      </div>

      {item.slot === 'weapon2' && item.ammoCapacity && (
        <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6 }}>
          📀 Вместимость: {item.ammoCapacity} патронов
        </div>
      )}
      {item.slot === 'mod_magazine' && item.stats?.ammoCapacity && (
        <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6 }}>
          📀 +{item.stats.ammoCapacity} патронов к вместимости
        </div>
      )}
      <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />

      {item.set && SET_BONUSES[item.set] && (
        <div style={{
          background: 'rgba(88,28,135,0.08)', border: '1px solid rgba(88,28,135,0.2)',
          borderRadius: 6, padding: '6px 8px', marginBottom: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#c084fc', marginBottom: 4 }}>
            📦 Сет «{item.set}» — {equippedSetCount}/{SET_BONUSES[item.set].at(-1)?.count ?? '?'}
          </div>
          {SET_BONUSES[item.set].map((tier, idx) => {
            const bonusStr = Object.entries(tier.bonuses)
              .map(([k, v]) => `${STAT_LABELS[k] || k}: ${v > 0 ? '+' : ''}${v >= 1 ? v : v.toFixed(3)}`)
              .join(', ');
            const isAchieved = equippedSetCount >= tier.count;
            const isMax = idx === SET_BONUSES[item.set].length - 1;
            return (
              <div key={idx} style={{
                fontSize: 10, color: isAchieved ? '#4ade80' : isMax ? '#c084fc' : 'rgba(255,255,255,0.4)',
                marginTop: 2, lineHeight: 1.4,
              }}>
                {isAchieved ? '✅ ' : isMax ? '🏆 ' : ''}({tier.count}) {bonusStr}
              </div>
            );
          })}
        </div>
      )}

      {item.abilityId && ABILITY_MAP[item.abilityId] && (
        <div style={{
          background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)',
          borderRadius: 6, padding: '6px 8px', marginBottom: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>
            {ABILITY_MAP[item.abilityId].icon} {ABILITY_MAP[item.abilityId].name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {ABILITY_MAP[item.abilityId].description}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {ABILITY_MAP[item.abilityId].apCost} AP | КД: {ABILITY_MAP[item.abilityId].cooldown} хода
          </div>
          <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 2 }}>
            ⭐ Сила: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{ABILITY_MAP[item.abilityId].powerRating} (ур.{item.level || 1} × {(1 + ((item.level || 1) - 1) * 0.05).toFixed(2)})</span>
          </div>
        </div>
      )}

      {Object.entries(item.stats || {}).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {Object.entries(item.stats || {}).slice(0, 10).map(([k, v]) => {
            if (!v) return null;
            return (
              <div key={k} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{formatStat(k, typeof v === 'object' ? (v as any).base || 0 : v)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Нет характеристик</div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: item.qualityColor }}>
          {item.quality || item.type || ''}
        </span>
        <span style={{ color: 'var(--accent-warning)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          💾{getSellPrice(item).toLocaleString()}
        </span>
      </div>
    </div>
  );
};
