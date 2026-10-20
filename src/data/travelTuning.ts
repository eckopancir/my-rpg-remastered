/**
 * ТЕСТ: ускорение симуляции путешествия в 10 раз.
 * Должно совпадать с TRAVEL_TEST_SPEED в api/exploration/engine_logic.php.
 * Перед релизом вернуть в 1 (здесь и в PHP).
 */
export const TRAVEL_TEST_SPEED = 10;

/** Дорога туда, сек (ускоренная). */
export const TRAVEL_OUT_SEC = Math.max(1, Math.round(120 / TRAVEL_TEST_SPEED));

/** Дорога обратно, сек (ускоренная). */
export const TRAVEL_BACK_SEC = Math.max(1, Math.round(3600 / TRAVEL_TEST_SPEED));
