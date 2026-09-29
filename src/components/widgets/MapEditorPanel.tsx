import { useCombatGridStore } from '../../stores/combatGridStore';
import {
  useMapEditorStore, UNIT_BEHAVIORS, MAP_MUSIC,
  rotateSelected, deleteSelected, toggleSelectedRandom, addRandomObstacle,
} from '../../stores/mapEditorStore';
import { ENEMY_BASE_STATS } from '../../engine/enemies';
import { BIG_BUILDING_IMAGES, CAR_IMAGES, WOOD_IMAGES, SMALL_OBSTACLE_IMAGES } from '../../engine/terrain';

const buildingSize = (k: string) => (k === 'o8' || k === 'o9' ? { w: 8, h: 6 } : { w: 6, h: 5 });
const carSize = (k: string) => (k === 'o23' || k === 'o29' ? { w: 2, h: 3 } : { w: 1, h: 2 });

const OB_CATALOG: { icon: string; imgKey: string; w: number; h: number; label: string }[] = [
  ...BIG_BUILDING_IMAGES.map((k) => ({ icon: 'building', imgKey: k, ...buildingSize(k), label: k })),
  ...CAR_IMAGES.map((k) => ({ icon: 'car', imgKey: k, ...carSize(k), label: k })),
  ...WOOD_IMAGES.map((k) => ({ icon: 'woods', imgKey: k, w: 2, h: 2, label: k })),
  ...SMALL_OBSTACLE_IMAGES.map((k) => ({ icon: 'small', imgKey: k, w: 1, h: 1, label: k })),
  { icon: 'fence', imgKey: 'o5', w: 1, h: 1, label: 'o5 забор' },
  { icon: 'field', imgKey: 'green1', w: 10, h: 8, label: 'поле 10×8' },
  { icon: 'field', imgKey: 'green1', w: 6, h: 4, label: 'поле 6×4' },
  { icon: 'field', imgKey: 'green1', w: 4, h: 4, label: 'поле 4×4' },
];

const ENEMY_KEYS = Object.keys(ENEMY_BASE_STATS);

const panel: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, width: 264, maxHeight: 'calc(100% - 16px)',
  overflowY: 'auto', background: 'rgba(12,14,18,0.96)', border: '1px solid #3a3f4a',
  borderRadius: 8, padding: 10, zIndex: 60, color: '#e8e8e8', fontSize: 12,
};
const sec: React.CSSProperties = { marginTop: 10, borderTop: '1px solid #2a2e37', paddingTop: 8 };
const h: React.CSSProperties = { fontWeight: 700, marginBottom: 6, fontSize: 12 };
const grid: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4 };
const btn = (on: boolean): React.CSSProperties => ({
  fontSize: 11, padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
  border: on ? '2px solid #ffd54a' : '1px solid #4a505c',
  background: on ? '#3a3320' : '#1c2027', color: '#e8e8e8',
});
const act: React.CSSProperties = {
  fontSize: 11, padding: '4px 8px', borderRadius: 5, cursor: 'pointer',
  border: '1px solid #4a505c', background: '#232936', color: '#fff', marginRight: 4, marginTop: 4,
};

