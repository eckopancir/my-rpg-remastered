import { useEffect, useRef, useState } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import {
  useMapEditorStore, UNIT_BEHAVIORS, MAP_MUSIC,
  rotateSelected, deleteSelected, toggleSelectedRandom, addRandomObstacle,
  clearRoute, setUnitFacing, setZoneText,
  PROP_SIZES, LIGHT_LEVELS,
} from '../../stores/mapEditorStore';
import { BATTLE_BGS, getMapImage, getGroundDecals, getBattleImage } from '../../assets/index';
import { ENEMY_BASE_STATS } from '../../engine/enemies';
import { BIG_BUILDING_IMAGES, CAR_IMAGES, WOOD_IMAGES, SMALL_OBSTACLE_IMAGES } from '../../engine/terrain';

const buildingSize = (k: string) => (k === 'o8' || k === 'o9' ? { w: 8, h: 6 } : { w: 6, h: 5 });
const carSize = (k: string) => (k === 'o23' || k === 'o29' ? { w: 2, h: 3 } : { w: 1, h: 2 });

const OB_CATALOG: { icon: string; imgKey: string; w: number; h: number; label: string }[] = [
  ...BIG_BUILDING_IMAGES.map((k) => ({ icon: 'building', imgKey: k, ...buildingSize(k), label: k })),
  // Арты вне пулов генерации — только для конструктора.
  { icon: 'building', imgKey: 'o15', w: 6, h: 5, label: 'o15' },
  { icon: 'building', imgKey: 'o27', w: 6, h: 5, label: 'o27' },
  ...CAR_IMAGES.map((k) => ({ icon: 'car', imgKey: k, ...carSize(k), label: k })),
  ...WOOD_IMAGES.map((k) => ({ icon: 'woods', imgKey: k, w: 2, h: 2, label: k })),
  { icon: 'woods', imgKey: 'o3zz', w: 2, h: 2, label: 'o3zz' },
  ...SMALL_OBSTACLE_IMAGES.map((k) => ({ icon: 'small', imgKey: k, w: 1, h: 1, label: k })),
  { icon: 'small', imgKey: 'o20z', w: 1, h: 1, label: 'o20z' },
  ...Object.entries(PROP_SIZES).map(([k, s]) => ({ icon: 'prop', imgKey: k, w: s.w, h: s.h, label: k })),
  { icon: 'building', imgKey: 'o48', w: 6, h: 3, label: 'o48 барак' },
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
  const campfire = useCombatGridStore((s) => s.campfire);
  const combatActive = useCombatGridStore((s) => s.isActive);
  const battleBg = useCombatGridStore((s) => s.battleBg);
  const isRaining = useCombatGridStore((s) => s.isRaining);
  const isNight = useCombatGridStore((s) => s.isNightTime);
  const fogLevel = useCombatGridStore((s) => s.fogLevel);
  const zones = useCombatGridStore((s) => s.zones);
  // Бой кончился/покинут — режим редактора не должен течь в следующий бой.
  useEffect(() => {
    if (!combatActive && useMapEditorStore.getState().active) {
      useMapEditorStore.getState().setActive(false);
    }
  }, [combatActive]);
  useEffect(() => { useMapEditorStore.getState().refreshMaps(); }, []);
  const [openName, setOpenName] = useState('');
  // Перетаскивание панели по экрану (null — пристыкована справа).
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button,input,select,textarea')) return;
    const el = panelRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const pr = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: r.left - pr.left, oy: r.top - pr.top };
    const move = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const nx = Math.max(-r.width + 60, Math.min(pr.width - 60, d.ox + ev.clientX - d.sx));
      const ny = Math.max(0, Math.min(pr.height - 40, d.oy + ev.clientY - d.sy));
      setPos({ x: nx, y: ny });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const openSaved = () => {
    try {
      const st = useMapEditorStore.getState();
      const m = st.maps.find((x) => x.name === openName) || st.maps[0];
      if (!m) return;
      const hasWork = (obstacles as any[]).length > 0 || (enemies as any[]).length > 0;
      if (hasWork && !window.confirm(`Открыть «${m.name}»? Текущая работа будет потеряна.`)) return;
      const ok = useCombatGridStore.getState().loadMapForEdit(m);
      if (!ok) {
        useCombatGridStore.getState().addBattleLog('⚠️ Карта не открылась');
        return;
      }
      st.setMapName(m.name);
      st.setMusic(m.music || 'track');
      st.setMusic2((m as any).music2 || '__none');
      st.setIntroBarks((((m as any).introBarks || []) as string[]).join('\n'));
      st.setActive(true);
    } catch (err) {
      try { useCombatGridStore.getState().cleanup(); } catch { /* ignore */ }
      useCombatGridStore.getState().addBattleLog(`⚠️ Ошибка открытия: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  // Z в конструкторе: развернуть призрак (палитра) или выбранный объект.
  // Ctrl+Z / Ctrl+Y: отмена / повтор.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useMapEditorStore.getState();
      if (!st.active) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        st.undo();
        return;
      }
      if (((e.ctrlKey || e.metaKey) && e.code === 'KeyY') || ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && e.shiftKey)) {
        e.preventDefault();
        st.redo();
        return;
      }
      if (e.code !== 'KeyZ' || e.ctrlKey || e.metaKey) {
        // C — удалить выбранное (только конструктор).
        if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
          const s = useMapEditorStore.getState();
          if (s.selObId !== null || s.selUnitId !== null || s.selCamp || s.selZoneId !== null) {
            e.preventDefault();
            deleteSelected();
          }
        }
        return;
      }
      if (st.selObId !== null) rotateSelected();
      else if (st.tool.kind === 'obstacle') st.rotateTool();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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
      ed.pushHistory();
      useCombatGridStore.getState().editorSetUnitBehavior((selUnit as any).id, b, ed.corpseLoot);
    }
  };
  const setCorpseLoot = (v: boolean) => {
    ed.setCorpseLoot(v);
    if (selUnit && (selUnit as any).dead) {
      ed.pushHistory();
      useCombatGridStore.getState().editorSetUnitBehavior((selUnit as any).id, 'corpse', v);
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
  const fileRef = useRef<HTMLInputElement>(null);
  const exportFile = () => {
    const st = useMapEditorStore.getState();
    const m = st.maps.find((x) => x.name === (openName || st.maps[0]?.name || ''));
    if (!m) {
      useCombatGridStore.getState().addBattleLog('⚠️ Нет карты для экспорта');
      return;
    }
    const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `map-${m.name}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const importFile = (f: File) => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const err = useMapEditorStore.getState().importMap(JSON.parse(String(rd.result)));
        useCombatGridStore.getState().addBattleLog(err ? `⚠️ ${err}` : '📥 Карта импортирована');
      } catch {
        useCombatGridStore.getState().addBattleLog('⚠️ Битый JSON');
      }
    };
    rd.readAsText(f);
  };

  return (
    <div ref={panelRef} style={{ ...panel, ...(pos ? { left: pos.x, top: pos.y, right: 'auto' } : null) }}>
      <div
        style={{ ...h, fontSize: 13, cursor: 'move', userSelect: 'none' }}
        title="Тяни чтобы передвинуть, двойной клик — вернуть на место"
        onMouseDown={startDrag}
        onDoubleClick={() => setPos(null)}
      >
        🛠 Конструктор карт
      </div>
      <div style={{ fontSize: 11 }}>
        <div style={{ opacity: 0.85 }}>Объектов: {(obstacles as any[]).length}, юнитов: {(enemies as any[]).length}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button style={btn(false)} disabled={!ed.canUndo()} title="Ctrl+Z" onClick={() => ed.undo()}>↩ Отмена</button>
          <button style={btn(false)} disabled={!ed.canRedo()} title="Ctrl+Y" onClick={() => ed.redo()}>↪ Повтор</button>
        </div>
        {(obstacles as any[]).length > 0 && (
          <div style={{ maxHeight: 132, overflowY: 'auto', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(obstacles as any[]).map((o: any) => {
              const sel = o.id === ed.selObId;
              return (
                <div
                  key={o.id}
                  onClick={() => ed.setSel(o.id, null)}
                  title="Клик — выбрать на карте"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                    padding: '2px 4px 2px 6px', borderRadius: 4, cursor: 'pointer',
                    border: sel ? '1px solid #ffd54a' : '1px solid #2a2e37',
                    background: sel ? '#3a3320' : '#14171d',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.imgKey || o.icon} {o.w}×{o.h} ({o.x},{o.y}){o.editorRandom ? ' 🎲' : ''}
                  </span>
                  <button
                    style={{ ...btn(false), padding: '0 5px' }}
                    title="Удалить с карты"
                    onClick={(e) => {
                      e.stopPropagation();
                      useCombatGridStore.setState((s: any) => ({
                        obstacles: s.obstacles.filter((x: any) => x.id !== o.id),
                      }));
                      if (ed.selObId === o.id) ed.setSel(null, null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={sec}>
        <div style={h}>🖼 Фон арены</div>
        <div style={grid}>
          {BATTLE_BGS.map((b) => (
            <button
              key={b.id}
              style={{ ...btn(battleBg === b.id), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
              title={b.label}
              onClick={() => useCombatGridStore.setState({ battleBg: b.id })}
            >
              <img src={getMapImage(b.id)} alt={b.label} draggable={false} style={{ width: 72, height: 44, objectFit: 'cover', borderRadius: 3 }} />
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div style={sec}>
        <div style={h}>⛅ Погода карты</div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
          <input type="checkbox" checked={!!isRaining} onChange={(e) => useCombatGridStore.setState({ isRaining: e.target.checked })} />
          🌧 Дождь
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
          <input type="checkbox" checked={!!isNight} onChange={(e) => useCombatGridStore.setState({ isNightTime: e.target.checked })} />
          🌙 Ночь (режет меткость!)
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
          🌫 Туман
          <input
            type="range" min={0} max={100} value={fogLevel || 0}
            onChange={(e) => useCombatGridStore.setState({ fogLevel: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
          {fogLevel || 0}%
        </label>
      </div>

      <div style={sec}>
        <div style={h}>🖌 Кисть-ручка</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
          Диаметр:
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} style={btn(ed.brushSize === n)} title={`Диаметр ${n} кл`} onClick={() => ed.setBrushSize(n)}>
              {n}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
          Плотность
          <input
            type="range" min={15} max={100} value={Math.round(ed.brushDensity * 100)}
            onChange={(e) => ed.setBrushDensity(Number(e.target.value) / 100)}
            style={{ flex: 1 }}
          />
          {Math.round(ed.brushDensity * 100)}%
        </label>
        <div style={grid}>
          {getGroundDecals().map((k) => (
            <button
              key={k}
              style={btn(ed.tool.kind === 'brush' && ed.tool.imgKey === k)}
              title="Рисовать протяжкой ЛКМ"
              onClick={() => ed.setTool({ kind: 'brush', imgKey: k })}
            >
              {k}
            </button>
          ))}
          <button style={btn(ed.tool.kind === 'eraser')} onClick={() => ed.setTool({ kind: 'eraser' })}>🧽 Ластик</button>
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
          Протяжка ЛКМ рисует. Свои текстуры: залей ground_*.png в battle/ — появятся сами.
        </div>
      </div>

      <div style={sec}>
        <div style={h}>📐 Зоны</div>
        <div style={grid}>
          <button
            style={btn(ed.tool.kind === 'zone' && ed.zoneKind === 'spawn')}
            title="Точка появления игрока (одна)"
            onClick={() => { ed.setZoneKind('spawn'); ed.setTool({ kind: 'zone' }); }}
          >
            🟢 Спавн
          </button>
          <button
            style={btn(ed.tool.kind === 'zone' && ed.zoneKind === 'exit')}
            title="Встал — бой завершён"
            onClick={() => { ed.setZoneKind('exit'); ed.setTool({ kind: 'zone' }); }}
          >
            🚪 Выход
          </button>
          <button
            style={btn(ed.tool.kind === 'zone' && ed.zoneKind === 'trigger')}
            title="Встал — реплика + пробуждение спящих"
            onClick={() => { ed.setZoneKind('trigger'); ed.setTool({ kind: 'zone' }); }}
          >
            💜 Триггер
          </button>
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>Тяни прямоугольник ЛКМ по карте.</div>
        {(zones || []).length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(zones || []).map((z: any) => (
              <div
                key={z.id}
                onClick={() => ed.setSelZone(z.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                  padding: '2px 4px 2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                  border: z.id === ed.selZoneId ? '1px solid #ffd54a' : '1px solid #2a2e37',
                  background: z.id === ed.selZoneId ? '#3a3320' : '#14171d',
                }}
              >
                <span>{z.kind === 'spawn' ? '🟢' : z.kind === 'exit' ? '🚪' : '💜'} {z.kind} {z.w}×{z.h} ({z.x},{z.y})</span>
                <button
                  style={{ ...btn(false), padding: '0 5px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    ed.pushHistory();
                    useCombatGridStore.setState((s: any) => ({ zones: (s.zones || []).filter((x: any) => x.id !== z.id) }));
                    if (ed.selZoneId === z.id) ed.setSelZone(null);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={sec}>
        <div style={h}>Курсор</div>
        <div style={grid}>
          <button style={btn(ed.tool.kind === 'select')} onClick={() => ed.setTool({ kind: 'select' })}>☝ Выбрать</button>
        </div>
      </div>

      <div style={sec}>
        <div style={h}>📂 Открыть карту</div>
        {ed.maps.length === 0 ? (
          <div style={{ fontSize: 11, opacity: 0.7 }}>Нет сохранённых карт</div>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              value={openName || ed.maps[0].name}
              onChange={(e) => setOpenName(e.target.value)}
              style={{ fontSize: 11, flex: 1, minWidth: 0 }}
            >
              {ed.maps.map((m) => (
                <option key={m.name} value={m.name}>{m.name} ({m.obstacles.length} об, {m.units.length} юн)</option>
              ))}
            </select>
            <button style={btn(false)} onClick={openSaved}>Открыть</button>
          </div>
        )}
      </div>

      <div style={sec}>
        <div style={h}>Объекты</div>
        {ed.tool.kind === 'obstacle' && (
          <div style={{ fontSize: 11, marginBottom: 6, opacity: 0.9 }}>
            Выбрано: {ed.tool.imgKey} {ed.tool.w}×{ed.tool.h} ({ed.tool.rot || 0}°){' '}
            <button
              style={btn(false)}
              title="Развернуть до установки (Z)"
              onClick={() => ed.rotateTool()}
            >
              🔄 Развернуть
            </button>
          </div>
        )}
        <div style={grid}>
          {OB_CATALOG.map((o, i) => {
            const on = ed.tool.kind === 'obstacle' && ed.tool.imgKey === o.imgKey && ed.tool.w === o.w && ed.tool.h === o.h;
            const thumb = getBattleImage(o.imgKey);
            return (
              <button
                key={`${o.imgKey}_${o.w}x${o.h}_${i}`}
                style={{ ...btn(on), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 52 }}
                title={`${o.icon} ${o.w}×${o.h}`}
                onClick={() => ed.setTool({ kind: 'obstacle', icon: o.icon, imgKey: o.imgKey, w: o.w, h: o.h, rot: 0 })}
              >
                {thumb && <img src={thumb} alt={o.label} draggable={false} style={{ width: 44, height: 30, objectFit: 'contain' }} />}
                <span>{o.label} {o.w}×{o.h}</span>
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
        <div style={h}>💡 Лампы (невидимки, только свет)</div>
        <div style={grid}>
          {Object.entries(LIGHT_LEVELS).map(([k, L], i) => {
            const on = ed.tool.kind === 'obstacle' && (ed.tool as any).imgKey === k;
            return (
              <button
                key={k}
                style={btn(on)}
                title={`Радиус ${L.r} кл, свет ${i + 1}/5`}
                onClick={() => ed.setTool({ kind: 'obstacle', icon: 'light', imgKey: k, w: 1, h: 1, rot: 0 })}
              >
                💡{i + 1} r{L.r}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
          Ставятся кликом, в игре не видны. Ходить сквозь можно, светят всегда (ночью ярче).
        </div>
      </div>

      <div style={sec}>
        <div style={h}>Костёр</div>
        <div style={grid}>
          <button
            style={btn(ed.tool.kind === 'campfire')}
            title="Поставить костёр кликом; клик по костру выбирает, следующий клик переносит"
            onClick={() => ed.setTool({ kind: 'campfire' })}
          >
            🔥 Костёр{campfire ? ` (${(campfire as any).x},${(campfire as any).y})` : ' (нет на карте)'}
          </button>
        </div>
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
        {(ed.behavior === 'corpse' || (selUnit && (selUnit as any).dead)) && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 11 }}>
            <input type="checkbox" checked={ed.corpseLoot} onChange={(e) => setCorpseLoot(e.target.checked)} />
            💰 С лутом (можно обыскать)
          </label>
        )}
        <div style={{ marginTop: 6 }}>
          <button
            style={btn(ed.tool.kind === 'route')}
            title="Кликай точки по карте (макс 12, ходят кругом)"
            onClick={() => ed.setTool({ kind: 'route' })}
          >
            📍 Маршрут патруля
          </button>
        </div>
        {selUnit && !(selUnit as any).dead && (
          <div style={{ marginTop: 6, fontSize: 11 }}>
            <div style={{ opacity: 0.8 }}>
              Точек: {((selUnit as any).patrolRoute || []).length}
              {((selUnit as any).patrolRoute || []).length > 0 && (
                <button style={{ ...btn(false), marginLeft: 6 }} onClick={() => clearRoute((selUnit as any).id)}>Очистить</button>
              )}
            </div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>Взгляд:</div>
            <div style={grid}>
              {[
                { l: '↖', d: -135 }, { l: '↑', d: -90 }, { l: '↗', d: -45 },
                { l: '←', d: 180 }, { l: '→', d: 0 },
                { l: '↙', d: 135 }, { l: '↓', d: 90 }, { l: '↘', d: 45 },
              ].map((f) => (
                <button key={f.l} style={btn(false)} title={`Смотреть ${f.l}`} onClick={() => setUnitFacing((selUnit as any).id, f.d)}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {(selOb || selUnit || ed.selCamp || ed.selZoneId !== null) && (
        <div style={sec}>
          <div style={h}>Выбрано</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>
            {selOb ? ((selOb as any).icon === 'light'
              ? `💡 Свет ${(selOb as any).imgKey} (r=${(LIGHT_LEVELS as any)[(selOb as any).imgKey]?.r ?? '?'})`
              : `Объект ${(selOb as any).imgKey || (selOb as any).icon} ${(selOb as any).w}×${(selOb as any).h}${(selOb as any).editorRandom ? ' 🎲 случайный' : ''}${(selOb as any).shootThrough ? ' (прострел)' : ''}`) : null}
            {selUnit ? `Юнит ${(selUnit as any).name} (${(selUnit as any).dead ? '💀 труп' + (((selUnit as any).loot || []).length ? ', с лутом' : ', без лута') : `${(selUnit as any).aiRole}${(selUnit as any).sleeping ? '+спит' : ''}`})` : null}
            {ed.selCamp && campfire ? `🔥 Костёр (${(campfire as any).x},${(campfire as any).y})` : null}
            {ed.selZoneId !== null ? (() => {
              const z = (zones || []).find((zz: any) => zz.id === ed.selZoneId) as any;
              return z ? `${z.kind === 'spawn' ? '🟢 Спавн' : z.kind === 'exit' ? '🚪 Выход' : '💜 Триггер'} ${z.w}×${z.h} (${z.x},${z.y})` : 'Зона';
            })() : null}
          </div>
          {ed.selZoneId !== null && (() => {
            const z = (zones || []).find((zz: any) => zz.id === ed.selZoneId) as any;
            return z && z.kind === 'trigger' ? (
              <input
                value={z.text || ''}
                onChange={(e) => setZoneText(z.id, e.target.value)}
                placeholder="Реплика триггера…"
                style={{ width: '100%', fontSize: 11, padding: 4, marginTop: 4, borderRadius: 4, border: '1px solid #4a505c', background: '#14171d', color: '#fff' }}
              />
            ) : null;
          })()}
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
        <div style={{ fontSize: 10, opacity: 0.7, margin: '4px 0 2px' }}>Вторая — следом по очереди:</div>
        <select value={ed.music2} onChange={(e) => ed.setMusic2(e.target.value)} style={{ fontSize: 11, width: '100%' }}>
          {MAP_MUSIC.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div style={sec}>
        <div style={h}>📢 Боевой клич (вскрики на входе)</div>
        <textarea
          value={ed.introBarks}
          onChange={(e) => ed.setIntroBarks(e.target.value)}
          placeholder={'в атаку!!!\nза мусорку\nсмерть воякам'}
          rows={4}
          style={{ width: '100%', fontSize: 11, padding: 4, borderRadius: 4, border: '1px solid #4a505c', background: '#14171d', color: '#fff', resize: 'vertical' }}
        />
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>По строке на крик, мусорщики орут волной.</div>
      </div>

      <div style={sec}>
        <div style={h}>☁ Сервер (видно разработчику)</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            style={act}
            title="Залить карту с текущим названием на сервер"
            onClick={async () => {
              const err = await useMapEditorStore.getState().uploadCurrentMap();
              useCombatGridStore.getState().addBattleLog(err ? `⚠️ ${err}` : `☁ Карта «${useMapEditorStore.getState().mapName.trim()}» на сервере`);
            }}
          >
            ⬆ Залить
          </button>
          <button
            style={act}
            onClick={async () => {
              const err = await useMapEditorStore.getState().refreshServerMaps();
              if (err) useCombatGridStore.getState().addBattleLog(`⚠️ ${err}`);
            }}
          >
            🔄 Список
          </button>
        </div>
        {(ed.serverMaps || []).length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ed.serverMaps.map((m) => (
              <div
                key={m.name}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                  padding: '2px 4px 2px 6px', borderRadius: 4, fontSize: 11,
                  border: '1px solid #2a2e37', background: '#14171d',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ☁ {m.name} ({m.obstacles} об, {m.units} юн)
                </span>
                <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button
                    style={{ ...btn(false), padding: '0 5px' }}
                    title="Скачать в локальный список"
                    onClick={async () => {
                      const err = await useMapEditorStore.getState().downloadServerMap(m.name);
                      useCombatGridStore.getState().addBattleLog(err ? `⚠️ ${err}` : `📥 «${m.name}» скачана локально`);
                    }}
                  >
                    ⬇
                  </button>
                  <button
                    style={{ ...btn(false), padding: '0 5px' }}
                    title="Удалить с сервера"
                    onClick={async () => {
                      if (!window.confirm(`Удалить «${m.name}» с сервера?`)) return;
                      const err = await useMapEditorStore.getState().deleteServerMap(m.name);
                      if (err) useCombatGridStore.getState().addBattleLog(`⚠️ ${err}`);
                    }}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
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
        <button style={act} onClick={exportFile} title="Скачать выбранную карту JSON-файлом">📤 Экспорт</button>
        <button style={act} onClick={() => fileRef.current?.click()} title="Загрузить карту из JSON-файла">📥 Импорт</button>
        <input
          ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) importFile(f);
            e.target.value = '';
          }}
        />
        <button
          style={act}
          onClick={() => {
            ed.pushHistory();
            useCombatGridStore.setState({ obstacles: [], enemies: [], decals: [], zones: [], campfire: null });
            ed.setSel(null, null);
          }}
        >
          🧹 Очистить
        </button>
        <button style={act} onClick={() => { useCombatGridStore.getState().exitEditor(); ed.setActive(false); }}>🚪 Выйти из конструктора</button>
      </div>
    </div>
  );
};
