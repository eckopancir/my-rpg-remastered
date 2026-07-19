import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { useCombatGridStore } from '../stores/combatGridStore';
import { useExplorationStore } from '../stores/explorationStore';

export const useGameLoop = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
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
        freshPlayer.startCombat(completedExp.difficulty || 5);
        useCombatGridStore.getState().initCombat(
          completedExp.difficulty || 5,
          undefined,
          completedExp.cardData?.enemyKeys,
          completedExp.cardData
            ? { chipReward: completedExp.cardData.chipReward, xpReward: completedExp.cardData.xpReward, cardRarityName: completedExp.cardData.cardRarityName }
            : undefined
        );
        freshUi.removeFromQueue(completedExp.id);
        freshUi.processQueue();
      }

      // 4. Exploration tick
      const exploration = useExplorationStore.getState();
      if (exploration.isExploring) {
        exploration.explorationTick();
      }

      // 5. Rest tick
      if (ui.isResting) {
        const done = player.restTick();
        if (done) {
          ui.setIsResting(false);
          ui.addToast('Полностью восстановлен!', 'success');
        }
      }

      // 6. Passive regen — faster at base, slower outside
      if (!player.combat.isFighting && !player.travel.isTraveling && !player.travel.isReturning && !ui.isResting) {
        const s = player.stats;
        if (s.currentHp < s.maxHp || s.stamina < s.maxStamina) {
          const atBase = !player.travel.isReturning && !player.travel.isTraveling;
          usePlayerStore.setState({
            stats: {
              ...s,
              currentHp: Math.min(s.maxHp, s.currentHp + s.regen * (atBase ? 1 : 0.3)),
              stamina: Math.min(s.maxStamina, s.stamina + (atBase ? 1 : 0.1)),
            },
          });
        }
      }

      // 7. Active effects tick (skip during combat — ticked per turn in endTurn)
      if (player.activeEffects.length > 0 && !player.combat.isFighting) {
        player.tickEffects();
      }

      // 8. Base upgrade tick (works even if Base page is not mounted)
      player.baseUpgradeTick();

      // 9. Timed items decay — only while not traveling
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
