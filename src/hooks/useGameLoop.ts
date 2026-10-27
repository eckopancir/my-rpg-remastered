import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { useCombatGridStore } from '../stores/combatGridStore';
import { useExplorationStore, catchUpExploration } from '../stores/explorationStore';
import { CUSTOM_MAPS } from '../data/encounters';

export const useGameLoop = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exploringInFlight = useRef(false);
  // Счётчик секунд игрового цикла (секундный каденс регена, минутный — стамины).
  const secRef = useRef(0);

  useEffect(() => {
    catchUpExploration();

    intervalRef.current = setInterval(() => {
      secRef.current += 1;
      const player = usePlayerStore.getState();
      const ui = useUiStore.getState();

      // 1. Return home tick
      if (player.travel.isReturning) {
        player.returnHomeTick();
      }

      // 2. Active expeditions - reduce timers
      ui.tick();

      // 3. Check if an expedition completed → start combat
      const freshPlayer = usePlayerStore.getState();
      const freshUi = useUiStore.getState();
      const completedExp = freshUi.queue.find((e) => e.status === 'completed');
      if (completedExp && !freshPlayer.combat.isFighting && !freshPlayer.travel.isTraveling && !freshPlayer.travel.isReturning) {
        // «Отравленная» экспедиция не должна вешать очередь: старт в try, снятие — всегда.
        try {
          freshPlayer.startCombat(completedExp.difficulty || 5);
          const cmapName = completedExp.cardData?.customMapName;
          const cmap = cmapName ? CUSTOM_MAPS[cmapName] : null;
          if (cmap) {
            // Битва на готовой карте конструктора: награды и сундук — с карточки, статы — с тиром.
            usePlayerStore.setState((st: any) => ({
              combat: {
                ...st.combat,
                enemyChipReward: completedExp.cardData.chipReward,
                enemyExpReward: completedExp.cardData.xpReward,
              },
            }));
            const ok = useCombatGridStore.getState().enterCustomMap(cmap, {
              tierMult: completedExp.cardData.tierMult || 1,
              rarity: completedExp.cardData.cardRarityName || null,
            });
            if (!ok) throw new Error('enterCustomMap failed');
          } else {
            const ok = useCombatGridStore.getState().initCombat(
              completedExp.difficulty || 5,
              undefined,
              completedExp.cardData?.enemyKeys,
              completedExp.cardData
                ? { chipReward: completedExp.cardData.chipReward, xpReward: completedExp.cardData.xpReward, cardRarityName: completedExp.cardData.cardRarityName }
                : undefined,
              completedExp.cardData?.allyCount || 0
            );
            if (!ok) throw new Error('initCombat failed');
          }
        } catch (e) {
          console.error('[gameLoop] combat start failed', e);
          usePlayerStore.setState((st: any) => ({ combat: { ...st.combat, isFighting: false } }));
          useUiStore.getState().addToast('⚠️ Бой не запустился — экспедиция снята', 'error');
        } finally {
          freshUi.removeFromQueue(completedExp.id);
          freshUi.processQueue();
        }
      }

      // 4. Exploration tick (skip if previous poll still in-flight — avoids
      //    double-processing the same time window when server is slow).
      //    Когда рейда нет — опрос раз в 5 сек, чтобы подхватить старт
      //    из другой вкладки или после перезагрузки.
      const exploration = useExplorationStore.getState();
      const idleTick = secRef.current % 5 === 0;
      if ((exploration.isExploring || idleTick) && !exploringInFlight.current) {
        exploringInFlight.current = true;
        exploration.pollServerState()
          .catch(() => {})
          .finally(() => { exploringInFlight.current = false; });
      }

      // 5. Rest tick (посекундно: минутная ставка отдыха раскладывается
      //    на 60 секунд внутри restTick — итог за минуту прежний).
      if (ui.isResting) {
        const sBefore = usePlayerStore.getState().stats;
        console.log('[REST_TICK] before', { currentHp: sBefore.currentHp, maxHp: sBefore.maxHp, regen: sBefore.regen, stamina: sBefore.stamina, maxStamina: sBefore.maxStamina, ts: Date.now() });
        const done = player.restTick();
        const sAfter = usePlayerStore.getState().stats;
        if (done) {
          console.log('[REST_TICK] done — HP full');
          ui.setIsResting(false);
          ui.addToast('Полностью восстановлен!', 'success');
        } else {
          console.log('[REST_TICK] after', { currentHp: sAfter.currentHp, hpDelta: sAfter.currentHp - sBefore.currentHp, ts: Date.now() });
        }
      }

      // 6. Passive regen — по-секундный, чтобы HP полз плавно («1 с хвостиком»),
      //    а не прыжком раз в минуту. Ставка за минуту прежняя:
      //    regen × (atBase ? 1 : 0.3) → раскладываем на 1/60 за секунду,
      //    дробный хвостик копится в stats.regenFrac (сейвится в статах) —
      //    итог за минуту совпадает до единицы. Стамина остаётся на минутном
      //    каденсе (почасовая модель, шаги слишком мелкие для показа).
      //    Арена — не здесь: в бою реген тикает с выстрела (см. combat store).
      const skipRegenDueToExploration = exploration.isExploring && !exploration.isReturningHome;
      const traveling = exploration.isExploring || player.travel.isTraveling || player.travel.isReturning;
      if (!skipRegenDueToExploration && !player.combat.isFighting && !player.travel.isTraveling && !player.travel.isReturning && !ui.isResting) {
        const s = player.stats;
        // HP — посекундно.
        if (s.currentHp < s.maxHp) {
          const atBase = !player.travel.isReturning && !player.travel.isTraveling;
          const regenVal = s.regen * (atBase ? 1 : 0.3); // за минуту
          const acc = Math.max(0, Number((s as any).regenFrac ?? 0)) + regenVal / 60;
          const whole = Math.floor(acc);
          const frac = acc - whole;
          if (whole > 0) {
            const newHp = Math.min(s.maxHp, s.currentHp + whole);
            console.log('[PASSIVE_REGEN]', { before: s.currentHp, regenUsed: s.regen, multiplier: atBase ? 1 : 0.3, regenVal, gained: whole, after: newHp, maxHp: s.maxHp, ts: Date.now() });
            usePlayerStore.setState({ stats: { ...s, currentHp: newHp, regenFrac: frac } as any });
          } else {
            usePlayerStore.setState({ stats: { ...s, regenFrac: frac } as any });
          }
        }
        // Стамина — минутный каденс, как раньше (почасовая модель).
        if (secRef.current % 60 === 0) {
          const st = usePlayerStore.getState().stats;
          if (st.stamina !== st.maxStamina) {
            const maxSt = st.maxStamina || 0;
            const newStam = maxSt > 0
              ? (traveling
                ? Math.max(0, st.stamina - (maxSt * 0.01) / 60)
                : Math.min(maxSt, st.stamina + (maxSt * 0.02) / 60))
              : st.stamina;
            usePlayerStore.setState({ stats: { ...st, stamina: newStam } });
          }
        }
      }

      // 7. Active effects tick (skip during combat — ticked per turn in endTurn)
      if (player.activeEffects.length > 0 && !player.combat.isFighting) {
        player.tickEffects();
      }

      // 8. Timed items decay — only while not traveling
      if (!player.travel.isTraveling && !player.travel.isReturning) {
      const eq = player.equipment;
      for (const slot of ['head', 'armor', 'weapon1', 'weapon2', 'gloves', 'boots']) {
        const item = eq[slot as keyof typeof eq];
        if (item && (item as any).timeLimit && (item as any).timeLimit > 0) {
          const newTime = (item as any).timeLimit - 1;
          if (newTime <= 0) {
            usePlayerStore.getState().unequipItem(slot as any);
            usePlayerStore.getState().addLog(`⏳ ${(item as any).displayName || (item as any).name} истёк и снят.`, 'warning');
          } else {
            usePlayerStore.setState((state) => ({
              equipment: { ...state.equipment, [slot]: { ...item as any, timeLimit: newTime } },
            }));
          }
        }
      }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
};
