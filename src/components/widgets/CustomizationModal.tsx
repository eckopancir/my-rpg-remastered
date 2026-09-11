import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WapHeader } from '../ui/WapHeader';
import { ItemTooltip } from './ItemTooltip';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { getItemImage, images } from '../../assets/index';
import type { Item } from '../../types/items';

interface Props {
  item: Item | null;
  slot: string;
  onClose: () => void;
}

interface ModSlotPos {
  id: string;
  name: string;
  top: number;
  left: number;
}

const SCALE = 0.78;

const FIREARM_SLOT_POSITIONS: ModSlotPos[] = [
  { id: 'mod_scope', name: 'Прицел', top: Math.round(93 * SCALE), left: Math.round(193 * SCALE) },
  { id: 'mod_barrel', name: 'Ствол', top: Math.round(130 * SCALE), left: Math.round(340 * SCALE) },
  { id: 'mod_receiver', name: 'Ресивер', top: Math.round(170 * SCALE), left: Math.round(240 * SCALE) },
  { id: 'mod_muzzle', name: 'Дуло', top: Math.round(113 * SCALE), left: Math.round(439 * SCALE) },
  { id: 'mod_magazine', name: 'Магазин', top: Math.round(250 * SCALE), left: Math.round(130 * SCALE) },
  { id: 'mod_stock', name: 'Приклад', top: Math.round(168 * SCALE), left: Math.round(130 * SCALE) },
];

const COLD_WEAPON_SLOT_POSITIONS: ModSlotPos[] = [
  { id: 'mod_blade', name: 'Лезвие', top: Math.round(130 * SCALE), left: Math.round(140 * SCALE) },
  { id: 'mod_handle', name: 'Рукоять', top: Math.round(230 * SCALE), left: Math.round(390 * SCALE) },
  { id: 'mod_pommel', name: 'Обух', top: Math.round(230 * SCALE), left: Math.round(190 * SCALE) },
  { id: 'mod_harness', name: 'Крепление', top: Math.round(130 * SCALE), left: Math.round(390 * SCALE) },
];

const ARMOR_MOD_SLOTS: ModSlotPos[] = [
  { id: 'mod_lining', name: 'Подкладка', top: Math.round(130 * SCALE), left: Math.round(140 * SCALE) },
  { id: 'mod_hardshell', name: 'Накладка', top: Math.round(130 * SCALE), left: Math.round(390 * SCALE) },
  { id: 'mod_utility', name: 'Система', top: Math.round(230 * SCALE), left: Math.round(190 * SCALE) },
  { id: 'mod_patch', name: 'Усиление', top: Math.round(230 * SCALE), left: Math.round(390 * SCALE) },
];

const SLOT_LABELS: Record<string, string> = {
  head: 'Шлем', armor: 'Броня', pants: 'Штаны', weapon1: 'Оружие', weapon2: 'Вторая рука',
  gloves: 'Перчатки', boots: 'Ботинки',
};

const DISPLAY_W = 520;
const DISPLAY_H = 430;

