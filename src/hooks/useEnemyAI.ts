import { useEffect, useRef } from 'react';
import { useCombatGridStore, checkVisibility, findPathForEnemy, getDist, getAngle, calculateCombatResult, executeSkill, absorbWithShield, isBossEnemy, type GlobalEffect } from '../stores/combatGridStore';
import { applyTerrainToTarget, getTerrainBonus } from '../engine/terrain';
import { isCellWalkable } from '../engine/terrain';
import { usePlayerStore } from '../stores/playerStore';
import { BASE_AP } from '../stores/combatGridStore';
import { playCombatSound } from './useSound';
import { calcExtraShots } from '../utils/itemPower';
import { CAMP_CHATTER, SENTRY_RADIO, PATROL_CHATTER, MILITARY_COMBAT_BARK, BOSS_COMBAT_BARK, SPOT_BARK, SENTRY_NOTICED, WAKE_BARK, pickPhrase } from '../data/enemyChatter';

const isMilitary = (e: any): boolean =>
  (e.faction || '').toLowerCase().includes('воен') || (e.factionKey || '').toLowerCase().includes('воен');

/** Очки укрытия клетки: сумма бонусов брони+блока+уворота. */
const coverScore = (x: number, y: number, obstacles: any[]): number => {
  const b = getTerrainBonus({ x, y }, obstacles);
  return (b.armor || 0) + (b.block || 0) + (b.evasion || 0);
};

/**
 * Лучшая клетка для стрельбы: в радиусе R от врага, с прострелом и
 * дальностью до цели, с максимальным укрытием. Возвращает null если
 * текущая клетка уже не хуже.
 */
