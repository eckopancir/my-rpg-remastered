import { getItemImage, images, crystalImages, getSchemeImage } from '../../assets/index';
import iconBullets from '../../assets/images/ui/icon-bullets.png';
import iconScope from '../../assets/images/ui/icon-scope.png';
import { getConsumableIcon } from '../../data/consumables';
import { FOOD_MAP } from '../../data/food';
import type { Item } from '../../types/items';
import { chestImageFor, configForQuality } from '../../data/chests';
import { QUALITY_TIERS } from '../../engine/items';
import { backpackDefByName, backpackSlots, backpackSlotsFor } from '../../data/backpacks';
import { ammoGroupName, ammoTypeForWeapon, maxStackFor, weaponRangeProfile, effectiveAmmoCapacity, MAGAZINE_BONUS, bulletQualityIndex, BULLET_DMG_PCT, bulletDamageMult, type AmmoGroup } from '../../data/ammo';
import { ABILITY_MAP } from '../../data/accessoryAbilities';
import { calcItemPower } from '../../utils/itemPower';
import { getSellPrice } from '../../utils/sellPrice';
import { SET_BONUSES } from '../../data/GameItems';
import { usePlayerStore, gunSlotForWeapon, EQUIPMENT_SLOTS } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { effectiveItemStats, modStatsOf, modLevelMult } from '../../utils/itemStats';
import { socketSlotsOf, schematicBonusOf, isSocketable, schemePctFor, schemeFlatFor, SCHEME_FLAT_STATS, SCHEME_STAT_LABELS } from '../../data/schematics';
import { useState, useEffect } from 'react';

interface ItemTooltipProps {
  item: Item;
  x: number;
  y: number;
  // Вложенный (сравнение): шифт не отслеживаем, чтобы не плодить каскад.
  nested?: boolean;
  // Прибитый режим: висит сверху экрана, T не перехватывает.
  pinMode?: boolean;
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

const STAT_COLORS: Record<string, string> = {
  // 4 группы: красный урон, синий защита, зелёный живучесть, жёлтый точность/мобильность
  damage: '#f87171', punching: '#f87171', vampir: '#f87171', dpsExtro: '#f87171', dpsFire: '#f87171',
  armor: '#60a5fa', block: '#60a5fa', evasion: '#60a5fa', dpsEmi: '#60a5fa',
  regen: '#4ade80', health: '#4ade80', maxHp: '#4ade80', stamina: '#4ade80', luck: '#4ade80', incomingDamageMult: '#4ade80', dpsToxis: '#4ade80',
  crit: '#fbbf24', accuracy: '#fbbf24', speed: '#fbbf24',
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

export const ItemTooltip = ({ item, x, y, nested, pinMode }: ItemTooltipProps) => {
  const tooltipX = pinMode ? Math.max(8, window.innerWidth / 2 - 140) : Math.min(x + 16, window.innerWidth - 280);
  const tooltipY = pinMode ? 10 : Math.min(y - 10, window.innerHeight - 340);
  // Спойлеры сета/сфер — изначально свернуты, через 3с плавно раскрываются.
  const [spoilersOpen, setSpoilersOpen] = useState(false);
  useEffect(() => {
    setSpoilersOpen(false);
    const t = setTimeout(() => setSpoilersOpen(true), 3000);
    return () => clearTimeout(t);
  }, [item.id]);
  // Сравнение: зажатый Shift показывает надетый аналог слева.
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    if (nested) return;
    const dn = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    // T — прибить тултип наверх экрана (читать длинные описания).
    const pin = (e: KeyboardEvent) => {
      if ((e as any).code !== 'KeyT' || pinMode) return;
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault();
      useUiStore.getState().setTooltipPin(item);
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    window.addEventListener('keydown', pin);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      window.removeEventListener('keydown', pin);
    };
  }, [nested, pinMode, item]);
  const equipment = usePlayerStore((s) => s.equipment);
  // Прибитый двойник наверху — ховер-версию прячем, чтобы не висело два.
  const activePin = useUiStore((s) => s.tooltipPin);
  const compareSlot = item.slot === 'weapon2'
    ? gunSlotForWeapon(item)
    : ((EQUIPMENT_SLOTS as readonly string[]).includes(item.slot || '') ? (item.slot as string) : null);
  const compareItem = compareSlot ? (equipment as any)[compareSlot] : null;
  const showCompare = shiftHeld && compareItem && compareItem.id !== item.id;
  const compareX = Math.max(8, tooltipX - 276);
  const foodIcon = item.type === 'consumable' && item.abilityId ? (FOOD_MAP[item.abilityId]?.icon || getConsumableIcon(item)) : null;
  const imgUrl = item.image
    || (item.type === 'chest' ? chestImageFor(item.quality || item.rarity || 'Обычный') : undefined)
    || getItemImage(item.name, item.displayName, item.slot, item.type);
  const itemPower = calcItemPower(item);
  const equippedSetCount = item.set
    ? Object.values(equipment).filter((eq) => eq?.set === item.set).length
    : 0;