export const MapEditorPanel = () => {
  const ed = useMapEditorStore();
  const obstacles = useCombatGridStore((s) => s.obstacles);
  const enemies = useCombatGridStore((s) => s.enemies);
  if (!ed.active) return null;

  const selOb = ed.selObId !== null
    ? (obstacles as any[]).find((o: any) => o.id === ed.selObId)
    : null;
  const selUnit = ed.selUnitId !== null
    ? (enemies as any[]).find((e: any) => e.id === ed.selUnitId)
    : null;

  const rotateSel = () => {
    rotateSelected();
  };
  const deleteSel = () => {
    deleteSelected();
  };
  const setUnitBehavior = (b: string) => {
    ed.setBehavior(b);
    if (selUnit) {
      useCombatGridStore.setState((s: any) => ({
        enemies: s.enemies.map((e: any) => (e.id === (selUnit as any).id
          ? { ...e, aiRole: b === 'sleeping' ? 'patrol' : b, sleeping: b === 'sleeping' }
          : e)),
      }));
    }
  };
  const save = () => {
    const err = ed.saveMap(obstacles, enemies);
    if (err) {
      useCombatGridStore.getState().addBattleLog(`⚠️ ${err}`);
      return;
    }
    useCombatGridStore.getState().addBattleLog(`💾 Карта «${ed.mapName.trim()}» сохранена`);
  };

  return (
    <div style={panel}>
      <div style={{ ...h, fontSize: 13 }}>🛠 Конструктор карт</div>
      <div style={{ opacity: 0.75, fontSize: 11 }}>
        Выбранное водится за мышкой — клик ставит. Клик по объекту выбирает,
        следующий клик переносит. ПКМ — отмена инструмента.
        Объектов: {(obstacles as any[]).length}, юнитов: {(enemies as any[]).length}
      </div>

      <div style={sec}>
        <div style={h}>Курсор</div>
        <div style={grid}>
          <button style={btn(ed.tool.kind === 'select')} onClick={() => ed.setTool({ kind: 'select' })}>☝ Выбрать</button>
        </div>
      </div>

      <div style={sec}>
        <div style={h}>Объекты</div>
        {ed.tool.kind === 'obstacle' && (
          <div style={{ fontSize: 11, marginBottom: 6, opacity: 0.9 }}>
            Выбрано: {ed.tool.imgKey} {ed.tool.w}×{ed.tool.h}{' '}
            <button
              style={btn(false)}
              title="Развернуть до установки (поменять w/h)"
              onClick={() => ed.rotateTool()}
            >
              🔄 Развернуть
            </button>
          </div>
        )}
        <div style={grid}>
          {OB_CATALOG.map((o, i) => {
            const on = ed.tool.kind === 'obstacle' && ed.tool.imgKey === o.imgKey && ed.tool.w === o.w && ed.tool.h === o.h;
            return (
              <button
                key={`${o.imgKey}_${o.w}x${o.h}_${i}`}
                style={btn(on)}
                title={`${o.icon} ${o.w}×${o.h}`}
                onClick={() => ed.setTool({ kind: 'obstacle', icon: o.icon, imgKey: o.imgKey, w: o.w, h: o.h })}
              >
                {o.label} {o.w}×{o.h}
              </button>
            );
          })}
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 11 }}>
          <input type="checkbox" checked={ed.randomSpawn} onChange={(e) => ed.setRandomSpawn(e.target.checked)} />
          🎲 Случайное место при входе
        </label>
        <button
          style={act}
          disabled={ed.tool.kind !== 'obstacle'}
          title="Положить выбранный объект на случайное свободное место"
          onClick={() => {
            const err = addRandomObstacle();
            if (err) useCombatGridStore.getState().addBattleLog(`⚠️ ${err}`);
          }}
        >
          ➕ ДОБАВИТЬ
        </button>
      </div>

      <div style={sec}>
        <div style={h}>Юниты</div>
        <div style={grid}>
          <button
            style={btn(ed.tool.kind === 'unit' && ed.tool.side === 'neutral')}
            onClick={() => ed.setTool({ kind: 'unit', side: 'neutral', factionKey: 'Кабан' })}
          >
            🐗 Кабан (нейтрал)
          </button>
          <button
            style={btn(ed.tool.kind === 'unit' && ed.tool.side === 'ally')}
            onClick={() => ed.setTool({ kind: 'unit', side: 'ally', factionKey: 'Военные (original)' })}
          >
            🤝 Мусорщик (союзник)
          </button>
          {ENEMY_KEYS.map((k) => {
            const on = ed.tool.kind === 'unit' && ed.tool.side === 'enemy' && ed.tool.factionKey === k;
            return (
              <button key={k} style={btn(on)} onClick={() => ed.setTool({ kind: 'unit', side: 'enemy', factionKey: k })}>
                👹 {k}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 6, fontSize: 11 }}>
          Поведение:{' '}
          <select value={ed.behavior} onChange={(e) => setUnitBehavior(e.target.value)} style={{ fontSize: 11 }}>
            {UNIT_BEHAVIORS.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>
      </div>

      {(selOb || selUnit) && (
        <div style={sec}>
          <div style={h}>Выбрано</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>
            {selOb ? `Объект ${(selOb as any).imgKey || (selOb as any).icon} ${(selOb as any).w}×${(selOb as any).h}${(selOb as any).editorRandom ? ' 🎲 случайный' : ''}` : null}
            {selUnit ? `Юнит ${(selUnit as any).name} (${(selUnit as any).aiRole}${(selUnit as any).sleeping ? '+спит' : ''})` : null}
          </div>
          {selOb && <button style={act} onClick={rotateSel}>🔄 Развернуть 90°</button>}
          {selOb && <button style={act} onClick={() => toggleSelectedRandom()}>🎲 Случайное/фикс</button>}
          <button style={act} onClick={deleteSel}>🗑 Удалить</button>
        </div>
      )}

      <div style={sec}>
        <div style={h}>Музыка карты</div>
        <select value={ed.music} onChange={(e) => ed.setMusic(e.target.value)} style={{ fontSize: 11, width: '100%' }}>
          {MAP_MUSIC.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div style={sec}>
        <div style={h}>Сохранить</div>
        <input
          value={ed.mapName}
          onChange={(e) => ed.setMapName(e.target.value)}
          placeholder="Название карты"
          style={{ width: '100%', fontSize: 12, padding: 4, borderRadius: 4, border: '1px solid #4a505c', background: '#14171d', color: '#fff' }}
        />
        <button style={act} onClick={save}>💾 Сохранить карту</button>
        <button
          style={act}
          onClick={() => {
            useCombatGridStore.setState({ obstacles: [], enemies: [] });
            ed.setSel(null, null);
          }}
        >
          🧹 Очистить
        </button>
        <button style={act} onClick={() => ed.setActive(false)}>🚪 Выйти из конструктора</button>
      </div>
    </div>
  );
};
