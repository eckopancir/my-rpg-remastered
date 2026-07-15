import { useEffect, useRef } from 'react';
import { useCombatGridStore, checkVisibility, findPathForEnemy, getDist, getAngle, calculateCombatResult, executeSkill, type GlobalEffect } from '../stores/combatGridStore';
import { usePlayerStore } from '../stores/playerStore';
import { BASE_AP } from '../stores/combatGridStore';
import { playCombatSound } from './useSound';
import { calcExtraShots } from '../utils/itemPower';

export const useEnemyAI = () => {
  const turn = useCombatGridStore((s) => s.turn);
  const isActive = useCombatGridStore((s) => s.isActive);
  const isProcessing = useRef(false);

  useEffect(() => {
    if (turn !== 'enemy' || !isActive || isProcessing.current) return;

    const runAI = async () => {
      isProcessing.current = true;
      try {
      const store = useCombatGridStore.getState();

      // Safety: if all enemies dead + no reserve, don't run AI
      const allDeadCheck = store.enemies.every((e: any) => e.currentHp <= 0);
      if (allDeadCheck && store.reserve.length === 0) {
        useCombatGridStore.setState({
          turn: 'player',
          ap: BASE_AP,
          message: '🕊️ Поле зачищено. Свободное перемещение.',
          battleLogs: [...useCombatGridStore.getState().battleLogs, '🕊️ Поле зачищено. Все враги уничтожены!'],
        });
        isProcessing.current = false;
        return;
      }

      // Process global effects
      const activeEffects: GlobalEffect[] = [];
      for (const eff of store.globalEffects) {
        if (eff.timer <= 0) {
          if (eff.type === 'GRENADE') {
            useCombatGridStore.setState({ isShaking: true });
            setTimeout(() => useCombatGridStore.setState({ isShaking: false }), 500);
            const d = getDist(store.playerPos, eff.pos);
            if (d <= 2) {
              const finalDmg = eff.damage;
              usePlayerStore.setState((st: any) => ({
                stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
              }));
              useCombatGridStore.getState().addPopup(store.playerPos.x, store.playerPos.y, `💥 ГРАНАТА! -${Math.round(finalDmg)}`, 'ERROR');
            } else {
              useCombatGridStore.getState().addPopup(eff.pos.x, eff.pos.y, '💥 БАМ!', 'SPECIAL');
            }
          }
          if (eff.type === 'REDZONE') {
            useCombatGridStore.setState({ isShaking: true });
            setTimeout(() => useCombatGridStore.setState({ isShaking: false }), 500);
            const isHit = store.playerPos.x === eff.pos.x && store.playerPos.y === eff.pos.y;
            if (isHit) {
              usePlayerStore.setState((st: any) => ({
                stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - eff.damage) },
              }));
              useCombatGridStore.getState().addPopup(store.playerPos.x, store.playerPos.y, `☢️ ПРЯМОЕ ПОПАДАНИЕ! -${Math.round(eff.damage)}`, 'ERROR');
            } else {
              useCombatGridStore.getState().addPopup(eff.pos.x, eff.pos.y, '💨 МИМО!', 'SPECIAL');
            }
          }
        } else {
          activeEffects.push({ ...eff, timer: eff.timer - 1 });
          if (eff.type === 'GRENADE') useCombatGridStore.getState().addPopup(eff.pos.x, eff.pos.y, `⏲️ ${eff.timer}`, 'SPECIAL');
          if (eff.type === 'REDZONE') useCombatGridStore.getState().addPopup(eff.pos.x, eff.pos.y, '⚠️ ЗАХВАТ ЦЕЛИ', 'ERROR');
        }
      }
      useCombatGridStore.setState({ globalEffects: activeEffects });
      await new Promise((r) => setTimeout(r, 300));

      // Decrease cooldowns and effects on all enemies
      const s = useCombatGridStore.getState();
      let updatedEnemies = s.enemies.map((e: any) => {
        const nextInvisTurns = e.isInvisible ? Math.max(0, e.invisTurns - 1) : 0;
        const losingInvis = e.isInvisible && nextInvisTurns === 0;
        return {
          ...e,
          cooldowns: Object.fromEntries(
            Object.entries(e.cooldowns || {}).map(([k, v]) => [k, Math.max(0, (v as number) - 1)]),
          ),
          rageTurns: e.isEnraged ? Math.max(0, e.rageTurns - 1) : 0,
          invisTurns: nextInvisTurns,
          isEnraged: e.isEnraged && e.rageTurns > 1,
          isInvisible: nextInvisTurns > 0,
          evasion: losingInvis ? e.baseEvasion : e.evasion,
        };
      });
      useCombatGridStore.setState({ enemies: [...updatedEnemies] });
      await new Promise((r) => setTimeout(r, 200));

      const playerStats = usePlayerStore.getState().stats;

      for (let i = 0; i < updatedEnemies.length; i++) {
        const curStore = useCombatGridStore.getState();
        const enemy = updatedEnemies[i];
        if (enemy.currentHp <= 0) continue;
        let enemyAp = enemy.runAp || 5;

        const isMedic = enemy.name.toLowerCase().includes('medic') || enemy.factionKey?.toLowerCase().includes('medic');

        // Skills
        if (enemy.skillUse && enemy.skillUse.length > 0) {
          for (const skillName of enemy.skillUse) {
            const res = await executeSkill(skillName, enemy, curStore.playerPos, useCombatGridStore.setState, useCombatGridStore.getState, playerStats);
            if (res) {
              if (res.boostAp) enemyAp = (enemy.runAp || 5) * 2;
              if (res.costAp) enemyAp -= res.costAp;
              if (res.spendAllAp) { enemyAp = 0; break; }
              if (res.forcedPos) {
                enemy.pos = res.forcedPos;
                updatedEnemies[i].pos = res.forcedPos;
              }
              await new Promise((r) => setTimeout(r, 600));
              if (enemyAp <= 0) break;
            }
          }
        }

        // Basic attack/move
        while (enemyAp > 0) {
          const currentStore = useCombatGridStore.getState();
          let woundedAlly: any = null;
          let targetPos = { ...currentStore.playerPos };

          if (isMedic) {
            woundedAlly = updatedEnemies.find(
              (e: any) => e.id !== enemy.id && !e.dead && e.currentHp > 0 && e.currentHp < e.maxHp * 0.95,
            );
            if (woundedAlly) {
              // Medic only heals, never attacks player
              const healVal = enemy.damage || 10;
              updatedEnemies = updatedEnemies.map((e: any) =>
                e.id === woundedAlly.id ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + healVal) } : e,
              );
              playCombatSound('healer', 0.4);
              useCombatGridStore.getState().addPopup(woundedAlly.pos.x, woundedAlly.pos.y, `+${Math.round(healVal)} HP 🩹`, 'HEAL');
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
              await new Promise((r) => setTimeout(r, 400));
              break;
            }
            // No wounded allies — follow leader or idle
            const leader = updatedEnemies.find((e: any) => e.id !== enemy.id && !e.dead && e.currentHp > 0);
            if (leader) targetPos = { ...leader.pos };
            else { enemyAp = 0; break; }
          }

          const dist = getDist(enemy.pos, targetPos);
          const inRange = dist <= (enemy.rangeDistance || 7);
          const canSee = checkVisibility(enemy.pos, 0, targetPos, currentStore.obstacles, { range: 15, fov: 360 });

          if (canSee && inRange && enemyAp >= (enemy.shotPrice || 1)) {
            const angle = getAngle(enemy.pos, targetPos);
            // Play enemy attack sound
            const atkSound = enemy.soundAttack || 'shotenemy';
            playCombatSound(atkSound, 0.4);
            useCombatGridStore.setState({
              shotLine: { from: enemy.pos, to: targetPos },
              enemies: useCombatGridStore.getState().enemies.map((e: any) =>
                e.id === enemy.id ? { ...e, rotation: angle, isSpinning: enemy.name.toLowerCase().includes('melle') || enemy.name.toLowerCase().includes('melee') } : e
              ),
            });
            setTimeout(() => useCombatGridStore.setState({ shotLine: null }), 400);
            setTimeout(() => {
              useCombatGridStore.setState({
                enemies: useCombatGridStore.getState().enemies.map((e: any) =>
                  e.id === enemy.id ? { ...e, isSpinning: false } : e
                ),
              });
            }, 300);

            // DPS = damage * (1 + speed) as in original
            const enemyDps = enemy.dps || enemy.damage * (1 + (enemy.speed || 0));
            const result = calculateCombatResult(
              { dps: enemyDps, accuracy: enemy.accuracy, crit: enemy.crit, punching: enemy.punching, vampir: enemy.vampir, isPlayer: false },
              { armor: playerStats.armor, evasion: playerStats.evasion, block: playerStats.block, incomingDamageMult: playerStats.incomingDamageMult },
            );

            // Sound from result (crit/block)
            if (result.sound) {
              playCombatSound(result.sound, 0.4);
            }

            if (result.damage > 0) {
              const finalDmg = Math.round(result.damage);
              usePlayerStore.setState((st: any) => ({
                stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
              }));
              useCombatGridStore.getState().addPopup(currentStore.playerPos.x, currentStore.playerPos.y, result.text, result.type);
              useCombatGridStore.setState({ isPlayerHit: true });
              setTimeout(() => useCombatGridStore.setState({ isPlayerHit: false }), 300);

              // Vampirism: heal attacker
              const healVamp = result.damage * (enemy.vampir || 0);
              if (healVamp > 0) {
                updatedEnemies = updatedEnemies.map((e: any) =>
                  e.id === enemy.id ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + healVamp) } : e,
                );
                useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, `+${Math.round(healVamp)} 🩸`, 'VAMP');
              }
            } else {
              useCombatGridStore.getState().addPopup(currentStore.playerPos.x, currentStore.playerPos.y, result.text, result.type);
            }

            // Post-attack regen (flat)
            if (enemy.regen > 0) {
              updatedEnemies = updatedEnemies.map((e: any) =>
                e.id === enemy.id ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + (e.regen || 0)) } : e,
              );
              useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, `+${Math.round(enemy.regen || 0)} HP`, 'HEAL');
            }

            useCombatGridStore.setState({ enemies: [...updatedEnemies] });

            // Extra shots from enemy speed (no AP cost)
            const enemyBonusShots = calcExtraShots(enemy.speed || 0);
            for (let s = 0; s < enemyBonusShots; s++) {
              const curAfter = usePlayerStore.getState().stats;
              if (curAfter.currentHp <= 0) break;

              const eAngle = getAngle(enemy.pos, currentStore.playerPos);
              const eAtkSound = enemy.soundAttack || 'shotenemy';
              playCombatSound(eAtkSound, 0.4);
              useCombatGridStore.setState({
                shotLine: { from: enemy.pos, to: currentStore.playerPos },
                enemies: useCombatGridStore.getState().enemies.map((e: any) =>
                  e.id === enemy.id ? { ...e, rotation: eAngle, isSpinning: enemy.name.toLowerCase().includes('melle') || enemy.name.toLowerCase().includes('melee') } : e
                ),
              });
              setTimeout(() => useCombatGridStore.setState({ shotLine: null }), 400);
              setTimeout(() => {
                useCombatGridStore.setState({
                  enemies: useCombatGridStore.getState().enemies.map((e: any) =>
                    e.id === enemy.id ? { ...e, isSpinning: false } : e
                  ),
                });
              }, 300);

              const enemyDps2 = enemy.dps || enemy.damage * (1 + (enemy.speed || 0));
              const result2 = calculateCombatResult(
                { dps: enemyDps2, accuracy: enemy.accuracy, crit: enemy.crit, punching: enemy.punching, vampir: enemy.vampir, isPlayer: false },
                { armor: curAfter.armor, evasion: curAfter.evasion, block: curAfter.block, incomingDamageMult: curAfter.incomingDamageMult },
              );

              if (result2.sound) playCombatSound(result2.sound, 0.4);

              if (result2.damage > 0) {
                const finalDmg2 = Math.round(result2.damage);
                usePlayerStore.setState((st: any) => ({
                  stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg2) },
                }));
                useCombatGridStore.getState().addPopup(currentStore.playerPos.x, currentStore.playerPos.y, result2.text, result2.type);
                useCombatGridStore.setState({ isPlayerHit: true });
                setTimeout(() => useCombatGridStore.setState({ isPlayerHit: false }), 300);

                const healVamp2 = result2.damage * (enemy.vampir || 0);
                if (healVamp2 > 0) {
                  updatedEnemies = updatedEnemies.map((e: any) =>
                    e.id === enemy.id ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + healVamp2) } : e,
                  );
                  useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, `+${Math.round(healVamp2)} 🩸`, 'VAMP');
                }
              } else {
                useCombatGridStore.getState().addPopup(currentStore.playerPos.x, currentStore.playerPos.y, result2.text, result2.type);
              }

              useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, '+1 🏃', 'BUFF');
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
              await new Promise((r) => setTimeout(r, 400));
            }

            enemyAp -= enemy.shotPrice || 1;
            useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }

          if (enemyAp > 0) {
            const curStore2 = useCombatGridStore.getState();
            const path = findPathForEnemy(enemy.pos, targetPos, curStore2.obstacles, updatedEnemies, enemy.id);
            if (path && path.length > 1) {
              const nextStep = path[1];
              const moveAngle = getAngle(enemy.pos, nextStep);
              enemy.pos = { ...nextStep };
              updatedEnemies[i] = { ...enemy, rotation: moveAngle };
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
              enemyAp -= 1;
              await new Promise((r) => setTimeout(r, 200));
            } else { break; }
          } else { break; }
        }
      }

      // Regeneration for all enemies
      updatedEnemies = useCombatGridStore.getState().enemies.map((e: any) => {
        if (e.dead) return e;
        const regenVal = e.regen || 0;
        if (regenVal > 0 && e.currentHp < e.maxHp) {
          const newHp = Math.min(e.maxHp, e.currentHp + regenVal);
          return { ...e, currentHp: newHp };
        }
        return e;
      });
      useCombatGridStore.setState({ enemies: [...updatedEnemies] });

      // Check player death
      const playerAfter = usePlayerStore.getState();
      if (playerAfter.stats.currentHp <= 0) {
        useCombatGridStore.getState().addMessage('💀 Ты пал в бою...');
        useCombatGridStore.getState().addBattleLog('💀 Поражение...');
        useCombatGridStore.setState({ isDefeat: true, turn: 'player' });
        isProcessing.current = false;
        return;
      }

      // Start player turn
      const finalState = useCombatGridStore.getState();
      useCombatGridStore.setState({
        turn: 'player',
        ap: BASE_AP,
        turnCount: finalState.turnCount + 1,
        message: `⚔️ Твой ход (раунд ${finalState.turnCount + 1})`,
      });
      } catch (e) {
        console.error('[EnemyAI]', e);
      }
      isProcessing.current = false;
    };

    runAI();
  }, [turn, isActive]);
};
