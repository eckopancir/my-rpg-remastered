import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../stores/playerStore';

import { useUiStore } from '../stores/uiStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useSound } from '../hooks/useSound';
import { WapPanel } from '../components/ui/WapPanel';
import { WapFrame } from '../components/ui/WapFrame';
import { WapHeader } from '../components/ui/WapHeader';
import { WapHudBar } from '../components/ui/WapHudBar';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { generateItem } from '../engine/items';
import { GAME_ITEMS, GAME_RESOURCES } from '../data/GameItems';
import { getItemImage, images } from '../assets/index';

const debugGenerateItems = (count: number) => {
  const addItem = useInventoryStore.getState().addItem;
  for (let i = 0; i < count; i++) {
    const drop = generateItem(GAME_ITEMS, usePlayerStore.getState().level);
    if (drop) addItem(drop);
  }
  useUiStore.getState().addToast(`🎒 Сгенерировано ${count} предметов`, 'loot');
};

const debugAddMods = (count: number) => {
  const addItem = useInventoryStore.getState().addItem;
  const mods = GAME_ITEMS.filter((i) => i.type === 'mod');
  for (let i = 0; i < count; i++) {
    const def = mods[Math.floor(Math.random() * mods.length)];
    addItem({
      id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: def.name, displayName: def.name, rarity: def.rarity,
      slot: def.slot, type: 'mod', stats: def.stats || {},
      quality: 'Редкий', qualityColor: '#a855f7',
      image: getItemImage(def.name), level: 1,
    });
  }
  useUiStore.getState().addToast(`🔧 +${count} модификаций (${mods.length} видов)`, 'success');
};

const debugAddAmmo = (count: number) => {
  const addItem = useInventoryStore.getState().addItem;
  const ammoItems = GAME_ITEMS.filter((i) => i.slot === 'ammo');
  for (let i = 0; i < count; i++) {
    const drop = generateItem(ammoItems, usePlayerStore.getState().level, null, null, 'ammo');
    if (drop) addItem(drop);
  }
  useUiStore.getState().addToast(`🎒 +${count} амуниции со способностями`, 'loot');
};

const debugAddResources = (count: number) => {
  const addItem = useInventoryStore.getState().addItem;
  for (const def of GAME_RESOURCES) {
    addItem({
      id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: def.name, displayName: def.name, rarity: def.rarity,
      slot: def.slot, stats: {}, quality: 'Обычный',
      qualityColor: '#a0a0a0', level: 1, type: 'material',
      quantity: count, image: def.image,
    });
  }
  useUiStore.getState().addToast(`📦 +${count} каждого ресурса (${GAME_RESOURCES.length} видов)`, 'loot');
};

interface StatInfo {
  label: string; value: string; desc: string; breakpoints?: string[];
}

