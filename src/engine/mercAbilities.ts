import { useCombatGridStore, getDist } from '../stores/combatGridStore';
import { usePlayerStore } from '../stores/playerStore';
import { playCombatSound } from '../hooks/useSound';

/** Наёмники: пассивки/активки, редирект урона, сон вместо смерти, HEALZONE. */

export const hasMercStar = (merc: any, n: number): boolean =>
  !!merc?.isMerc && (merc.mercStars || 0) >= n;

/** Живой танк-союзник с «Живым щитом» (1★). */
export const livingTankMerc = (list: any[]): any | null =>
  list.find((e: any) =>
    e?.isMerc && e.mercRole === 'tank' && !e.dead && !e.sleeping &&
    (e.currentHp || 0) > 0 && hasMercStar(e, 1),
  ) || null;

/**
 * Редирект 30% урона по команде в танка.
 * Возвращает урон цели + список ударов по танкам (обычно 1).
 */
export const splitTankRedirect = (
  target: any, dmg: number, list: any[],
): { dmg: number; hits: { tank: any; dmg: number }[] } => {
  if (!target || dmg <= 0) return { dmg, hits: [] };
  // Сам танк себе не перенаправляет.
  if (target?.isMerc && target.mercRole === 'tank') return { dmg, hits: [] };
  const tank = livingTankMerc(list);
  if (!tank || tank.id === target?.id) return { dmg, hits: [] };
  const share = Math.round(dmg * 0.3);
  if (share <= 0) return { dmg, hits: [] };
  return { dmg: dmg - share, hits: [{ tank, dmg: share }] };
};

/** Удар по танку от редиректа: попап, лог, сон при 0 HP. */
export const hitRedirectTank = (tank: any, dmg: number, fromName: string): void => {
  const cs = useCombatGridStore.getState();
  tank.currentHp = Math.max(0, (tank.currentHp || 0) - dmg);
  tank.isHit = true;
  cs.addPopup(tank.pos.x, tank.pos.y, `🛡️ −${dmg}`, 'BLOCK');
  cs.addBattleLog(`🛡️ ${tank.name} принял ${dmg} урона (${fromName})`);
  setTimeout(() => { tank.isHit = false; }, 300);
  if (tank.currentHp <= 0) {
    tank.sleeping = true;
    tank.isHit = false;
    cs.addPopup(tank.pos.x, tank.pos.y, '😴 Танк без сознания!', 'SPECIAL');
    cs.addBattleLog(`😴 ${tank.name} без сознания (доспит до конца боя)`);
  }
};

/** Временный бафф на юнита: прямая смена стата + запись для отката. */
export const applyMercBuff = (
  target: any, stat: string, mult: number, turns: number, label: string,
): void => {
  if (!target || turns <= 0) return;
  const base = (target as any)[stat];
  if (typeof base !== 'number') return;
  (target as any)[stat] = base * mult;
  (target as any).mercBuffs = [
    ...((target as any).mercBuffs || []),
    { stat, base, remaining: turns },
  ];
  const cs = useCombatGridStore.getState();
  cs.addPopup(target.pos.x, target.pos.y, label, 'BUFF');
};

/** Тик баффов (вызывать в глобальном тике ИИ): откат истёкших. */
export const tickMercBuffs = (e: any): void => {
  const buffs = (e as any)?.mercBuffs;
  if (!Array.isArray(buffs) || buffs.length === 0) return;
  const left: any[] = [];
  let dmgTouched = false;
  for (const b of buffs) {
    b.remaining -= 1;
    if (b.remaining <= 0) {
      (e as any)[b.stat] = b.base;
      if (b.stat === 'damage' || b.stat === 'speed') dmgTouched = true;
    } else left.push(b);
  }
  (e as any).mercBuffs = left;
  // dps кешируется — пересчитать после отката урона/скорости.
  if (dmgTouched && typeof (e as any).dps === 'number') {
    (e as any).dps = (e.damage || 0) * (1 + ((e as any).speed || 0));
  }
};

const commit = (list: any[]) =>
  useCombatGridStore.setState({ enemies: [...list] });

/** Аура на игрока через его систему эффектов (обновление без дублей и логов). */
const refreshPlayerAura = (id: string, name: string, mult: Record<string, number>): void => {
  const ps = usePlayerStore.getState();
  const ex = (ps.activeEffects || []).find((e: any) => e.id === id);
  if (ex) {
    usePlayerStore.setState((st: any) => ({
      activeEffects: (st.activeEffects || []).map((e: any) =>
        e.id === id ? { ...e, remaining: 2, duration: 2 } : e),
    }));
  } else {
    ps.addEffect({ id, name, duration: 2, remaining: 2, statBoosts: {}, statBoostsMult: mult });
  }
  const cs = useCombatGridStore.getState();
  cs.addPopup(cs.playerPos.x, cs.playerPos.y, `✨ ${name}!`, 'BUFF');
};

