import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useCombatGridStore } from '../stores/combatGridStore';
import { useUiStore } from '../stores/uiStore';
import { generateSkirmishCards, skirmishPowerMult, type SkirmishCard } from '../data/skirmish';

const slCost = (c: SkirmishCard) => 15 + c.rarity.tier * 5;

const DAMAGER_LABEL: Record<string, string> = {
  melee: '🔪 Мили',
  sniper: '🎯 Снайпер',
  original: '🔫 Стрелок',
  drob: '💥 Дробовик',
};

export const Skirmishes = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<SkirmishCard[]>(() => generateSkirmishCards());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const addLog = usePlayerStore((s) => s.addLog);
  const addToast = useUiStore((s) => s.addToast);

  const handleStart = (cardId?: string) => {
    const id = cardId || selectedId;
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const cs = useCombatGridStore.getState();
    if (cs.isActive) {
      addLog('⚔️ Бой уже идёт', 'warning');
      return;
    }
    // Без полного отряда (3 наёмника) в стычку нельзя.
    const pst0 = usePlayerStore.getState();
    const empty = (['merc1', 'merc2', 'merc3'] as const).filter((k) => !(pst0.mercSlots as any)?.[k]);
    if (empty.length > 0) {
      addToast('❌ Заполни все 3 слота наёмников в экипировке', 'error');
      addLog('❌ Стычка: пустые слоты наёмников — в бой нельзя', 'warning');
      return;
    }
    const pst = usePlayerStore.getState();
    const cost = slCost(card);
    if ((pst.stats.stamina || 0) < cost) {
      addToast(`❌ Нужно ${cost} выносливости`, 'error');
      return;
    }
    usePlayerStore.setState((st: any) => ({
      stats: { ...st.stats, stamina: Math.max(0, st.stats.stamina - cost) },
    }));
    try {
      usePlayerStore.getState().startCombat(1, true);
      const ok = useCombatGridStore.getState().startSkirmish(card);
      if (!ok) throw new Error('startSkirmish failed');
    } catch (e) {
      try { useCombatGridStore.getState().cleanup(); } catch { /* ignore */ }
      addLog('⚠️ Стычка не запустилась', 'warning');
      return;
    }
    addLog(`⚔️ Стычка (${card.rarity.name}): расставь отряд и жми «В бой!»`, 'info');
    navigate('/battle');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>⚔️ Стычки 4×4</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ты + 3 напарника против танка, хила, дамагера и техника</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setCards(generateSkirmishCards()); setSelectedId(null); }}>
            🔄 Новые
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {cards.map((card) => {
            const isSelected = selectedId === card.id;
            const rarityColor = card.rarity.color;
            return (
              <motion.div
                key={card.id}
                whileHover={{ scale: 1.03 }}
                onClick={() => setSelectedId(card.id)}
                onDoubleClick={() => handleStart(card.id)}
                style={{
                  padding: 20,
                  background: 'linear-gradient(rgba(20,8,8,0.55), rgba(0,0,0,0.75))',
                  border: `2px solid ${isSelected ? rarityColor : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isSelected ? `0 0 14px ${rarityColor}` : 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: 140,
                }}
              >
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  padding: '2px 8px', borderRadius: 4, fontSize: 10,
                  background: rarityColor,
                  color: '#000', fontWeight: 700,
                }}>
                  {card.rarity.name}
                </div>
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  padding: '2px 8px', borderRadius: 4, fontSize: 11,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff', fontWeight: 600,
                }}
                  title={`Вход стоит ${slCost(card)} выносливости`}>
                  SL {slCost(card)} <span style={{ color: '#fbbf24' }}>⚡</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 20, color: '#fff' }}>
                  {card.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  🛡️ Танк · 💉 Хил · {DAMAGER_LABEL[card.damager]} · 🔧 Техник
                </div>
                <div style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>
                  💀 Мощь врагов ×{skirmishPowerMult(card.rarity.tier)}
                </div>
                <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>
                  💾 {card.chipReward} чипов за победу
                </div>
              </motion.div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            disabled={!selectedId}
            onClick={() => handleStart()}
          >
            ⚔️ В стычку
          </Button>
        </div>
      </WapPanel>
    </motion.div>
  );
};
