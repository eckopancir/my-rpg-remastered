export interface CombatPlayer {
  dps: number;
  dpsToxis?: number;
  dpsEmi?: number;
  dpsExtro?: number;
  dpsFire?: number;
  health: number;
  stamina: number;
  armor: number;
  regen: number;
  accuracy: number;
  evasion: number;
  block: number;
  punching: number;
  vampir: number;
  crit: number;
}

export interface CombatEnemy {
  dps: number;
  health: number;
  armor: number;
  regen: number;
  accuracy: number;
  evasion: number;
  block: number;
  punching: number;
  vampir: number;
  crit: number;
  faction?: string;
}

export interface CombatResult {
  playerDamageDealt: number;
  enemyDamageDealt: number;
  playerRegen: number;
  enemyRegen: number;
  playerVampHeal: number;
  enemyVampHeal: number;
  playerEvasions: number;
  enemyEvasions: number;
  playerBlocks: number;
  enemyBlocks: number;
  playerArmorAbsorbed: number;
  enemyArmorAbsorbed: number;
  playerDmgBlocked: number;
  enemyDmgBlocked: number;
  newPlayerHp: number;
  newEnemyHp: number;
  logMessages: string[];
  effectiveDps: number;
}

const TIME_STEP = 6;
const ATTACKS_PER_STEP = 3;
const LOW_STAMINA_THRESHOLD = 0.1;
const LOW_STAMINA_DAMAGE_PENALTY = 0.5;

const getCritMultiplier = (critVal: number): number => {
  const baseTier = Math.floor(critVal);
  const chance = Math.min(critVal - baseTier, 1);
  return Math.random() < chance ? baseTier + 2 : baseTier + 1;
};

const getBlockReduction = (blockVal: number): number => {
  if (blockVal >= 3.0) return 0.9;
  if (blockVal >= 2.0) return 0.8;
  return 0.5;
};

