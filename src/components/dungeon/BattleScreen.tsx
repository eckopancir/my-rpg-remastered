import { useEffect, useMemo, useState } from 'react';
import { CARD_MAP, effectiveCard } from '../../data/dungeon/cards';
import { SLOT_LABEL } from '../../data/dungeon/mercs';
import { useDungeonStore, type Fx } from '../../stores/dungeonStore';
import { AimArrow } from './AimArrow';
import { CardView } from './CardView';
import { EnemyCard } from './EnemyCard';
import { MercCard } from './MercCard';
import styles from './dungeon.module.css';

type NeedTarget = 'enemy' | 'merc' | null;

export const BattleScreen = () => {
  const run = useDungeonStore((s) => s.run);
  const playCard = useDungeonStore((s) => s.playCard);
  const endTurn = useDungeonStore((s) => s.endTurn);
  const stepEnemy = useDungeonStore((s) => s.stepEnemy);

  const battle = run?.battle ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);

  const fxId = battle?.fx?.id;
  useEffect(() => {
    if (!battle?.fx) return;
    setFx(battle.fx);
    const t = window.setTimeout(() => setFx(null), 640);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxId]);

  const phase = battle?.phase;
  const queueLen = battle?.enemyQueue.length ?? 0;
  useEffect(() => {
    if (phase !== 'enemy') return;
    const t = window.setTimeout(() => stepEnemy(), 620);
    return () => window.clearTimeout(t);
  }, [phase, queueLen, stepEnemy]);

  const selectedInst = useMemo(
    () => (battle && selected ? battle.hand.find((c) => c.uid === selected) ?? null : null),
    [battle, selected],
  );

  useEffect(() => {
    if (!selectedInst) setSelected(null);
  }, [selectedInst]);

  if (!run || !battle) return null;

  const playerTurn = battle.phase === 'player';
  const needTarget: NeedTarget = selectedInst
    ? (() => {
      const def = CARD_MAP[selectedInst.defId];
      if (!def) return null;
      const eff = effectiveCard(def, selectedInst.level);
      return eff.target === 'enemy' ? 'enemy' : eff.target === 'merc' ? 'merc' : null;
    })()
    : null;

  const onCard = (uid: string) => {
    if (!playerTurn) return;
    const inst = battle.hand.find((c) => c.uid === uid);
    if (!inst) return;
    const def = CARD_MAP[inst.defId];
    if (!def) return;
    const eff = effectiveCard(def, inst.level);
    if (battle.energy < eff.cost) return;
    if (eff.target === 'enemy' || eff.target === 'merc') {
      setSelected(selected === uid ? null : uid);
      return;
    }
    setSelected(null);
    playCard(uid);
  };

  const onEnemy = (uid: string) => {
    if (!playerTurn || !selected || needTarget !== 'enemy') return;
    playCard(selected, uid);
    setSelected(null);
  };

  const onMerc = (id: string) => {
    if (!playerTurn || !selected || needTarget !== 'merc') return;
    playCard(selected, id);
    setSelected(null);
  };

  const aliveMercs = battle.mercs.filter((m) => m.alive);
  const slotOrder = ['back1', 'back2', 'front1', 'front2'] as const;
  const mercAt = (slot: string) => aliveMercs.find((m) => m.slot === slot) ?? null;
  // Врагов обычно 1–3, но призывы могут добавить ещё — лишние переносятся на вторую строку.
  const enemySlots = Math.max(4, battle.enemies.length);
  // Враги стоят в обратном порядке: первый в списке — крайний правый слот.
  const enemyAt = (slot: number) => battle.enemies[enemySlots - 1 - slot] ?? null;
  const logTail = battle.log.slice(-5);

  return (
    <div className={styles.battle}>
      <div className={styles.battleLog}>
        {logTail.map((line, i) => <div key={`${i}-${line}`}>{line}</div>)}
      </div>
      <div className={styles.turnBadge}>
        ХОД {battle.turn} · {playerTurn ? 'ВАШ' : 'ВРАГ'}
      </div>

      <div className={styles.field}>
        <div className={`${styles.side} ${styles.sidePlayer}`}>
          {slotOrder.map((slot) => {
            const m = mercAt(slot);
            return m ? (
              <div key={slot} className={styles.slot}>
                <MercCard
                  id={m.id}
                  name={m.name}
                  role={m.role}
                  stars={m.stars}
                  hp={m.hp}
                  maxHp={m.maxHp}
                  armor={m.armor}
                  maxArmor={m.maxArmor}
                  shield={m.shield}
                  healDown={m.healDown}
                  armorDown={m.armorDown}
                  vuln={m.vuln}
                  barrier={m.barrier}
                  regen={m.regen}
                  thorns={m.thorns}
                  taunt={m.taunt}
                  dodge={m.dodge}
                  slotLabel={SLOT_LABEL[slot]}
                  targetable={needTarget === 'merc'}
                  fx={fx}
                  onClick={() => onMerc(m.id)}
                />
              </div>
            ) : (
              <div key={slot} className={`${styles.slot} ${styles.emptySlot}`}>{SLOT_LABEL[slot]}</div>
            );
          })}
        </div>

        <div className={`${styles.side} ${styles.sideEnemy}`}>
          {Array.from({ length: enemySlots }).map((_, i) => {
            const e = enemyAt(i);
            return e ? (
              <div key={e.uid} className={styles.slot}>
                <EnemyCard
                  enemy={e}
                  targetable={needTarget === 'enemy'}
                  fx={fx}
                  onClick={() => onEnemy(e.uid)}
                />
              </div>
            ) : (
              <div key={`empty-${i}`} className={`${styles.slot} ${styles.emptySlot} ${styles.emptySlotTall}`} aria-hidden="true" />
            );
          })}
        </div>
      </div>

      {selectedInst && needTarget && <AimArrow sourceUid={selectedInst.uid} kind={needTarget} />}

      <div className={styles.handArea}>
        {battle.hand.length === 0 ? (
          <div className={styles.handEmpty}>{playerTurn ? 'Рука пуста' : 'Ход врага…'}</div>
        ) : (
          battle.hand.map((inst, i) => {
            const def = CARD_MAP[inst.defId];
            const eff = def ? effectiveCard(def, inst.level) : null;
            return (
              <CardView
                key={inst.uid}
                defId={inst.defId}
                level={inst.level}
                hand
                uid={inst.uid}
                delay={i * 45}
                selected={selected === inst.uid}
                disabled={!playerTurn || !eff || battle.energy < eff.cost}
                onClick={() => onCard(inst.uid)}
              />
            );
          })
        )}
      </div>

      <div className={styles.battleBottom}>
        <div className={styles.energy}>
          <span className={styles.energyLabel}>ЭНЕРГИЯ</span>
          <div className={styles.pips}>
            {Array.from({ length: Math.max(5, battle.energy) }).map((_, i) => (
              <span key={i} className={`${styles.pip} ${i < battle.energy ? styles.pipOn : ''}`} />
            ))}
          </div>
          <b style={{ color: '#fbbf24' }}>{battle.energy}</b>
        </div>

        {(battle.rage ?? 0) > 0 && (
          <span className={styles.pill} style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.55)' }} title="Урон наёмников увеличен до конца боя">
            🔥 ЯРОСТЬ +{Math.round(battle.rage * 100)}%
          </span>
        )}

        {needTarget && (
          <span className={styles.pill} style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.5)' }}>
            {needTarget === 'enemy' ? 'Выберите врага' : 'Выберите наёмника'}
          </span>
        )}

        <div className={styles.deckInfo}>
          <span className={styles.pill} title="Карты в колоде добора">Колода: {battle.drawPile.length}</span>
          <span className={styles.pill} title="Карты в сбросе">Сброс: {battle.discardPile.length}</span>
        </div>

        <button
          type="button"
          className={styles.endTurn}
          disabled={!playerTurn}
          onClick={() => { setSelected(null); endTurn(); }}
        >
          {playerTurn ? 'КОНЕЦ ХОДА' : 'ХОД ВРАГА…'}
        </button>
      </div>
    </div>
  );
};
