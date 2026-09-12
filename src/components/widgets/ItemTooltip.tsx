import { getItemImage, images } from '../../assets/index';
import type { Item } from '../../types/items';
import { chestImageFor, configForQuality } from '../../data/chests';
import { QUALITY_TIERS } from '../../engine/items';
import { backpackDefByName, backpackSlots, backpackSlotsFor } from '../../data/backpacks';
import { ammoGroupName, ammoTypeForWeapon, maxStackFor, weaponRangeProfile, effectiveAmmoCapacity, MAGAZINE_BONUS, type AmmoGroup } from '../../data/ammo';
import { ABILITY_MAP } from '../../data/accessoryAbilities';
import { calcItemPower } from '../../utils/itemPower';
import { getSellPrice } from '../../utils/sellPrice';
import { SET_BONUSES } from '../../data/GameItems';
import { usePlayerStore, gunSlotForWeapon, EQUIPMENT_SLOTS } from '../../stores/playerStore';
import { effectiveItemStats, modStatsOf, modLevelMult } from '../../utils/itemStats';
import { useState, useEffect } from 'react';

interface ItemTooltipProps {
  item: Item;
  x: number;
  y: number;
  // Вложенный (сравнение): шифт не отслеживаем, чтобы не плодить каскад.
  nested?: boolean;
}

const STAT_LABELS: Record<string, string> = {
  damage: 'Урон', crit: 'Крит. шанс', armor: 'Броня', regen: 'Регенерация',
  evasion: 'Уклонение', block: 'Блок', punching: 'Дробящий', accuracy: 'Точность',
  vampir: 'Вампиризм', speed: 'Скорость', health: 'Здоровье', maxHp: 'Макс. HP',
  stamina: 'Выносливость', dpsEmi: 'ЭМИ урон', dpsToxis: 'Токсичный урон',
  dpsExtro: 'Экстро урон', dpsFire: 'Огненный урон', luck: 'Удача',
};

const SLOT_LABELS: Record<string, string> = {
  weapon1: 'Ближний бой', weapon2: 'Автомат',
  gun_pistol: 'Пистолет', gun_shotgun: 'Дробовик', gun_sniper: 'Снайперка', gun_heavy: 'Тяжёлое',
  head: 'Шлем', armor: 'Броня', pants: 'Штаны', gloves: 'Перчатки', boots: 'Ботинки',
  ammo: '(снято с игры)', bullet: 'Патроны',
  any: 'Универсально',
  mod_scope: 'Прицел', mod_barrel: 'Ствол', mod_receiver: 'Ресивер',
  mod_muzzle: 'Дуло', mod_magazine: 'Магазин', mod_stock: 'Приклад',
  mod_blade: 'Лезвие', mod_handle: 'Рукоять', mod_pommel: 'Обух', mod_harness: 'Крепление',
  mod_lining: 'Арамидный внутренний слой', mod_hardshell: 'Композитный внешний слой', mod_utility: 'Система', mod_patch: 'Бронепластина',
};