const StatCapsule = ({ s, onHover }: { s: StatInfo; onHover: (s: StatInfo | null) => void }) => (
  <span
    onMouseEnter={() => onHover(s)}
    onMouseLeave={() => onHover(null)}
    style={{
      fontSize: 11, fontFamily: 'var(--wa-font-hud)', padding: '2px 8px',
      background: 'rgba(0,0,0,0.3)', borderRadius: 3,
      border: '1px solid rgba(200,200,200,0.06)',
      color: 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'default',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}
  >
    {s.label}
    <strong style={{ color: 'var(--wa-accent-amber)' }}>{s.value}</strong>
  </span>
);

export const Dashboard = () => {
  const navigate = useNavigate();
  const stats = usePlayerStore((s) => s.stats);
  const level = usePlayerStore((s) => s.level);
  const currentExp = usePlayerStore((s) => s.currentExp);
  const expToNext = usePlayerStore((s) => s.expToNext);
  const dataChips = usePlayerStore((s) => s.dataChips);
  const travel = usePlayerStore((s) => s.travel);
  const combat = usePlayerStore((s) => s.combat);
  const queue = useUiStore((s) => s.queue);
  const setIsResting = useUiStore((s) => s.setIsResting);
  const isResting = useUiStore((s) => s.isResting);
  const activeEffects = usePlayerStore((s) => s.activeEffects);
  const toggleEquipment = useUiStore((s) => s.toggleEquipment);
  const toggleInventory = useUiStore((s) => s.toggleInventory);
  const powerBreakdown = usePlayerStore((s) => s.powerBreakdown);
  const { playClick } = useSound();

  const [hoveredStat, setHoveredStat] = useState<StatInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showPowerBreakdown, setShowPowerBreakdown] = useState(false);

  const statCapsules: StatInfo[] = [
    { label: 'DMG', value: stats.damage.toFixed(1), desc: 'Базовый урон (DPS). Определяет силу всех атак.' },
    { label: 'ARM', value: stats.armor.toFixed(1), desc: 'Броня. Каждая единица поглощает 1 ед. входящего урона.' },
    { label: 'CRIT', value: `${(stats.crit * 100).toFixed(1)}%`, desc: 'Шанс критического удара.', breakpoints: ['1-100% → ×2', '101-200% → ×3', '201-300% → ×4', '301-400% → ×5'] },
    { label: 'ACC', value: `${(stats.accuracy * 100).toFixed(0)}%`, desc: 'Меткость. Определяет шанс попадания.' },
    { label: 'EVA', value: `${(stats.evasion * 100).toFixed(1)}%`, desc: 'Уклонение. Шанс избежать атаки.' },
    { label: 'BLK', value: `${(stats.block * 100).toFixed(1)}%`, desc: 'Блок. Шанс заблокировать часть урона.', breakpoints: ['<200% → 50%', '≥200% → 80%', '≥300% → 90%'] },
    { label: 'REG', value: stats.regen.toFixed(1), desc: 'Регенерация HP/сек.' },
    { label: 'VAMP', value: `${(stats.vampir * 100).toFixed(1)}%`, desc: 'Вампиризм. % урона → HP.' },
    { label: 'PCH', value: `${(stats.punching * 100).toFixed(1)}%`, desc: 'Пробитие. Игнорирует % брони врага.' },
    { label: 'SPD', value: `${(stats.speed * 100).toFixed(1)}%`, desc: 'Скорость. Каждый выстрел имеет 0.5% × скорость шанс на бесплатный повтор (100% → 50%, 200% → гарант).' },
  ];

  const hasElemDps = [stats.dpsEmi, stats.dpsToxis, stats.dpsExtro, stats.dpsFire].some((v) => v > 0);
  const elemDps = [
    { label: 'ЭМИ', value: stats.dpsEmi, color: '#818cf8', desc: 'ЭМИ урон. Против Роботов.' },
    { label: 'ТОКС', value: stats.dpsToxis, color: '#22c55e', desc: 'Токсичный урон. Против Мутантов.' },
    { label: 'ЭКСТРО', value: stats.dpsExtro, color: '#f97316', desc: 'Усиленный урон. Против Бандитов.' },
    { label: 'ОГОНЬ', value: stats.dpsFire, color: '#ef4444', desc: 'Разрывной урон. Против Бандитов.' },
  ];

  const handleStatHover = (s: StatInfo | null) => {
    setHoveredStat(s);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}
    >
      {/* Character panel */}
      <WapPanel variant="metal" glow="amber">
        <WapHeader title="ПАНЕЛЬ ПЕРСОНАЖА" glow="amber" />
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            {images.hero ? (
              <img src={images.hero} alt="" style={{ width: 80, height: 80, borderRadius: 4, border: '2px solid rgba(146,64,14,0.4)', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: 4, border: '2px solid rgba(146,64,14,0.4)', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🧟</div>
            )}
            <div style={{ marginTop: 6, fontFamily: 'var(--wa-font-hud)', fontSize: 12, color: 'var(--wa-accent-amber)', fontWeight: 600 }}>Lv.{level}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: 'var(--wa-font-display)', fontSize: 18, color: 'var(--text-primary)', letterSpacing: 2, fontWeight: 600 }}>WASTELANDER</div>
            <WapHudBar label="HP" value={stats.currentHp} max={stats.maxHp} variant="hp" size="md" />
            <WapHudBar label="ST" value={stats.stamina} max={stats.maxStamina} variant="stamina" size="md" />
            <WapHudBar label="XP" value={currentExp} max={expToNext} variant="xp" size="md" />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', fontFamily: 'var(--wa-font-display)', fontSize: 14, letterSpacing: 1 }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>🟡</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', marginRight: 8 }}>МОЩНОСТЬ</span>
              <span
                style={{ color: 'var(--wa-accent-amber)', fontWeight: 700, cursor: 'help', borderBottom: '1px dashed rgba(251,191,36,0.3)' }}
                onMouseEnter={(e) => { setShowPowerBreakdown(true); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setShowPowerBreakdown(false)}
              >
                {(stats.power || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </WapPanel>

      {/* Stats */}
      <WapPanel variant="metal">
        <WapHeader title="ХАРАКТЕРИСТИКИ" glow="none" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {statCapsules.map((s) => (
            <span key={s.label}
              onMouseEnter={(e) => { setHoveredStat(s); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
              onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredStat(null)}
              style={{
                fontSize: 11, fontFamily: 'var(--wa-font-hud)', padding: '2px 8px',
                background: 'rgba(0,0,0,0.3)', borderRadius: 3,
                border: '1px solid rgba(200,200,200,0.06)',
                color: 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'default',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {s.label} <strong style={{ color: 'var(--wa-accent-amber)' }}>{s.value}</strong>
            </span>
          ))}
        </div>
        {hasElemDps && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {elemDps.map((s) => (
              <span key={s.label}
                onMouseEnter={(e) => { setHoveredStat({ label: s.label, value: s.value.toFixed(1), desc: s.desc }); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredStat(null)}
                style={{
                  fontSize: 10, fontFamily: 'var(--wa-font-hud)', padding: '1px 6px',
                  background: 'rgba(0,0,0,0.2)', borderRadius: 3,
                  border: `1px solid ${s.color}22`, color: s.color, whiteSpace: 'nowrap', cursor: 'default',
                }}
              >
                {s.label} +{s.value.toFixed(1)}
              </span>
            ))}
          </div>
        )}
        {activeEffects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {activeEffects.map((e) => {
              const boostDesc = e.statBoosts ? Object.entries(e.statBoosts).map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(', ') : '';
              return (
              <span key={e.id}
                onMouseEnter={(ev) => { setHoveredStat({ label: e.name, value: `${e.remaining}с`, desc: boostDesc || 'нет бонусов' }); setTooltipPos({ x: ev.clientX, y: ev.clientY }); }}
                onMouseMove={(ev) => setTooltipPos({ x: ev.clientX, y: ev.clientY })}
                onMouseLeave={() => setHoveredStat(null)}
                style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3,
                  background: 'rgba(74,222,128,0.08)', color: '#4ade80',
                  border: '1px solid rgba(74,222,128,0.15)',
                  fontFamily: 'var(--wa-font-hud)', whiteSpace: 'nowrap', cursor: 'help',
                }}>
                {e.name} ✦{e.remaining}
              </span>
            );})}
          </div>
        )}
      </WapPanel>

      {/* Quick actions */}
      <WapPanel variant="metal">
        <WapHeader title="БЫСТРЫЕ ДЕЙСТВИЯ" glow="none" />
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="primary" onClick={() => { playClick(); navigate('/map'); }} style={{ flex: 1, fontSize: 10 }}>🗺️ Карта</Button>
          <Button size="sm" variant="secondary" onClick={() => { playClick(); toggleInventory(); }} style={{ flex: 1, fontSize: 10 }}>🎒 Инвентарь</Button>
          <Button size="sm" variant="secondary" onClick={() => { playClick(); toggleEquipment(); }} style={{ flex: 1, fontSize: 10 }}>⚔️ Экипировка</Button>
          <Button size="sm" variant="secondary" onClick={() => { playClick(); if (combat.isFighting || travel.isTraveling) { useUiStore.getState().addToast('Нельзя отдыхать в бою или пути!', 'warning'); return; } setIsResting(true); usePlayerStore.getState().rest(); }} style={{ flex: 1, fontSize: 10 }}>🛌 Отдых</Button>
        </div>
      </WapPanel>

      {/* Status cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        {combat.isFighting && (
          <div style={{ flex: 1, cursor: 'pointer', background: 'rgba(18,16,14,0.88)', borderRadius: 6, border: '1px solid rgba(146,64,14,0.3)', padding: 10 }} onClick={() => navigate('/battle')}>
            <div style={{ fontSize: 11, fontFamily: 'var(--wa-font-hud)', fontWeight: 600, marginBottom: 4, color: 'var(--wa-accent)' }}>⚔️ ПОДГОТОВКА К БОЮ ЗАВЕРШЕНА</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--wa-font-terminal)' }}>НАЖМИТЕ ДЛЯ НАЧАЛА</div>
          </div>
        )}
        {isResting && (
          <WapPanel variant="metal" style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--wa-font-hud)', fontWeight: 600, marginBottom: 4 }}>🛌 Отдых...</div>
            <ProgressBar value={stats.currentHp} max={stats.maxHp} variant="hp" label="HP" />
          </WapPanel>
        )}
        {queue.length === 0 && !combat.isFighting && !isResting && (
          <WapPanel variant="metal" style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--wa-font-terminal)' }}>Нет активных экспедиций. 🗺️ Карта</div>
          </WapPanel>
        )}
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <WapPanel variant="metal">
          <WapHeader title="ОЧЕРЕДЬ ЗАДАНИЙ" glow="none" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {queue.map((entry) => (
              <div key={entry.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 8px', background: entry.status === 'active' ? 'rgba(217,119,6,0.08)' : 'rgba(0,0,0,0.3)',
                borderRadius: 3, border: `1px solid ${entry.status === 'active' ? 'rgba(217,119,6,0.3)' : 'rgba(200,200,200,0.06)'}`,
              }}>
                <span style={{ fontSize: 12, fontFamily: 'var(--wa-font-hud)', color: 'var(--text-primary)' }}>{entry.zoneName}</span>
                <span style={{ fontSize: 11, color: entry.status === 'active' ? 'var(--wa-accent-amber)' : 'var(--text-muted)', fontFamily: 'var(--wa-font-terminal)' }}>
                  {entry.status === 'active' ? `${entry.remaining}c` : entry.status}
                </span>
              </div>
            ))}
          </div>
        </WapPanel>
      )}

      {/* Power breakdown tooltip */}
      {showPowerBreakdown && (
        <div style={{
          position: 'fixed',
          left: Math.min(tooltipPos.x + 14, window.innerWidth - 300),
          top: Math.min(tooltipPos.y - 8, window.innerHeight - 300),
          zIndex: 9999, width: 260,
          background: '#12121a', border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 4, padding: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(251,191,36,0.1)',
          pointerEvents: 'none', fontSize: 11,
        }}>
          <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: 6, fontSize: 12 }}>🟡 Разбор мощности</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>⚔️ Атака (DPS ×3):</span>
            <span style={{ color: 'var(--text-primary)' }}>+{powerBreakdown.offensiveScore.toLocaleString()}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>🛡️ Защита (EHP /10):</span>
            <span style={{ color: 'var(--text-primary)' }}>+{powerBreakdown.defensiveScore.toLocaleString()}</span>
          </div>
          {powerBreakdown.itemPowers.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginBottom: 4 }}>
                <div style={{ color: '#fbbf24', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>⚙️ Предметы</div>
                {powerBreakdown.itemPowers.map((ip, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10 }}>
                    <span>{ip.slot} <span style={{ opacity: 0.4 }}>({ip.itemName})</span></span>
                    <span style={{ color: '#fbbf24' }}>+{ip.power}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {powerBreakdown.abilityItems.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginBottom: 4 }}>
                <div style={{ color: '#fbbf24', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>💎 Способности амуниции</div>
                {powerBreakdown.abilityItems.map((ai, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10 }}>
                    <span>{ai.abilityName} <span style={{ opacity: 0.4 }}>({ai.itemName})</span></span>
                    <span style={{ color: '#fbbf24' }}>+{ai.power}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-primary)' }}>Итого</span>
            <span style={{ color: '#fbbf24' }}>{(stats.power || 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredStat && (
        <div style={{
          position: 'fixed',
          left: Math.min(tooltipPos.x + 14, window.innerWidth - 260),
          top: Math.min(tooltipPos.y - 8, window.innerHeight - 200),
          zIndex: 9999, width: 230,
          background: '#12121a', border: '1px solid rgba(146,64,14,0.3)',
          borderRadius: 4, padding: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(146,64,14,0.1)',
          pointerEvents: 'none', fontSize: 10,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, fontSize: 11, fontFamily: 'var(--wa-font-hud)' }}>
            {hoveredStat.label}: {hoveredStat.value}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.4, fontFamily: 'var(--wa-font-terminal)', fontSize: 11 }}>
            {hoveredStat.desc}
          </div>
          {hoveredStat.breakpoints && hoveredStat.breakpoints.length > 0 && (
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--wa-font-display)' }}>Брейкпоинты</div>
              {hoveredStat.breakpoints.map((bp, i) => (
                <div key={i} style={{ color: 'var(--wa-accent-amber)', lineHeight: 1.6, fontSize: 12, fontFamily: 'var(--wa-font-terminal)' }}>{bp}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Debug */}
      <div style={{ opacity: 0.35 }}>
        <WapPanel variant="metal">
          <WapHeader title="🧪 DEBUG" glow="none" />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button size="sm" variant="ghost" onClick={() => debugGenerateItems(20)} style={{ fontSize: 9 }}>+20 предметов</Button>
            <Button size="sm" variant="ghost" onClick={() => debugAddResources(10)} style={{ fontSize: 9 }}>+10 рес.</Button>
            <Button size="sm" variant="ghost" onClick={() => usePlayerStore.getState().addChips(5000)} style={{ fontSize: 9 }}>+5000 💾</Button>
            <Button size="sm" variant="ghost" onClick={() => usePlayerStore.getState().addExp(5000)} style={{ fontSize: 9 }}>+5000 XP</Button>
            <Button size="sm" variant="ghost" onClick={() => debugAddMods(5)} style={{ fontSize: 9 }}>+5 модификаций</Button>
            <Button size="sm" variant="primary" onClick={() => debugAddAmmo(4)} style={{ fontSize: 9 }}>+4 амуниции 🎒</Button>
            <Button size="sm" variant="success" onClick={() => usePlayerStore.setState((s) => ({ stats: { ...s.stats, currentHp: s.stats.maxHp } }))} style={{ fontSize: 9 }}>❤️ Полное исцеление</Button>
            <Button size="sm" variant="danger" onClick={() => { useInventoryStore.getState().setItems([]); usePlayerStore.getState().addLog('🧹 Инвентарь очищен', 'info'); }} style={{ fontSize: 9 }}>🗑️ Очистить инвентарь</Button>
            <Button size="sm" variant="danger" onClick={() => usePlayerStore.getState().resetLevel()} style={{ fontSize: 9 }}>⬇️ Сброс уровня</Button>
          </div>
        </WapPanel>
      </div>
    </motion.div>
  );
};