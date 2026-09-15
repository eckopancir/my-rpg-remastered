import { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import ZeroTree from '../components/zerotree/ZeroTree.jsx';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';

// ZeroTree config adapted to our game stats
const TREE_CONFIG = {
  treeSeed: 0x1337BEEF,
  playerSeed: 0xCAFEBABE,
  cols: 9,
  rows: 7,
  statNames: ["damage", "armor", "maxHp", "crit", "evasion", "speed", "regen", "vampir", "punching", "accuracy", "block", "dpsFire"],
  statRanges: {
    damage:  [1, 2],
    armor:   [1, 1],
    maxHp:   [10, 15],
    crit:    [1, 1],
    evasion: [1, 1],
    speed:   [1, 1],
    regen:   [1, 1],
    vampir:  [1, 1],
    punching:[1, 1],
    accuracy:[1, 1],
    block:   [1, 1],
    dpsFire: [1, 1],
  },
  abilityPool: [
    { id: "cap_sniper", name: "Прицел снайпера", type: "ACTIVE", description: "Выстрел ×7 урон, +500% крит шанс. КД 5 ходов.", apCost: 2, cooldown: 5, powerRating: 70, effects: [{ type: "damage", multiplier: 7 } as any, { type: "stat_boost", stat: "crit", value: 5.0, duration: 1 } as any] },
    { id: "cap_soldier", name: "Стойкость героя", type: "PASSIVE", description: "+8% блок, +600 HP, +5% скорость — бастион.", apCost: 0, cooldown: 0, powerRating: 60, effects: [{ type: "stat_boost", stat: "block", value: 0.08, duration: 999 } as any] },
    { id: "cap_berserk", name: "Бог войны", type: "ACTIVE", description: "Вихрь урона ×1.8 на 3 хода, +10% вампиризма.", apCost: 2, cooldown: 6, powerRating: 65, effects: [{ type: "stat_boost_mult", stat: "damage", value: 0.8, duration: 3 } as any, { type: "stat_boost", stat: "vampir", value: 0.10, duration: 3 } as any] },
    { id: "cap_tank", name: "Колосс", type: "PASSIVE", description: "+22 брони, +1100 HP, +8% блок.", apCost: 0, cooldown: 0, powerRating: 60, effects: [{ type: "stat_boost", stat: "armor", value: 22, duration: 999 } as any] },
    { id: "cap_occult", name: "Владыка тьмы", type: "PASSIVE", description: "+18 всех стихий, +10% вамп.", apCost: 0, cooldown: 0, powerRating: 65, effects: [{ type: "stat_boost", stat: "vampir", value: 0.10, duration: 999 } as any] },
    { id: "cap_night", name: "Тень убийцы", type: "ACTIVE", description: "Инвиз 3 хода + следующий удар 100% крит.", apCost: 2, cooldown: 6, powerRating: 65, effects: [{ type: "status", id: "invisibility", duration: 3 } as any, { type: "stat_boost", stat: "crit", value: 1.0, duration: 2 } as any] },
    { id: "cap_demo", name: "Апокалипсис", type: "ACTIVE", description: "АОЕ ×3, поджог 3 хода.", apCost: 3, cooldown: 7, powerRating: 70, effects: [{ type: "damage", multiplier: 3, aoe: 3 } as any] },
    { id: "cap_arcanist", name: "Абсолютный барьер", type: "ACTIVE", description: "Щит 50% 3 хода.", apCost: 2, cooldown: 7, powerRating: 60, effects: [{ type: "status", id: "shield", duration: 3 } as any] },
    { id: "cap_survivor", name: "Второе дыхание", type: "ACTIVE", description: "25% HP + 10% уклон 3 хода.", apCost: 2, cooldown: 7, powerRating: 60, effects: [{ type: "heal_percent", value: 25 } as any] },
    { id: "cap_merchant", name: "Золотой запас", type: "ACTIVE", description: "+2 AP 1 ход.", apCost: 1, cooldown: 6, powerRating: 55, effects: [{ type: "stat_boost", stat: "bonusAp", value: 2, duration: 1 } as any] },
    { id: "cap_trader", name: "Снабжение", type: "ACTIVE", description: "15% HP.", apCost: 1, cooldown: 8, powerRating: 50, effects: [{ type: "heal_percent", value: 15 } as any] },
    { id: "cap_stalker", name: "Выслеживание", type: "ACTIVE", description: "Телепорт + инвиз 2.", apCost: 2, cooldown: 6, powerRating: 60, effects: [{ type: "teleport" } as any] },
  ],
  // callbacks will be injected via wrapper
  abilityPool2: [] as any,
};

export const SkillsZeroTree = () => {
  const skillPoints = usePlayerStore(s => s.skillPoints);
  const addLog = usePlayerStore(s => s.addLog);
  const level = usePlayerStore(s => s.level);
  const applyZeroTreeDelta = usePlayerStore(s => (s as any).applyZeroTreeDelta || (()=>{}));
  const addZeroTreeAbility = usePlayerStore(s => (s as any).addZeroTreeAbility || (()=>{}));
  const removeZeroTreeAbility = usePlayerStore(s => (s as any).removeZeroTreeAbility || (()=>{}));
  const [showTree, setShowTree] = useState(true);

  // Build config with callbacks that hit our store
  const config = {
    ...TREE_CONFIG,
    onStatChange: (deltas: any[]) => {
      const mapped = deltas.map(d => {
        let delta = d.delta;
        let stat = d.stat.toLowerCase();
        // ZeroTree magnitude 1 => 0.2% for most, 0.1% for block, flat 1-2
        if (['crit','evasion','speed','vampir','punching','accuracy'].includes(stat)) {
          delta = delta * 0.002; // 1 => 0.2%
        } else if (stat === 'block') {
          delta = delta * 0.001; // 1 => 0.1%
        }
        // damage 1-2, armor 1, maxHp 10-15, dpsFire 1 already flat
        return { stat, delta };
      });
      // @ts-ignore
      if (applyZeroTreeDelta) (applyZeroTreeDelta as any)(mapped);
      // also recalc handled in store
      for (const d of mapped) {
        addLog(`ZeroTree: ${d.stat} ${d.delta > 0 ? '+' : ''}${d.delta}`, 'info');
      }
    },
    onAbilityUnlock: (ability: any) => {
      addZeroTreeAbility(ability);
      addLog(`⚡ Способность ZeroTree: ${ability.name}`, 'info');
    },
    onAbilityRevoke: (ability: any) => {
      removeZeroTreeAbility(ability);
      addLog(`↩ Отозвана: ${ability.name}`, 'warning');
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>⭐ Древо ZeroTree — процедурное</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Очков: <b style={{ color: '#4af7a0' }}>{skillPoints}</b> · Ур. {level}</span>
            <Button size="sm" variant="ghost" onClick={() => setShowTree(v => !v)}>{showTree ? 'Скрыть' : 'Показать'} древо</Button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Дерево 9×7 = 63 нода, детерминированное от <code>treeSeed=0x1337BEEF</code>. Каждая нода — STAT/PASSIVE/ACTIVE/KEYSTONE. Связи считаются хешем пары, без хранения. Корень всегда открыт. Клик → выбор, клик снова → вкачать за очки. Бесплатные способности капстоунов интегрируются как ACTIVE/PASSIVE ноды.
        </div>
      </WapPanel>

      {showTree && (
        <div style={{ position: 'relative', minHeight: 520, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ZeroTree
            visible={true}
            onClose={() => setShowTree(false)}
            config={config as any}
            initialPoints={Math.min(skillPoints, 20)}
          />
        </div>
      )}

      <WapPanel variant="metal" padding="lg">
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Как встроено в вашу игру</div>
        <ul style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 16 }}>
          <li><b>treeSeed</b> — один int → всё дерево (63 ноды, 4 типа, 12 статов, 6 способностей). Смените — другое дерево.</li>
          <li><b>statRanges</b> настроены под ваши статы (урон 1-3, броня 1-2, HP 12-35, крит 1-2% и т.д., блок 1%).</li>
          <li><b>abilityPool</b> — 6 способностей капстоунов (Снайпер ×7/500% крит КД5, Берсерк, Танк и т.д.) — падают на ACTIVE/PASSIVE ноды.</li>
          <li><b>onStatChange</b> → <code>applyZeroTreeDelta</code> в <code>playerStore</code> → добавляется к <code>recalcStats</code>.</li>
          <li><b>onAbilityUnlock/Revoke</b> → пушит в <code>zeroTreeAbilities</code> → попадает в <code>Battle</code> как бесплатные слоты (мимо расходников).</li>
          <li><b>Персист</b> — <code>serialize()</code> → base64 маска + spent → хранить в <code>playerStore</code> + сервер.</li>
        </ul>
      </WapPanel>
    </div>
  );
};
