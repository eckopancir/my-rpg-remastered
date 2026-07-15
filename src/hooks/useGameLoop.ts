import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { useCombatGridStore } from '../stores/combatGridStore';

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

      // 2. Travel tick (to zone)
      if (player.travel.isTraveling) {
        player.travelTick();
        if (!usePlayerStore.getState().travel.isTraveling) {
          ui.processQueue();
        }
      }

      // 3. Active expeditions - reduce timers
      ui.tick();

      // 4. Check if an expedition completed → start combat
      const completedExp = ui.queue.find((e) => e.status === 'completed');
      if (completedExp && !player.combat.isFighting && !player.travel.isTraveling && !player.travel.isReturning) {
        player.startCombat(completedExp.difficulty || 5);
        useCombatGridStore.getState().initCombat(completedExp.difficulty || 5);
        ui.removeFromQueue(completedExp.id);
        ui.processQueue();
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

      // 9. Timed items decay — decrement timeLimit on equipped items
      const eq = player.equipment;
      for (const slot of ['head', 'armor', 'weapon1', 'weapon2', 'gloves', 'boots', 'ammo1', 'ammo2', 'ammo3', 'ammo4']) {
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
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
};
