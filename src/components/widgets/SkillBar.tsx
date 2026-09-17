import { useRef, useState, useEffect, useMemo } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { usePlayerStore } from '../../stores/playerStore';
import { getSniperImage } from '../../assets';
import { useSound } from '../../hooks/useSound';
import { AbilityTooltip } from './AbilityTooltip';
import {
  SNIPER_ABILITIES, buildSniperBattleAbility,
  type SniperAbilityDef,
} from '../../data/sniper';
import { PET_BY_ID, type PetBattleAbility } from '../../data/pets';
import type { AccessoryAbility } from '../../types/abilities';

const COLS = 12;
const ROWS = 2;
const SLOT = 50;
const IMG = 35;
const GAP = 3;
const TOTAL_SLOTS = COLS * ROWS;

/** Shift+1-0,-,= — выбор слотов верхнего ряда. */
const HOTKEY_CHARS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
/** Двойное нажатие цифр 1-8 — сразу применить слоты 0-7. */
const DOUBLE_TAP_MS = 450;

type BarEntry = { ab: AccessoryAbility | PetBattleAbility; source: 'skill' | 'pet'; idx: number } | null;

export const SkillBar = ({ onSelect }: { onSelect?: (idx: number) => void }) => {
  const { playClick } = useSound();
  const skillBarLayout = useUiStore((s) => s.skillBarLayout);
  const skillBarPos = useUiStore((s) => s.skillBarPos);
  const setSkillBarPos = useUiStore((s) => s.setSkillBarPos);
  const swapSkillBarSlots = useUiStore((s) => s.swapSkillBarSlots);
  const skillBarLocked = useUiStore((s) => s.skillBarLocked);
  const setSkillBarLocked = useUiStore((s) => s.setSkillBarLocked);
  const skillBarSingleRow = useUiStore((s) => s.skillBarSingleRow);
  const setSkillBarSingleRow = useUiStore((s) => s.setSkillBarSingleRow);
  // Живые статы в шапку: HP / выносливость / чипы.
  const curHp = usePlayerStore((s) => s.stats.currentHp);
  const maxHp = usePlayerStore((s) => s.stats.maxHp);
  const curStam = usePlayerStore((s) => s.stats.stamina);
  const maxStam = usePlayerStore((s) => s.stats.maxStamina);
  const chips = usePlayerStore((s) => s.dataChips);
  const skillBarAbilities = useCombatGridStore((s) => s.skillBarAbilities);
  const skillBarCooldowns = useCombatGridStore((s) => s.skillBarCooldowns);
  const petAbilities = useCombatGridStore((s) => s.petAbilities);
  const petCooldowns = useCombatGridStore((s) => s.petCooldowns);
  const petUnit = useCombatGridStore((s) => s.enemies.find((e: any) => e.isPet && !e.dead));
  const selectedAbility = useCombatGridStore((s) => s.selectedAbility);
  const selectedAbilitySource = useCombatGridStore((s) => s.selectedAbilitySource);
  const ap = useCombatGridStore((s) => s.ap);
  const turn = useCombatGridStore((s) => s.turn);
  const selectSkillBarAbility = useCombatGridStore((s) => s.selectSkillBarAbility);
  const selectPetAbility = useCombatGridStore((s) => s.selectPetAbility);
  const setPetCommandMode = useCombatGridStore((s) => s.setPetCommandMode);
  const petCommandMode = useCombatGridStore((s) => s.petCommandMode);
  const petAiActive = useCombatGridStore((s) => s.petAiActive);
  const hasPet = useCombatGridStore((s) => s.enemies.some((e: any) => e.isPet && !e.dead));
  const ensureSkillBarSlots = useUiStore((s) => s.ensureSkillBarSlots);

  const petAwake = !!petUnit && !petUnit.sleeping && (petUnit.currentHp || 0) > 0;
  const petApLeft = petAwake ? (petUnit.petAp || 0) : 0;
  const turnCount = useCombatGridStore((s) => s.turnCount);
  const activePetId = usePlayerStore((s) => s.activePetId);

  // Auto-populate empty slots with available abilities (skills + pet)
  useEffect(() => {
    const ids = [
      ...skillBarAbilities.filter(Boolean).map((ab) => ab!.id),
      ...petAbilities.filter(Boolean).map((ab) => (ab as PetBattleAbility).id),
    ];
    ensureSkillBarSlots(ids);
  }, [skillBarAbilities, petAbilities, ensureSkillBarSlots]);

  // Перемещение панели за шапку
  const panelRef = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);
  const moveOffset = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!moving) return;
    const onMove = (e: MouseEvent) => setSkillBarPos({ x: e.clientX - moveOffset.current.x, y: e.clientY - moveOffset.current.y });
    const onUp = () => setMoving(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [moving, setSkillBarPos]);

  // Перетаскивание способностей между слотами (только когда разблокировано)
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Тултип как на странице скиллов (при наведении на скилл)
  const [tip, setTip] = useState<{ entry: Exclude<BarEntry, null>; x: number; y: number } | null>(null);
  const playerSkills = usePlayerStore((s) => s.skills);

  // built-id боевой способности -> деф дерева (для тултипа снайперов)
  const battleToDef = useMemo(() => {
    const m = new Map<string, SniperAbilityDef>();
    for (const def of SNIPER_ABILITIES) {
      m.set(buildSniperBattleAbility(def, 1, 0).id, def);
    }
    return m;
  }, []);

  // Map abilityId → {source, index}
  const abilityMap = useMemo(() => {
    const m = new Map<string, { source: 'skill' | 'pet'; idx: number }>();
    skillBarAbilities.forEach((ab, i) => { if (ab) m.set(ab.id, { source: 'skill', idx: i }); });
    petAbilities.forEach((ab, i) => { if (ab && !m.has(ab.id)) m.set(ab.id, { source: 'pet', idx: i }); });
    return m;
  }, [skillBarAbilities, petAbilities]);

  // Build ordered array for display
  const slots: BarEntry[] = useMemo(() => {
    const result: BarEntry[] = [];
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const id = skillBarLayout[i];
      if (!id) { result.push(null); continue; }
      const ref = abilityMap.get(id);
      if (!ref) { result.push(null); continue; }
      const ab = ref.source === 'skill' ? skillBarAbilities[ref.idx] : petAbilities[ref.idx];
      result.push(ab ? { ab: ab as any, source: ref.source, idx: ref.idx } : null);
    }
    return result;
  }, [skillBarLayout, abilityMap, skillBarAbilities, petAbilities]);
  const isPassivePet = (id: string) => id.startsWith('petp_');

  const apCostOf = (entry: any): number =>
    isPassivePet(entry.ab.id) ? 0 : entry.source === 'pet' ? ((entry.ab as PetBattleAbility).id === 'petb_pb_t6_restore' ? 2 : (entry.ab as PetBattleAbility).petApCost) : (entry.ab as AccessoryAbility).apCost;
  const cdOf = (entry: any): number => {
    if (isPassivePet(entry.ab.id)) {
      const period = entry.ab.cooldown || 6;
      return (period - (turnCount % period)) % period;
    }
    return entry.source === 'pet' ? (petCooldowns[entry.idx] || 0) : (skillBarCooldowns[entry.idx] || 0);
  };
  const readyApOf = (entry: any): boolean => {
    if (isPassivePet(entry.ab.id)) return cdOf(entry) === 0;
    return entry.source === 'pet' ? ((entry.ab as PetBattleAbility).id === 'petb_pb_t6_restore' ? ap >= 2 : petAwake && petApLeft >= apCostOf(entry)) : ap >= apCostOf(entry);
  };

  const selectEntry = (entry: any) => {
    if (isPassivePet(entry.ab.id)) return;
    if (entry.source === 'pet') selectPetAbility(entry.idx);
    else selectSkillBarAbility(entry.idx);
    onSelect?.(entry.idx);
  };

  /** Выбрать и сразу применить (дабл-клик / дабл-тап). */
  const applySlot = (slotIdx: number) => {
    const entry = (slots as any)[slotIdx];
    if (!entry || turn !== 'player') return;
    if (cdOf(entry) > 0 || !readyApOf(entry)) return;
    const st = useCombatGridStore.getState();
    const wantSource = entry.source === 'pet' ? 'pet' : 'skillBar';
    if (st.selectedAbility !== entry.idx || st.selectedAbilitySource !== wantSource) {
      if (entry.source === 'pet') st.selectPetAbility(entry.idx);
      else st.selectSkillBarAbility(entry.idx);
    }
    playClick();
    const cs = useCombatGridStore.getState();
    if (entry.source === 'pet') cs.usePetAbility(entry.idx, cs.selectedEnemy ?? undefined);
    else cs.useAbility(cs.selectedEnemy ?? undefined);
  };

  // Hotkeys: Shift+... — выбор; двойное нажатие 1-8 — применить.
  const tapRef = useRef({ key: '', time: 0 });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (turn !== 'player') return;
      const key = e.key;
      const idx = HOTKEY_CHARS.indexOf(key);
      if (idx === -1) return;
      if (e.shiftKey) {
        const slotIdx = idx;
        if (slotIdx < 0 || slotIdx >= TOTAL_SLOTS) return;
        const entry = (slots as any)[slotIdx];
        if (!entry || cdOf(entry) > 0 || !readyApOf(entry)) return;
        playClick();
        selectEntry(entry);
        return;
      }
      // Обычные цифры 1-8: двойное нажатие = применить.
      if (idx < 0 || idx > 7) return;
      const now = Date.now();
      if (tapRef.current.key === key && now - tapRef.current.time < DOUBLE_TAP_MS) {
        tapRef.current = { key: '', time: 0 };
        applySlot(idx);
      } else {
        tapRef.current = { key, time: now };
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, slots, selectSkillBarAbility, selectPetAbility, onSelect]);

  const cols = skillBarSingleRow ? TOTAL_SLOTS : COLS;
  const rows = skillBarSingleRow ? 1 : ROWS;
  const panelW = cols * (SLOT + GAP) - GAP + 12;
  const pos = skillBarPos ?? {
    x: Math.max(0, (window.innerWidth - panelW) / 2),
    y: 12,
  };

  const hotLabel = (i: number) => {
    if (i < 8) return `${i + 1}`;
    if (i < HOTKEY_CHARS.length) return `⇧${HOTKEY_CHARS[i]}`;
    return `${i + 1}`;
  };

  const renderPetTip = (ab: PetBattleAbility, cd: number, x: number, y: number) => {
    const def = PET_BY_ID[ab.defId];
    const isPlayerCost = ab.id === 'petb_pb_t6_restore';
    const cost = isPlayerCost ? 2 : ab.petApCost;
    const statusLine = !isPlayerCost && !petAwake
      ? { text: 'Питомец спит', color: 'rgba(255,255,255,0.4)' }
      : cd > 0
        ? { text: `КД: ${cd} хода`, color: '#ff6b6b' }
        : isPlayerCost ? (ap < cost ? { text: `Нужно ${cost} AP игрока`, color: 'rgba(255,255,255,0.4)' } : { text: 'Готово — дабл-клик применить', color: '#69db7c' })
        : petApLeft < cost
          ? { text: `Нужно ${cost} AP питомца`, color: 'rgba(255,255,255,0.4)' }
          : { text: 'Готово — дабл-клик применить', color: '#69db7c' };
    return (
      <div style={{
        position: 'fixed', left: Math.min(x + 16, window.innerWidth - 300), top: Math.max(8, y - 10), zIndex: 9999,
        width: 280, background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 60%, #23272b 100%)',
        border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.75)', pointerEvents: 'none',
        fontFamily: 'var(--font-sans)',
      }}>
        <div style={{ height: 3, background: '#a16207', opacity: 0.95, borderRadius: '10px 10px 0 0' }} />
        <div style={{ padding: '8px 14px 12px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24', textAlign: 'center' }}>
            {ab.icon} {ab.name}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)', justifyContent: 'center' }}>
            <span>🐾 Питомец</span>
            {cost > 0 ? <span>• {cost}AP</span> : <span>• FREE</span>}
            {ab.cooldown > 0 ? <span>• КД {ab.cooldown}</span> : null}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.82)', lineHeight: 1.4 }}>
            {def?.mechanic || ''}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: statusLine.color }}>
            {statusLine.text}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '10px 0 8px' }} />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
            Дабл-клик — применить · 2×1-8 — слоты
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`@keyframes wowDash{to{stroke-dashoffset:-180}}`}</style>
      <div ref={panelRef} style={{
        position: 'fixed',
      left: pos.x,
      top: pos.y,
      zIndex: 1400,
      borderRadius: 10,
      background: 'linear-gradient(180deg, rgba(28,24,18,0.95), rgba(12,11,9,0.95))',
      border: '1px solid rgba(217,119,6,0.45)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.65), 0 0 12px rgba(217,119,6,0.12)',
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      {/* Шапка — ручка для перемещения */}
      <div
        onMouseDown={(e) => {
          moveOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
          setMoving(true);
        }}
        title="Тянуть чтобы переместить панель"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px',
          background: 'linear-gradient(180deg, rgba(217,119,6,0.28), rgba(217,119,6,0.08))',
          borderBottom: '1px solid rgba(217,119,6,0.35)',
          cursor: moving ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 2 }}>⋮⋮</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#fbbf24', flex: 1 }}>✨ СПОСОБНОСТИ</span>
        {hasPet && (
          <span
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); playClick(); setPetCommandMode(!petCommandMode); }}
            title="Команда питомцу: вкл — клик по врагу (атака) или клетке (шаг), повторный клик по питомцу — отмена"
            style={{
              cursor: 'pointer', fontSize: 13,
              filter: petCommandMode ? 'drop-shadow(0 0 5px #fbbf24)' : 'grayscale(0.7)',
              opacity: petCommandMode ? 1 : 0.55,
            }}
          >
            🐾
          </span>
        )}
        <span title="Здоровье" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f87171', whiteSpace: 'nowrap' }}>
          ❤ {Math.round(curHp || 0)}/{Math.round(maxHp || 0)}
        </span>
        <span title="Выносливость" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#4ade80', whiteSpace: 'nowrap' }}>
          ⚡{Math.round(curStam || 0)}/{Math.round(maxStam || 0)}
        </span>
        <span title="Чипы" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fbbf24', whiteSpace: 'nowrap' }}>
          💾{(chips || 0).toLocaleString()}
        </span>
        <span
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); playClick(); setSkillBarSingleRow(!skillBarSingleRow); }}
          title={skillBarSingleRow ? 'Режим: 12×2 (два ряда)' : 'Режим: 24×1 (длинная в один ряд)'}
          style={{ cursor: 'pointer', fontSize: 13, opacity: skillBarSingleRow ? 1 : 0.55 }}
        >
          {skillBarSingleRow ? '▬' : '▦'}
        </span>
        <span
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); playClick(); setSkillBarLocked(!skillBarLocked); }}
          title={skillBarLocked ? 'Разблокировать: двигать способности по слотам' : 'Заблокировать панель'}
          style={{ cursor: 'pointer', fontSize: 13, opacity: skillBarLocked ? 0.55 : 1, filter: skillBarLocked ? 'grayscale(0.6)' : 'none' }}
        >
          {skillBarLocked ? '🔒' : '🔓'}
        </span>
      </div>
      {/* Слоты: 12×2 или 24×1 — единственный источник способностей (питомец тоже через ensureSkillBarSlots) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${SLOT}px)`,
        gridTemplateRows: `repeat(${rows}, auto)`,
        gap: GAP,
        padding: 5,
        maxWidth: '96vw',
        overflowX: 'auto',
      }}>
        {slots.map((entry, i) => {
          const isPassive = !!(entry && isPassivePet((entry as any).ab.id));
          const ab = (entry as any)?.ab as (AccessoryAbility & { image?: string }) | null;
          const isPet = (entry as any)?.source === 'pet';
          const cost = entry ? apCostOf(entry) : 0;
          const cd = entry ? cdOf(entry) : 0;
          const isReady = !!entry && cd <= 0 && readyApOf(entry) && !isPassive;
          const wantSource = isPet ? 'pet' : 'skillBar';
          const isAiToggle = !!entry && isPet && (entry.ab as any).id === 'petb_pet_ai' && petAiActive && !isPassive;
          const isCmdToggle = !!entry && isPet && (entry.ab as any).id === 'petb_pet_command' && petCommandMode && !isPassive;
          const isToggleActive = isAiToggle || isCmdToggle;
          const isSelected = isToggleActive || (!!entry && !isPassive && selectedAbility === (entry as any).idx && selectedAbilitySource === wantSource);
          const isOver = dragOver === i;
          const isFreeAb = !!ab && (isPet || !!(ab as any)?.passive || (ab as any)?.free === true);
          const abImg = !isPet && (ab as any)?.image ? getSniperImage((ab as any).image as string) : undefined;
          const statusText = !entry ? '' : isPassive ? (cd > 0 ? `КД${cd}` : 'ГОТОВ') : cd > 0 ? `КД${cd}` : cost > 0 ? `${cost}AP` : 'FREE';
          const statusColor = !entry ? '' : isPassive ? (cd > 0 ? '#ff6b6b' : '#4ade80') : cd > 0 ? '#ff6b6b' : !isReady ? 'rgba(255,255,255,0.3)' : isFreeAb ? '#4ade80' : '#fbbf24';

          return (
            <div
              key={i}
              draggable={!!entry && !skillBarLocked}
              onMouseEnter={(e) => {
                if (entry && !moving && dragFrom === null) setTip({ entry: entry as any, x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => {
                if (entry && !moving && dragFrom === null) setTip({ entry: entry as any, x: e.clientX, y: e.clientY });
              }}
              onMouseLeave={() => setTip(null)}
              onDragStart={(e) => {
                if (!entry || skillBarLocked) { e.preventDefault(); return; }
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* noop */ }
              }}
              onDragOver={(e) => { if (!skillBarLocked && dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
              onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                if (!skillBarLocked && dragFrom !== null && dragFrom !== i) {
                  swapSkillBarSlots(dragFrom, i);
                  playClick();
                }
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
              onClick={() => {
                if (!entry || !isReady) return;
                playClick();
                selectEntry(entry);
              }}
              onDoubleClick={() => { if (entry && isReady) { setTip(null); applySlot(i); } }}
              onContextMenu={(e) => e.preventDefault()}
              title={!entry ? `Слот ${i + 1}${skillBarLocked ? '' : ' (перетаскивай способности сюда)'}` : undefined}
              style={{
                width: SLOT, minHeight: SLOT, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 1,
                padding: '3px 2px 2px',
                border: `1px solid ${isPassive ? (cd === 0 ? '#4ade80' : 'rgba(255,255,255,0.12)') : isToggleActive ? '#4ade80' : isSelected ? '#fbbf24' : isOver ? 'rgba(255,255,255,0.5)' : isReady && entry ? 'rgba(217,119,6,0.5)' : 'rgba(255,255,255,0.08)'}`,
                background: isPassive ? (cd === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(0,0,0,0.45)') : isToggleActive ? 'rgba(74,222,128,0.22)' : isSelected ? 'rgba(217,119,6,0.22)' : isOver ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.45)',
                boxShadow: isPassive ? (cd === 0 ? '0 0 6px rgba(74,222,128,0.4)' : 'none') : isToggleActive ? '0 0 10px rgba(74,222,128,0.5)' : isSelected ? '0 0 10px rgba(251,191,36,0.5)' : isReady && entry ? '0 0 6px rgba(217,119,6,0.2)' : 'none',
                cursor: isPassive ? 'default' : entry ? (skillBarLocked ? (isReady ? 'pointer' : 'default') : 'move') : 'default',
                opacity: isPassive ? (cd === 0 ? 1 : 0.45) : entry ? (isReady ? 1 : 0.4) : 0.18,
                borderRadius: 7, position: 'relative',
                overflow: 'hidden',
                transition: 'box-shadow 100ms, opacity 100ms',
              }}
            >
              {isToggleActive && (
                <svg
                  viewBox="0 0 52 52"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 7 }}
                >
                  <rect
                    x="1"
                    y="1"
                    width="50"
                    height="50"
                    rx="7"
                    ry="7"
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="28 140"
                    style={{ animation: 'wowDash 1.15s linear infinite', filter: 'drop-shadow(0 0 3px rgba(74,222,128,0.9))' }}
                  />
                </svg>
              )}
              {abImg
                ? <img src={abImg} alt={ab!.name} draggable={false} style={{ width: IMG, height: IMG, objectFit: 'cover', borderRadius: 5 }} />
                : ab ? <span style={{ fontSize: 22, lineHeight: 1 }}>{ab.icon}</span> : <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>·</span>
              }
              {entry && (
                <div style={{ fontSize: 8, color: statusColor, fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                  {statusText}
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 1, left: 3,
                fontSize: 8, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)',
              }}>
                {hotLabel(i)}
              </div>
            </div>
          );
        })}
      </div>
      {/* Тултип как на странице скиллов */}
      {tip && !moving && dragFrom === null && (() => {
        const { entry } = tip;
        if (entry.source === 'pet') {
          return renderPetTip(entry.ab as PetBattleAbility, cdOf(entry), tip.x, tip.y);
        }
        const ab = entry.ab as AccessoryAbility;
        const cd = cdOf(entry);
        const cost = apCostOf(entry);
        const statusLine = cd > 0
          ? { text: `КД: ${cd} хода`, color: '#ff6b6b' }
          : cost > 0 && ap < cost
            ? { text: `Нужно ${cost} AP`, color: 'rgba(255,255,255,0.4)' }
            : { text: 'Готово — дабл-клик применить', color: '#69db7c' };
        const footerText = 'Дабл-клик — применить · 2×1-8 — слоты · Shift+цифра — выбрать';
        const def = battleToDef.get(ab.id);
        if (def) {
          const rank = playerSkills[def.id] || 0;
          return <AbilityTooltip def={def} rank={rank} x={tip.x} y={tip.y} apCost={cost} statusLine={statusLine} footerText={footerText} />;
        }
        // Капстоуны классических веток: дефа в дереве снайпера нет — синтезируем.
        const pseudo: SniperAbilityDef = {
          id: ab.id, column: 'attack', tier: 5, img: '', name: ab.name,
          kind: 'ulta', maxRanks: 1, gate: 0, apCost: cost,
          cooldown: ab.cooldown, mechanic: ab.description,
        };
        return <AbilityTooltip def={pseudo} rank={1} x={tip.x} y={tip.y} apCost={cost} statusLine={statusLine} footerText={footerText} />;
      })()}
    </div>
    </>
  );
};
