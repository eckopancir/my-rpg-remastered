import { useEffect, useRef } from 'react';
import { useCombatGridStore, checkVisibility, findPathForEnemy, getDist, getAngle, calculateCombatResult, executeSkill, absorbWithShield, type GlobalEffect } from '../stores/combatGridStore';
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
          ap: store.maxAp || BASE_AP,
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
              if (useCombatGridStore.getState().immortalityTurns > 0) {
                useCombatGridStore.getState().addPopup(store.playerPos.x, store.playerPos.y, '🛡️ БЕССМЕРТИЕ!', 'BLOCK');
              } else {
                usePlayerStore.setState((st: any) => ({
                  stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
                }));
                useCombatGridStore.getState().addPopup(store.playerPos.x, store.playerPos.y, `💥 ГРАНАТА! -${Math.round(finalDmg)}`, 'ERROR');
                useCombatGridStore.getState().checkAutoTriggers();
              }
            } else {
              useCombatGridStore.getState().addPopup(eff.pos.x, eff.pos.y, '💥 БАМ!', 'SPECIAL');
            }
          }
          if (eff.type === 'REDZONE') {
            useCombatGridStore.setState({ isShaking: true });
            setTimeout(() => useCombatGridStore.setState({ isShaking: false }), 500);
            const isHit = store.playerPos.x === eff.pos.x && store.playerPos.y === eff.pos.y;
            if (isHit) {
              const finalDmg = eff.damage;
              if (useCombatGridStore.getState().immortalityTurns > 0) {
                useCombatGridStore.getState().addPopup(store.playerPos.x, store.playerPos.y, '🛡️ БЕССМЕРТИЕ!', 'BLOCK');
              } else {
                usePlayerStore.setState((st: any) => ({
                  stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
                }));
                useCombatGridStore.getState().addPopup(store.playerPos.x, store.playerPos.y, `☢️ ПРЯМОЕ ПОПАДАНИЕ! -${Math.round(finalDmg)}`, 'ERROR');
                useCombatGridStore.getState().checkAutoTriggers();
              }
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

      // Decrease cooldowns and effects on all enemies + player invis
      const s = useCombatGridStore.getState();
      const nextPlayerInvisTurns = s.playerInvisible ? Math.max(0, s.playerInvisTurns - 1) : 0;
      const losingPlayerInvis = s.playerInvisible && nextPlayerInvisTurns === 0;
      if (losingPlayerInvis) {
        useCombatGridStore.getState().addPopup(s.playerPos.x, s.playerPos.y, '👀 Вас заметили!', 'WARNING');
      }
      const nextImmortalityTurns = s.immortalityTurns > 0 ? Math.max(0, s.immortalityTurns - 1) : 0;
      useCombatGridStore.setState({
        playerInvisible: nextPlayerInvisTurns > 0,
        playerInvisTurns: nextPlayerInvisTurns,
        immortalityTurns: nextImmortalityTurns,
      });

      let updatedEnemies = s.enemies.map((e: any) => {
        const nextInvisTurns = e.isInvisible ? Math.max(0, e.invisTurns - 1) : 0;
        const losingInvis = e.isInvisible && nextInvisTurns === 0;
        const nextStunTurns = e.stunned ? Math.max(0, (e.stunTurns || 0) - 1) : 0;
        const nextLifetime = e.lifetime ? e.lifetime - 1 : 0;
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
          stunned: e.stunned && (e.stunTurns || 0) > 0,
          stunTurns: nextStunTurns,
          lifetime: nextLifetime,
        };
      });
      // Remove expired minions (lifetime just hit 0)
      const expiredMinions = updatedEnemies.filter((e: any) => e.lifetime === 0 && e.isMinion);
      for (const exp of expiredMinions) {
        useCombatGridStore.getState().addPopup(exp.pos.x, exp.pos.y, '💫 Клон исчез!', 'SPECIAL');
      }
      updatedEnemies = updatedEnemies.filter((e: any) => e.lifetime !== 0 || !e.isMinion);
      useCombatGridStore.setState({ enemies: [...updatedEnemies] });
      await new Promise((r) => setTimeout(r, 200));

      const playerStats = usePlayerStore.getState().stats;
      const isPlayerInvisible = useCombatGridStore.getState().playerInvisible;

      for (let i = 0; i < updatedEnemies.length; i++) {
        const curStore = useCombatGridStore.getState();
        const enemy = updatedEnemies[i];
        if (enemy.currentHp <= 0) continue;

        // Skip stunned enemies
        if (enemy.stunned) {
          useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, '⚡ ОГЛУШЕН!', 'SPECIAL');
          continue;
        }

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

        // Sync store rotations (from skills like ram/aimShot) into local copy
        {
          const storeEnemies = useCombatGridStore.getState().enemies;
          updatedEnemies = updatedEnemies.map((e: any) => {
            const se = storeEnemies.find((s: any) => s.id === e.id);
            return se ? { ...e, rotation: se.rotation } : e;
          });
        }

        // Basic attack/move
        while (enemyAp > 0) {
          const currentStore = useCombatGridStore.getState();
          let woundedAlly: any = null;
          const isAlly = enemy.faction === 'Союзник';

          // Determine target: allies attack enemies, enemies attack player or nearby ally
          let targetPos: { x: number; y: number };
          if (isAlly) {
            // Minion/decoy: find nearest non-ally enemy
            const hostile = updatedEnemies.find((e: any) => e.id !== enemy.id && !e.dead && e.currentHp > 0 && e.faction !== 'Союзник');
            targetPos = hostile ? { ...hostile.pos } : { ...currentStore.playerPos };
          } else {
            // Check for nearby ally (decoy/minion) to attack instead of player
            const nearbyAlly = updatedEnemies.find(
              (e: any) => e.faction === 'Союзник' && !e.dead && e.currentHp > 0 && getDist(enemy.pos, e.pos) <= (enemy.rangeDistance || 7),
            );
            if (nearbyAlly) {
              targetPos = { ...nearbyAlly.pos };
            } else if (isPlayerInvisible) {
              // Player invisible, no ally visible — idle
              enemyAp = 0; break;
            } else {
              targetPos = { ...currentStore.playerPos };
            }
          }

          if (isMedic) {
            const allWoundedAllies = updatedEnemies
              .filter((e: any) => e.id !== enemy.id && !e.dead && e.currentHp > 0
                && e.currentHp < e.maxHp * 0.95
                && e.faction === enemy.faction)
              .sort((a: any, b: any) => getDist(enemy.pos, a.pos) - getDist(enemy.pos, b.pos));

            if (allWoundedAllies.length === 0) {
              enemyAp = 0; break; // некого лечить — бездействие
            }

            const nearestWounded = allWoundedAllies[0];
            const healRange = 2;
            const distToWounded = getDist(enemy.pos, nearestWounded.pos);

            if (distToWounded <= healRange) {
              const healVal = (enemy.damage || 10) * 3;
              const healAngle = getAngle(enemy.pos, nearestWounded.pos);
              updatedEnemies = updatedEnemies.map((e: any) =>
                e.id === nearestWounded.id ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + healVal) } : e,
              );
              updatedEnemies[i] = { ...updatedEnemies[i], rotation: healAngle };
              playCombatSound('healer', 0.4);
              useCombatGridStore.getState().addPopup(nearestWounded.pos.x, nearestWounded.pos.y, `+${Math.round(healVal)} HP 🩹`, 'HEAL');
              useCombatGridStore.setState({ enemies: [...updatedEnemies], shotLine: { from: enemy.pos, to: nearestWounded.pos, type: 'heal' } });
              await new Promise((r) => setTimeout(r, 400));
              const st = useCombatGridStore.getState();
              if (st.shotLine?.type === 'heal') useCombatGridStore.setState({ shotLine: null });
              break;
            }

            // Движение к ближайшему раненому союзнику
            targetPos = { ...nearestWounded.pos };
          }

          const dist = getDist(enemy.pos, targetPos);
          const inRange = dist <= (enemy.rangeDistance || 7);
          const canSee = checkVisibility(enemy.pos, 0, targetPos, currentStore.obstacles, { range: 15, fov: 360 });

          if (canSee && inRange && enemyAp >= (enemy.shotPrice || 1) && !isMedic) {
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
            updatedEnemies = updatedEnemies.map((e: any) =>
              e.id === enemy.id ? { ...e, rotation: angle } : e
            );
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
              // Check if target is an ally (decoy/minion) in enemies array
              const targetAlly = updatedEnemies.find((e: any) =>
                e.faction === 'Союзник' && !e.dead && e.pos.x === targetPos.x && e.pos.y === targetPos.y,
              );
              if (targetAlly) {
                targetAlly.currentHp = Math.max(0, targetAlly.currentHp - finalDmg);
                targetAlly.isHit = true;
                useCombatGridStore.getState().addPopup(targetAlly.pos.x, targetAlly.pos.y, result.text, result.type);
                setTimeout(() => { targetAlly.isHit = false; }, 300);
                if (targetAlly.currentHp <= 0) {
                  targetAlly.dead = true;
                  useCombatGridStore.getState().addPopup(targetAlly.pos.x, targetAlly.pos.y, '💥 Приманка уничтожена!', 'SPECIAL');
                }
              } else if (absorbWithShield(currentStore.playerPos)) {
                // Shield absorbed all damage
              } else if (useCombatGridStore.getState().immortalityTurns > 0) {
                useCombatGridStore.getState().addPopup(currentStore.playerPos.x, currentStore.playerPos.y, '🛡️ БЕССМЕРТИЕ!', 'BLOCK');
                useCombatGridStore.setState({ isPlayerHit: true });
                setTimeout(() => useCombatGridStore.setState({ isPlayerHit: false }), 300);
              } else {
                usePlayerStore.setState((st: any) => ({
                  stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
                }));
                useCombatGridStore.getState().addPopup(currentStore.playerPos.x, currentStore.playerPos.y, result.text, result.type);
                useCombatGridStore.setState({ isPlayerHit: true });
                setTimeout(() => useCombatGridStore.setState({ isPlayerHit: false }), 300);
                useCombatGridStore.getState().checkAutoTriggers();
              }

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

              const eAngle = getAngle(enemy.pos, targetPos);
              const eAtkSound = enemy.soundAttack || 'shotenemy';
              playCombatSound(eAtkSound, 0.4);
              useCombatGridStore.setState({
                shotLine: { from: enemy.pos, to: targetPos },
                enemies: useCombatGridStore.getState().enemies.map((e: any) =>
                  e.id === enemy.id ? { ...e, rotation: eAngle, isSpinning: enemy.name.toLowerCase().includes('melle') || enemy.name.toLowerCase().includes('melee') } : e
                ),
              });
              updatedEnemies = updatedEnemies.map((e: any) =>
                e.id === enemy.id ? { ...e, rotation: eAngle } : e
              );
              setTimeout(() => useCombatGridStore.setState({ shotLine: null }), 400);
              setTimeout(() => {
                useCombatGridStore.setState({
                  enemies: useCombatGridStore.getState().enemies.map((e: any) =>
                    e.id === enemy.id ? { ...e, isSpinning: false } : e
                  ),
                });
              }, 300);

              const enemyDps2 = enemy.dps || enemy.damage * (1 + (enemy.speed || 0));
              const extraTargetAlly = updatedEnemies.find((e: any) =>
                e.faction === 'Союзник' && !e.dead && e.pos.x === targetPos.x && e.pos.y === targetPos.y,
              );
              const tgtArmor = extraTargetAlly ? extraTargetAlly.armor : curAfter.armor;
              const tgtEvasion = extraTargetAlly ? extraTargetAlly.evasion : curAfter.evasion;
              const tgtBlock = extraTargetAlly ? extraTargetAlly.block : curAfter.block;
              const tgtIncoming = extraTargetAlly ? 1 : curAfter.incomingDamageMult;
              const result2 = calculateCombatResult(
                { dps: enemyDps2, accuracy: enemy.accuracy, crit: enemy.crit, punching: enemy.punching, vampir: enemy.vampir, isPlayer: false },
                { armor: tgtArmor, evasion: tgtEvasion, block: tgtBlock, incomingDamageMult: tgtIncoming },
              );

              if (result2.sound) playCombatSound(result2.sound, 0.4);

              if (result2.damage > 0) {
                const finalDmg2 = Math.round(result2.damage);
                if (extraTargetAlly) {
                  extraTargetAlly.currentHp = Math.max(0, extraTargetAlly.currentHp - finalDmg2);
                  extraTargetAlly.isHit = true;
                  useCombatGridStore.getState().addPopup(extraTargetAlly.pos.x, extraTargetAlly.pos.y, result2.text, result2.type);
                  setTimeout(() => { extraTargetAlly.isHit = false; }, 300);
                  if (extraTargetAlly.currentHp <= 0) {
                    extraTargetAlly.dead = true;
                    useCombatGridStore.getState().addPopup(extraTargetAlly.pos.x, extraTargetAlly.pos.y, '💥 Приманка уничтожена!', 'SPECIAL');
                  }
                } else if (absorbWithShield(currentStore.playerPos)) {
                  // Shield absorbed all damage
                } else if (useCombatGridStore.getState().immortalityTurns > 0) {
                  useCombatGridStore.getState().addPopup(currentStore.playerPos.x, currentStore.playerPos.y, '🛡️ БЕССМЕРТИЕ!', 'BLOCK');
                  useCombatGridStore.setState({ isPlayerHit: true });
                  setTimeout(() => useCombatGridStore.setState({ isPlayerHit: false }), 300);
                } else {
                  usePlayerStore.setState((st: any) => ({
                    stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg2) },
                  }));
                  useCombatGridStore.getState().addPopup(currentStore.playerPos.x, currentStore.playerPos.y, result2.text, result2.type);
                  useCombatGridStore.setState({ isPlayerHit: true });
                  setTimeout(() => useCombatGridStore.setState({ isPlayerHit: false }), 300);
                  useCombatGridStore.getState().checkAutoTriggers();
                }

                const healVamp2 = result2.damage * (enemy.vampir || 0);
                if (healVamp2 > 0) {
                  updatedEnemies = updatedEnemies.map((e: any) =>
                    e.id === enemy.id ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + healVamp2) } : e,
                  );
                  useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, `+${Math.round(healVamp2)} 🩸`, 'VAMP');
                }
              } else {
                useCombatGridStore.getState().addPopup(targetPos.x, targetPos.y, result2.text, result2.type);
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

      // Mine proximity detection & detonation
      const curMineState = useCombatGridStore.getState();
      const mines = curMineState.globalEffects.filter((g) => g.type === 'MINE');
      if (mines.length > 0) {
        let minesRemoved = false;
        for (const mine of mines) {
          for (let ei = 0; ei < updatedEnemies.length; ei++) {
            const e = updatedEnemies[ei];
            if (e.dead || e.currentHp <= 0) continue;
            const dist = Math.abs(e.pos.x - mine.pos.x) + Math.abs(e.pos.y - mine.pos.y);
            if (dist <= 1) {
              // Detonate!
              useCombatGridStore.setState({ isShaking: true });
              setTimeout(() => useCombatGridStore.setState({ isShaking: false }), 500);
              playCombatSound('land-mineew', 0.4);
              useCombatGridStore.getState().addPopup(mine.pos.x, mine.pos.y, '💥 МИНА!', 'ERROR');
              useCombatGridStore.getState().addBattleLog(`💥 Мина взорвалась!`);
              for (let ej = 0; ej < updatedEnemies.length; ej++) {
                const enemy = updatedEnemies[ej];
                if (enemy.dead) continue;
                const eDist = Math.abs(enemy.pos.x - mine.pos.x) + Math.abs(enemy.pos.y - mine.pos.y);
                if (eDist <= 1) {
                  const dmg = Math.round(mine.damage * (1 - eDist * 0.15));
                  updatedEnemies[ej] = { ...enemy, currentHp: Math.max(0, enemy.currentHp - dmg), isHit: true };
                  useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, `💥 -${dmg}`, 'DMG');
                  if (updatedEnemies[ej].currentHp <= 0) {
                    updatedEnemies[ej].dead = true;
                    updatedEnemies[ej].isHit = false;
                    useCombatGridStore.getState().addBattleLog(`💀 ${enemy.name} уничтожен миной!`);
                  }
                }
              }
              minesRemoved = true;
              break;
            }
          }
          if (minesRemoved) break;
        }
        if (minesRemoved) {
          const remainingEffects = curMineState.globalEffects.filter((g) => g.type !== 'MINE');
          useCombatGridStore.setState({ globalEffects: remainingEffects, enemies: [...updatedEnemies] });
          await new Promise((r) => setTimeout(r, 500));
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
        ap: finalState.maxAp || BASE_AP,
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
