import { useState } from 'react';
import { motion } from 'framer-motion';
import { useInventoryStore, type InvTab } from '../stores/inventoryStore';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { useUiStore } from '../stores/uiStore';
import { usePlayerStore, getEquipSlot } from '../stores/playerStore';
import { getItemImage } from '../assets/index';
import type { Item } from '../types/items';
import { ABILITY_MAP } from '../data/accessoryAbilities';

const tabs: InvTab[] = ['all', 'weapons', 'armor', 'mods', 'materials'];

export const Inventory = () => {
  const {
    items, activeTab, sortKey, sortAsc, searchQuery, filterRarity,
    setActiveTab, toggleSortAsc, setSearchQuery, removeItem, addItem,
  } = useInventoryStore();
  const addToast = useUiStore((s) => s.addToast);
  const equipItem = usePlayerStore((s) => s.equipItem);
  const equipment = usePlayerStore((s) => s.equipment);
  const useConsumable = usePlayerStore((s) => s.useConsumable);

  const [tooltipItem, setTooltipItem] = useState<Item | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleEquip = (item: Item) => {
    const slot = getEquipSlot(item);
    if (!slot) {
      addToast(`❌ ${item.displayName || item.name} нельзя экипировать`, 'warning');
      return;
    }
    if (equipment[slot]) {
      addToast(`❌ Слот ${slot} уже занят. Сначала снимите предмет.`, 'warning');
      return;
    }
    if (equipItem(slot, item)) {
      removeItem(item.id);
      addToast(`⛓️ ${item.displayName || item.name} экипирован`, 'info');
    }
  };

  const handleMouseEnter = (item: Item | null, e: React.MouseEvent) => {
    if (!item) return;
    setTooltipItem(item);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!tooltipItem) return;
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => setTooltipItem(null);

  const filteredItems = items
    .filter((i) => activeTab === 'all' || i.type === activeTab.slice(0, -1) || (activeTab === 'weapons' && i.type === 'weapon'))
    .filter((i) => !searchQuery || i.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || i.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((i) => filterRarity.length === 0 || filterRarity.includes(i.rarity));

  const getSortVal = (item: typeof items[0], key: string) => {
    if (key === 'rarity') return item.quality || item.rarity || '';
    if (key === 'price') return (item as any).price || 0;
    return item.level || 0;
  };

  const sorted = [...filteredItems].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    const aVal = getSortVal(a, sortKey);
    const bVal = getSortVal(b, sortKey);
    if (typeof aVal === 'string') return aVal.localeCompare(String(bVal)) * dir;
    return (Number(aVal) - Number(bVal)) * dir;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ position: 'relative' }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Inventory</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {items.length} items
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>

        {/* Search & Sort */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: 13,
              outline: 'none',
            }}
          />
          <Button size="sm" onClick={toggleSortAsc}>
            {sortAsc ? '↑' : '↓'} {sortKey}
          </Button>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {sorted.slice(0, 100).map((item) => (
            <motion.div
              key={item.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', item.id);
                e.dataTransfer.effectAllowed = 'move';
                useUiStore.getState().setDraggedItemId(item.id);
              }}
              onDragEnd={() => useUiStore.getState().setDraggedItemId(null)}
              onDoubleClick={() => {
                removeItem(item.id);
                addToast(`${item.displayName || item.name} выброшен`, 'warning');
              }}
              onMouseEnter={(e) => handleMouseEnter(item, e)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              whileHover={{ scale: 1.04, borderColor: item.qualityColor || 'rgba(255,255,255,0.3)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                padding: 10, background: 'var(--bg-glass)',
                border: `1px solid ${item.qualityColor || 'var(--border-glass)'}`,
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontSize: 12, userSelect: 'none',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', margin: '0 auto 6px', textAlign: 'center' }}>
                {(() => { const url = getItemImage(item.name, item.displayName); return url ? <img src={url} alt="" style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated', display: 'block', borderRadius: 4, background: 'rgba(0,0,0,0.2)' }} /> : null; })()}
              </div>
              {item.abilityId && ABILITY_MAP[item.abilityId] && (
                <div style={{ fontSize: 10, color: 'var(--wa-accent-amber)', textAlign: 'center', marginBottom: 4, padding: '1px 4px', background: 'rgba(217,119,6,0.1)', borderRadius: 3, border: '1px solid rgba(217,119,6,0.2)' }}>
                  {ABILITY_MAP[item.abilityId].icon} {ABILITY_MAP[item.abilityId].name}
                </div>
              )}
              <div style={{ fontWeight: 500, color: item.qualityColor || 'var(--text-primary)', fontSize: 13 }}>
                {item.displayName || item.name}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                Lv.{item.level || 1}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4 }}>
                {Object.entries(item.stats || {}).slice(0, 3).map(([k, v]) => {
                  const val = typeof v === 'object' ? (v as any).base || 0 : v;
                  if (!val) return null;
                  return (
                    <span key={k} style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {k}:+{typeof val === 'number' ? val.toFixed(val > 1 ? 1 : 3) : val}
                    </span>
                  );
                })}
              </div>
              {(() => {
                const slot = getEquipSlot(item);
                if (!item.slot || !slot) return null;
                const isOccupied = !!equipment[slot];
                return isOccupied ? (
                  <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                    слот {slot} занят
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEquip(item)}
                    style={{ marginTop: 6, fontSize: 10, padding: '2px 6px', width: '100%' }}
                  >
                    ⛓️ Экипировать
                  </Button>
                );
              })()}
              {(item.type === 'consumable' || item.timeLimit) && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => { useConsumable(item); }}
                  style={{ marginTop: 4, fontSize: 10, padding: '2px 6px', width: '100%' }}
                >
                  🧪 Использовать
                </Button>
              )}
            </motion.div>
          ))}
          {sorted.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No items found
            </div>
          )}
        </div>
      </WapPanel>

      {tooltipItem && <ItemTooltip item={tooltipItem} x={tooltipPos.x} y={tooltipPos.y} />}
    </motion.div>
  );
};
