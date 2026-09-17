<?php
// Зеркало skillUtility() из playerStore.ts — скидки/бонусы торговца,
// посчитанные СЕРВЕРОМ из player_skills. Клиентским цифрам не доверяем.
// PHP 7.1-safe (без стрелочных функций).
function traderSkillPoints($pdo, $userId) {
  $stmt = $pdo->prepare('SELECT skill_id, points FROM player_skills WHERE user_id = ?');
  $stmt->execute([$userId]);
  $pts = [];
  foreach ($stmt->fetchAll() as $r) {
    $pts[$r['skill_id']] = (int)$r['points'];
  }
  return $pts;
}

function traderDiscounts($pdo, $userId) {
  $pts = traderSkillPoints($pdo, $userId);
  $lvl = function ($id) use ($pts) { return isset($pts[$id]) ? $pts[$id] : 0; };

  $buyDiscount = $lvl('trader_haggle') * 0.03 + $lvl('trader_network') * 0.02 + $lvl('trader_bulk') * 0.02;
  $sellBonus = $lvl('trader_connections') * 0.03 + $lvl('trader_network') * 0.02 + $lvl('trader_bulk') * 0.02;
  $refreshDiscount = $lvl('trader_discount') * 0.05 + $lvl('trader_bulk') * 0.02;
  $capMulti = $lvl('trader_capstone') > 0 ? 0.15 : 0;

  return [
    'buyDiscount' => min(0.9, $buyDiscount * (1 + $capMulti)),
    'sellBonus' => $sellBonus * (1 + $capMulti),
    'refreshDiscount' => min(0.9, $refreshDiscount * (1 + $capMulti)),
  ];
}

// Группы патронов (зеркало AMMO_GROUP_MAP из src/data/ammo.ts).
function ammoGroupMap() {
  return ['pistol' => 1, 'rifle' => 1, 'sniper' => 1, 'shell' => 1, 'mg' => 1, 'energy' => 1];
}

/** Группа патронов оружия — зеркало ammoTypeForWeapon() (тот же порядок приоритетов). */
function weaponAmmoGroup($name, $itemData) {
  if (!is_array($itemData)) $itemData = [];
  $map = ammoGroupMap();
  foreach (['ammoGroup', 'ammoType'] as $k) {
    if (!empty($itemData[$k]) && isset($map[$itemData[$k]])) return $itemData[$k];
  }
  $n = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
  if (preg_match('/пистолет|глок|beretta|usp|five-seven|стечкин|stechkin|colt|наган|макаров/u', $n)) return 'pistol';
  if (preg_match('/мосин|свд|l96|barrett|винторез|птрс|снайпер|предел|оракул/u', $n)) return 'sniper';
  if (preg_match('/дробовик|обрез|осада|аннигилятор|remington|spas|aa-12|двустволка/u', $n)) return 'shell';
  if (preg_match('/m134|m60|m249|pkm|миниган|пулем/u', $n)) return 'mg';
  if (preg_match('/эми|термальн|терма|гравитац|разрядник|импульс|плазм|огнемет|огнемёт|квант|базука|рельсов|рпг|гп-25|гранатомёт|лазер|мультилазер|аннигилятор/u', $n)) return 'energy';
  return 'rifle';
}

/** Дальность выстрела — зеркало weaponRangeProfile() из src/data/ammo.ts. */
function weaponRangeOf($name, $itemData) {
  if (!is_array($itemData)) $itemData = [];
  if ((($itemData['slot'] ?? '') === 'weapon1') || !empty($itemData['isFists'])) return 1.5;
  $n = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
  if (preg_match('/базук|рпг|гп-25|гранатом|milkor|m79/u', $n)) return 10;
  if (preg_match('/огнемет|огнемёт|flame|дробовик|обрез|spas|aa-12|remington|двустволка|осада/u', $n)) return 5;
  $g = weaponAmmoGroup($name, $itemData);
  if ($g === 'sniper') return 12;
  if ($g === 'pistol') return 8;
  if ($g === 'mg') return 8;
  if ($g === 'shell') return 5;
  return 10;
}

function isSniperWeaponRow($name, $itemData) {
  if (!is_array($itemData)) $itemData = [];
  if (($itemData['type'] ?? '') === 'bullet') return false;
  if (weaponAmmoGroup($name, $itemData) !== 'sniper') return false;
  $isGun = isset($itemData['ammoCapacity'])
    || (($itemData['type'] ?? '') === 'weapon')
    || (strpos((string)($itemData['slot'] ?? ''), 'weapon') === 0);
  if (!$isGun) return false;
  $range = weaponRangeOf($name, $itemData);
  return $range >= 12 && $range <= 14;
}
function sniperSellRateFor($name, $itemData, $tradeRank) {
  if ((int)$tradeRank <= 0) return 0.4;
  if (!isSniperWeaponRow($name, $itemData)) return 0.4;
  return ((int)$tradeRank >= 2) ? 1.0 : 0.8;
}
