/**
 * Темп симуляции путешествия. Должен совпадать с TRAVEL_TEST_SPEED в
 * api/exploration/engine_logic.php.
 * 1 = реальное время (крупные события ~2/час, микро раз в 8-12 мин).
 * Больше 1 — только для отладки: баланс урона в пути посчитан под темп 1.
 */
export const TRAVEL_TEST_SPEED = 1;

/** Дорога туда, сек. */
export const TRAVEL_OUT_SEC = Math.max(1, Math.round(120 / TRAVEL_TEST_SPEED));

/** Дорога обратно, сек. */
export const TRAVEL_BACK_SEC = Math.max(1, Math.round(3600 / TRAVEL_TEST_SPEED));