export const calculateCombatStep = (
  player: CombatPlayer,
  enemy: CombatEnemy,
  playerCurrentHp: number,
  enemyCurrentHp: number,
): CombatResult => {
  const messages: string[] = [];
  let effectiveDps = player.dps;
  let damageModifier = 1.0;

  let totalPlayerDmgDealt = 0;
  let totalEnemyDmgDealt = 0;
  let playerEvasions = 0;
  let playerBlocks = 0;
  let playerDmgBlocked = 0;
  let playerArmorAbsorbed = 0;
  let enemyEvasions = 0;
  let enemyBlocks = 0;
  let enemyDmgBlocked = 0;
  let enemyArmorAbsorbed = 0;

  if (player.stamina < LOW_STAMINA_THRESHOLD) {
    damageModifier = LOW_STAMINA_DAMAGE_PENALTY;
    messages.push('🔴 Штраф! Выносливость критически низка. Урон снижен на 50%.');
  }

  const faction = enemy.faction || '';
  switch (faction) {
    case 'Мутанты':
      effectiveDps = Math.max(player.dps, player.dpsToxis || 0);
      break;
    case 'Роботы':
      effectiveDps = Math.max(player.dps, player.dpsEmi || 0);
      break;
    case 'Бандиты':
    case 'Военные':
      effectiveDps = Math.max(player.dps, player.dpsExtro || 0, player.dpsFire || 0);
      break;
    default:
      effectiveDps = player.dps;
      break;
  }
  effectiveDps *= damageModifier;

  const getDpsLabel = (): string => {
    if (faction === 'Мутанты' && effectiveDps > player.dps) return 'Токсичный';
    if (faction === 'Роботы' && effectiveDps > player.dps) return 'ЭМИ';
    if ((faction === 'Бандиты' || faction === 'Военные') && effectiveDps === (player.dpsFire || 0) && effectiveDps > player.dps) return 'Разрывной (Fire)';
    if ((faction === 'Бандиты' || faction === 'Военные') && effectiveDps === (player.dpsExtro || 0) && effectiveDps > player.dps) return 'Усиленный (Extro)';
    return 'Базовый/Физический';
  };

  messages.push(`🎯 Игрок использует ${effectiveDps.toFixed(1)} DPS (${getDpsLabel()}) против ${faction || 'Неизвестный тип'}.`);

  const playerRegenAmount = player.regen * TIME_STEP;
  const enemyRegenAmount = enemy.regen * TIME_STEP;

  for (let i = 0; i < ATTACKS_PER_STEP; i++) {
    let dmg = effectiveDps;
    if (Math.random() > player.accuracy && player.accuracy < 1) {
      messages.push(`❌ Промах (Меткость: ${Math.round(player.accuracy * 100)}%)`);
      continue;
    }

    // Crit check — cascade tiers
    if (player.crit > 0) {
      const critMult = getCritMultiplier(player.crit);
      dmg *= critMult;
      messages.push(`💥 КРИТ x${critMult}!`);
    }

    const effectiveEnemyArmor = enemy.armor * (1 - player.punching);
    const actualArmorReduction = Math.min(dmg, effectiveEnemyArmor);
    dmg = Math.max(0, dmg - actualArmorReduction);
    enemyArmorAbsorbed += actualArmorReduction;

    let evasionSuccess = false;
    if (Math.random() < enemy.evasion) evasionSuccess = true;
    if (evasionSuccess && player.accuracy > 1) {
      if (Math.random() < player.accuracy - 1) evasionSuccess = false;
    }
    if (evasionSuccess) { enemyEvasions++; continue; }

    if (Math.random() < Math.min(1, enemy.block)) {
      enemyBlocks++;
      const blockReduction = getBlockReduction(enemy.block);
      const blocked = dmg * blockReduction;
      enemyDmgBlocked += blocked;
      dmg *= 1 - blockReduction;
      if (enemy.block >= 2.0) messages.push(`🧱 Враг блокирует ${Math.round(blockReduction * 100)}% урона (блок ${Math.round(enemy.block * 100)}%)`);
    }
    totalPlayerDmgDealt += dmg;
  }

  for (let i = 0; i < ATTACKS_PER_STEP; i++) {
    let dmg = enemy.dps;
    if (Math.random() > enemy.accuracy && enemy.accuracy < 1) continue;

    // Crit check for enemy
    if (enemy.crit > 0) {
      const critMult = getCritMultiplier(enemy.crit);
      dmg *= critMult;
      messages.push(`💥 Враг критует x${critMult}!`);
    }

    const effectivePlayerArmor = player.armor * (1 - enemy.punching);
    const actualArmorReduction = Math.min(dmg, effectivePlayerArmor);
    dmg = Math.max(0, dmg - actualArmorReduction);
    playerArmorAbsorbed += actualArmorReduction;

    let evasionSuccess = false;
    if (Math.random() < player.evasion) evasionSuccess = true;
    if (evasionSuccess && enemy.accuracy > 1) {
      if (Math.random() < enemy.accuracy - 1) evasionSuccess = false;
    }
    if (evasionSuccess) { playerEvasions++; continue; }

    if (Math.random() < Math.min(1, player.block)) {
      playerBlocks++;
      const blockReduction = getBlockReduction(player.block);
      const blocked = dmg * blockReduction;
      playerDmgBlocked += blocked;
      dmg *= 1 - blockReduction;
      if (player.block >= 2.0) messages.push(`🧱 Ты блокируешь ${Math.round(blockReduction * 100)}% урона (блок ${Math.round(player.block * 100)}%)`);
    }
    totalEnemyDmgDealt += dmg;
  }

  const playerVampHeal = totalPlayerDmgDealt * player.vampir;
  const enemyVampHeal = totalEnemyDmgDealt * enemy.vampir;

  const newEnemyHp = Math.min(enemy.health, Math.max(0, enemyCurrentHp - totalPlayerDmgDealt + enemyRegenAmount + enemyVampHeal));
  const newPlayerHp = Math.min(player.health, Math.max(0, playerCurrentHp - totalEnemyDmgDealt + playerRegenAmount + playerVampHeal));

  messages.push(`--- БОЙ ЗА ${TIME_STEP} СЕК. ---`);
  messages.push(`⚔️ Нанесено ${totalPlayerDmgDealt.toFixed(1)} урона. Реген ${playerRegenAmount.toFixed(1)} HP. Вампиризм ${playerVampHeal.toFixed(1)} HP.`);
  messages.push(`🌀 Враг: уклонов ${enemyEvasions}, броня ${enemyArmorAbsorbed.toFixed(1)}, блок ${enemyDmgBlocked.toFixed(1)}.`);
  messages.push(`⚔️ Враг нанес ${totalEnemyDmgDealt.toFixed(1)} урона. Реген ${enemyRegenAmount.toFixed(1)} HP. Вампиризм ${enemyVampHeal.toFixed(1)} HP.`);
  messages.push(`🌀 Ты: уклонов ${playerEvasions}, броня ${playerArmorAbsorbed.toFixed(1)}, блок ${playerDmgBlocked.toFixed(1)}.`);
  messages.push(`❤️ Твое HP: ${newPlayerHp.toFixed(1)} / Врага HP: ${newEnemyHp.toFixed(1)}`);

  return {
    playerDamageDealt: totalPlayerDmgDealt,
    enemyDamageDealt: totalEnemyDmgDealt,
    playerRegen: playerRegenAmount,
    enemyRegen: enemyRegenAmount,
    playerVampHeal,
    enemyVampHeal,
    playerEvasions,
    enemyEvasions,
    playerBlocks,
    enemyBlocks,
    playerArmorAbsorbed,
    enemyArmorAbsorbed,
    playerDmgBlocked,
    enemyDmgBlocked,
    newPlayerHp,
    newEnemyHp,
    logMessages: messages,
    effectiveDps,
  };
};
