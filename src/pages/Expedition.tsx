import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { getAvailableCards, getRefreshTime, forceRefresh, ENEMY_TYPE_TO_KEY } from '../data/encounters';
import type { GeneratedCard, EnemyShortName } from '../data/encounters';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore, type ExpeditionEntry } from '../stores/uiStore';

const RARITY_BG: Record<string, string> = {
  'Обычный': 'rgba(255,255,255,0.3)',
  'Редкий': 'rgba(0,255,0,0.35)',
  'Раритетный': 'rgba(0,191,255,0.35)',
  'Эпический': 'rgba(147,112,219,0.35)',
  'Смертоносный': 'rgba(255,0,0,0.35)',
  'Легендарный': 'rgba(255,215,0,0.35)',
  'Божественный': 'rgba(0,255,255,0.35)',
};

const ENEMY_LABELS: Record<EnemyShortName, string> = {
  tank: 'Танк',
  melee: 'Мили',
  sniper: 'Снайпер',
  drob: 'Дробовик',
  original: 'Стрелок',
  medic: 'Медик',
  boss: 'БОСС',
};

export const Expedition = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zoneName = searchParams.get('zone') || 'Заброшенная военная база и окрестности';
  const addLog = usePlayerStore((s) => s.addLog);
  const addToQueue = useUiStore((s) => s.addToQueue);
  const addToast = useUiStore((s) => s.addToast);
  const countParam = searchParams.get('count');
  const expeditionDuration = countParam ? Math.max(1, parseInt(countParam, 10) || 3) : 3;

  const [cards, setCards] = useState<GeneratedCard[]>(() => getAvailableCards());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshTime, setRefreshTime] = useState(() => getRefreshTime());

  useEffect(() => {
    if (refreshTime <= 0) return;
    const t = setInterval(() => {
      setRefreshTime((prev) => {
        if (prev <= 1) {
          setCards(forceRefresh());
          setSelectedId(null);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [refreshTime]);

  const handleStart = useCallback((cardId?: string) => {
    const id = cardId || selectedId;
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card) return;

    const entryId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const entry: ExpeditionEntry = {
      id: entryId,
      zoneName,
      encounterIds: [card.id],
      status: 'active',
      duration: expeditionDuration,
      remaining: expeditionDuration,
      difficulty: card.totalSl,
      cardData: {
        enemyKeys: card.enemyTypes.map((t) => ENEMY_TYPE_TO_KEY[t]),
        chipReward: card.chipReward,
        xpReward: card.xpReward,
        cardRarityName: card.rarity.name,
      },
    };

    addToQueue(entry);
    addLog(`📋 Экспедиция на карту "${card.name}" (SL ${card.totalSl}) добавлена.`, 'info');
    addToast(`Экспедиция на "${card.name}" запущена!`, 'success');
    navigate('/dashboard');
  }, [selectedId, cards, zoneName, addToQueue, addLog, addToast, navigate]);

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
            <div style={{ fontSize: 18, fontWeight: 600 }}>{zoneName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Выбери столкновение для экспедиции</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Обновление: {Math.floor(refreshTime / 60)}:{String(refreshTime % 60).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {cards.map((card) => {
            const isSelected = selectedId === card.id;
            const rarityBg = RARITY_BG[card.rarity.name] || 'rgba(255,255,255,0.3)';
            const rarityColor = card.rarity.color;

            const enemyCounts: Partial<Record<EnemyShortName, number>> = {};
            card.enemyTypes.forEach((t) => {
              enemyCounts[t] = (enemyCounts[t] || 0) + 1;
            });

            return (
              <motion.div
                key={card.id}
                whileHover={{ scale: 1.03 }}
                onClick={() => setSelectedId(card.id)}
                onDoubleClick={() => handleStart(card.id)}
                style={{
                  padding: 20,
                  background: `
                    linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.6)),
                    url(${card.image}) center/cover
                  `,
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
                  background: rarityBg,
                  color: '#000', fontWeight: 700,
                }}>
                  {card.rarity.name}
                </div>

                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  padding: '2px 8px', borderRadius: 4, fontSize: 11,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff', fontWeight: 600,
                }}>
                  SL {card.totalSl}
                </div>

                <div style={{
                  fontSize: 14, fontWeight: 600, marginTop: 20,
                  color: '#fff',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                }}>
                  {card.name}
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 11 }}>
                  {(Object.entries(enemyCounts) as [EnemyShortName, number][]).map(([type, count]) => (
                    <span key={type} style={{
                      padding: '1px 6px', borderRadius: 3,
                      background: 'rgba(0,0,0,0.45)',
                      color: '#ddd',
                    }}>
                      {ENEMY_LABELS[type] || type} ×{count}
                    </span>
                  ))}
                </div>

                <div style={{
                  marginTop: 'auto',
                  display: 'flex', gap: 10, fontSize: 12,
                  color: '#bbb',
                }}>
                  <span>+{card.chipReward} 💾</span>
                  <span>+{card.xpReward} XP</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={() => navigate('/map')}>← Назад к карте</Button>
        </div>
      </WapPanel>
    </motion.div>
  );
};
