import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { useCombatGridStore } from '../stores/combatGridStore';
import { useExplorationStore, catchUpExploration } from '../stores/explorationStore';

export const useGameLoop = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exploringInFlight = useRef(false);
  // Счётчик секунд для минутного каденса регена (кроме арены).
  const secRef = useRef(0);

  useEffect(() => {
    catchUpExploration();

    intervalRef.current = setInterval(() => {
      secRef.current += 1;
      // Реген тикает раз в минуту, а не раз в секунду.
      const isRegenTick = secRef.current % 60 === 0;
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
          const ok = useCombatGridStore.getState().initCombat(
            completedExp.difficulty || 5,
            undefined,
            completedExp.cardData?.enemyKeys,
            completedExp.cardData
              ? { chipReward: completedExp.cardData.chipReward, xpReward: completedExp.cardData.xpReward, cardRarityName: completedExp.cardData.cardRarityName }
              : undefined
          );
          if (!ok) throw new Error('initCombat failed');
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
      //    double-processing the same time window when server is slow)
      const exploration = useExplorationStore.getState();
      if (exploration.isExploring && !exploringInFlight.current) {
        exploringInFlight.current = true;
        exploration.pollServerState()
          .catch(() => {})
          .finally(() => { exploringInFlight.current = false; });
      }

      // 5. Rest tick (раз в минуту)
      if (ui.isResting && isRegenTick) {
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

      // 6. Passive regen — faster at base, slower outside (skip during server-polled phase of exploration)
      // Тикает раз в минуту (isRegenTick), кроме арены.
      const skipRegenDueToExploration = exploration.isExploring && !exploration.isReturningHome;
      if (isRegenTick && !skipRegenDueToExploration && !player.combat.isFighting && !player.travel.isTraveling && !player.travel.isReturning && !ui.isResting) {
        const s = player.stats;
        if (s.currentHp !== s.maxHp || s.stamina !== s.maxStamina) {
          const atBase = !player.travel.isReturning && !player.travel.isTraveling;
          const regenVal = s.regen * (atBase ? 1 : 0.3);
          const newHp = Math.min(s.maxHp, s.currentHp + regenVal);
          console.log('[PASSIVE_REGEN]', { before: s.currentHp, regenUsed: s.regen, multiplier: atBase ? 1 : 0.3, regenVal, after: newHp, maxHp: s.maxHp, ts: Date.now() });
          usePlayerStore.setState({
            stats: {
              ...s,
              currentHp: newHp,
              stamina: Math.min(s.maxStamina, s.stamina + (atBase ? 1 : 0.1)),
            },
          });
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