const setCd = (merc: any, id: string, cd: number) => {
  if (!merc.cooldowns) merc.cooldowns = {};
  merc.cooldowns[id] = cd;
};

const ready = (merc: any, id: string): boolean =>
  !merc.cooldowns || (merc.cooldowns[id] || 0) <= 0;

const alliesOf = (list: any[], merc: any): any[] =>
  list.filter((e: any) => e.faction === merc.faction && !e.dead && (e.currentHp || 0) > 0 && !e.sleeping);

const hostilesOf = (list: any[], merc: any): any[] =>
  list.filter((e: any) => e.faction !== merc.faction && !(e as any).isNeutral && !e.dead && (e.currentHp || 0) > 0);

const healUnit = (target: any, amount: number, srcName: string): void => {
  const cs = useCombatGridStore.getState();
  target.currentHp = Math.min(target.maxHp, (target.currentHp || 0) + amount);
  cs.addPopup(target.pos.x, target.pos.y, `+${Math.round(amount)} 💗`, 'HEAL');
  cs.addBattleLog(`💗 ${srcName} → ${target.name}: +${Math.round(amount)} HP`);
};

/**
 * Ход способностей наёмника (вызывать до обычной атаки).
 * Пассивки каждый ход + максимум 1 активная за ход.
 */