  if (!pinMode && activePin && activePin.id === item.id) return null;

  const qc = item.qualityColor || '#6b7280';
  const QUALITY_HEX_MAP: Record<string, string> = {
    'Обычный': '#a0a0a0', 'Редкий': '#4ade80', 'Раритетный': '#60a5fa',
    'Эпический': '#a855f7', 'Смертоносный': '#ef4444', 'Легендарный': '#fbbf24', 'Божественный': '#22d3ee',
  };
  const hex = QUALITY_HEX_MAP[item.quality || ''] || (qc.startsWith('#') ? qc : '#a0a0a0');
  return (
    <>
    {showCompare && !nested && (
      <ItemTooltip item={compareItem} x={compareX - 16} y={y} nested />
    )}
    <div
      style={{
        position: 'fixed', left: tooltipX, top: tooltipY, zIndex: 9999,
        width: 320,
        background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,0.75), 0 2px 0 rgba(255,255,255,0.04) inset',
        pointerEvents: 'auto',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* тонкая линия качества внутри */}
      <div style={{ height: 3, background: hex, opacity: 0.95 }} />
      {/* переливание цвета редкости: от полоски через картинку до названия — без новой территории, всё на фоне картинки */}
      <div style={{ background: `linear-gradient(180deg, ${hex}26 0%, ${hex}14 32%, ${hex}07 58%, transparent 92%)`, position: 'relative' }}>
        {/* топ-оверлей на фоне картинки: слева звёзды редкости, справа мощность */}
        <div style={{ position: 'absolute', top: 6, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none', zIndex: 1 }}>
          {item.quality && QUALITY_STARS[item.quality] ? (
            <span style={{ display: 'inline-flex', gap: 2, color: '#fbbf24', textShadow: '0 0 8px rgba(251,191,36,0.55)', lineHeight: 1 }}>
              {Array.from({ length: QUALITY_STARS[item.quality] }).map((_, i) => (
                <span key={i} style={{ fontSize: 14 }}>★</span>
              ))}
            </span>
          ) : <span />}
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, color: '#fbbf24', fontWeight: 700, background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: 4, padding: '3px 6px', minWidth: 52 }}>
            <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>⚡ {itemPower}</span>
            <span style={{ fontSize: 6, fontWeight: 600, letterSpacing: 0.5, color: 'rgba(251,191,36,0.75)', marginTop: 1, textTransform: 'uppercase' }}>мощность</span>
          </span>
        </div>
      {(imgUrl || foodIcon) && (
        <div style={{ textAlign: 'center', padding: '4px 14px 0', position: 'relative' }}>
          {imgUrl ? (
            <img src={imgUrl} alt="" style={{ width: '100%', height: item.type === 'backpack' ? 187 : 180, objectFit: 'contain', padding: 4, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.6))' }} />
          ) : (
            <span style={{ fontSize: 72, lineHeight: 1.2 }}>{foodIcon}</span>
          )}
          {isSocketable(item) && socketSlotsOf(item) > 0 && (() => {
            const max = socketSlotsOf(item);
            const socks = Array.isArray((item as any).sockets) ? (item as any).sockets : [];
            const filled = socks.length;
            return (
              <div style={{ position: 'absolute', top: 62, right: 14, display: 'flex', flexDirection: 'column', gap: 3 }} title={`Гнёзда: ${filled}/${max}`}>
                {Array.from({ length: max }).map((_, i) => {
                  const src = i < filled ? (getSchemeImage(socks[i]?.stat) || crystalImages.filled) : crystalImages.empty;
                  return src ? (
                    <img key={i} src={src} alt="" style={{ width: 13, height: 13, objectFit: 'contain', filter: i < filled ? 'drop-shadow(0 0 4px rgba(74,222,128,0.9))' : 'opacity(0.5)' }} />
                  ) : (
                    <div key={i} style={{ width: 9, height: 9, transform: 'rotate(45deg)', background: i < filled ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.08)', border: `1px solid ${i < filled ? '#4ade80' : 'rgba(255,255,255,0.25)'}` }} />
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
        <div style={{ padding: '8px 14px 12px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: hex, lineHeight: 1.2, textShadow: '0 1px 0 rgba(0,0,0,0.6)', wordBreak: 'break-word' }}>
          {item.displayName || item.name}
        </div>
        {(item as any).unique && (
          <div style={{ display: 'inline-block', marginTop: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1.6, color: '#ffd700', background: 'rgba(255,215,0,0.10)', border: '1px solid rgba(255,215,0,0.35)', borderRadius: 4, padding: '2px 6px' }}>
            УНИК
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)', flexWrap: 'wrap' }}>
          <span>Lv.{item.level || 1}</span>
          {item.slot && <span>• {SLOT_LABELS[item.slot] || item.slot}</span>}
          {item.slot && MOD_SLOTS_MAP[item.slot] && <span>• ⚙ {item.mods ? Object.keys(item.mods).length : 0}/{MOD_SLOTS_MAP[item.slot].length}</span>}
        </div>
      </div>
      </div>
      <div style={{ padding: '0 14px 12px' }}>
      {item.type === 'blueprint' && (() => {
        const stat = (item as any).blueprintStat || 'damage';
        const isFlat = SCHEME_FLAT_STATS.has(stat);
        const pct = isFlat ? schemeFlatFor(stat, (item as any).blueprintRarity || item.quality) : schemePctFor(stat, (item as any).blueprintRarity || item.quality);
        return (
          <div style={{
            background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 6, padding: '6px 8px', marginBottom: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>
              💎 {SCHEME_STAT_LABELS[stat] || stat} +{pct}{isFlat ? '' : '%'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Вставляется в перековке, улучшает только этот предмет
            </div>
          </div>
        );
      })()}
      {item.type === 'bullet' && (() => {
        const pct = BULLET_DMG_PCT[Math.min(bulletQualityIndex(item.quality), BULLET_DMG_PCT.length - 1)] || 0;
        return (
          <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6 }}>
            <div>🔸 {ammoGroupName(((item as any).ammoGroup as AmmoGroup) || 'rifle')} · стак до {maxStackFor(((item as any).ammoGroup as AmmoGroup) || 'rifle')} шт.</div>
            <div style={{ color: '#4ade80' }}>+{pct}% к урону ({item.quality || 'Обычный'})</div>
          </div>
        );
      })()}
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
      {item.slot === 'weapon2' && item.ammoCapacity && (() => {
        const mq = (item as any).loadedAmmoQuality || 'Обычный';
        const mm = bulletDamageMult(mq);
        return (
          <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={iconBullets} alt="" style={{ width: 16, height: 16, objectFit: 'contain', filter: 'brightness(1.2)' }} />
            <span>Патроны {ammoGroupName(ammoTypeForWeapon(item)).toLowerCase()} {item.loadedAmmo ?? 0}/{effectiveAmmoCapacity(item)} · {mq}{mm > 1 ? ` (+${Math.round((mm - 1) * 100)}%)` : ''}</span>
          </div>
        );
      })()}
      {item.slot === 'weapon1' && (
        <div style={{ fontSize: 12, color: '#7dd3fc', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src={iconScope} alt="" style={{ width: 16, height: 16, objectFit: 'contain', filter: 'brightness(1.2)' }} />
          <span>Ближний бой · бьёт 3 клетки спереди</span>
        </div>
      )}
      {item.slot === 'weapon2' && (() => {
        const prof = weaponRangeProfile(item);
        const tags = [
          `Дальность ${prof.range}`,
          prof.cone ? 'веер' : null,
          prof.aoe ? `💥 площадь ${prof.aoe}` : null,
          prof.fast ? '⚡ темп' : null,
        ].filter(Boolean).join(' · ');
        return (
          <div style={{ fontSize: 12, color: '#7dd3fc', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={iconScope} alt="" style={{ width: 16, height: 16, objectFit: 'contain', filter: 'brightness(1.2)' }} />
            <span>{tags}</span>
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
      {/* divider like screenshot */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0 10px' }} />

      {/* set bonuses — спойлер, раскрывается через 3с */}
      {item.set && SET_BONUSES[item.set] && (
        <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
          <div
            onClick={() => setSpoilersOpen((o) => !o)}
            style={{ padding: '7px 8px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', pointerEvents: 'auto', userSelect: 'none' }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', flex: 1 }}>◆ Сет «{item.set}» — {equippedSetCount}/{SET_BONUSES[item.set].at(-1)?.count ?? '?'}</span>
            <span style={{ fontSize: 10, color: 'rgba(200,180,255,0.6)', transform: spoilersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)' }}>▼</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateRows: spoilersOpen ? '1fr' : '0fr',
            opacity: spoilersOpen ? 1 : 0,
            transition: 'grid-template-rows 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease',
          }}>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0 8px 7px' }}>
                {SET_BONUSES[item.set].map((tier, idx) => {
                  const bonusStr = Object.entries(tier.bonuses).map(([k, v]) => `${STAT_LABELS[k] || k}: ${v > 0 ? '+' : ''}${v >= 1 ? v : v.toFixed(3)}`).join(', ');
                  const isAchieved = equippedSetCount >= tier.count;
                  const isMax = idx === SET_BONUSES[item.set].length - 1;
                  return (
                    <div key={idx} style={{ fontSize: 10, color: isAchieved ? '#4ade80' : isMax ? '#c084fc' : 'rgba(255,255,255,0.35)', marginTop: 2, lineHeight: 1.4 }}>
                      {isAchieved ? '◆ ' : isMax ? '◇ ' : '◇ '}({tier.count}) {bonusStr}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {item.abilityId && ABILITY_MAP[item.abilityId] && (
        <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.14)', borderRadius: 8, padding: '7px 8px', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
            {ABILITY_MAP[item.abilityId].icon} {ABILITY_MAP[item.abilityId].name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{ABILITY_MAP[item.abilityId].description}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{ABILITY_MAP[item.abilityId].apCost} AP · КД {ABILITY_MAP[item.abilityId].cooldown}</div>
          {item.type === 'consumable' && <div style={{ fontSize: 10, color: '#4ade80', marginTop: 3 }}>Расходует: 1 шт.</div>}
        </div>
      )}

      {/* stats — like screenshot: diamond + colored value */}
      {(() => {
        const eff = effectiveItemStats(item);
        const fromMods = modStatsOf(item);
        const modMult = item.type === 'mod' ? modLevelMult(item) : 1;
        const disp: Record<string, number> = {};
        for (const [k, v] of Object.entries(eff)) disp[k] = v * modMult;
        const posKeys = Object.keys(eff).filter((k) => eff[k] > 0);
        const negKeys = Object.keys(eff).filter((k) => eff[k] < 0);
        if (posKeys.length === 0 && negKeys.length === 0) {
          return <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Нет характеристик</div>;
        }
        const renderRow = (k: string, v: number, isNeg: boolean) => {
          const col = STAT_COLORS[k] || (isNeg ? '#f87171' : '#d1d5db');
          const isPct = ['crit', 'evasion', 'vampir', 'accuracy', 'speed', 'punching', 'incomingDamageMult'].includes(k);
          const isBlock = k === 'block';
          const shown = isPct ? `${(Math.abs(v) * 100).toFixed(v < 0.01 ? 1 : 0)}%` : isBlock ? `${(Math.abs(v) * 10).toFixed(1)}%` : `${Math.abs(v) >= 1 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(2)}`;
          const sign = isNeg ? '-' : '+';
          const label = STAT_LABELS[k] || k;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
              <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>◇</span>
              <span style={{ flex: 1, color: 'rgba(255,255,255,0.82)' }}>
                <span style={{ color: col, fontWeight: 600 }}>{sign}{shown}</span>{' '}
                <span style={{ color: 'rgba(255,255,255,0.72)' }}>{label}</span>
                {fromMods[k] ? <span style={{ color: '#4ade80', fontSize: 10, marginLeft: 6 }}> ( +{Math.abs(fromMods[k]) >= 1 ? Math.abs(fromMods[k]).toFixed(1) : Math.abs(fromMods[k]).toFixed(2)} мод )</span> : null}
              </span>
            </div>
          );
        };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {posKeys.slice(0, 12).map((k) => renderRow(k, disp[k], false))}
              {negKeys.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {negKeys.map((k) => renderRow(k, disp[k], true))}
                </div>
              )}
              {(() => {
                const socks = Array.isArray((item as any).sockets) ? (item as any).sockets : [];
                if (socks.length === 0) return null;
                return (
                  <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.07)' }}>
                    <div
                      onClick={() => setSpoilersOpen((o) => !o)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', pointerEvents: 'auto', userSelect: 'none' }}
                    >
                      <span style={{ width: 14, height: 1, background: 'rgba(74,222,128,0.4)' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#4ade80' }}>◆ БОНУСЫ СФЕР</span>
                      <span style={{ flex: 1, height: 1, background: 'rgba(74,222,128,0.14)' }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(74,222,128,0.7)', letterSpacing: 0.3 }}>{socks.length}/{socketSlotsOf(item)}</span>
                      <span style={{ fontSize: 9, color: 'rgba(74,222,128,0.6)', transform: spoilersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)' }}>▼</span>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateRows: spoilersOpen ? '1fr' : '0fr',
                      opacity: spoilersOpen ? 1 : 0,
                      transition: 'grid-template-rows 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.32s ease',
                    }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 6 }}>
                          {socks.map((s: any, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <span style={{ color: 'rgba(74,222,128,0.5)', fontSize: 10 }}>◇</span>
                              <span style={{ color: '#4ade80' }}>+{s.pct}{SCHEME_FLAT_STATS.has(s.stat) ? '' : '%'} {(SCHEME_STAT_LABELS[s.stat] || STAT_LABELS[s.stat] || s.stat)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        );
      })()}

      {item.description && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.38)', fontStyle: 'italic', lineHeight: 1.4 }}>
          {item.description}
        </div>
      )}
      {!nested && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            {item.quality && (
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, color: hex, border: `1px solid ${hex}`, background: `${hex}18`, borderRadius: 4, padding: '3px 7px', letterSpacing: 0.3, boxShadow: `0 0 8px ${hex}22` }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>{item.quality}</span>
              </span>
            )}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
            <span>SHIFT сравнить · T закрепить</span>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, color: 'rgba(255,255,255,0.55)', fontWeight: 600, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 4, padding: '4px 8px', minWidth: 64 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span>💾</span> {getSellPrice(item).toLocaleString()}</span>
              <span style={{ fontSize: 6.4, fontWeight: 600, letterSpacing: 0.6, color: 'rgba(255,255,255,0.45)', marginTop: 2, textTransform: 'uppercase' }}>продажа</span>
            </span>
          </div>
        </>
      )}
      </div>
    </div>
    </>
  );
};

/** Прибитый тултип сверху экрана (T во время показа). T/✕ — открепить. */
export const PinnedTooltipHost = () => {
  const pin = useUiStore((s) => s.tooltipPin);
  useEffect(() => {
    if (!pin) return;
    const closer = (e: KeyboardEvent) => {
      if ((e as any).code !== 'KeyT') return;
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      useUiStore.getState().setTooltipPin(null);
    };
    window.addEventListener('keydown', closer);
    return () => window.removeEventListener('keydown', closer);
  }, [pin]);
  if (!pin) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{ position: 'relative', pointerEvents: 'auto' }}>
        <ItemTooltip item={pin} x={0} y={0} pinMode />
        <span
          onClick={() => useUiStore.getState().setTooltipPin(null)}
          style={{
            position: 'absolute', top: 2, right: 2, cursor: 'pointer',
            fontSize: 13, color: 'white', background: 'rgba(0,0,0,0.6)',
            borderRadius: 4, padding: '0 6px', zIndex: 1,
          }}
        >
          ✕
        </span>
      </div>
    </div>
  );
};
