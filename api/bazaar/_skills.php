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