const findCoverCell = (
  from: { x: number; y: number },
  target: { x: number; y: number },
  range: number,
  obstacles: any[],
  enemies: any[],
  selfId: number | string,
): { x: number; y: number } | null => {
  const R = 6;
  const cur = coverScore(from.x, from.y, obstacles);
  let best: { x: number; y: number } | null = null;
  let bestScore = cur;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = from.x + dx;
      const ny = from.y + dy;
      if (nx < 0 || ny < 0 || nx >= 32 || ny >= 32) continue;
      if (!isCellWalkable(nx, ny, obstacles)) continue;
      if (enemies.some((o: any) => o.id !== selfId && !o.dead && o.currentHp > 0 && o.pos.x === nx && o.pos.y === ny)) continue;
      if (getDist({ x: nx, y: ny }, target) > range) continue;
      if (!checkVisibility({ x: nx, y: ny }, 0, target, obstacles, { range: 40, fov: 360 })) continue;
      const s = coverScore(nx, ny, obstacles);
      if (s > bestScore + 0.001) { bestScore = s; best = { x: nx, y: ny }; }
    }
  }
  return best;
};

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
        // Тик естественного сна: уснул на N ходов — просыпается сам.
        let nextSleeping = e.sleeping;
        let nextSleepTurns = e.sleepTurns;
        if (e.sleeping && typeof e.sleepTurns === 'number') {
          nextSleepTurns = e.sleepTurns - 1;
          if (nextSleepTurns <= 0) { nextSleeping = false; nextSleepTurns = undefined; }
        }
        return {
          ...e,
          sleeping: nextSleeping,
          sleepTurns: nextSleepTurns,
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

      // saySync: облачко в стор + синк в локальную копию, чтобы поздний
      // setState этого же хода не затёр реплику stale-копией.
      const saySync = (id: number | string, text: string, ms?: number) => {
        useCombatGridStore.getState().say(id, text, ms);
        const u = updatedEnemies.find((x: any) => x.id === id);
        if (u) u.speech = text;
      };
      // Болтовня слышна в пределах 15 клеток от игрока.
      const canChatter = (pos: { x: number; y: number }) =>
        getDist(pos, useCombatGridStore.getState().playerPos) <= 15;

      const playerStats = usePlayerStore.getState().stats;
      const isPlayerInvisible = useCombatGridStore.getState().playerInvisible;

      // Подкрепление на 40 ходу: отложенные враги с угла карты.
      {
        const st0 = useCombatGridStore.getState();
        if (!st0.reinforceSpawned && st0.pendingReinforce.length > 0 && st0.turnCount >= 39) {
          st0.spawnReinforcements();
          await new Promise((r) => setTimeout(r, 800));
          const fresh = useCombatGridStore.getState().enemies;
          for (const ne of fresh) {
            if (!updatedEnemies.some((u: any) => u.id === (ne as any).id)) updatedEnemies.push({ ...(ne as any) });
          }
          useCombatGridStore.setState({ enemies: [...updatedEnemies] });
        }
      }

      for (let i = 0; i < updatedEnemies.length; i++) {
        const curStore = useCombatGridStore.getState();
        const enemy = updatedEnemies[i];
        if (enemy.currentHp <= 0) continue;

        // Skip stunned enemies
        if (enemy.stunned) {
          useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, '⚡ ОГЛУШЕН!', 'SPECIAL');
          continue;
        }

        // --- Camp life: спящие просыпаются, если игрок подошёл близко
        // или союзники по фракции рядом уже в бою.
        // Спящие скрытного НЕ слышат вовсе: будят только бой рядом и урон ---
        if (enemy.sleeping) {
          const stealthOn = useCombatGridStore.getState().stealth;
          const wakeR = stealthOn ? 0 : 16;
          const matesFight = updatedEnemies.some((o: any) =>
            o.id !== enemy.id && !o.dead && o.currentHp > 0 && o.faction === enemy.faction
            && o.aggro && getDist(o.pos, enemy.pos) <= 15);
          if ((!isPlayerInvisible && getDist(enemy.pos, curStore.playerPos) <= wakeR) || matesFight) {
            enemy.sleeping = false;
            enemy.aggro = true;
            enemy.knowsPlayer = true;
            updatedEnemies[i] = { ...enemy };
            const stw = useCombatGridStore.getState();
            saySync(enemy.id, pickPhrase(WAKE_BARK));
            if (stw.stealth) {
              useCombatGridStore.setState({ enemies: [...updatedEnemies], stealth: false });
              useCombatGridStore.getState().addMessage('👁️ Тебя заметили! Скрытность сорвана');
            } else {
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            }
            await new Promise((r) => setTimeout(r, 400));
          }
          continue;
        }

        // --- Camp life: обнаружение игрока или бой фракции рядом — агро.
        // --- Увидел труп рядом (3 клетки), даже случайно проходя мимо: паника ---
        // (спящие выше уже continue — они трупов не видят).
        if (!useCombatGridStore.getState().alarmRaised && enemy.faction !== 'Союзник') {
          const corpseNear = updatedEnemies.some((o: any) => o.dead
            && Math.max(Math.abs(o.pos.x - enemy.pos.x), Math.abs(o.pos.y - enemy.pos.y)) <= 3);
          if (corpseNear) {
            useCombatGridStore.getState().raiseCorpseAlarm(enemy.id);
            updatedEnemies = useCombatGridStore.getState().enemies.map((x: any) => ({ ...x }));
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        // Вне скрытности радиус обнаружения x2 (24).
        // Скрытного замечают: обычные — в 3 клетках, часовые — в 6 (с «❗») ---
        if (!enemy.aggro && enemy.aiRole) {
          const stealthOn = useCombatGridStore.getState().stealth;
          // Босс видит дальше всех: 24 без скрытности, 12 в скрытности.
          const eIsBoss = isBossEnemy(enemy.name, (enemy as any).factionKey);
          const detectR = eIsBoss
            ? (stealthOn ? 12 : 24)
            : stealthOn
              ? (enemy.aiRole === 'sentry' ? 10 : 3)
              : (enemy.aiRole === 'sentry' ? 15 : 24);
          const spotted = !isPlayerInvisible && getDist(enemy.pos, curStore.playerPos) <= detectR;
          const matesFight = !spotted && updatedEnemies.some((o: any) =>
            o.id !== enemy.id && !o.dead && o.currentHp > 0 && o.faction === enemy.faction
            && o.aggro && getDist(o.pos, enemy.pos) <= 15);
          if (spotted || matesFight) {
            enemy.aggro = true;
            enemy.knowsPlayer = true;
            updatedEnemies[i] = { ...enemy };
            // Часовой заметил: тревога слышна всем часовым — тоже идут в бой.
            if (spotted && enemy.aiRole === 'sentry') {
              for (const o of updatedEnemies) {
                if ((o as any).aiRole === 'sentry' && !o.dead && o.currentHp > 0) {
                  (o as any).aggro = true;
                  (o as any).knowsPlayer = true;
                }
              }
            }
            if (stealthOn && spotted) {
              // Заметили скрытного: часовой — особым диалогом «заметил»,
              // скрытность сорвана.
              saySync(enemy.id, enemy.aiRole === 'sentry' ? pickPhrase(SENTRY_NOTICED) : pickPhrase(SPOT_BARK));
              useCombatGridStore.setState({ enemies: [...updatedEnemies], stealth: false });
              useCombatGridStore.getState().addMessage('👁️ Тебя заметили! Скрытность сорвана');
            } else {
              if (isMilitary(enemy)) saySync(enemy.id, pickPhrase(spotted ? SPOT_BARK : WAKE_BARK));
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            }
          }
        }

        // --- Camp life: жизнь вне боя по ролям ---
        if (!enemy.aggro && enemy.aiRole) {
          // Шаг патруля: в общем направлении, при стене — новое. chatter — болтовня на ходу.
          const doPatrolStep = (withChatter: boolean) => {
            const pDirs = [
              { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
              { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
            ];
            let dir = enemy.patrolDir || pDirs[0];
            const tryStep = (d: { dx: number; dy: number }) => {
              const nx = enemy.pos.x + d.dx;
              const ny = enemy.pos.y + d.dy;
              if (nx < 0 || ny < 0 || nx >= 32 || ny >= 32) return null;
              if (!isCellWalkable(nx, ny, curStore.obstacles)) return null;
              if (nx === curStore.playerPos.x && ny === curStore.playerPos.y) return null;
              if (updatedEnemies.some((o: any) => o.id !== enemy.id && !o.dead && o.currentHp > 0 && o.pos.x === nx && o.pos.y === ny)) return null;
              return { x: nx, y: ny };
            };
            let step = tryStep(dir);
            if (!step) {
              dir = pDirs[Math.floor(Math.random() * pDirs.length)];
              step = tryStep(dir);
            }
            if (step) {
              enemy.pos = { ...step };
              enemy.patrolDir = { ...dir };
              enemy.rotation = getAngle({ x: step.x - dir.dx, y: step.y - dir.dy }, step);
              updatedEnemies[i] = { ...enemy };
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            } else {
              enemy.patrolDir = pDirs[Math.floor(Math.random() * pDirs.length)];
              updatedEnemies[i] = { ...enemy };
            }
            if (withChatter && Math.random() < 0.15 && canChatter(enemy.pos)) saySync(enemy.id, pickPhrase(PATROL_CHATTER));
          };
          // Труп лежит, тревоги ещё нет: бодрствующий вне боя — 10% в ход пойти проверить («!!!»).
          {
            const cs0 = useCombatGridStore.getState();
            if (cs0.corpseSearch && !cs0.alarmRaised && !enemy.searching && Math.random() < 0.10) {
              enemy.searching = true;
              updatedEnemies[i] = { ...enemy };
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            }
          }
          // --- Режим «!!!»: идёт к трупу, заметил (3 клетки) — общая тревога ---
          if (enemy.searching) {
            const css = useCombatGridStore.getState();
            const target = css.corpseSearch;
            if (!target || css.alarmRaised) {
              enemy.searching = false;
              updatedEnemies[i] = { ...enemy };
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            } else if (Math.max(Math.abs(enemy.pos.x - target.x), Math.abs(enemy.pos.y - target.y)) <= 3) {
              enemy.searching = false;
              updatedEnemies[i] = { ...enemy };
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
              css.raiseCorpseAlarm(enemy.id);
              // Тревога перемаппила врагов — синкаем локальную копию.
              updatedEnemies = useCombatGridStore.getState().enemies.map((x: any) => ({ ...x }));
              await new Promise((r) => setTimeout(r, 500));
            } else {
              // Идёт со своей максимальной скоростью (runAp клеток/ход).
              const maxSteps = enemy.runAp || 4;
              for (let stp = 0; stp < maxSteps; stp++) {
                if (Math.max(Math.abs(enemy.pos.x - target.x), Math.abs(enemy.pos.y - target.y)) <= 3) break;
                const cpath = findPathForEnemy(enemy.pos, target, curStore.obstacles, updatedEnemies, enemy.id);
                if (!cpath || cpath.length <= 1) break;
                const ns = cpath[1];
                const srot = getAngle(enemy.pos, ns);
                enemy.pos = { ...ns };
                enemy.rotation = srot;
                updatedEnemies[i] = { ...enemy };
                useCombatGridStore.setState({ enemies: [...updatedEnemies] });
                await new Promise((r) => setTimeout(r, 120));
              }
              // Дошёл и заметил — тревога, иначе в следующем ходу продолжит.
              if (Math.max(Math.abs(enemy.pos.x - target.x), Math.abs(enemy.pos.y - target.y)) <= 3) {
                enemy.searching = false;
                updatedEnemies[i] = { ...enemy };
                useCombatGridStore.setState({ enemies: [...updatedEnemies] });
                useCombatGridStore.getState().raiseCorpseAlarm(enemy.id);
                updatedEnemies = useCombatGridStore.getState().enemies.map((x: any) => ({ ...x }));
                await new Promise((r) => setTimeout(r, 500));
              } else {
                updatedEnemies[i] = { ...enemy };
                useCombatGridStore.setState({ enemies: [...updatedEnemies] });
                await new Promise((r) => setTimeout(r, 200));
              }
            }
            continue;
          }
          // Вне боя: 5% в ход уснуть на 3 хода (после тревоги сон запрещён).
          // Подкрепление не спит — патрулирует. Боссы не спят никогда.
          if (!enemy.sleeping && enemy.aiRole !== 'reinforce' && !isBossEnemy(enemy.name, (enemy as any).factionKey) && !useCombatGridStore.getState().noSleep && Math.random() < 0.05) {
            enemy.sleeping = true;
            enemy.sleepTurns = 3;
            enemy.speech = null;
            updatedEnemies[i] = { ...enemy };
            useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            useCombatGridStore.getState().addBattleLog(`😴 ${enemy.name} задремал`);
            await new Promise((r) => setTimeout(r, 150));
            continue;
          }
          if (enemy.aiRole === 'camp') {
            // Стоят у костра, иногда болтают.
            if (Math.random() < 0.2 && canChatter(enemy.pos)) saySync(enemy.id, pickPhrase(CAMP_CHATTER));
          } else if (enemy.aiRole === 'sentry') {
            // Часовой: вертится (новый поворот), докладывает по рации.
            const rot = Math.floor(Math.random() * 360);
            updatedEnemies[i] = { ...enemy, rotation: rot };
            useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            if (Math.random() < 0.1 && canChatter(enemy.pos)) saySync(enemy.id, pickPhrase(SENTRY_RADIO));
            // Видит цель в дальности — открывает огонь, но с места не сходит.
            // Скрытного часовой замечает только в 10 клетках.
            const sDist = getDist(enemy.pos, curStore.playerPos);
            const sRange = enemy.rangeDistance || 7;
            const sInRange = sDist <= (useCombatGridStore.getState().stealth ? Math.min(sRange, 10) : sRange);
            const sCanSee = !isPlayerInvisible && checkVisibility(enemy.pos, 0, curStore.playerPos, curStore.obstacles, { range: 40, fov: 360 });
            if (sCanSee && sInRange && !isPlayerInvisible) {
              enemy.aggro = true;
              enemy.knowsPlayer = true;
              updatedEnemies[i] = { ...enemy };
              useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            }
          } else if (enemy.aiRole === 'patrol') {
            // Патруль: шаг в общем направлении + болтовня.
            doPatrolStep(true);
          } else if (enemy.aiRole === 'reinforce') {
            // Подкрепление: патрулирует вместе (общее направление), молча, не спит.
            doPatrolStep(false);
          }
          await new Promise((r) => setTimeout(r, 150));
          // Агронуло по ходу роли (часовой увидел) — дальше обычный бой.
          if (updatedEnemies[i]?.aggro) {
            enemy.aggro = true;
          } else {
            continue;
          }
        }

        let enemyAp = enemy.runAp || 5;

        const isBoss = isBossEnemy(enemy.name, (enemy as any).factionKey);
        const hpFrac = enemy.currentHp / Math.max(1, enemy.maxHp);

        // --- Раненый (HP<25%, не босс, не сдающийся): к медику, иначе к костру ---
        if (!isBoss && !enemy.surrendering) {
          if (!enemy.retreating && enemy.currentHp > 0 && hpFrac < 0.25) {
            enemy.retreating = true;
            updatedEnemies[i] = { ...enemy };
          }
          if (enemy.retreating) {
            if (hpFrac >= 0.5) {
              // Подлечился — снова в бой.
              enemy.retreating = false;
              updatedEnemies[i] = { ...enemy };
            } else {
              const st = useCombatGridStore.getState();
              const medic = updatedEnemies.find((o: any) => o.id !== enemy.id && !o.dead && o.currentHp > 0
                && /medic|медик/i.test(`${o.name} ${o.factionKey || ''}`) && o.faction === enemy.faction);
              const dest = medic ? { ...medic.pos } : st.campfire ? { ...st.campfire } : null;
              if (!dest) {
                enemy.retreating = false;
                updatedEnemies[i] = { ...enemy };
              } else if (Math.max(Math.abs(enemy.pos.x - dest.x), Math.abs(enemy.pos.y - dest.y)) <= 2) {
                // На месте: у костра +25% HP в ход (медик лечит сам), стоим.
                if (!medic && st.campfire) {
                  const heal = Math.round(enemy.maxHp * 0.25);
                  enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + heal);
                  updatedEnemies[i] = { ...enemy };
                  useCombatGridStore.setState({ enemies: [...updatedEnemies] });
                  useCombatGridStore.getState().addPopup(enemy.pos.x, enemy.pos.y, `+${heal} HP 🔥`, 'HEAL');
                }
                await new Promise((r) => setTimeout(r, 150));
                continue;
              } else {
                // Бежит лечиться (3 клетки/ход), не стреляет.
                for (let stp = 0; stp < 3; stp++) {
                  const rpath = findPathForEnemy(enemy.pos, dest, curStore.obstacles, updatedEnemies, enemy.id);
                  if (!rpath || rpath.length <= 1) break;
                  const ns = rpath[1];
                  const rrot = getAngle(enemy.pos, ns);
                  enemy.pos = { ...ns };
                  enemy.rotation = rrot;
                }
                updatedEnemies[i] = { ...enemy };
                useCombatGridStore.setState({ enemies: [...updatedEnemies] });
                await new Promise((r) => setTimeout(r, 200));
                continue;
              }
            }
          }
        }

        // --- Сдача в плен: последний живой противник при HP<25% (не босс) ---
        if (!isBoss && !enemy.surrenderOffered && !enemy.surrendering && enemy.currentHp > 0) {
          const alive = updatedEnemies.filter((o: any) => !o.dead && o.currentHp > 0 && o.faction !== 'Союзник');
          if (alive.length === 1 && alive[0].id === enemy.id && hpFrac < 0.25) {
            enemy.surrendering = true;
            updatedEnemies[i] = { ...enemy };
            useCombatGridStore.setState({ enemies: [...updatedEnemies] });
            useCombatGridStore.getState().addBattleLog(`🏳️ ${enemy.name} хочет сдаться!`);
          }
        }
        // Сдающийся не действует, ждёт решения игрока.
        if (enemy.surrendering) {
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }

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

          // --- Дальник-искатель: стоим открыто, а рядом есть укрытие с прострелом
          // и хватает AP на шаг+выстрел — сначала шаг к укрытию, потом огонь ---
          if (enemy.coverSeeker && !isAlly && !isMedic && canSee && inRange) {
            const crange = enemy.rangeDistance || 7;
            const cshot = enemy.shotPrice || 1;
            if (coverScore(enemy.pos.x, enemy.pos.y, currentStore.obstacles) < 0.05 && enemyAp >= 1 + cshot) {
              const best = findCoverCell(enemy.pos, targetPos, crange, currentStore.obstacles, updatedEnemies, enemy.id);
              if (best) {
                const cpath = findPathForEnemy(enemy.pos, best, currentStore.obstacles, updatedEnemies, enemy.id);
                if (cpath && cpath.length > 1) {
                  const ns = cpath[1];
                  const cmoveAngle = getAngle(enemy.pos, ns);
                  enemy.pos = { ...ns };
                  updatedEnemies[i] = { ...enemy, rotation: cmoveAngle };
                  useCombatGridStore.setState({ enemies: [...updatedEnemies] });
                  enemyAp -= 1;
                  await new Promise((r) => setTimeout(r, 200));
                  continue;
                }
              }
            }
          }

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
            // Крики при стрельбе: у босса свои, у военных — свои.
            if (isBossEnemy(enemy.name, (enemy as any).factionKey) && Math.random() < 0.4) {
              saySync(enemy.id, pickPhrase(BOSS_COMBAT_BARK));
            } else if (isMilitary(enemy) && Math.random() < 0.15) {
              saySync(enemy.id, pickPhrase(MILITARY_COMBAT_BARK));
            }
            // Открыл огонь по игроку — все в радиусе 9 от стрелка бегут в бой.
            if (targetPos.x === currentStore.playerPos.x && targetPos.y === currentStore.playerPos.y) {
              useCombatGridStore.getState().aggroWave(enemy.pos);
            }
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
              applyTerrainToTarget(
                { armor: playerStats.armor, evasion: playerStats.evasion, block: playerStats.block, incomingDamageMult: playerStats.incomingDamageMult },
                targetPos,
                currentStore.obstacles,
              ),
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
                applyTerrainToTarget(
                  { armor: tgtArmor, evasion: tgtEvasion, block: tgtBlock, incomingDamageMult: tgtIncoming },
                  targetPos,
                  useCombatGridStore.getState().obstacles,
                ),
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
            // Часовые держат пост только вне боя; в бою идут в атаку как все.
            // Дальник-искатель: шаг к лучшему укрытию с прострелом по цели.
            if (enemy.coverSeeker && !isAlly && !isMedic) {
              const mrange = enemy.rangeDistance || 7;
              const best = findCoverCell(enemy.pos, targetPos, mrange, curStore2.obstacles, updatedEnemies, enemy.id);
              if (best && (best.x !== enemy.pos.x || best.y !== enemy.pos.y)) {
                const cpath = findPathForEnemy(enemy.pos, best, curStore2.obstacles, updatedEnemies, enemy.id);
                if (cpath && cpath.length > 1) {
                  const ns = cpath[1];
                  const mmoveAngle = getAngle(enemy.pos, ns);
                  enemy.pos = { ...ns };
                  updatedEnemies[i] = { ...enemy, rotation: mmoveAngle };
                  useCombatGridStore.setState({ enemies: [...updatedEnemies] });
                  enemyAp -= 1;
                  await new Promise((r) => setTimeout(r, 200));
                  continue;
                }
              }
            }
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
                  updatedEnemies[ej] = { ...enemy, currentHp: Math.max(0, enemy.currentHp - dmg), isHit: true, sleeping: false, aggro: true, knowsPlayer: true };
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
        // Одна битая итерация ИИ не должна вешать бой на «Ходе врага» навсегда.
        try {
          const fs = useCombatGridStore.getState();
          useCombatGridStore.setState({
            turn: 'player',
            ap: fs.maxAp || BASE_AP,
            message: '⚠️ Сбой хода врага — ход возвращён тебе',
          });
        } catch { /* ignore */ }
      }
      isProcessing.current = false;
    };

    runAI();
  }, [turn, isActive]);
};