export const CustomizationModal = ({ item, slot, onClose }: Props) => {
  const inventoryItems = useInventoryStore((s) => s.items);
  const removeItem = useInventoryStore((s) => s.removeItem);
  const addItem = useInventoryStore((s) => s.addItem);
  const equipment = usePlayerStore((s) => s.equipment);
  const addLog = usePlayerStore((s) => s.addLog);
  const recalcStats = usePlayerStore((s) => s.recalcStats);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [hoverMod, setHoverMod] = useState<Item | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const draggedItemId = useUiStore((s) => s.draggedItemId);
  const draggedMod = inventoryItems.find((i) => i.id === draggedItemId && i.type === 'mod');
  const liveItem = equipment[slot as keyof typeof equipment] || item;

  const slotsArray: ModSlotPos[] = (() => {
    const itemType = liveItem?.slot;
    if (itemType === 'weapon1') return COLD_WEAPON_SLOT_POSITIONS;
    if (itemType === 'weapon2') return FIREARM_SLOT_POSITIONS;
    if (['head', 'armor', 'pants', 'gloves', 'boots'].includes(itemType || '')) return ARMOR_MOD_SLOTS;
    return [];
  })();

  const handleModDrop = (modSlotId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
    // Фолбэк: dataTransfer иногда пуст — берём id из стора.
    const dtId = e.dataTransfer.getData('text/plain');
    const modId = dtId || draggedItemId;
    if (!modId) return;
    const mod = inventoryItems.find((i) => i.id === modId);
    if (!mod || mod.type !== 'mod') { addLog('❌ Это не мод.', 'warning'); return; }
    if (mod.slot !== modSlotId) { addLog(`❌ ${mod.displayName || mod.name} не подходит для слота "${modSlotId.replace('mod_', '')}".`, 'warning'); return; }
    const equipSlot = slot as keyof typeof equipment;
    const parentItem = equipment[equipSlot];
    if (!parentItem) { addLog('❌ Предмет не экипирован.', 'warning'); return; }
    const currentMod = parentItem.mods?.[modSlotId];
    if (currentMod) {
      addItem({ ...currentMod, id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
      addLog(`📦 Снят старый мод: ${currentMod.displayName || currentMod.name}`, 'info');
    }
    const updatedParent = {
      ...parentItem,
      mods: { ...(parentItem.mods || {}), [modSlotId]: mod },
    };
    usePlayerStore.setState((state) => ({
      equipment: { ...state.equipment, [equipSlot]: updatedParent },
    }));
    removeItem(modId);
    recalcStats();
    addLog(`🔧 Установлен мод: ${mod.displayName || mod.name} на ${parentItem.displayName || parentItem.name}`, 'loot');
  };

  const handleRemoveMod = (modSlotId: string) => {
    const equipSlot = slot as keyof typeof equipment;
    const parentItem = equipment[equipSlot];
    if (!parentItem?.mods?.[modSlotId]) return;
    const mod = parentItem.mods[modSlotId];
    addItem({ ...mod, id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
    const newMods = { ...parentItem.mods };
    delete newMods[modSlotId];
    usePlayerStore.setState((state) => ({
      equipment: { ...state.equipment, [equipSlot]: { ...parentItem, mods: newMods } },
    }));
    recalcStats();
    setHoverMod(null);
    addLog(`📦 Мод ${mod.displayName || mod.name} снят`, 'info');
  };

  const itemImg = liveItem ? getItemImage(liveItem.name, liveItem.displayName) : undefined;

  const [pos, setPos] = useState({ x: window.innerWidth / 2 - 280, y: window.innerHeight / 2 - 220 });
  const dragState = useRef<{ dx: number; dy: number } | null>(null);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    dragState.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      setPos({ x: ev.clientX - dragState.current.dx, y: ev.clientY - dragState.current.dy });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'transparent',
          pointerEvents: 'none',
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: pos.x, top: pos.y,
            width: 720, maxWidth: '96vw',
            pointerEvents: 'auto',
          }}
        >
          <WapHeader
            title={`🔧 КАСТОМИЗАЦИЯ: ${liveItem?.displayName || liveItem?.name || SLOT_LABELS[slot] || slot}`}
            glow="amber"
            onMouseDown={onHeaderMouseDown}
            style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))' }}
          >
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
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            padding: 16,
          }}>
          <div style={{
            background: 'rgba(8,8,14,0.4)',
            borderRadius: 8, padding: 12,
            backgroundImage: images.workshop ? `url(${images.workshop})` : 'none',
            backgroundSize: '92%',
            backgroundPosition: 'center',
          }}>

          {liveItem && (
            <div style={{
              position: 'relative',
              width: DISPLAY_W, height: DISPLAY_H,
              maxWidth: '100%', margin: '0 auto',
              backgroundImage: itemImg ? `url(${itemImg})` : 'none',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}>
              {slotsArray.map(({ id, name, top, left }) => {
                const modItem = liveItem.mods?.[id];
                const isCompatible = !!draggedMod && draggedMod.slot === id && !dragOverSlot;
                return (
                  <div
                    key={id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSlot(id); }}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={handleModDrop(id)}
                    onClick={() => modItem && handleRemoveMod(id)}
                    onMouseEnter={(e) => { if (modItem) { setHoverMod(modItem); setHoverPos({ x: e.clientX, y: e.clientY }); } }}
                    onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoverMod(null)}
                    style={{
                      position: 'absolute',
                      top, left,
                      width: 80, height: 80,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      textAlign: 'center',
                      border: `2px solid ${
                        modItem ? '#50B550'
                        : dragOverSlot === id ? 'var(--accent-primary)'
                        : isCompatible ? '#50B550'
                        : 'rgba(170,170,170,0.5)'
                      }`,
                      background: modItem ? 'rgba(50,150,70,0.9)' : dragOverSlot === id ? 'rgba(99,102,241,0.35)' : isCompatible ? 'rgba(50,150,70,0.35)' : 'rgba(30,30,30,0.7)',
                      borderRadius: 6, cursor: modItem ? 'pointer' : 'default',
                      transition: 'all 100ms',
                    }}
                  >
                    {modItem ? (
                      <>
                        {(() => {
                          const modImg = modItem.image || getItemImage(modItem.name, modItem.displayName);
                          return modImg ? (
                            <img src={modImg} alt={modItem.name} style={{ width: 36, height: 36, objectFit: 'contain', imageRendering: 'pixelated' }} />
                          ) : null;
                        })()}
                        <span style={{ fontSize: 9, color: '#fff', fontWeight: 'bold', lineHeight: 1.1, marginTop: 2 }}>
                          {modItem.displayName || modItem.name}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', margin: 0 }}>
            Перетащи мод из инвентаря в слот. Нажми на слот с модом, чтобы снять.
          </p>

          {hoverMod && (
            <ItemTooltip item={hoverMod} x={hoverPos.x} y={hoverPos.y} />
          )}
          </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