export const mercAbilityTurn = async (merc: any, list: any[]): Promise<void> => {
  const cs = useCombatGridStore.getState();
  const role = merc.mercRole as string;
  const build = merc.mercBuild as string;
  const hpFrac = (merc.currentHp || 0) / Math.max(1, merc.maxHp || 1);
  const allies = alliesOf(list, merc);
  const hostiles = hostilesOf(list, merc);
  const wounded80 = allies
    .filter((a) => a.currentHp < a.maxHp * 0.8)
    .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  const wounded90 = allies
    .filter((a) => a.currentHp < a.maxHp * 0.9)
    .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  const downed = list
    .filter((e: any) => e.faction === merc.faction && !e.isNeutral &&
      (e.dead || ((e.sleeping || (e.currentHp || 0) <= 0) && (e.isMerc || e.isPet))));

  // --- Пассивки каждый ход ---
  if ((build === 'juggernaut') && hasMercStar(merc, 4)) {
    const amt = Math.round(merc.maxHp * 0.05);
    if ((merc.currentHp || 0) > 0 && merc.currentHp < merc.maxHp) {
      merc.currentHp = Math.min(merc.maxHp, merc.currentHp + amt);
      cs.addPopup(merc.pos.x, merc.pos.y, `+${amt} 💗`, 'HEAL');
    }
  }
  if ((build === 'fortress') && hasMercStar(merc, 4)) {
    merc.armor = Number((((merc.armor || 0) * 1.025)).toFixed(2));
  }

  const pause = () => new Promise((r) => setTimeout(r, 350));

  // --- ТАНКИ ---
  if (role === 'tank') {
    // Сейв при HP<30%.
    if (hpFrac < 0.3) {
      if (build === 'juggernaut' && hasMercStar(merc, 5) && ready(merc, 'jug_last')) {
        const baseLast = (merc as any).incomingDamageMult ?? 1;
        (merc as any).incomingDamageMult = 0.2;
        merc.mercBuffs = [...(merc.mercBuffs || []), { stat: 'incomingDamageMult', base: baseLast, remaining: 1 }];
        setCd(merc, 'jug_last', 10);
        cs.addPopup(merc.pos.x, merc.pos.y, '💢 −80%!', 'BUFF');
        playCombatSound('block', 0.4);
        cs.addBattleLog(`💢 ${merc.name}: Последний рубеж! −80% урона`);
        commit(list);
        await pause();
        return;
      }
      if (build === 'fortress' && hasMercStar(merc, 5) && ready(merc, 'frt_ghost')) {
        const base = merc.evasion;
        merc.evasion = 1.0;
        merc.mercBuffs = [...(merc.mercBuffs || []), { stat: 'evasion', base, remaining: 1 }];
        setCd(merc, 'frt_ghost', 10);
        playCombatSound('invis', 0.4);
        cs.addPopup(merc.pos.x, merc.pos.y, '👤 НЕВИДИМ!', 'BUFF');
        cs.addBattleLog(`👤 ${merc.name}: Призрак! Уклонение 100%`);
        commit(list);
        await pause();
        return;
      }
    }
    // Рабочие баффы.
    if (hostiles.length > 0) {
      if (build === 'juggernaut' && hasMercStar(merc, 2) && ready(merc, 'jug_wall')) {
        const baseWall = (merc as any).incomingDamageMult ?? 1;
        (merc as any).incomingDamageMult = 0.5;
        merc.mercBuffs = [...(merc.mercBuffs || []), { stat: 'incomingDamageMult', base: baseWall, remaining: 2 }];
        setCd(merc, 'jug_wall', 8);
        playCombatSound('invis', 0.4);
        cs.addPopup(merc.pos.x, merc.pos.y, '🛡️ СТЕНА!', 'BUFF');
        cs.addBattleLog(`🛡️ ${merc.name}: Стена! −50% входящего (2 хода)`);
        commit(list);
        await pause();
        return;
      }
      if (build === 'fortress' && hasMercStar(merc, 2) && ready(merc, 'frt_dodge')) {
        const base = merc.evasion;
        merc.evasion = Math.min(1, base + 0.3);
        merc.mercBuffs = [...(merc.mercBuffs || []), { stat: 'evasion', base, remaining: 3 }];
        setCd(merc, 'frt_dodge', 8);
        playCombatSound('evasion', 0.4);
        cs.addPopup(merc.pos.x, merc.pos.y, '🌀 +30% УКЛ!', 'BUFF');
        cs.addBattleLog(`🌀 ${merc.name}: Дым! +30% уклонения (3 хода)`);
        commit(list);
        await pause();
        return;
      }
    }
    return;
  }

  // --- МЕДИКИ ---
  if (role === 'medic') {
    // Воскрешение.
    const rezId = build === 'elena' ? 'eln_rez' : 'brs_rez';
    if (hasMercStar(merc, 5) && ready(merc, rezId) && downed.length > 0) {
      const tgt = downed.sort((a, b) =>
        getDist(merc.pos, a.pos) - getDist(merc.pos, b.pos))[0];
      if (getDist(merc.pos, tgt.pos) <= 14) {
        tgt.dead = false;
        tgt.sleeping = false;
        (tgt as any).sleepTurns = undefined;
        tgt.currentHp = Math.round(tgt.maxHp * 0.25);
        tgt.looted = true;
        setCd(merc, rezId, 999);
        playCombatSound('Aeon_Disk', 0.5);
        cs.addPopup(tgt.pos.x, tgt.pos.y, '✦ ВОСКРЕШЁН!', 'HEAL');
        cs.addBattleLog(`✦ ${merc.name} воскресил ${tgt.name} (25% HP)`);
        commit(list);
        await pause();
        return;
      }
    }
    // Зона/волна.
    if (wounded80.length > 0) {
      const tgt = wounded80[0];
      const d = getDist(merc.pos, tgt.pos);
      if (build === 'elena' && hasMercStar(merc, 2) && ready(merc, 'eln_zone') && d <= 14) {
        useCombatGridStore.setState((s: any) => ({
          globalEffects: [...s.globalEffects, {
            type: 'HEALZONE' as const, pos: { ...tgt.pos },
            damage: 0, timer: 3, ownerId: merc.id,
            healPct: 0.1, radius: 2, shape: 'square', ownerFaction: merc.faction,
          }],
        }));
        setCd(merc, 'eln_zone', 10);
        playCombatSound('grenadegun', 0.4);
        cs.addPopup(tgt.pos.x, tgt.pos.y, '💚 ПОЛЕ ЖИЗНИ', 'HEAL');
        cs.addBattleLog(`💚 ${merc.name}: Поле жизни 5×5 у ${tgt.name} (10%/ход, 3 хода)`);
        commit(list);
        await pause();
        return;
      }
      if (build === 'boris' && hasMercStar(merc, 2) && ready(merc, 'brs_wave') && d <= 14) {
        useCombatGridStore.setState((s: any) => ({
          globalEffects: [...s.globalEffects, {
            type: 'HEALZONE' as const, pos: { ...tgt.pos },
            damage: 0, timer: 3, ownerId: merc.id,
            healPct: 0.1, radius: 5, shape: 'circle', ownerFaction: merc.faction,
          }],
        }));
        setCd(merc, 'brs_wave', 10);
        playCombatSound('healer', 0.4);
        cs.addPopup(tgt.pos.x, tgt.pos.y, '💚 ВОЛНА ЖИЗНИ', 'HEAL');
        cs.addBattleLog(`💚 ${merc.name}: Волна жизни вокруг ${tgt.name} (R5, 10%/ход, 3 хода)`);
        commit(list);
        await pause();
        return;
      }
      // Граната/бинт.
      if (build === 'elena' && hasMercStar(merc, 3) && ready(merc, 'eln_grenade') && d <= 14) {
        healUnit(tgt, tgt.maxHp * 0.25, merc.name);
        setCd(merc, 'eln_grenade', 10);
        playCombatSound('grenadeBoom', 0.3);
        playCombatSound('healer', 0.4);
        commit(list);
        await pause();
        return;
      }
      if (build === 'boris' && hasMercStar(merc, 3) && ready(merc, 'brs_bandage') && d <= 14) {
        const base = tgt.regen || 0;
        const add = tgt.maxHp * 0.05;
        tgt.regen = base + add;
        tgt.mercBuffs = [...(tgt.mercBuffs || []), { stat: 'regen', base, remaining: 10 }];
        setCd(merc, 'brs_bandage', 10);
        playCombatSound('healer', 0.4);
        cs.addPopup(tgt.pos.x, tgt.pos.y, '🩹 БИНТ!', 'HEAL');
        cs.addBattleLog(`🩹 ${merc.name}: бинт на ${tgt.name} (+5%/ход, 10 ходов)`);
        commit(list);
        await pause();
        return;
      }
    }
    // Стимуляторы.
    if (wounded90.length > 0) {
      const tgt = wounded90[0];
      const d = getDist(merc.pos, tgt.pos);
      if (build === 'elena' && hasMercStar(merc, 4) && ready(merc, 'eln_stim') && d <= 14) {
        const base = tgt.vampir || 0;
        tgt.vampir = base + 1.0;
        tgt.mercBuffs = [...(tgt.mercBuffs || []), { stat: 'vampir', base, remaining: 1 }];
        setCd(merc, 'eln_stim', 10);
        playCombatSound('1bbfc9b5f4347f2', 0.4);
        cs.addPopup(tgt.pos.x, tgt.pos.y, '🩸 ВАМПИРИЗМ!', 'BUFF');
        cs.addBattleLog(`🩸 ${merc.name}: стимулятор на ${tgt.name} (+100% вампиризма)`);
        commit(list);
        await pause();
        return;
      }
      if (build === 'boris' && hasMercStar(merc, 4) && ready(merc, 'brs_stim') && d <= 14) {
        const base = tgt.regen || 0;
        // +200%: от нуля считать нечего — дать плоские 5% maxHp.
        const add = base > 0 ? base * 2 : tgt.maxHp * 0.05;
        tgt.regen = base + add;
        tgt.mercBuffs = [...(tgt.mercBuffs || []), { stat: 'regen', base, remaining: 1 }];
        setCd(merc, 'brs_stim', 10);
        playCombatSound('1bbfc9b5f4347f2', 0.4);
        cs.addPopup(tgt.pos.x, tgt.pos.y, '♻️ РЕГЕН x3!', 'BUFF');
        cs.addBattleLog(`♻️ ${merc.name}: стимулятор на ${tgt.name} (+200% регена)`);
        commit(list);
        await pause();
        return;
      }
    }
    return;
  }

  // --- МЕХАНИК ---
  if (role === 'mechanic') {
    // Стан.
    if (hasMercStar(merc, 1) && ready(merc, 'mch_stun')) {
      const tgt = hostiles
        .filter((h) => getDist(merc.pos, h.pos) <= 10)
        .sort((a, b) => getDist(merc.pos, a.pos) - getDist(merc.pos, b.pos))[0];
      if (tgt) {
        tgt.stunned = true;
        tgt.stunTurns = 1;
        setCd(merc, 'mch_stun', 8);
        playCombatSound('melee', 0.4);
        cs.addPopup(tgt.pos.x, tgt.pos.y, '😵 СТАН!', 'SPECIAL');
        cs.addBattleLog(`⚡ ${merc.name}: ЭМИ-разряд по ${tgt.name} (стан 1 ход)`);
        commit(list);
        await pause();
        return;
      }
    }
    // Аура урона (и на игрока, если он в радиусе).
    if (hasMercStar(merc, 2) && ready(merc, 'mch_dmg')) {
      let n = 0;
      for (const a of allies) {
        if (a.id !== merc.id && getDist(merc.pos, a.pos) <= 10) {
          const base = a.damage || 0;
          a.damage = base * 1.2;
          a.dps = a.damage * (1 + (a.speed || 0));
          a.mercBuffs = [...(a.mercBuffs || []), { stat: 'damage', base, remaining: 2 }];
          n++;
        }
      }
      const cs0 = useCombatGridStore.getState();
      if (getDist(merc.pos, cs0.playerPos) <= 10) {
        refreshPlayerAura('merc_mch_dmg', 'Аура урона', { damage: 0.2 });
        n++;
      }
      if (n > 0) {
        setCd(merc, 'mch_dmg', 8);
        playCombatSound('Aeon_Disk', 0.4);
        cs.addPopup(merc.pos.x, merc.pos.y, '🔥 АУРА УРОНА!', 'BUFF');
        cs.addBattleLog(`🔥 ${merc.name}: аура урона +20% (${n} союзн., 2 хода)`);
        commit(list);
        await pause();
        return;
      }
    }
    // Ослепление (не танк/медик; mechanic — не medic, точное совпадение).
    if (hasMercStar(merc, 3) && ready(merc, 'mch_blind')) {
      const tgt = hostiles
        .filter((h) => {
          const k = `${h.name} ${(h as any).factionKey || ''}`.toLowerCase();
          return !k.includes('tank') && !k.includes('(medic)') && !k.includes('медик') &&
            getDist(merc.pos, h.pos) <= 14;
        })
        .sort((a, b) => getDist(merc.pos, a.pos) - getDist(merc.pos, b.pos))[0];
      if (tgt) {
        const base = tgt.accuracy;
        tgt.accuracy = base * 0.7;
        tgt.mercBuffs = [...(tgt.mercBuffs || []), { stat: 'accuracy', base, remaining: 1 }];
        setCd(merc, 'mch_blind', 8);
        playCombatSound('shotenemy', 0.3);
        cs.addPopup(tgt.pos.x, tgt.pos.y, '🎯‍🟥 −30% МЕТК!', 'SPECIAL');
        cs.addBattleLog(`🎯‍🟥 ${merc.name}: ослепление ${tgt.name} (−30% меткости)`);
        commit(list);
        await pause();
        return;
      }
    }
    // Аура меткости (и на игрока, если он в радиусе).
    if (hasMercStar(merc, 4) && ready(merc, 'mch_acc')) {
      let n = 0;
      for (const a of allies) {
        if (a.id !== merc.id && getDist(merc.pos, a.pos) <= 10) {
          const base = a.accuracy || 0;
          a.accuracy = base * 1.2;
          a.mercBuffs = [...(a.mercBuffs || []), { stat: 'accuracy', base, remaining: 2 }];
          n++;
        }
      }
      const cs0 = useCombatGridStore.getState();
      if (getDist(merc.pos, cs0.playerPos) <= 10) {
        refreshPlayerAura('merc_mch_acc', 'Аура меткости', { accuracy: 0.2 });
        n++;
      }
      if (n > 0) {
        setCd(merc, 'mch_acc', 8);
        playCombatSound('reload', 0.4);
        cs.addPopup(merc.pos.x, merc.pos.y, '🎯 АУРА МЕТКОСТИ!', 'BUFF');
        cs.addBattleLog(`🎯 ${merc.name}: аура меткости +20% (${n} союзн., 2 хода)`);
        commit(list);
        await pause();
        return;
      }
    }
    return;
  }
};

/** Смерть механика 5★: +25% HP всей команде. */
export const mechanicLastGift = (merc: any, list: any[]): void => {
  if (merc?.mercBuild !== 'mechanic' || !hasMercStar(merc, 5)) return;
  const cs = useCombatGridStore.getState();
  const ps = usePlayerStore.getState();
  for (const a of list) {
    if (a.faction === merc.faction && !a.dead && !a.sleeping && (a.currentHp || 0) > 0 && a.id !== merc.id) {
      const amt = Math.round(a.maxHp * 0.25);
      a.currentHp = Math.min(a.maxHp, a.currentHp + amt);
      cs.addPopup(a.pos.x, a.pos.y, `+${amt} 💚`, 'HEAL');
    }
  }
  const pmax = ps.stats.maxHp || 1;
  const pamt = Math.round(pmax * 0.25);
  usePlayerStore.setState((st: any) => ({
    stats: { ...st.stats, currentHp: Math.min(pmax, st.stats.currentHp + pamt) },
  }));
  playCombatSound('wilhelm_scream', 0.4);
  playCombatSound('healer', 0.4);
  cs.addBattleLog(`💚 ${merc.name}: Последний подарок! Команда +25% HP`);
};