const MOD_SLOTS_MAP: Record<string, string[]> = {
  weapon1: ['mod_blade', 'mod_handle', 'mod_pommel', 'mod_harness'],
  weapon2: ['mod_scope', 'mod_barrel', 'mod_receiver', 'mod_muzzle', 'mod_magazine', 'mod_stock'],
  head: ['mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch'],
  armor: ['mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch'],
  gloves: ['mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch'],
  boots: ['mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch'],
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

export const ItemTooltip = ({ item, x, y, nested }: ItemTooltipProps) => {
  const tooltipX = Math.min(x + 16, window.innerWidth - 280);
  const tooltipY = Math.min(y - 10, window.innerHeight - 340);
  // Сравнение: зажатый Shift показывает надетый аналог слева.
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    if (nested) return;
    const dn = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, [nested]);
  const equipment = usePlayerStore((s) => s.equipment);
  const compareSlot = item.slot === 'weapon2'
    ? gunSlotForWeapon(item)
    : ((EQUIPMENT_SLOTS as readonly string[]).includes(item.slot || '') ? (item.slot as string) : null);
  const compareItem = compareSlot ? (equipment as any)[compareSlot] : null;
  const showCompare = shiftHeld && compareItem && compareItem.id !== item.id;
  const compareX = Math.max(8, tooltipX - 276);
  const imgUrl = item.image
    || (item.type === 'chest' ? chestImageFor(item.quality || item.rarity || 'Обычный') : undefined)
    || getItemImage(item.name, item.displayName, item.slot, item.type);
  const itemPower = calcItemPower(item);
  const equippedSetCount = item.set
    ? Object.values(equipment).filter((eq) => eq?.set === item.set).length
    : 0;

  return (
    <>
    {showCompare && !nested && (
      <ItemTooltip item={compareItem} x={compareX - 16} y={y} nested />
    )}
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
          <img src={imgUrl} alt="" style={{ width: '100%', height: item.type === 'backpack' ? 156 : 120, objectFit: 'contain', padding: 4 }} />
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
      {(item as any).unique && (
        <div style={{
          display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 2,
          color: '#ffd700', background: 'rgba(255,215,0,0.1)',
          border: '1px solid rgba(255,215,0,0.5)', borderRadius: 4,
          padding: '1px 7px', marginBottom: 8,
        }}>
          🔥 УНИК
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>Lv.{item.level || 1}</span>
        {item.slot && (
          <span>• Слот: {SLOT_LABELS[item.slot] || item.slot}</span>
        )}
        {item.slot && MOD_SLOTS_MAP[item.slot] && (
          <span>• ⚙️{item.mods ? Object.keys(item.mods).length : 0}/{MOD_SLOTS_MAP[item.slot].length}</span>
        )}
      </div>

      {item.type === 'bullet' && (
        <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6 }}>
          🔸 {ammoGroupName(((item as any).ammoGroup as AmmoGroup) || 'rifle')} · стак до {maxStackFor(((item as any).ammoGroup as AmmoGroup) || 'rifle')} шт.
        </div>
      )}
      {item.type === 'chest' && (() => {
        const qn = item.quality || 'Обычный';
        const cfg = configForQuality(qn);
        const tierIdx = QUALITY_TIERS.findIndex((t) => t.name === qn);
        const lines = [
          `⚔️ 1 предмет · 100% ${qn}`,
          `📦 Ресурсы: ${cfg.resTypes} видов`,
          `💾 Чипы: ${cfg.chipBase}+`,
        ];
        if (tierIdx >= 3) lines.push('🔸 Пачка патронов');
        lines.push(`🧪 Расходники: ${cfg.consTypes[0]}–${cfg.consTypes[1]} видов`);
        lines.push('🎒 Рюкзак: шанс 1%');
        return (
          <div style={{
            background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)',
            borderRadius: 6, padding: '6px 8px', marginBottom: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24', marginBottom: 4 }}>
              📦 Может выпасть:
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{l}</div>
            ))}
          </div>
        );
      })()}
      {item.type === 'backpack' && (() => {
        const def = backpackDefByName(item.name || '');
        const slots = def ? backpackSlots(def, item.quality) : backpackSlotsFor(item);
        return (
          <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6 }}>
            🎒 Слотов: {slots}{def ? ` (база ${def.baseSlots} + качество)` : ''}
          </div>
        );
      })()}
      {item.slot === 'weapon2' && item.ammoCapacity && (
        <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6 }}>
          📀 Патроны {ammoGroupName(ammoTypeForWeapon(item)).toLowerCase()} {item.loadedAmmo ?? 0}/{effectiveAmmoCapacity(item)}
        </div>
      )}
      {item.slot === 'weapon1' && (
        <div style={{ fontSize: 12, color: '#7dd3fc', marginBottom: 6 }}>
          🎯 ближний бой · бьёт 3 клетки спереди
        </div>
      )}
      {item.slot === 'weapon2' && (() => {
        const prof = weaponRangeProfile(item);
        const tags = [
          `дальность ${prof.range}`,
          prof.cone ? 'веер' : null,
          prof.aoe ? `💥 площадь ${prof.aoe}` : null,
          prof.fast ? '⚡ темп' : null,
        ].filter(Boolean).join(' · ');
        return (
          <div style={{ fontSize: 12, color: '#7dd3fc', marginBottom: 6 }}>
            🎯 {tags}
          </div>
        );
      })()}
      {item.slot === 'mod_magazine' && (() => {
        const order = ['Обычный', 'Редкий', 'Раритетный', 'Эпический', 'Смертоносный', 'Легендарный', 'Божественный'];
        const qi = Math.max(0, order.indexOf(item.quality || 'Обычный'));
        const val = (cls: string): number => {
          const t = MAGAZINE_BONUS[cls] || MAGAZINE_BONUS.default;
          return t[Math.min(qi, t.length - 1)] || 0;
        };
        const rows: [string, string][] = [
          ['Снайпер', 'sniper'], ['Автомат', 'rifle'], ['Пистолет', 'pistol'],
          ['Дробь', 'shotgun'], ['Пулемёт', 'mg'], ['Тяжёлое', 'heavy'],
        ];
        return (
          <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6 }}>
            <div style={{ marginBottom: 3 }}>📀 Магазин ({item.quality || 'Обычный'}): +патроны по стволу</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 8px', fontSize: 11, color: 'var(--text-secondary)' }}>
              {rows.map(([label, cls]) => (
                <div key={cls} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{label}</span>
                  <span style={{ color: '#4ade80', fontFamily: 'var(--font-mono)' }}>+{val(cls)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
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
            ⭐ Сила: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{Math.round(ABILITY_MAP[item.abilityId].powerRating * (1 + ((item.level || 1) - 1) * 0.05) * 3)}</span>
          </div>
          {item.type === 'consumable' && (
            <div style={{ fontSize: 10, color: '#4ade80', marginTop: 2 }}>
              📦 Расходует: 1 шт. за использование в бою
            </div>
          )}
        </div>
      )}

      {(() => {
        // Статы с учётом вставленных модов: шлем 30 + мод 1 покажет 31.
        // Штрафы (минусы) — отдельно красным блоком, они не растут с уровнем.
        // Сами моды показываем сразу со скейлом от их уровня.
        const eff = effectiveItemStats(item);
        const fromMods = modStatsOf(item);
        const modMult = item.type === 'mod' ? modLevelMult(item) : 1;
        const disp: Record<string, number> = {};
        for (const [k, v] of Object.entries(eff)) disp[k] = v * modMult;
        const posKeys = Object.keys(eff).filter((k) => eff[k] > 0);
        const negKeys = Object.keys(eff).filter((k) => eff[k] < 0);
        if (posKeys.length === 0 && negKeys.length === 0) {
          return <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Нет характеристик</div>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {posKeys.slice(0, 10).map((k) => (
              <div key={k} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{formatStat(k, disp[k])}</span>
                {fromMods[k] ? (
                  <span title="Бонус от модов" style={{ fontSize: 10, color: '#4ade80', background: 'rgba(34,197,94,0.12)', padding: '0 5px', borderRadius: 3 }}>
                    🔧+{(Math.abs(fromMods[k]) >= 1 ? Math.abs(fromMods[k]).toFixed(1) : Math.abs(fromMods[k]).toFixed(3))}
                  </span>
                ) : null}
              </div>
            ))}
            {negKeys.length > 0 && (
              <div style={{
                marginTop: 4, padding: '5px 7px', borderRadius: 6,
                background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', letterSpacing: 1 }}>➖ ШТРАФЫ</div>
                {negKeys.map((k) => {
                  const label = STAT_LABELS[k] || k;
                  const v = disp[k];
                  const isPct = ['crit', 'evasion', 'block', 'vampir', 'accuracy', 'speed', 'punching', 'incomingDamageMult'].includes(k);
                  const shown = isPct
                    ? (() => { const p = Math.abs(v) * 100; return `${Number.isInteger(p) ? p : p.toFixed(1)}%`; })()
                    : `${Math.abs(v) >= 1 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(3)}`;
                  return (
                    <div key={k} style={{ fontSize: 12, color: '#f87171', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{label}: -{shown}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: item.qualityColor }}>
          {item.quality || item.type || ''}
        </span>
        {!nested && compareItem && compareItem.id !== item.id && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>Shift — сравнить</span>
        )}
        <span style={{ color: 'var(--accent-warning)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          💾{getSellPrice(item).toLocaleString()}
        </span>
      </div>
    </div>
    </>
  );
};
