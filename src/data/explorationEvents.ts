import { useInventoryStore } from '../stores/inventoryStore';

export type ExplorationEventType =
  | 'combat' | 'loot' | 'damage' | 'heal' | 'chips'
  | 'xp' | 'neutral' | 'trade' | 'story' | 'discovery' | 'danger' | 'legendary';

export interface ExplorationEventLog {
  id: string;
  text: string;
  type: ExplorationEventType;
  ts: number;
  items?: any[];
  chips?: number;
  exp?: number;
  damage?: number;
  damagePercent?: number;
  heal?: number;
  healPercent?: number;
  combat?: boolean;
  decision?: string;
  resourceCost?: string;
  resourceHad?: boolean;
  isMicro?: boolean;
  isLegendary?: boolean;
  legendaryTitle?: string;
  legendaryStage?: number;
  legendaryResult?: string;
}

export interface EventEffects {
  damage?: number;
  damagePercent?: number;
  heal?: number;
  healPercent?: number;
  chips?: number;
  exp?: number;
  itemCount?: number;
  combat?: boolean;
}

export interface BranchOutcome {
  text: string;
  weight: number;
  effects?: (zone: string, level: number) => EventEffects;
  branches?: BranchOutcome[];
  resourceCost?: string;
  resourceText?: string;
  noResourceText?: string;
  resourceEffects?: (zone: string, level: number) => EventEffects;
  noResourceEffects?: (zone: string, level: number) => EventEffects;
}

export interface EventBranch {
  prompt: string;
  outcomes: BranchOutcome[];
}

interface EventTemplate {
  text: string;
  type: ExplorationEventType;
  effects?: (zone: string, level: number) => EventEffects;
  branch?: EventBranch;
  noAutoBranch?: boolean;
}

export interface LegendaryStage {
  text: string;
  continueChoice: string;
  retreatChoice: string;
  successText: string;
  failText: string;
  rewards: (level: number) => EventEffects;
}

export interface LegendaryEventData {
  id: string;
  title: string;
  description: string;
  stages: LegendaryStage[];
  finalRewardText: string;
  finalReward: (level: number) => EventEffects;
}

// ---------------------------------------------------------------------------
// NPC / naming data
// ---------------------------------------------------------------------------
const MALE_NAMES = [
  'Артём', 'Максим', 'Дмитрий', 'Алексей', 'Сергей', 'Андрей', 'Владимир',
  'Константин', 'Игорь', 'Олег', 'Виктор', 'Григорий', 'Павел', 'Роман',
  'Евгений', 'Николай', 'Михаил', 'Иван', 'Вадим', 'Борис', 'Глеб', 'Семён',
  'Пётр', 'Ярослав', 'Тимур', 'Даниил', 'Егор', 'Матвей', 'Кирилл', 'Лев',
];

const FEMALE_NAMES = [
  'Анна', 'Елена', 'Ольга', 'Марина', 'Светлана', 'Наталья', 'Ирина',
  'Татьяна', 'Ксения', 'Дарья', 'Юлия', 'Александра', 'Виктория', 'Полина',
  'Екатерина', 'Вера', 'Надежда', 'Любовь', 'Алиса', 'Зоя', 'Валерия',
  'Маргарита', 'Антонина', 'Лидия', 'Галина',
];

const NICKNAMES = [
  'Пустошник', 'Ходок', 'Скиталец', 'Сталкер', 'Торговец', 'Ветеран',
  'Охотник', 'Механик', 'Лекарь', 'Связист', 'Гонец', 'Разведчик',
  'Копатель', 'Сапёр', 'Кузнец', 'Стрелок', 'Проводник', 'Бродяга',
];

const ITEM_NAMES = [
  'патроны', 'консервы', 'бинты', 'медикаменты', 'запчасти',
  'инструменты', 'пища', 'вода', 'топливо', 'боеприпасы',
];

const LOOT_ROOMS = [
  'подвал', 'бункер', 'склад', 'тайник', 'ржавый контейнер',
  'сейф', 'сумку', 'ящик', 'шкаф', 'пещеру',
];

// ---------------------------------------------------------------------------
// Template generators by category
// ---------------------------------------------------------------------------
const PICK = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const RANGE = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const RF = (min: number, max: number): number => min + Math.random() * (max - min);

// Level-scaled chip/exp helpers
const C = (level: number, _tier?: number): number => RANGE(1, 5) + (level - 1) * 2;
const NC = (level: number, _tier?: number): number => RANGE(-5, -1) - (level - 1) * 2;
const E = (level: number, _tier?: number): number => RANGE(1, 10) + (level - 1) * 10;
const LC = (level: number, _tier?: number): number => RANGE(5, 15) + (level - 1) * 5;
const LE = (level: number, _tier?: number): number => RANGE(5, 20) + (level - 1) * 15;

// ---------------------------------------------------------------------------
// Resource helpers
// ---------------------------------------------------------------------------
const EXPLORATION_RESOURCES = [
  'Вода', 'Изолента', 'Железо', 'Дерево', 'Инструменты',
  'Гвозди', 'Пластмасса', 'Топливо', 'Батарейки', 'Консервы', 'Лекарства',
];
let resourceCycleIndex = 0;
const nextResource = (): string => {
  const r = EXPLORATION_RESOURCES[resourceCycleIndex % EXPLORATION_RESOURCES.length];
  resourceCycleIndex++;
  return r;
};
const consumeResource = (resourceName: string): boolean => {
  const inv = useInventoryStore.getState();
  const idx = inv.items.findIndex((i) => i.name === resourceName);
  if (idx === -1) return false;
  inv.removeItem(inv.items[idx].id);
  return true;
};

// ---------------------------------------------------------------------------
// Branch resolution
// ---------------------------------------------------------------------------
const resolveBranch = (branch: EventBranch, zone: string, level: number): { texts: string[]; effects: EventEffects; resourceCost?: string; resourceHad?: boolean } => {
  const totalWeight = branch.outcomes.reduce((s, o) => s + o.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = branch.outcomes[0];
  for (const outcome of branch.outcomes) {
    roll -= outcome.weight;
    if (roll <= 0) { chosen = outcome; break; }
  }
  const texts = [chosen.text];
  let effects = chosen.effects?.(zone, level) || {};
  let resourceCost: string | undefined;
  let resourceHad: boolean | undefined;

  if (chosen.resourceCost) {
    resourceCost = chosen.resourceCost;
    resourceHad = consumeResource(resourceCost);
    if (resourceHad && chosen.resourceText) {
      texts[0] = chosen.resourceText;
      if (chosen.resourceEffects) {
        const bonus = chosen.resourceEffects(zone, level);
        for (const [k, v] of Object.entries(bonus)) {
          if (v) (effects as any)[k] = ((effects as any)[k] || 0) + (v as number);
        }
      }
    } else if (!resourceHad && chosen.noResourceText) {
      texts[0] = chosen.noResourceText;
      if (chosen.noResourceEffects) {
        const penalty = chosen.noResourceEffects(zone, level);
        for (const [k, v] of Object.entries(penalty)) {
          if (v) (effects as any)[k] = ((effects as any)[k] || 0) + (v as number);
        }
      }
    }
  }

  if (chosen.branches && chosen.branches.length > 0) {
    const sub: EventBranch = { prompt: '', outcomes: chosen.branches };
    const subResult = resolveBranch(sub, zone, level);
    texts.push(...subResult.texts);
    for (const [k, v] of Object.entries(subResult.effects)) {
      if (v) (effects as any)[k] = ((effects as any)[k] || 0) + (v as number);
    }
  }
  return { texts, effects, resourceCost, resourceHad };
};

const getAutoBranch = (template: EventTemplate, zone: string): EventBranch | null => {
  if (template.noAutoBranch) return null;
  if (template.branch) return null;
  const t = template.type;
  const zoneLabel = zone || 'окрестностей';
  if (t === 'combat') {
    const r = [0,1,2,3,4].map(() => nextResource());
    return {
      prompt: '',
      outcomes: [
        { text: `Даём бой и выходим победителями из схватки у ${zoneLabel}.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }), resourceCost: r[0], resourceText: `Используя [${r[0]}] ремонтируем оружие в бою — трофеи x3.`, noResourceText: `Без [${r[0]}] ствол заклинило — обычная награда.`, resourceEffects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }), noResourceEffects: () => ({}) },
        { text: `Тактически отступаем, уводя противника в ловушку. Ворачиваемся за трофеем.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }), resourceCost: r[1], resourceText: `[${r[1]}] помогли замаскировать ловушку — лут x2.`, noResourceText: `Без [${r[1]}] ловушка слабая — часть добычи потеряна.`, resourceEffects: (_, level) => ({ chips: C(level, 3), exp: E(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 1) }) },
        { text: `Вовремя подоспевшая помощь — патруль союзников разгоняет врагов.`, weight: 20, effects: (_, level) => ({ healPercent: RF(0.02, 0.06), exp: E(level, 4), chips: C(level, 3) }), resourceCost: r[2], resourceText: `Отблагодарили патруль [${r[2]}] — союзники поделились боеприпасами. Награда x2.`, noResourceText: `Нечем отблагодарить — [${r[2]}] нет. Разошлись сухо.`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2), exp: E(level, 3) }), noResourceEffects: () => ({}) },
        { text: `Противник оказывается сильнее. Получаем серьёзные ранения в бою.`, weight: 20, effects: (_, level) => ({ damagePercent: 0.10, chips: NC(level, 2) }), resourceCost: r[3], resourceText: `[${r[3]}] смягчили удар — ранения лёгкие.`, noResourceText: `Нет [${r[3]}] — урон удвоен.`, resourceEffects: () => ({ damagePercent: -0.05 }), noResourceEffects: () => ({ damagePercent: 0.10 }) },
        { text: `Прорываемся с боем, теряем часть припасов, но приобретаем боевой опыт.`, weight: 15, effects: (_, level) => ({ damagePercent: RF(0.02, 0.05), exp: E(level, 4) }), resourceCost: r[4], resourceText: `Повезло, [${r[4]}] поймало пулю — урон -50%.`, noResourceText: `Отсутствует [${r[4]}] — дополнительный урон x2.`, resourceEffects: () => ({ damagePercent: -RF(0.01, 0.02) }), noResourceEffects: (_, level) => ({ damagePercent: RF(0.02, 0.05) }) },
      ],
    };
  }
  if (t === 'loot' || t === 'discovery') {
    const r = [0,1,2,3,4].map(() => nextResource());
    return {
      prompt: '',
      outcomes: [
        { text: `Находка в целости — всё, что здесь было, достаётся нам.`, weight: 20, effects: (_, level) => ({ chips: C(level, 4), exp: E(level, 2) }), resourceCost: r[0], resourceText: `Благодаря [${r[0]}] добираемся до тайника первыми — лут x3.`, noResourceText: `Без [${r[0]}] упаковка не вскрыта — часть пропала.`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2), chips: C(level, 3) }), noResourceEffects: () => ({ chips: NC(level, 0) }) },
        { text: `Помимо основного, замечаем скрытый тайник в ${zoneLabel}.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3), itemCount: RANGE(1, 2) }), resourceCost: r[1], resourceText: `[${r[1]}] помогают вскрыть тайник без шума — находка x2.`, noResourceText: `Без [${r[1]}] тайник взломан силой — часть испорчена.`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: () => ({ itemCount: -1 }) },
        { text: `Находим ценные сведения — карты, записи, координаты других схронов.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }), resourceCost: r[2], resourceText: `[${r[2]}] пригодились — контейнер распакован. Находка x3.`, noResourceText: `Без [${r[2]}] контейнер взломан — часть испорчена.`, resourceEffects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 2) }), noResourceEffects: () => ({ chips: NC(level, 2) }) },
        { text: `Ловушка! Кто-то подстраховал находку. Получаем урон и теряем часть снаряжения.`, weight: 20, effects: (_, level) => ({ damagePercent: 0.08, chips: NC(level, 0) }), resourceCost: r[3], resourceText: `[${r[3]}] обезвредили ловушку — урон минимален.`, noResourceText: `[${r[3]}] нет — ловушка сработала в полную силу.`, resourceEffects: () => ({ damagePercent: -0.04 }), noResourceEffects: () => ({ damagePercent: 0.08 }) },
        { text: `Забираем ценное, но приходится уходить под обстрелом.`, weight: 15, effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), chips: C(level, 3) }), resourceCost: r[4], resourceText: `Прикрываясь [${r[4]}] уходим без царапины.`, noResourceText: `Нет [${r[4]}] — полный урон.`, resourceEffects: () => ({ damagePercent: -0.03 }), noResourceEffects: () => ({ damagePercent: RF(0.02, 0.04) }) },
      ],
    };
  }
  if (t === 'trade') {
    const r = [0,1,2,3,4].map(() => nextResource());
    return {
      prompt: '',
      outcomes: [
        { text: `Удаётся сторговаться по выгодной цене. Продавец доволен, мы при деньгах.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 2) }), resourceCost: r[0], resourceText: `Предложили [${r[0]}] как оплату — продавец дал скидку. Прибыль x2.`, noResourceText: `Нет [${r[0]}] для бартера — цена стандартная.`, resourceEffects: (_, level) => ({ chips: C(level, 5) }), noResourceEffects: () => ({}) },
        { text: `Продавец оказывается щедрым — добавляет бонус к сделке.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }), resourceCost: r[1], resourceText: `Обменяли [${r[1]}] на редкий товар — бонус x2.`, noResourceText: `Без [${r[1]}] бонус скромнее.`, resourceEffects: (_, level) => ({ itemCount: 1 }), noResourceEffects: () => ({}) },
        { text: `Обмениваемся знаниями и информацией о ${zoneLabel}.`, weight: 20, effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.05) }), resourceCost: r[2], resourceText: `Поделились [${r[2]}] — попутчики раскрыли секретные маршруты. Опыт x2.`, noResourceText: `Нечем поделиться — [${r[2]}] нет. Поговорили и разошлись.`, resourceEffects: (_, level) => ({ exp: E(level, 4) }), noResourceEffects: () => ({}) },
        { text: `Обман! Продавец подсовывает бракованный товар и скрывается с нашими чипами.`, weight: 20, effects: (_, level) => ({ chips: NC(level, 2), damagePercent: RF(0.08, 0.12) }), resourceCost: r[3], resourceText: `Вовремя заметили подмену — [${r[3]}] спасли от обмана. Потери минимальны.`, noResourceText: `[${r[3]}] нет — попались на удочку. Потери x2.`, resourceEffects: () => ({ chips: 0 }), noResourceEffects: (_, level) => ({ chips: NC(level, 2) }) },
        { text: `Сделка проходит нейтрально — без прибыли, но и без потерь.`, weight: 15, effects: (_, level) => ({ chips: C(level, 2), exp: E(level, 1) }), resourceCost: r[4], resourceText: `[${r[4]}] подсластили сделку — выбили бонус.`, noResourceText: `Без [${r[4]}] — ровно, как договорились.`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: () => ({}) },
      ],
    };
  }
  if (t === 'story') {
    const r = [0,1,2,3,4].map(() => nextResource());
    return {
      prompt: '',
      outcomes: [
        { text: `Предлагаем помощь — нас благодарят и щедро вознаграждают.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }), resourceCost: r[0], resourceText: `Используем [${r[0]}] чтобы помочь — благодарность x3.`, noResourceText: `Нечем помочь — [${r[0]}] нет. Награда скромнее.`, resourceEffects: (_, level) => ({ chips: C(level, 5), itemCount: RANGE(1, 2) }), noResourceEffects: () => ({ chips: NC(level, 1) }) },
        { text: `Рассказываем свою историю. Местные вдохновляются и делятся припасами.`, weight: 20, effects: (_, level) => ({ healPercent: RF(0.02, 0.06), exp: E(level, 4) }), resourceCost: r[1], resourceText: `[${r[1]}] как дар скрепляет дружбу — местные открывают запасы.`, noResourceText: `Без [${r[1]}] история тронула, но припасов не дали.`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2), chips: C(level, 3) }), noResourceEffects: () => ({}) },
        { text: `Помогаем в обмен на услугу. Взаимовыручка в ${zoneLabel}.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), itemCount: RANGE(1, 2) }), resourceCost: r[2], resourceText: `Оставляем [${r[2]}] в залог — услуга оплачена вдвойне.`, noResourceText: `Без [${r[2]}] услуга без благодарности.`, resourceEffects: (_, level) => ({ chips: C(level, 3) }), noResourceEffects: () => ({}) },
        { text: `Проявляем наивность — нас обманывают и обкрадывают.`, weight: 20, effects: (_, level) => ({ damagePercent: RF(0.08, 0.12), chips: NC(level, 2) }), resourceCost: r[3], resourceText: `[${r[3]}] помогли сохранить часть припасов. Потери -50%.`, noResourceText: `Нет [${r[3]}] — потеряли всё.`, resourceEffects: () => ({ chips: NC(0, 0) }), noResourceEffects: (_, level) => ({ chips: NC(level, 2) }) },
        { text: `Помочь не вышло — ситуация обернулась против нас, но получили ценный урок.`, weight: 15, effects: (_, level) => ({ damagePercent: RF(0.02, 0.04), exp: E(level, 4) }), resourceCost: r[4], resourceText: `[${r[4]}] смягчили падение — легко отделались.`, noResourceText: `Нет [${r[4]}] — урон вдвое сильнее.`, resourceEffects: () => ({ damagePercent: -RF(0.01, 0.02) }), noResourceEffects: (_, level) => ({ damagePercent: RF(0.02, 0.04) }) },
      ],
    };
  }
  if (t === 'danger') {
    const r = [0,1,2,3,4].map(() => nextResource());
    return {
      prompt: '',
      outcomes: [
        { text: `Удача на нашей стороне — проходим опасный участок ${zoneLabel} без потерь.`, weight: 20, effects: (_, level) => ({ chips: C(level, 4), exp: E(level, 3) }), resourceCost: r[0], resourceText: `[${r[0]}] помогают преодолеть препятствие — проходим с комфортом.`, noResourceText: `Без [${r[0]}] идём на риск — проходим, но потрёпанные.`, resourceEffects: (_, level) => ({ healPercent: RF(0.02, 0.04) }), noResourceEffects: (_, level) => ({ damagePercent: RF(0.01, 0.03) }) },
        { text: `Находим способ обезвредить угрозу — сообразительность спасает положение.`, weight: 20, effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 4) }), resourceCost: r[1], resourceText: `[${r[1]}] — идеальный инструмент для обезвреживания. Награда x2.`, noResourceText: `Без [${r[1]}] обезвреживаем подручными средствами.`, resourceEffects: (_, level) => ({ chips: C(level, 4), itemCount: 1 }), noResourceEffects: () => ({}) },
        { text: `Опасность закаляет дух. Выходим из передряги сильнее.`, weight: 20, effects: (_, level) => ({ healPercent: RF(0.02, 0.05), exp: E(level, 4) }), resourceCost: r[2], resourceText: `[${r[2]}] укрепляют позиции — меньше урона, больше опыта.`, noResourceText: `Без [${r[2]}] выходим потрёпанными.`, resourceEffects: (_, level) => ({ healPercent: RF(0.02, 0.04), exp: E(level, 2) }), noResourceEffects: () => ({ damagePercent: RF(0.01, 0.03) }) },
        { text: `Опасность оказалась сильнее. Получаем травмы и теряем часть снаряжения.`, weight: 20, effects: (_, level) => ({ damagePercent: 0.12, chips: NC(level, 0) }), resourceCost: r[3], resourceText: `[${r[3]}] спасают от худшего — травмы лёгкие.`, noResourceText: `Нет [${r[3]}] — урон x2, потери серьёзные.`, resourceEffects: () => ({ damagePercent: -0.06 }), noResourceEffects: () => ({ damagePercent: 0.12 }) },
        { text: `Выбрались с трудом. Потрёпаны, но с добычей.`, weight: 15, effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), chips: C(level, 3) }), resourceCost: r[4], resourceText: `[${r[4]}] помогли сохранить добычу — ценное уцелело.`, noResourceText: `Без [${r[4]}] добыча рассыпалась — подобрали половину.`, resourceEffects: (_, level) => ({ chips: C(level, 3) }), noResourceEffects: () => ({ chips: NC(level, 0) }) },
      ],
    };
  }
  if (t === 'heal') {
    const r = [0,1,2,3,4].map(() => nextResource());
    return {
      prompt: '',
      outcomes: [
        { text: `Отличное место для отдыха. Восстанавливаем силы и дух.`, weight: 20, effects: (_, level) => ({ healPercent: RF(0.04, 0.08), exp: E(level, 2) }), resourceCost: r[0], resourceText: `Разводим костёр с помощью [${r[0]}] — отдых полноценный. Восстановление x2.`, noResourceText: `Без [${r[0]}] отдых неполный.`, resourceEffects: (_, level) => ({ healPercent: RF(0.04, 0.06) }), noResourceEffects: () => ({ healPercent: -RF(0.02, 0.04) }) },
        { text: `Встречаем попутного лекаря. Он делится медикаментами и советами.`, weight: 20, effects: (_, level) => ({ healPercent: RF(0.03, 0.07), exp: E(level, 3), chips: C(level, 3) }), resourceCost: r[1], resourceText: `Даём лекарю [${r[1]}] — он делится лучшими препаратами. Лечение x3.`, noResourceText: `Нет [${r[1]}] для обмена — помощь бесплатная, но скупая.`, resourceEffects: (_, level) => ({ healPercent: RF(0.04, 0.06) }), noResourceEffects: () => ({}) },
        { text: `Обнаруживаем природный источник чистой воды и съедобные растения.`, weight: 20, effects: () => ({ healPercent: RF(0.02, 0.05), itemCount: RANGE(1, 2) }), resourceCost: r[2], resourceText: `С помощью [${r[2]}] очищаем воду — запас пополнен.`, noResourceText: `Без [${r[2]}] пьём как есть — риск заражения.`, resourceEffects: () => ({ healPercent: RF(0.02, 0.04) }), noResourceEffects: () => ({ damagePercent: RF(0.01, 0.03) }) },
        { text: `Место оказалось заражённым. Вместо отдыха получаем отравление.`, weight: 20, effects: (_, level) => ({ damagePercent: 0.08, chips: NC(level, 0) }), resourceCost: r[3], resourceText: `[${r[3]}] нейтрализует яд — урон -50%.`, noResourceText: `Нет [${r[3]}] — отравление в полную силу.`, resourceEffects: () => ({ damagePercent: -0.04 }), noResourceEffects: () => ({ damagePercent: 0.08 }) },
        { text: `Короткий привал — успеваем передохнуть, но в спешке срываем спину.`, weight: 15, effects: () => ({ healPercent: RF(0.01, 0.03) }), resourceCost: r[4], resourceText: `[${r[4]}] подкладываем под спину — отдых комфортный.`, noResourceText: `Без [${r[4]}] спим на земле — спина болит.`, resourceEffects: () => ({ healPercent: RF(0.02, 0.04) }), noResourceEffects: () => ({ damagePercent: RF(0.01, 0.02) }) },
      ],
    };
  }
  if (t === 'neutral') {
    const r = [0,1,2,3,4].map(() => nextResource());
    return {
      prompt: '',
      outcomes: [
        { text: `Приятное знакомство у ${zoneLabel}. Новый друг — ценный союзник.`, weight: 20, effects: (_, level) => ({ chips: C(level, 4), exp: E(level, 2) }), resourceCost: r[0], resourceText: `Угощаем друга [${r[0]}] — союзник делится припасами. Дружба x2.`, noResourceText: `Нечем угостить — [${r[0]}] нет. Друг без подарков.`, resourceEffects: (_, level) => ({ itemCount: 1, chips: C(level, 2) }), noResourceEffects: () => ({}) },
        { text: `Интересный собеседник делится ценной информацией о ${zoneLabel}.`, weight: 20, effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.04) }), resourceCost: r[1], resourceText: `Платим [${r[1]}] за информацию — данные подробнее и ценнее.`, noResourceText: `Без [${r[1]}] информация общая, без деталей.`, resourceEffects: (_, level) => ({ exp: E(level, 4), chips: C(level, 3) }), noResourceEffects: () => ({}) },
        { text: `Обмениваемся любезностями и подарками.`, weight: 20, effects: (_, level) => ({ chips: C(level, 5), itemCount: 1 }), resourceCost: r[2], resourceText: `Дарим [${r[2]}] — взаимный обмен щедрый. Подарки x2.`, noResourceText: `Без [${r[2]}] обмен скромный.`, resourceEffects: (_, level) => ({ chips: C(level, 3), itemCount: 1 }), noResourceEffects: () => ({}) },
        { text: `Незнакомец оказывается агрессивным. Приходится защищаться.`, weight: 20, effects: (_, level) => ({ damagePercent: RF(0.08, 0.12), chips: NC(level, 0) }), resourceCost: r[3], resourceText: `[${r[3]}] используем как щит — урон -50%.`, noResourceText: `Нет [${r[3]}] — урон полный.`, resourceEffects: () => ({ damagePercent: -RF(0.04, 0.06) }), noResourceEffects: () => ({ damagePercent: RF(0.04, 0.06) }) },
        { text: `Нейтральное общение — ни тепло, ни холодно.`, weight: 15, effects: (_, level) => ({ exp: E(level, 2) }), resourceCost: r[4], resourceText: `[${r[4]}] как тема разговора — стало интереснее. Бонус.`, noResourceText: `[${r[4]}] нет — разговор ни о чём.`, resourceEffects: (_, level) => ({ exp: E(level, 2), chips: C(level, 2) }), noResourceEffects: () => ({}) },
      ],
    };
  }
  return null;
};

export interface ExplorationEventResult {
  text: string;
  type: ExplorationEventType;
  effects: EventEffects;
  decision?: string;
  resourceCost?: string;
  resourceHad?: boolean;
}

// ---------------------------------------------------------------------------
// 1. COMBAT — 30 unique patrol/ambush templates (each uses {faction} + dynamic enemy name)
// ---------------------------------------------------------------------------
const combatTemplates: EventTemplate[] = [
  {
    text: `Из-за ржавых руин выходит патруль {faction}. Впереди — огромный детина. Он ухмыляется, поигрывая монтировкой. «Не повезло тебе, странник». Завязывается бой.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Тишину разрезает окрик: «Стоять!». Из тумана выступают трое вооружённых {faction}. Главный целится тебе в голову. Придётся пробиваться с боем.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `На пути — блокпост {faction}. За мешками с песком виднеется пулемёт. Часовой лениво поправляет ленту. Договориться не выйдет — только бой.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Грубый голос из темноты: «Живой товар!». Из засады вылетают {faction}. Главарь размахивает цепью. Бой неизбежен.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Лай собак и топот сапог. Отряд {faction} заметил тебя. Командир отдаёт приказ: «Взять его!». Они бегут прямо на тебя.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Из люка вылезает вооружённый {faction} с напарником. «Полезешь туда — пристрелю». Спорить бесполезно. Придётся драться за этот проход.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Засада! Двое {faction} укрылись за старой цистерной. Один даёт очередь поверх головы. Бой начинается мгновенно.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, exp: E(level, 4) }),
  },
  {
    text: `Патруль {faction} прочёсывает территорию. Заметив тебя, старший свистит — и вся группа разворачивается в твою сторону.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `«А ну стоять, мразь!» — рявкают из-за груды мусора. Рядом с окрикнувшим ещё пара {faction}. Они открывают огонь.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Ночной дозор {faction} обнаружил твой костёр. «Легкая добыча сама пришла», — слышен злобный шёпот. Вокруг смыкается кольцо.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, exp: E(level, 3) }),
  },
  {
    text: `Из зарослей вылетает граната! Ты падаешь на землю — взрыв поднимает комья грязи. Из дыма выбегают {faction} с дикими криками. Бой в ближке.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Тропу перегораживает завал из колючей проволоки и бочек. За ним — окоп {faction}. «Плати за проход или убирайся». Слово за слово — разговор переходит в перестрелку.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `В разрушенном доме слышны голоса {faction}. Ты пытаешься обойти — но натыкаешься на часового, который поднимает тревогу. Весь отряд высыпает на улицу.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Снайпер! Пуля срывает кусок стены в паре сантиметров от головы. Ты ныряешь за укрытие. {faction} явно не хотят, чтобы ты прошёл через их сектор.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `БТР с намалёванной эмблемой {faction} стоит поперёк дороги. Из люка высовывается пулемётчик. «Свои?» — «Нет». Башня начинает поворачиваться в твою сторону.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `«Кидай ствол!» — из подворотни выскакивают трое {faction}. У одного — обрез, у другого — арматура. Они окружают тебя. Бой в тесном пространстве.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Мост охраняется отрядом {faction}. Проход бесплатный, но досмотр — забирают часть припасов. Ты отказываешься — начинается перестрелка на мосту.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Из подземного коллектора доносится лязг затвора. «Кто там?». Ты не отвечаешь — и в тебя летит связка «лимонок». Едва успев отпрыгнуть, вступаешь в бой с вылезающими {faction}.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Радиорубка {faction}. Они передают координаты «цели» — тебя. Пока они говорят, ты врываешься внутрь. Трое радистов хватаются за оружие.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
  {
    text: `Засада на дороге. Растяжка из проволоки — ты спотыкаешься, гремит пустая жестянка. Из кювета встают {faction} и открывают огонь из самодельных автоматов.`,
    type: 'combat',
    effects: (_, level) => ({ combat: true, chips: C(level, 5) }),
  },
];

// ---------------------------------------------------------------------------
// 2. TRADE — merchants and traders (30 templates)
// ---------------------------------------------------------------------------
const tradeTemplates: EventTemplate[] = [
  {
    text: 'На обочине стоит потрёпанный фургон. Пожилой мужчина с трубкой раскладывает товар на капоте. «Заходи, странник, есть кое-что интересное». Он предлагает обменять припасы на чипы.',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 2) }),
  },
  {
    text: 'Торговец по имени {male} — здоровяк с татуировками на шее — развернул палатку прямо посреди дороги. «Пустошь нынче опасная, парень. Купи патронов — не прогадаешь». В знак сделки он даёт тебе пригоршню чипов.',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 1) }),
  },
  {
    text: 'Хрупкая девушка {female} сидит на перевёрнутом ящике. Перед ней разложены самодельные бинты и склянки с мутной жидкостью. «Медицина нужна? Недорого». Она отдаёт тебе часть своих запасов.',
    type: 'trade',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.10), chips: C(level, 2) }),
  },
  {
    text: 'Двое торговцев спорят о ценах на металл. Увидев тебя, один из них, бородач в промасленной куртке, манит рукой: «Помоги разобраться с товаром — получишь долю». Помогаешь разгрузить ящики и получаешь плату.',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1 }),
  },
  {
    text: 'Маленькая тележка, запряжённая худой лошадью. Торговка {female} кричит: «Свежие новости из Центрального сектора! И карты, и припасы!» Карты оказываются бесполезными, но припасы — настоящие.',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 4), itemCount: 1 }),
  },
  {
    text: 'Молчаливый мужчина в чёрном плаще сидит у костра. Рядом — открытый чемодан с инструментами: ключи, отвёртки, микросхемы. «Механика — наше всё», — бросает он. Он чинит твоё снаряжение за символическую плату.',
    type: 'trade',
    effects: (_, level) => ({ healPercent: RF(0.03, 0.08), chips: NC(level, 2) }),
  },
  {
    text: 'На дереве висит самодельная вывеска «Лавка дядюшки Грыма». Под ней — землянка, битком набитая хламом и сокровищами. Хозяин, сухой старик со стеклянным глазом, подзывает тебя: «Гляди, что есть!»',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1 }),
  },
  {
    text: 'Странник в рваном плаще предлагает обменять инфу на припасы. «К востоку отсюда — заброшенный склад боеприпасов. Но я туда не пойду. Возьми карту, может пригодится».',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 4), exp: E(level, 4) }),
  },
  {
    text: 'Цыганский табор расположился у высохшего русла. Женщина с бусами зовёт погадать на «чипы будущего». За горсть чипов она предсказывает тебе удачу (или просто кормит обедом).',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), healPercent: RF(0.03, 0.05) }),
  },
  {
    text: 'Скупщик металлолома копается в груде ржавых запчастей. «Есть что продать? Или купить? Всё найду!» Он находит для тебя кое-что ценное среди мусора и отдаёт почти задаром.',
    type: 'trade',
    effects: (_, level) => ({ itemCount: 1, chips: C(level, 2) }),
  },
  {
    text: 'Бородатый мужик в кожаной безрукавке торгует с рук: «Лучшие чипы данных! Прямо с серверов Старого Мира!». Чипы оказываются настоящими — ты пополняешь свой запас.',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 2) }),
  },
  {
    text: 'Девчонка лет четырнадцати бегает между торговцами с подносом пирожков. «Горячие! С тушёнкой!» Пирожки на удивление съедобные, и ты чувствуешь прилив сил.',
    type: 'trade',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.11), chips: NC(level, 2) }),
  },
  {
    text: 'Странствующий аптекарь. Он разложил на пледе пузырьки с яркими жидкостями: «Адреналин, антирад, боевой коктейль!». Покупаешь универсальный стимулятор.',
    type: 'trade',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.12), chips: NC(level, 2) }),
  },
  {
    text: 'Группа кочевников разбила юрты. Старейшина приглашает тебя на чай. Оказывается, они знают этот регион как свои пять пальцев. За рассказы ты получаешь ценные сведения и подарки.',
    type: 'trade',
    effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 4), healPercent: RF(0.03, 0.05) }),
  },
  {
    text: 'Боевой инженер на ходу чистит пулемёт. «Запчасти нужны? Есть родные, не китайские». Он выменивает у тебя старый хлам на несколько обойм патронов.',
    type: 'trade',
    effects: (_, level) => ({ itemCount: 1, chips: C(level, 4) }),
  },
  {
    text: 'Худой человек в грязном халате продаёт «лекарство от всех болезней». На пузырьке — этикетка «Радиация: 0% гарантии». Ты отказываешься, но он суёт тебе пузырёк бесплатно. Выбрасывать жалко — оставляешь.',
    type: 'trade',
    effects: () => ({ healPercent: RF(0.02, 0.04) }),
  },
  {
    text: 'Подозрительный тип в застёгнутом плаще шарит в багажнике мертвого сталкера. Выносить не выносит, но и не бросает. Выкидывает что-то отвлекающее и пропадает в руинах.',
    type: 'trade',
    effects: (_, level) => ({ itemCount: 2, chips: NC(level, 2) }),
  },
  {
    text: 'Девочка лет семи продаёт цветы, растущие среди обломков: «Настоящие! Поливаю каждый день!». Цветы маленькие, но живые. Символ надежды. Ты покупаешь букет и получаешь заряд бодрости.',
    type: 'trade',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.08), chips: NC(level, 0), exp: E(level, 2) }),
  },
  {
    text: 'Авторазборка. Мужик в мазуте копается в двигателе. «Можешь покопаться в той куче — 5 чипов за вход». Находишь редкую микросхему, продаёшь её тут же дороже.',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1 }),
  },
  {
    text: 'Боец {male} продаёт трофейное оружие, снятое с мёртвых врагов. «Этот ствол снял лично с полковника {faction}. Он им уже не пользуется». Торг уместен. Уходишь с покупкой и остатком чипов.',
    type: 'trade',
    effects: (_, level) => ({ itemCount: 1, chips: C(level, 3) }),
  },
];

// ---------------------------------------------------------------------------
// 3. STORY_HELP — good encounters (25 templates)
// ---------------------------------------------------------------------------
const helpTemplates: EventTemplate[] = [
  {
    text: 'На дороге сидит старик. Нога перевязана грязной тряпкой. «Сынок, помоги дойти до посёлка. Отблагодарю, чем смогу». Помогаешь ему дойти — в благодарность он отдаёт старый, но рабочий пистолет и горсть чипов.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3), itemCount: 1 }),
  },
  {
    text: 'Женщина с ребёнком на руках прячется в подвале разрушенного дома. «Муж ушёл за водой и не вернулся…» Ты делишься с ней припасами. В ответ она отдаёт тебе шкатулку с редкими микросхемами.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Молодой парень копается в двигателе старого грузовика. «Не заведётся, чтоб его!». Помогаешь ему починить — он в благодарность даёт тебе топливо и указывает безопасный путь через болота.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 4), exp: E(level, 3), healPercent: RF(0.03, 0.05) }),
  },
  {
    text: 'Маленький мальчик сидит на обочине и плачет. «Я потерялся…» Ты провожаешь его до ближайшего поселения. Родители в благодарность угощают тебя обедом и дают чипы.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.10), chips: C(level, 4), exp: E(level, 2) }),
  },
  {
    text: 'Пожилая пара пытается перетащить телегу через завал. Ты помогаешь расчистить путь. Женщина угощает тебя домашним хлебом (настоящим, не синтетическим!), а мужчина даёт несколько чипов.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.08), chips: C(level, 4) }),
  },
  {
    text: 'Раненый сталкер сидит у костра и пытается сам себе перевязать плечо. «Помоги, брат. Напоролся на арматуру в тёмном подвале». Ты помогаешь ему с перевязкой. Он даёт тебе флягу с водой и ценный совет.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.02, 0.04), exp: E(level, 4), chips: C(level, 3) }),
  },
  {
    text: 'Собака выбегает из кустов, поджав хвост. У неё — царапина и ошейник с запиской: «Приюти, кто может». Забираешь её с собой — она становится твоим компаньоном. В ошейнике припрятаны чипы.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3), healPercent: RF(0.02, 0.04) }),
  },
  {
    text: 'Юноша сидит на корточках у капкана, в который попался его друг. «Отцепи его, прошу!». Ты помогаешь освободить ногу парня. Спасённый достаёт из рюкзака банку тушёнки и несколько чипов.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.03, 0.06), chips: C(level, 4), exp: E(level, 3) }),
  },
  {
    text: 'Девушка в запылённой куртке чинит солнечную панель на крыше сарая. «Подай мне ключ на 10!» Работаешь с ней часом. Она даёт тебе запасную батарею и чипы за помощь.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Трое детей играют в «войнушку» возле сгоревшего бронетранспортёра. Они не видели чужаков с рождения. Ты даёшь им сладости и рассказываешь старую сказку. Их мать приглашает тебя на ужин и даёт припасы в дорогу.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.12), chips: C(level, 3), exp: E(level, 2) }),
  },
  {
    text: 'Из ямы кричит мужчина: «Помогите! Сорвался, ногу подвернул!». Ты спускаешь ему верёвку и вытаскиваешь. Он механик: в благодарность чинит одну из твоих вещей и делится чипами.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }),
  },
  {
    text: 'Бродячий кот трется о ноги. У него — ошейник с биркой «Рыжий, особь ценная». Кот ведёт тебя к заброшенному дому, где в подполе лежит ящик с инструментами и чипами.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1, exp: E(level, 3) }),
  },
  {
    text: 'Древняя старуха сидит на крыльце и плетёт сеть из проволоки и пластиковых лент. «Помоги натянуть, старая уже, сил нет». Помогаешь — она угощает травяным чаем и даёт оберег из костей птиц.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.10), exp: E(level, 3) }),
  },
  {
    text: 'Семья переселенцев остановилась у ручья. Отец чинит телегу, мать кормит детей. «Не подкинешь бензина? Своим кончился». Делишься топливом — они дают тебе старую карту местности с пометками тайников.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Двое сталкеров спорят, куда идти. Один говорит: «Налево — к базе, направо — к смерти». Второй: «Да пошёл ты!». Ты указываешь им безопасный путь. В благодарность делятся патронами.',
    type: 'story',
    effects: (_, level) => ({ itemCount: 1, chips: C(level, 4), exp: E(level, 3) }),
  },
  {
    text: 'Освобождаешь пленного, привязанного к столбу. «Спасибо, брат. Я инженер с Водоканала. Должен теперь тебе». Он даёт тебе жетон, по которому на его станции дадут бесплатный запас воды.',
    type: 'story',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Учитель в развалинах школы проводит урок для горстки детей. Он рассказывает о физике и истории. «Хочешь, посиди, послушай. Знания — сила». Полчаса лекции — и ты чувствуешь себя умнее.',
    type: 'story',
    effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.04) }),
  },
  {
    text: 'У монаха в оранжевой робе закончилась вода. Он медитирует под палящим солнцем. Ты даёшь ему флягу. «Будда хранит тебя, странник». Он дарит тебе чётки из обожжённой глины — они странно тёплые на ощупь.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.10), exp: E(level, 4) }),
  },
  {
    text: 'Слепой ветеран сидит у могильного креста. «Сын здесь лежит. Не уберёг…» Ты молча сидишь рядом. Ветеран достаёт флягу, наливает по сто грамм. Горькая, но крепкая встреча.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.02, 0.05), exp: E(level, 4), chips: C(level, 3) }),
  },
  {
    text: 'Молодая пара строит дом из обломков. «Не армия, не банда — просто хотим жить по-человечески». Они приглашают тебя помочь забить пару гвоздей. За работу кормят ужином и дают чипы.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.10), chips: C(level, 4), exp: E(level, 2) }),
  },
  {
    text: 'Гонец на велосипеде чуть не сбивает тебя. «Прости, брат, спешу! В посёлке эпидемия!». У него порвана цепь. Ты помогаешь починить — он мчится дальше, крикнув на прощание: «Проверь фильтр для воды, если есть!».',
    type: 'story',
    effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.04) }),
  },
  {
    text: 'Маленький щенок выбегает из кустов, весь в репьях. За ним никто не идёт. Ты даёшь ему галету — он лижет руку и бежит за тобой. Компаньон на ближайший час поднимает настроение.',
    type: 'story',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.08), exp: E(level, 2) }),
  },
];

// ---------------------------------------------------------------------------
// 4. STORY_TRAP — bad/deception encounters (25 templates)
// ---------------------------------------------------------------------------
const trapTemplates: EventTemplate[] = [
  {
    text: 'Мужчина с перевязанным глазом машет тебе: «Помоги, брат, друзей в засаде бросили!» Ведёт тебя прямиком в ловушку — трое бандитов встречают тебя дубинами. Еле отбиваешься и теряешь часть припасов.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.08, 0.15), chips: NC(level, 2) }),
  },
  {
    text: 'Девушка с заплаканным лицом просит воды. Ты протягиваешь флягу — она выбивает её у тебя из рук, и тут же из кустов выбегают её сообщники. «Шмонай его!» Потеряно часть чипов.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.04, 0.10), chips: NC(level, 2) }),
  },
  {
    text: 'Запах дыма и жареного мяса. За столом сидит компания, машет: «Садись, путник, угощайся!» Мясо оказывается отравленным. Ты теряешь сознание и просыпаешься без части вещей.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.10, 0.18), chips: NC(level, 2) }),
  },
  {
    text: 'Яркая тряпка на ветке — якобы указатель к «Бесплатному складу». Там — растяжка с гранатой. Чудом остаёшься жив, но контужен и зол.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.12, 0.25), chips: NC(level, 0) }),
  },
  {
    text: '«Эй, чувак, хочешь дешёвый ствол?» — парень в капюшоне достаёт пистолет. Пистолет — муляж, а пока ты смотришь, его подельник обчищает твой рюкзак.',
    type: 'danger',
    effects: (_, level) => ({ chips: NC(level, 2), damagePercent: RF(0.02, 0.05) }),
  },
  {
    text: 'Из темноты — крик о помощи. Ты бежишь на звук и проваливаешься в яму-ловушку, прикрытую ветками. На дне — старые кости и вонь. Выбираешься, но ранен и выпачкан в грязи.',
    type: 'danger',
    effects: () => ({ damagePercent: RF(0.06, 0.12) }),
  },
  {
    text: '«Меня зовут {male}, я бывший военный. Вступи в наш отряд — у нас еда, оружие, бабы!» В отряде оказывается секта каннибалов. С боем прорываешься наружу.',
    type: 'danger',
    effects: () => ({ damagePercent: RF(0.12, 0.22), combat: true }),
  },
  {
    text: 'Красивая женщина в чистой одежде стоит на пороге брошенного магазина. «Заходи, я одна, мне страшно». Внутри — ловушка: двое с ножами. Едва уносишь ноги.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.08, 0.14), chips: NC(level, 0) }),
  },
  {
    text: 'Странник предлагает сыграть в кости: «Удвою твои чипы, если выиграешь!» Кости краплёные. Проигрываешь всё, что поставил.',
    type: 'danger',
    effects: (_, level) => ({ chips: NC(level, 2), damagePercent: RF(0.01, 0.03) }),
  },
  {
    text: 'Дорогу перегородил «дорожный сборщик» — вооружённый тип с ржавым автоматом. «Плати за проход». Платишь, но в последний момент он пытается забрать всё. Отбиваешься, но чипы уже потеряны.',
    type: 'danger',
    effects: (_, level) => ({ chips: NC(level, 2), damagePercent: RF(0.04, 0.08) }),
  },
  {
    text: '«Помоги откопать колодец!» — кричит мужик из ямы. Ты наклоняешься — он хватает тебя за шкирку и стаскивает вниз. Под землёй — старая штольня. Выбираешься через затопленный тоннель.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.10, 0.18), exp: E(level, 4) }),
  },
  {
    text: 'Лже-сталкер продаёт тебе карту «сокровищ». Он ведёт тебя к муляжу, где вместо сундука — взрывпакет. Теряешь часть снаряжения.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.08, 0.15), chips: NC(level, 2) }),
  },
  {
    text: 'Женщина с ребёнком стоит на дороге, голосует. Ты останавливаешься — «ребёнок» оказывается муляжом, а из кустов выбегают грабители. «Кошелёк или жизнь!» Отбиваешься с трудом.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.06, 0.12), chips: NC(level, 2) }),
  },
  {
    text: 'Странный аппарат посреди дороги — «автомат желаний». Надпись: «Брось 10 чипов и загадай». Бросаешь — аппарат выплёвывает ржавую банку с газом. Газ едкий, глаза слезятся.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), chips: NC(level, 2) }),
  },
  {
    text: 'Шериф самопровозглашённый на въезде в посёлок: «Пошлина на вход — 20 чипов с рыла». Платишь — он пропускает. В посёлке ни души — это ловушка. Из домов выходят люди с оружием.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.08, 0.15), chips: NC(level, 2) }),
  },
  {
    text: '«Сыграем на интерес?» — предлагает парень в дорогой куртке. Он вытаскивает колоду карт. Карты меченые — ты проигрываешь все чипы, что были в кармане.',
    type: 'danger',
    effects: (_, level) => ({ chips: NC(level, 2) }),
  },
  {
    text: 'Девушка в рваной одежде просит убежища на ночь. Ты соглашаешься — ночью она пытается перерезать твой рюкзак. Бдительность спасает, но в борьбе получаешь удар ножом.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.10, 0.18), chips: NC(level, 0) }),
  },
  {
    text: '«Помоги выбраться!» — человек наполовину влез в узкую трубу и застрял. Ты тянешь его — он оказывается легче пера, но из трубы вылетает рой мутировавших насекомых. Кусают больно.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.06, 0.12), exp: E(level, 3) }),
  },
  {
    text: 'Привал у красивого озера. Вода прозрачная — слишком прозрачная. Со дна поднимаются пузыри. Вода начинает кипеть — озеро радиоактивное. Получаешь ожоги, быстро ретируясь.',
    type: 'danger',
    effects: () => ({ damagePercent: RF(0.08, 0.14) }),
  },
  {
    text: 'Двое играют в «русскую рулетку» с трёхзарядным револьвером. Пьяный хохот. «А вот и третий! Садись, не бойся!» Отказываешься — они обижаются и открывают стрельбу.',
    type: 'danger',
    effects: () => ({ damagePercent: RF(0.06, 0.10), combat: true }),
  },
  {
    text: '«Место силы» — табличка у дерева. Под деревом — «жертвенный алтарь» с запиской: «Оставь дань, получишь удачу». Оставляешь чипы — ничего не происходит. Чипы пропали.',
    type: 'danger',
    effects: (_, level) => ({ chips: NC(level, 2), exp: E(level, 2) }),
  },
  {
    text: 'Пьяный водитель на древнем мотоцикле чуть не сбивает тебя. Он слезает и начинает агрессивно выяснять отношения. За его спиной появляются трое друзей.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.06, 0.12), chips: NC(level, 2) }),
  },
  {
    text: 'В заброшенном доме слышен детский плач. Ты заходишь — и дверь захлопывается. Ловушка: дом подготовлен для отлова «живого товара» работорговцами. Пробиваешь стену и сбегаешь.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.10, 0.18), exp: E(level, 4) }),
  },
];

// ---------------------------------------------------------------------------
// 5. LOOT — finding resources and items (25 templates)
// ---------------------------------------------------------------------------
const lootTemplates: EventTemplate[] = [
  {
    text: 'Среди мусора замечаешь блеск. Под ржавым листом железа — аккуратно сложенные предметы. Кто-то явно прятал это на чёрный день.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 3), chips: C(level, 4) }),
  },
  {
    text: 'Брошенная машина скорой помощи. Внутри — медицинские шкафчики. Часть разграблена, но в одном ящике находишь бинты и препараты.',
    type: 'loot',
    effects: () => ({ healPercent: RF(0.05, 0.12), itemCount: 1 }),
  },
  {
    text: 'Старый рюкзак висит на ветке. Хозяин не вернулся. Внутри — запаянный контейнер с продовольствием и карта местности с пометками.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 2), chips: C(level, 5), exp: E(level, 3) }),
  },
  {
    text: 'Разбитый дрон лежит в овраге. Его аккумулятор ещё цел. Рядом валяются микросхемы и несколько чипов памяти.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1 }),
  },
  {
    text: 'Высохшее русло ручья. На песке — человеческие кости и полуистлевший мешок. Внутри — коробка с инструментами и несколько старых монет (предметы старины ценятся у коллекционеров).',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 2), chips: C(level, 5) }),
  },
  {
    text: 'Бункер с сорванной дверью. Внутри — пустые стеллажи, но в углу, под грудой тряпья, находишь маленький сейф. В сейфе — чипы данных.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Упавший транспортный вертолёт. Обшивка прогорела, но грузовой отсек уцелел. Военные ящики раскрыты, но в одном находишь нераспечатанный контейнер с боеприпасами.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(2, 4), chips: C(level, 3) }),
  },
  {
    text: 'Старый торговый автомат, перекошенный набок. Пара монет внутри — и он выдаёт банку газировки, пролежавшую там лет двадцать. На удивление, пить можно.',
    type: 'loot',
    effects: (_, level) => ({ healPercent: RF(0.03, 0.05), chips: C(level, 3) }),
  },
  {
    text: 'Мастерская оружейника. Хозяин давно мёртв, инструменты проржавели, но в тайнике под верстаком лежат запчасти для оружия и патроны.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 3), chips: C(level, 4) }),
  },
  {
    text: 'Среди камней — свежий схрон. Кто-то оставил припасы и записку: «Если ты это читаешь — я уже мёртв. Забирай, пригодится».',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 2), chips: C(level, 5) }),
  },
  {
    text: 'Упавший квадрокоптер с камерой. Карта памяти цела. На ней — координаты трёх тайников. Продаёшь данные торговцу информацией.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Ржавый автобус лежит на боку. В багажном отсеке — чемодан с одеждой и личные вещи. В подкладке пиджака зашита пачка чипов.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1 }),
  },
  {
    text: 'На спутниковой тарелке висит рюкзак десантника. Внутри — НЗ, аптечка, карта с координатами эвакуационного дроп-пойнта. Картой можно торговать.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 2), chips: C(level, 5), exp: E(level, 3) }),
  },
  {
    text: 'Контейнер, сброшенный с дрона-снабженца. Частично разбит, но внутри — вакуумные упаковки с армейским пайком и сухой паёк.',
    type: 'loot',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.12), itemCount: 1, chips: C(level, 3) }),
  },
  {
    text: 'Рыболовная сеть, застрявшая в корягах. В ней — дохлая рыба и мусор, но среди грязи блестит металл: старый нож и несколько монет.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: 1, chips: C(level, 5) }),
  },
  {
    text: 'Стенд с инструментами на автозаправке. Большая часть украдена, но на верхней полке лежит забытый набор отвёрток и мультиметр. Хозяевам уже не пригодятся.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 2), exp: E(level, 3) }),
  },
  {
    text: 'Брошенный военный УАЗик. Колеса спущены, аккумулятор мёртв, но в бардачке — карта местности и кобура с пистолетом. Револьвер старого образца, но стреляет.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: 2, chips: C(level, 5) }),
  },
  {
    text: 'Труп сталкера в странной позе. Рядом — пустая фляга и дневник. В дневнике — записи о «пятом измерении» и код от сейфа в его убежище. Координаты убежища указаны.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: 1 }),
  },
  {
    text: 'Логово браконьеров. Временное, судя по всему — брошено в спешке. В ящике — разделанная туша кабана и мешок с травами. Мясо можно приготовить, травы целебные.',
    type: 'loot',
    effects: () => ({ healPercent: RF(0.08, 0.14), itemCount: 1 }),
  },
  {
    text: 'Почтовый вагон, сошедший с рельсов. Горы полуистлевших писем и посылок. В одной посылке — {item}, упакованные в пузырчатую плёнку. Целы и невредимы.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 3), chips: C(level, 4), exp: E(level, 2) }),
  },
  {
    text: 'Сейф в полу разрушенного банка. Дверца снесена взрывом, внутри пусто. Но в щели застрела монета — редкая, коллекционная. У нумизматов пойдёт за чипы.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 2) }),
  },
];

// ---------------------------------------------------------------------------
// 6. ENV_DISCOVERY — finding places (25 templates)
// ---------------------------------------------------------------------------
const discoveryTemplates: EventTemplate[] = [
  {
    text: 'Сквозь листву виднеются руины старой церкви. Купол обрушился, но стены ещё крепки. Внутри — алтарь с позеленевшими подсвечниками и тишина. В подвале — склад припасов.',
    type: 'discovery',
    effects: (_, level) => ({ itemCount: RANGE(1, 2), chips: C(level, 5), healPercent: RF(0.03, 0.05) }),
  },
  {
    text: 'Подземный гараж на два уровня. Машины сгнили, но в мастерской — полный набор инструментов и несколько канистр с топливом.',
    type: 'discovery',
    effects: (_, level) => ({ itemCount: RANGE(2, 4), exp: E(level, 3) }),
  },
  {
    text: 'Тёплая пещера с подземным озером. Вода чистая и прозрачная. На берегу — следы стоянки: остатки костра и забытая фляга. Отличное место для привала.',
    type: 'discovery',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.14), exp: E(level, 2) }),
  },
  {
    text: 'Поляна, усыпанная дикими ягодами. Среди кустов — одичавшие пчёлы. Мёд в дупле дерева. Собираешь ягоды и мёд — вкусно и питательно.',
    type: 'discovery',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.10), exp: E(level, 1) }),
  },
  {
    text: 'Маленькая библиотека в подвале жилого дома. Книги отсырели, но часть уцелела. Находишь дневник инженера — в нём схемы и пароли от старого терминала.',
    type: 'discovery',
    effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 5) }),
  },
  {
    text: 'Водонапорная башня. Наверху — гнездо птиц и отличный обзор на километры вокруг. Ты замечаешь вдалеке столб дыма — возможно, там люди. Записываешь координаты.',
    type: 'discovery',
    effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.04) }),
  },
  {
    text: 'Старое кладбище. Могилы разрыты мародёрами, но одна семейная усыпальница уцелела. Внутри — пустые гробы и забытая шкатулка с драгоценностями.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }),
  },
  {
    text: 'Подземный переход, затопленный на треть. Вода тёплая — где-то рядом прорыв теплотрассы. На стенах — детские рисунки, на полу — брошенные игрушки. Горькое напоминание о прошлой жизни.',
    type: 'discovery',
    effects: (_, level) => ({ exp: E(level, 3), chips: C(level, 2) }),
  },
  {
    text: 'Шахта лифта, ведущая вниз на пять этажей. Спускаешься по тросам. Внизу — подземный торговый центр. Большая часть разграблена, но в ювелирном бутике находишь уцелевший сейф.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1, exp: E(level, 3) }),
  },
  {
    text: 'Теплица с разбитой крышей. Внутри — буйная растительность. Среди сорняков — кусты помидоров и огурцов, одичавших, но плодоносящих. Собираешь урожай.',
    type: 'discovery',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.12), exp: E(level, 2) }),
  },
  {
    text: 'Старый заправочный комплекс. Резервуары пусты, но под полом — аварийный запас: канистра с бензином и масло для двигателя. Ценная находка.',
    type: 'discovery',
    effects: (_, level) => ({ itemCount: 2, chips: C(level, 5) }),
  },
  {
    text: 'Радиовышка. Забираешься на самый верх. Оттуда видно весь регион. В кабине — работающая рация. Ты выходишь на связь с неизвестным, который даёт тебе наводку на ценный трофей.',
    type: 'discovery',
    effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 4) }),
  },
  {
    text: 'Подземный командный бункер. Дверь герметичная, система жизнеобеспечения работает. Внутри — запасы консервов, воды и оружия. Кто-то подготовился к концу света основательно.',
    type: 'discovery',
    effects: (_, level) => ({ itemCount: RANGE(2, 4), chips: C(level, 5), healPercent: RF(0.05, 0.10) }),
  },
  {
    text: 'Лаборатория генной инженерии. Пробирки разбиты, образцы уничтожены. Но в морозильной камере уцелела партия сыворотки «Р-7». Надпись: «Усилитель регенерации».',
    type: 'discovery',
    effects: (_, level) => ({ healPercent: RF(0.10, 0.20), exp: E(level, 4) }),
  },
  {
    text: 'Верёвочный мост через ущелье. Доски прогнили, но переправа возможна. На той стороне — сторожка лесника, полная припасов и книг. Живописное место для отдыха.',
    type: 'discovery',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.12), exp: E(level, 4), itemCount: 1 }),
  },
  {
    text: 'Затопленный карьер. На дне виднеются очертания грузовика. Вода чистая, но холодная. Ныряешь — в кабине труп водителя и ящик с боеприпасами. Забираешь, сколько можешь унести.',
    type: 'discovery',
    effects: (_, level) => ({ itemCount: RANGE(2, 3), chips: C(level, 5) }),
  },
  {
    text: 'Старый аквапарк. Горки разрушены, бассейны высохли и покрылись трещинами. В административном здании — склад детских игрушек и автоматов с призами. В одном автомате застряла монетка — выбиваешь её.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }),
  },
  {
    text: 'Заброшенная тюрьма. Решётки проржавели, камеры пусты. В камере смертников на стене — надпись кровью: «Они придут за вами». И координаты схрона под полом.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Солнечная электростанция. Панели покрыты пылью, но некоторые целы. Подключаешь аккумулятор и заряжаешь свои гаджеты. Заодно находишь брошенный инвертор.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1, exp: E(level, 3) }),
  },
  {
    text: 'Винный погреб ресторана. Температура идеальная. Бутылки покрыты плесенью, но запечатаны. Настоящее коллекционное вино — торговцы дадут за него хорошие чипы.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5) }),
  },
  {
    text: 'Метеоритный кратер. В центре — обломок космического камня с вкраплениями неизвестного металла. Тяжёлый, но явно ценный. Тащишь с собой часть образца.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
];

// ---------------------------------------------------------------------------
// 7. ENV_ANOMALY — anomalies and hazards (15 templates)
// ---------------------------------------------------------------------------
const anomalyTemplates: EventTemplate[] = [
  {
    text: 'Волосы встают дыбом, воздух потрескивает. Аномалия «Электра» — сгусток атмосферного электричества. Она притягивает металл. Бросаешь болт — разряд бьёт в землю. Огибаешь опасное место, но получаешь небольшую дозу облучения.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.05, 0.10), exp: E(level, 3) }),
  },
  {
    text: 'Земля под ногами начинает пульсировать. «Жижа» — аномалия, превращающая почву в зыбучий кисель. Проваливаешься по пояс, с трудом выбираешься. Обувь безнадёжно испорчена.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.06, 0.12), chips: NC(level, 0) }),
  },
  {
    text: 'Температура резко падает. Из ниоткуда появляется морозная дымка. «Ледяное дыхание». Кожу щиплет, дыхание сбивается. Находишь убежище и отогреваешься у костра.',
    type: 'danger',
        effects: () => ({ damagePercent: RF(0.04, 0.08) }),
  },


  {
    text: 'Гравитационная аномалия. Камни вокруг левитируют. В центре — спрессованный ком земли размером с дом. Бросаешь гайку — она с ускорением улетает в эпицентр. Лучше держаться подальше.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.02, 0.05), exp: E(level, 4) }),
  },
  {
    text: 'Запах озона и гари. Воздух дрожит — «Жар-птица». Вспышки пламени вылетают из ниоткуда и исчезают. Одна прожигает твой рюкзак. Быстро уходишь из зоны.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.08, 0.14), chips: NC(level, 2) }),
  },
  {
    text: 'Тишина, какой не бывает в природе. Ни звука, ни ветра, ни насекомых. «Мёртвая петля» — поле абсолютной тишины. Психика давит — с трудом пересиливаешь панику.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), exp: E(level, 4) }),
  },
  {
    text: 'Из земли торчат трубы, из которых сочится маслянистая жидкость. Она светится в темноте. Один вдох — и начинает кружиться голова. Надеваешь респиратор и обходишь.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.06, 0.10), chips: C(level, 3) }),
  },
  {
    text: 'Песок под ногами странно тёплый. Рыхлый грунт проваливается — ты скатываешься в овраг, на дне которого горячий источник. Получаешь ожоги, но источник целебный.',
    type: 'danger',
    effects: () => ({ damagePercent: RF(0.04, 0.08), healPercent: RF(0.05, 0.10) }),
  },
  {
    text: 'Гул, от которого вибрируют зубы. Из земли торчит странная конструкция — «Колокол». Он издаёт инфразвук. Внутри всё переворачивается. Быстро ретируешься, но тошнота остаётся.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.05, 0.09), exp: E(level, 4) }),
  },
  {
    text: 'Радужная плёнка на луже. Вода переливается всеми цветами. Красиво, но смертельно — «Радуга», химическая аномалия. Один вдох испарений — и кашель с кровью. Надеваешь респиратор и обходишь.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.06, 0.11), exp: E(level, 3) }),
  },
  {
    text: 'Пространство искажается — «Кривое зеркало». Деревья кажутся ближе, камни — дальше. Компас сходит с ума. Бредёшь вслепую полчаса, пока не выходишь из зоны. Сильно устаёшь.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), exp: E(level, 4) }),
  },
  {
    text: 'Из глухой бетонной стены торчит рука. Она шевелится. «Помоги…». Рука принадлежит мутанту, замурованному в стену. Он просит воды и еды. Ты бросаешь ему банку консервов — он хватает и затихает. Жутко.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.02, 0.05), exp: E(level, 4) }),
  },
];

// ---------------------------------------------------------------------------
// 8. NPC — character encounters (25 templates)
// ---------------------------------------------------------------------------
const npcTemplates: EventTemplate[] = [
  {
    text: 'Старик {male} сидит на перевёрнутом ведре и курит трубку. «Видал я всякое, сынок. Вот, гляди, что нашёл в старом тоннеле». Он показывает тебе странный артефакт, излучающий тусклый свет. Артефакт тёплый и вроде бы неопасный.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Женщина {female} в военной форме без знаков различия марширует вдоль дороги. Она не разговаривает, только жестикулирует. Кажется, контузия. Ты оставляешь ей немного еды.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 2), healPercent: RF(0.03, 0.05) }),
  },
  {
    text: 'Монах в тёмной рясе идёт босиком по камням. «Испытание плоти очищает душу, сын мой». Он благословляет тебя и даёт нательный крест, сплетённый из проволоки.',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.10), exp: E(level, 4) }),
  },
  {
    text: 'Художник рисует углём на стене разрушенного дома. Пустоши, люди, монстры — его полотна пугают и завораживают. «Красота в разрушении», — шепчет он. Дарит тебе один рисунок.',
    type: 'neutral',
    effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 3) }),
  },
  {
    text: 'Пьяный в стельку мужик валяется у входа в бар (заведение работает вопреки всему). «Заходи, там {male} угощает!» В баре играет музыка на грязной пластинке. Местные делятся историями и чипами.',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.06), chips: C(level, 4), exp: E(level, 3) }),
  },
  {
    text: 'Сапёр с металлоискателем копается на пустыре. «Тут мины?» — «Были. Теперь — цветной металл». Он даёт тебе пару найденных безделушек и совет обходить овраги.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }),
  },
  {
    text: 'Девушка {female} сидит на крыше броневика и играет на губной гармошке. Мелодия грустная, но красивая. Она заканчивает, улыбается и кидает тебе яблоко — «сладкое, как до войны».',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.07), exp: E(level, 2) }),
  },
  {
    text: 'Мальчишки стреляют из самодельных луков по консервным банкам. Меткий стрелок, мелкий сорванец, вызывается провести тебя через опасный участок за пару чипов. Он знает каждую тропинку.',
    type: 'neutral',
    effects: (_, level) => ({ chips: NC(level, 0), exp: E(level, 4) }),
  },
  {
    text: 'Группа людей в противогазах копает огород на бывшей бензоколонке. «Земля ещё родит, если удобрять пеплом». Они делятся с тобой репой и морковью — странными, но съедобными.',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.08), exp: E(level, 2) }),
  },
  {
    text: 'Слепой старец сидит с табличкой: «Подайте на пропитание бывшему программисту». В плошке — несколько чипов. Ты добавляешь чипов. Он шепчет: «Когда-нибудь интернет восстановят...».',
    type: 'neutral',
    effects: (_, level) => ({ chips: NC(level, 2), exp: E(level, 4) }),
  },
  {
    text: 'Сумасшедший учёный в белом халате выбегает из полуразрушенной лаборатории. «Синтезировал новый изотоп! Смотри!» Пробирка шипит, ничего не взрывается. Он даёт тебе батарейку с «вечным зарядом».',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Двое парней толкают телегу с аккумулятором. «Сдохла тачка за поворотом. Одолжишь рывок?» Помогаешь завести их грузовик. Шофёр кидает тебе ящик с консервами и машет рукой.',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.03, 0.06), chips: C(level, 3) }),
  },
  {
    text: 'Старая женщина развешивает бельё во дворе многоэтажки. «Выжили как-то, — говорит она. — Вода есть, электричество от генератора». Она приглашает тебя на чай из трав. Отдыхаешь и набираешься сил.',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.12), exp: E(level, 3) }),
  },
  {
    text: 'Парень на самодельном электроскутере обгоняет тебя. «Эй, брат, не видал заправку? Аккумулятор садится!». У тебя есть запасной — отдаёшь. В ответ он даёт наводку на клад под мостом.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }),
  },
  {
    text: 'Труп в военной форме сидит в кабине грузовика. В руке — фотография женщины и детей. Забираешь медальон, чтобы передать родственникам, если найдутся. Чипы найдутся в бардачке.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Курьер с перевязанной рукой бежит с пакетом. «Срочно! Доставить в госпиталь на северной окраине!» Несёшь пакет — в нём лекарства. За успешную доставку получаешь премию.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Мужик с бородой сидит на бревне и играет на электрогитаре. Звук идёт через портативную колонку. Поёт блюз про конец света. Ты кидаешь несколько чипов в чехол. Он кивает — «Спасибо, бро».',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.03, 0.06), chips: NC(level, 0) }),
  },
  {
    text: 'Группа туристов (туристов! в этом аду!) фотографирует руины. Они из Внутреннего Кольца: чистая одежда, дорогое снаряжение. «О, местный! Сфоткай нас на фоне того остова!». Платят чипами за услугу.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 1) }),
  },
  {
    text: 'Эвакуатор тащит ржавую легковушку. Водитель предлагает подбросить до развилки за пару чипов. Едешь с ветерком, болтаешь о жизни. Высаживает у заправки, где можно разжиться припасами.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 3), exp: E(level, 3), healPercent: RF(0.02, 0.04) }),
  },
  {
    text: 'Молчаливый копатель долбит мёрзлую землю. Ищет цветной металл. Находит старый телефон. Экран разбит, но SIM-карта цела. «На память о прошлом», — дарит тебе.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 4), exp: E(level, 3) }),
  },
  {
    text: 'Боевой вертолёт пролетает на низкой высоте. Ты ложишься на землю — он делает круг и улетает. В десантном отсеке что-то выпало — ящик с сухпайком и бинтами.',
    type: 'neutral',
    effects: () => ({ healPercent: RF(0.04, 0.08), itemCount: 1 }),
  },
  {
    text: 'Индюк перебегает дорогу. За ним бежит фермер с ружьём. «Помоги поймать, ужин убегает!». Загоняете птицу вдвоём. Фермер приглашает к столу — свежая индейка, печёная картошка, компот.',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.09, 0.16), exp: E(level, 3) }),
  },
];

// ---------------------------------------------------------------------------
// 9. REST — camp/shelter finds (15 templates)
// ---------------------------------------------------------------------------
const restTemplates: EventTemplate[] = [
  {
    text: 'Живописная поляна у ручья. Вода прозрачная и холодная. Разбиваешь лагерь, моешься, стираешь вещи. Восстанавливаешь силы за вечер у костра.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.08, 0.16), exp: E(level, 2) }),
  },
  {
    text: 'Охотничий домик. Внутри — печка, топчан, банка круп и соль. Кто-то поддерживает это место для таких же скитальцев. Топишь печь, варишь кашу. Силы возвращаются.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.14), exp: E(level, 3) }),
  },
  {
    text: 'Пещера с наскальными рисунками. Древние люди жили здесь тысячи лет назад. Странное чувство единения с прошлым. Ночь проходит спокойно.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.11), exp: E(level, 4) }),
  },
  {
    text: 'Брошенная церковь. Крыша местами провалилась, но алтарная часть сухая. Зажигаешь свечу (нашёл в ящике). Тишина и покой успокаивают израненную душу.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.06, 0.12), exp: E(level, 4) }),
  },
  {
    text: 'Тёплый чердак жилого дома. На чердаке сухо, есть старый матрас и ящик с книгами. Читаешь закат, забываясь от реальности. Утром чувствуешь себя отдохнувшим.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.10), exp: E(level, 3) }),
  },
  {
    text: 'Остановка общественного транспорта. Скамейка уцелела, есть навес от дождя. Рядом — работающий автомат с водой (кто-то его обслуживает). Ночь проходит спокойно.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.09), exp: E(level, 1) }),
  },
  {
    text: 'Старый фургон на обочине. Дверца открыта, внутри — спальник и газовая горелка. Кто-то явно живёт здесь время от времени. Оставляешь записку с благодарностью и используешь приют.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.08, 0.14), exp: E(level, 2) }),
  },
  {
    text: 'Баня! Настоящая русская баня посреди пустоши. Топит её дед Матвей. «Заходи, попарься, грех не воспользоваться!» Паришься веником, ныряешь в ледяную реку. Выходишь заново рождённым.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.12, 0.24), exp: E(level, 4) }),
  },
  {
    text: 'Геотермальный источник. Вода горячая, пар поднимается клубами. Вокруг — дикий виноград и ежевика. Идеальное место для отдыха. Лежишь в тёплой воде, глядя на звёзды.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.10, 0.18), exp: E(level, 3) }),
  },
  {
    text: 'Старый кинотеатр. Уцелел проектор и пара бобин с плёнкой. Крутишь старый советский фильм про войну. Смотришь в одиночестве, жуя галеты. Диковинное чувство — киносеанс в пустоши.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.04, 0.08), exp: E(level, 4) }),
  },
  {
    text: 'Палаточный лагерь Красного Креста. Волонтёры раздают еду и медикаменты. Бесплатно. «Человек человеку — друг, не забывай». Получаешь порцию каши, бинты и пару чипов на дорогу.',
    type: 'heal',
    effects: (_, level) => ({ healPercent: RF(0.08, 0.14), itemCount: 1, exp: E(level, 3) }),
  },
];

// ---------------------------------------------------------------------------
// 11. SPECIAL — rare unique events (20 templates)
// ---------------------------------------------------------------------------
const specialTemplates: EventTemplate[] = [
  {
    text: 'Из тумана выходит фигура в длинном плаще. Лица не видно — только два зелёных огонька. «Ты ищешь. Я знаю. Ступай за мной». Фигура ведёт к тайнику с редчайшим артефактом и исчезает.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: 2 }),
  },
  {
    text: 'Огненный шар падает с неба в нескольких километрах. Через час добираешься до места падения — обломки спутника. В одном блоке уцелела память с ценными данными.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: 1 }),
  },
  {
    text: 'Подземный город! Целый этаж торгового центра уцелел: стеклянный купол, деревья в кадках, фонтан (не работает). Люди живут здесь уже десять лет. Тебя встречают хлебом-солью. Отдых и торговля.',
    type: 'discovery',
    effects: (_, level) => ({ healPercent: RF(0.12, 0.24), chips: C(level, 5), exp: E(level, 4), itemCount: 2 }),
  },
  {
    text: '«Бешеный» медведь-мутант выходит на поляну. Он встаёт на дыбы — три метра ростом. Сердце уходит в пятки. Медведь фыркает, разворачивается и уходит. Ты остаёшься стоять, не дыша. Удача.',
    type: 'neutral',
    effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 4) }),
  },
  {
    text: 'НЛО? В небе зависает светящийся треугольник. Он парит минуту, затем исчезает со сверхзвуковым хлопком. На месте зависания трава выжжена правильным кругом. В центре — странный кристалл.',
    type: 'discovery',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: 1 }),
  },
  {
    text: 'Ты находишь работающий терминал Старого Мира. На экране — просьба о помощи десятилетней давности. И код доступа к банковской ячейке. Сняв чипы со счёта, чувствуешь себя хакером из будущего.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Боевой дрон активируется у тебя над головой. «Цель идентифицирована. Сканирование… Ошибка. Цель — гражданский. Миссия отменена». Дрон падает к ногам — у него сел аккумулятор. Забираешь его на запчасти.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: 2, chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Зеркальный пруд: гладь воды абсолютно неподвижна, как стекло. В отражении ты видишь не себя, а свою версию из «хорошего» мира — чистого, сытого, безоружного. Смотришь долго. Выходишь задумчивым.',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.05, 0.10), exp: E(level, 4) }),
  },
  {
    text: 'Радиоактивный дождь начинается внезапно. Ты укрываешься в машине. Капли стучат по крыше, счётчик Гейгера зашкаливает. Дождь проходит через час. Выйдя, находишь на земле светящиеся капли — «звёздная пыль».',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.08, 0.14), chips: C(level, 5) }),
  },
  {
    text: 'На перекрёстке стоит указатель. Но на табличках — не названия городов, а имена людей и даты. «Артём — 2034», «Мария — 2037». Кто-то помнит погибших. Ты добавляешь своё имя? Добавляешь отпечаток пальца.',
    type: 'neutral',
    effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.04) }),
  },
  {
    text: 'Слышишь детский смех. Он доносится из разрушенного парка аттракционов. Карусель крутится сама по себе, хотя электричества нет. На карусели — куклы. Волосы шевелятся. Уходишь быстрым шагом.',
    type: 'danger',
    effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), exp: E(level, 4) }),
  },
  {
    text: 'Из-под обломков доносится стук. Ты разбираешь завал и находишь… сейф с детскими рисунками и свадебным альбомом. И пачку чипов. Чья-то память и сбережения.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'В ночном небе — северное сияние. Яркое, зелёное, пульсирующее. В пустоши это редкость. Ты сидишь на камне и смотришь в небо. В такие моменты понимаешь, что жизнь продолжается.',
    type: 'neutral',
    effects: (_, level) => ({ healPercent: RF(0.08, 0.14), exp: E(level, 4) }),
  },
  {
    text: 'На дороге стоит чёрный кот. Он смотрит на тебя, не моргая. Ты обходишь его стороной — и через минуту слышишь за спиной взрыв. Там, где ты должен был пройти, взорвался газовый баллон.',
    type: 'neutral',
    effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 4), healPercent: RF(0.03, 0.05) }),
  },
  {
    text: 'Страус бежит по пустоши. За ним — стая собак. Страус отбивается ногами и улетает (да, страусы не летают, но этот летит). Очередное безумие мутировавшего мира.',
    type: 'neutral',
    effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.04) }),
  },
  {
    text: 'Колодец желаний. В нём видно дно, усеянное монетами. Ты бросаешь чип — и слышишь эхо, не похожее на обычное. Чип звякает… или это звякнуло где-то в другом мире?',
    type: 'neutral',
    effects: (_, level) => ({ chips: NC(level, 0), exp: E(level, 4), healPercent: RF(0.04, 0.08) }),
  },
];

// ---------------------------------------------------------------------------
// 10. FACTION_EVENT — faction-specific encounters (15 templates)
// ---------------------------------------------------------------------------
const factionSpecific: EventTemplate[] = [
  {
    text: 'Отряд {faction} проводит учения на окраине. Они принимают тебя за своего (издалека не разобрать). Командир машет рукой: «Не отставай!». Ты быстро ретируешься, пока не заметили.',
    type: 'neutral',
    effects: (_, level) => ({ exp: E(level, 3), chips: C(level, 3) }),
  },
  {
    text: 'Лагерь {faction} разбит в старом ангаре. Часовые играют в карты у входа. Пробираешься мимо незаметно. В пристройке находишь забытый рюкзак с припасами.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 2), chips: C(level, 5) }),
  },
  {
    text: 'Двое {faction} не поделили добычу и устроили драку. Пока они выясняют отношения, ты проскальзываешь мимо. Один из них роняет кошелёк с чипами. Подбираешь.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 2) }),
  },
  {
    text: 'Патруль {faction} прочёсывает местность в поисках «шпиона». Ты прячешься в старой цистерне. Сидишь тихо два часа. После ухода находишь оставленный ими ящик с инструментами.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: RANGE(1, 3), exp: E(level, 4) }),
  },
  {
    text: 'Казнь в лагере {faction}. К столбу привязан перебежчик. Тебе нечем помочь. Ты уходишь, но находишь в кустай вещмешок казнённого — припасы и письма семье.',
    type: 'neutral',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: 'Мародеры в форме {faction} обыскивают трупы на поле боя. Подходишь ближе — они принимают тебя за своего. «Обыщи тех двоих, быстро!» Ты делаешь вид, но забираешь ценное и уходишь.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), itemCount: 1, exp: E(level, 3) }),
  },
  {
    text: 'Представители {faction} вербуют рекрутов в ближайшем поселении. «Вступай — паёк, патроны, крыша над головой!» Ты отказываешься — они пожимают плечами: «Дело твоё». Один суёт тебе листовку «на подумать».',
    type: 'neutral',
    effects: (_, level) => ({ exp: E(level, 3), chips: C(level, 3) }),
  },
  {
    text: 'Радиоперехват: {faction} вызывают подкрепление. «На секторе 7 — одиночка. Похож на сталкера. Возьмите живым». Похоже, говорят о тебе. Ускоряешь шаг.',
    type: 'neutral',
    effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 2) }),
  },
  {
    text: 'Техника {faction} застряла в болоте. Водитель матерится и пытается вытащить грузовик лебёдкой. «Помоги — заплачу». Помогаешь толкать. Он даёт чипы и банку тушёнки.',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), healPercent: RF(0.03, 0.05) }),
  },
  {
    text: 'Пленный {faction} сидит в яме со связанными руками. «Вытащи — отблагодарю». Вытаскиваешь — он убегает, бросив кошелёк с чипами. Честно? Воровато оглядываешься и забираешь.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 3) }),
  },
  {
    text: 'Штаб {faction} в старом здании администрации. Вокруг — патрули, прожектора, пулемётные гнёзда. Пробираться мимо — то ещё приключение. Зато из мусорного бачка у штаба можно выудить ценные бумаги.',
    type: 'loot',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }),
  },
  {
    text: '«Стой! Пропуск!» — окрик {faction}. Пропуска у тебя нет. «Ну давай 20 чипов, так и быть, пропущу». Платишь дань и проходишь. Дороже вышло бы с боем.',
    type: 'neutral',
    effects: (_, level) => ({ chips: NC(level, 2), exp: E(level, 2) }),
  },
  {
    text: '{faction} устроили зачистку мутантов. Дым, стрельба, взрывы. Ты наблюдаешь со стороны. Они профессиональны — мутантов расстреливают методично. После зачистки забирают трофеи. Тебе остаётся один «забытый» ствол.',
    type: 'loot',
    effects: (_, level) => ({ itemCount: 1, chips: C(level, 4), exp: E(level, 4) }),
  },
  {
    text: 'Пьяный в хлам боец {faction} сидит в канаве. «Брат, налей!». Он протягивает пустую флягу. Ты даёшь воды. Он лезет в карман и достаёт золотой зуб (выбитый) — «На, держи, на удачу». Продаётся за чипы.',
    type: 'trade',
    effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 2) }),
  },
];

// ---------------------------------------------------------------------------
// Micro-events — атмосферные мини-события (частые, короткие)
// ---------------------------------------------------------------------------
// Factory helpers for compact micro-event definitions
const M = (t: string, x?: number): EventTemplate => ({ text: t, type: 'neutral', effects: () => x ? ({ exp: RANGE(1, x) }) : ({}), noAutoBranch: true });
const H = (t: string, _x?: number): EventTemplate => ({ text: t, type: 'heal', effects: () => ({ healPercent: RF(0.01, 0.02) }), noAutoBranch: true });
const L = (t: string): EventTemplate => ({ text: t, type: 'loot', effects: () => ({ itemCount: 1 }), noAutoBranch: true });
const D = (t: string, d?: number): EventTemplate => ({ text: t, type: 'danger', effects: () => d ? ({ damagePercent: RF(0.01, 0.02) }) : ({}), noAutoBranch: true });

const microEventTemplates: EventTemplate[] = [
  // --- Ruins & buildings (40) ---
  M('Пересекаем высохшее русло реки. Тишина, только ветер шелестит сухой травой.', 5),
  M('Натыкаемся на остов сгоревшего дома. Обгоревшие стены, запах пепла.'),
  M('Проходим мимо заброшенной заправки. Стекла выбиты, внутри — пусто.'),
  M('Вдали виднеется полуразрушенная вышка сотовой связи. Когда-то здесь ловил интернет. Теперь — только ветер.', 3),
  M('Овраг, заваленный бытовым мусором. Среди отходов блестит что-то металлическое.'),
  M('Старая табличка: «Осторожно, мины!». Мины старые, но рисковать не стоит. Делаем крюк.', 10),
  M('Больница на холме. Окна тёмные, двери распахнуты. Оттуда тянет холодом и формалином. Не заходим.'),
  M('Разрушенный мост через реку. Придётся искать брод в полукилометре выше по течению.', 5),
  M('Заброшенная церковь. Купол обрушился, но крест на шпиле уцелел. Внутри — тишина и полумрак.'),
  M('Бензоколонка с проржавевшими колонками. Ценник на двери: «Бензин — 5$». Смешно.', 3),
  M('Руины школы. Парты перевёрнуты, на доске — надпись мелом: «Мы ещё вернёмся».'),
  M('Старый железнодорожный вокзал. На табло — расписание поездов, умерших лет двадцать назад.', 5),
  M('Мостовая треснула, из асфальта пробивается молодая берёза. Жизнь пробивается сквозь бетон.'),
  M('Сгоревшая библиотека. Книги превратились в пепел, но одна полка уцелела. Находим детский стишок.'),
  M('Разрушенный аквапарк. Горки покосились, бассейны заросли тиной. Когда-то здесь смеялись дети.'),
  M('Заброшенная АЗС с пробитыми цистернами. Топливо ушло в землю — трава вокруг не растёт.', 5),
  M('Кирпичное здание с вывеской «Стоматология». Кресло уцелело, бормашина — нет.'),
  M('Подземный переход, затопленный на треть. Стены расписаны граффити десятилетней давности.', 3),
  M('Полуразрушенный стадион. Трибуны пусты, поле заросло бурьяном. Тишина.'),
  M('Магазин игрушек. Витрина разбита, куклы с пустыми глазницами валяются на полу. Жутковато.'),
  M('Гаражный кооператив. Большинство боксов открыты и пусты, в одном — скелет в старой «Волге».', 8),
  M('Почтовое отделение. Письма рассыпаны по полу. Одно не отправлено: «Мама, я жив, скоро вернусь».', 5),
  M('Хоккейная коробка. Ворота целы. Кто-то поставил банку — можно кинуть шайбу.'),
  M('Склады с обвалившейся крышей. Под обломками — тюки прессованного картона и гнилые мешки.'),
  M('Автобус, сошедший с трассы и врезавшийся в дерево. Салон пуст, водительское сиденье проржавело.', 3),
  M('Пандус паркинга уходит под землю. Темнота и эхо капающей воды. Спускаться? Не сегодня.'),
  M('Пожарная часть. Машины на месте, но колёса спущены, шланги изъедены крысами.'),
  M('Коттеджный посёлок. Дома сгнили, заборы повалены. На одном заборе — детский рисунок солнца.', 5),
  M('Ларек «Продукты 24 часа». Холодильники открыты, внутри плесень. За прилавком — пустая касса.'),
  M('Сельский клуб. Афиша: «Танцы! Суббота, 19:00». Афише — двадцать лет.', 3),
  M('Детская площадка. Качели скрипят на ветру. Горка цела. Почему-то грустно.', 5),
  M('Рынок. Прилавки пусты, на земле — гнилые овощи и рваная одежда. Кто-то уходил в спешке.'),
  M('Теплица с разбитой крышей. Внутри буйная растительность — огурцы одичали, но плодоносят.', 8),
  M('Рекламный щит: «Новая жизнь — новый мир!» Краска облупилась, но буквы читаются. Горькая ирония.'),
  M('Химчистка. Висят выцветшие костюмы и платья. Как музей погибшей моды.', 3),
  M('Водонапорная башня. Забираемся наверх — отличный обзор на километры вокруг.'),
  M('Скотный двор. Забор повален, внутри — только кости и мухи.'),
  M('Остановка «Почта». Расписания нет, скамейка сломана. Ждать нечего — идём дальше.', 5),
  M('Банк. Сейфы открыты, деньги сгнили. Кому теперь нужны эти бумажки?'),
  M('Автомойка. Последняя машина так и стоит — немытая, с ключами в замке зажигания.', 8),

  // --- Nature & weather (45) ---
  M('Закат. Небо окрашивается в оранжевый и багровый. Красиво, несмотря на весь этот ад.', 10),
  H('Маленький водопад. Вода чистая, можно пополнить запасы. Приятный звук.', 20),
  M('Гроза начинается. Первые капли падают на лицо. Ускоряем шаг.', 3),
  M('Замечаем вдалеке дым. Может, костёр, может, пожар. Держимся подальше.'),
  M('На небе — двойная радуга. Редкое зрелище даже для Старого Мира. Загадываем желание.', 15),
  M('Проходим поле, усеянное воронками от снарядов. Земля до сих пор хранит шрамы.', 8),
  M('Термометр на разбитой метеостанции показывает 43 градуса в тени. Пьём последнюю воду.'),
  M('Солнце клонится к закату. Тени становятся длинными. Нужно найти место для ночлега.'),
  H('Ручей, перегороженный бобровой плотиной. Вода чистая, рыба есть.', 15),
  M('Лужа переливается всеми цветами радуги. Радиация? Или просто масло. Проверять не будем.'),
  M('Гроза застаёт врасплох. Прячемся под навесом сгоревшего магазина. Ждём.'),
  M('Ливень хлещет как из ведра. Рация шипит — влага попадает в динамик.'),
  M('После дождя воздух чистый и свежий. Пахнет озоном и мокрой землёй.', 8),
  M('Град размером с горошину барабанит по капюшону. Неприятно, но терпимо.'),
  M('Река вышла из берегов. Придётся делать большой крюк через лес.'),
  M('Болотистая местность. Под ногами хлюпает. Хорошо, что резиновые сапоги не протекают.'),
  M('Роса на траве. Ноги мокрые с первых шагов. Придётся сушить обувь на привале.', 3),
  M('Сильный ветер сбивает с ног. Держимся ближе к земле.'),
  M('Песчаная буря начинается. Видимость падает до нуля. Пережидаем, укрывшись за валуном.', 5),
  M('Первый снег. Крупные хлопья падают на землю и сразу тают. Зима близко.'),
  M('Земля под ногами чавкает — грунтовые воды близко. Идём по кочкам, как цапли.'),
  M('Гром гремит так, что закладывает уши. Буря совсем рядом.', 5),
  M('Лёгкий туман стелется по земле. Призрачное зрелище.', 3),
  M('Овраг, заросший ежевикой. Ягоды крупные и сладкие. Собираем горсть.'),
  H('Находим родник с холодной, кристально чистой водой. Пьём и наполняем фляги.', 30),
  M('Москиты. Тучи москитов. Надеваем накомарник и ускоряем шаг.'),
  M('Землетрясение! Слабые толчки, но камни осыпаются с холма. Уходим на открытое место.', 5),
  M('Густой туман. Видимость — три метра. Идём медленно, сверяясь с компасом.'),
  M('Прилив? Мы в низине — вода поднимается. Нужно подняться выше.', 3),
  M('Ураганный ветер валит деревья. Одно падает прямо позади нас — чудом не задело!', 10),
  H('Тёплый летний вечер. Птицы поют. На минуту забываешь, где ты.', 20),
  M('Идём вдоль русла пересохшей реки. Дно усеяно гладкими камнями и ракушками.', 3),
  M('Сели в грязь. Буквально. Нога уходит по колено. Выбираемся с трудом.', -3),
  M('Закат невероятной красоты — багровый, золотой, сиреневый. Стоим и смотрим.', 12),
  H('Пещера с подземным озером. Вода холодная, но можно умыться и напиться.', 25),
  M('Моросит мелкий дождь. Неприятно, но не смертельно. Капюшон спасает.', -2),
  M('Ветер стих. Внезапная, гробовая тишина. Даже птицы замолкли. Это не к добру.', -5),
  M('Пахнет гарью. Где-то горит лес. Ветер дует в нашу сторону — ускоряемся.', -3),
  M('Луна полная, освещает путь. Идти при луне почему-то спокойнее.', 5),
  H('Находим поляну с дикой малиной. Ягоды сочные, сладкие. Лакомство среди Пустоши.', 25),
  M('Град! Прячемся под густым деревом. Ветки защищают неплохо.', 3),
  M('Туман рассеивается. Открывается вид на бескрайнюю равнину. Дух захватывает.', 8),
  M('Ночное небо усыпано звёздами. В городах Старого Мира такого не было.', 10),
  M('Лёд на лужах хрустит под ногами. Холодает. Зима не за горами.'),
  H('Грибная поляна. Опята, подберёзовики. Можно сварить суп на привале.', 20),
  M('Солнце в зените, пекло нещадное. Прячемся в тени скалы переждать жару.'),

  // --- Wildlife & mutants (40) ---
  M('Птица с двумя головами пролетает над головой. Очередной подарок радиации.'),
  M('Мимо пробегает стая диких собак. К счастью, не заметили.'),
  M('Огромный муравейник прямо посреди дороги. Муравьи размером с палец. Обходим.'),
  M('Дикая кошка с тремя глазами шипит из кустов. Не трогаем — и она не трогает.'),
  M('Змея переползает дорогу. Двухголовая, шипит на все головы. Пережидаем.'),
  M('Комары. Миллионы комаров. Пустошь, блин.'),
  M('Дорогу перебегает лиса с белым мехом. Альбинос? Мутант? Смотрит на нас и убегает.'),
  M('Бабочка с кристально-прозрачными крыльями садится на руку. Красивая, несмотря на мутацию.'),
  M('В кустах кто-то возится. Медведь? Кабан? Замираем. Нет, просто ветер.'),
  M('Рой мутировавших насекомых кружит над болотом. Идём в обход.', 8),
  M('Ворон с белыми глазами сидит на ветке и не двигается. Смотрит на нас. Ускоряемся.', 5),
  M('Мертвая корова на обочине. Вздувшаяся. Обходим по широкой дуге.'),
  M('Крысы-мутанты размером с кошку грызут что-то в канаве. Не обращают на нас внимания.', 3),
  M('Паук необычной расцветки сидит в центре паутины. Паутина прочная как стальной трос.'),
  M('Стая ворон поднимается в небо с поля. Что-то их спугнуло. Настораживаемся.', 5),
  M('Гусеница размером с палец, ярко-синяя. Ядовитая? Не трогаем.'),
  M('Лось с шестью ногами стоит у ручья и пьёт. Смотрит на нас без страха.', 5),
  M('Крот-мутант выбрасывает землю прямо у ног. Удирает обратно в нору.'),
  M('Сова ухает в лесу. Днём? Странно.', 3),
  M('Стрекоза с размахом крыльев как у чайки пролетает над головой.'),
  M('Доносится рёв неизвестного зверя. Звук низкий, вибрирующий. Замираем.', 5),
  M('Косуля смотрит на нас из-за кустов. У неё три глаза. Мирно щиплет траву.'),
  M('Муравьиная дорожка. Тысячи муравьёв несут куски листьев. Слаженный механизм.', 3),
  M('Жук-олень с рогами размером с ладонь сидит на пне. Красивый и страшный одновременно.'),
  M('Улитки. Их здесь тысячи. Просто идём — хрустят под ногами.'),
  M('Лягушки квакают в канаве. Громко, на все голоса. Пустошь живёт своей жизнью.', 3),
  M('Следы крупного зверя на грязи. Лапа размером с две моих. Свежие.', 5),
  M('Туша дохлого кабана. Раздутая. Вокруг ползают жуки-могильщики.'),
  M('Шмель размером с мячик жужжит над цветком. Цветок — обычная ромашка. Контраст.', 3),
  M('Пиявки в ручье. Много. Идём вброд осторожно.'),
  M('Мутировавшая белка с красными глазами кидается шишками. Наглая.', 5),
  M('Волчий вой вдалеке. Точно не собака — слишком низко и протяжно.'),
  M('Змеиное гнездо под камнем. Много мелких змей. Обходим стороной.', 3),
  M('Дикие пчёлы. Улей на дереве. Мёд видно сквозь соты — но лезть не стоит.'),
  M('Черепаха с панцирем, поросшим мхом. Медленно пересекает дорогу.'),
  M('Цветущий кактус посреди пустыря. Ярко-розовый, на контрасте с серостью.', 5),
  M('Мыши шуршат в сухой траве. Хищник где-то рядом.'),
  M('Оводы. Нет, это не комары. Оводы кусаются больно и настырно.'),
  M('Хищная птица кружит высоко в небе. За кем-то охотится.', 3),
  M('Кузнечики прыгают из-под ног. Много. В детстве ловили таких сачком.', 5),

  // --- Travel & movement (35) ---
  M('Тропинка раздваивается. Левая — через тёмный лес, правая — вдоль обрыва. Выбираем правую.'),
  M('На обочине — разбитый мотоцикл. Бак пуст, колёса спущены, но рама цела.', 8),
  M('Проходим поле, усеянное воронками от снарядов. Битва была давно.', 8),
  M('Ноги гудят. Каждый шаг даётся с трудом. Но останавливаться нельзя.', -5),
  M('Под ногами хрустит битое стекло. Когда-то здесь была витрина магазина.'),
  M('Находим свежий след от ботинка. Кто-то прошёл здесь пару часов назад.', 5),
  M('Мост разрушен. Придётся спускаться в ущелье и переходить по камням.', 5),
  M('Грязь по колено. Ноги увязают. Выбираться тяжело.', -8),
  M('Крутой подъём. Камни осыпаются под ногами. Осторожно, шаг за шагом.', 5),
  M('Тоннель сквозь скалу. Темнота, хоть глаз выколи. Включаем фонарь.'),
  M('Бревно через реку — естественный мост. Переходим осторожно, балансируя.', 5),
  M('Лесная тропа заросла кустарником. Продираемся сквозь ветки.'),
  M('Тропинка выводит к старой асфальтовой дороге. Идти по асфальту — неслыханная роскошь.', 5),
  M('Каменистая осыпь. Каждый шаг рискует сорвать целую лавину камней.', -5),
  M('Поваленное дерево перегородило тропу. Перелезаем с трудом.', 3),
  M('Идём по кромке обрыва. Внизу — река. Красиво и страшно.', 5),
  M('Лужи после дождя. Вода в них чистая — можно напиться.', 8),
  M('Тропа становится всё уже. С двух сторон — колючие кусты.'),
  M('Песчаный участок. Ноги утопают по щиколотку. Идти тяжело.', -5),
  M('Дорога устлана гравием. Хрустит громко — нас слышно за километр.', 3),
  M('Бетонная плита с торчащей арматурой. Чуть не споткнулись.', -3),
  M('Овраг, заросший крапивой. Крапива выше человеческого роста. Жжётся адски.'),
  M('Ледяная корка на лужах. Первые заморозки. Дышится легко, морозно.', 5),
  M('Мелкий ручей пересекает тропу. Перепрыгиваем без проблем.'),
  M('Зыбкая почва — болото начинается. Быстро отступаем на твёрдую землю.', 3),
  M('Упавший дорожный знак. «Москва — 1200 км». Нам в другую сторону.', 5),
  M('Пробираемся сквозь густой камыш. Шуршит громко, но это хорошее укрытие.'),
  M('Корни деревьев переплелись на тропе. Спотыкаемся, но не падаем.', -3),
  M('Тропинка ведёт вдоль забора из колючей проволоки. Забор уходит в бесконечность.', 3),
  M('Подъём в гору. С каждым шагом ноги наливаются свинцом.', -8),
  M('Спуск к реке. Крутой, скользкий. Садимся и съезжаем на пятой точке.', 5),
  M('Чей-то старый след. Похоже на медведя. Или на очень большую собаку.', 5),
  M('Трава по пояс. В траве может быть кто угодно. Идём осторожно.'),
  M('Узкая тропа между скал. Проходим гуськом. Тишина давит на уши.', 5),
  M('Следы колёс на дороге. Похоже на военный грузовик. Свежие.', 8),

  // --- NPC traces & remnants (50) ---
  M('Чей-то рюкзак висит на ветке. Внутри — пустые обёртки и плесневелый хлеб.', -3),
  M('Находим брошенную палатку. Спальник, горелка, пустая консервная банка.', 3),
  M('Скелет в военной форме сидит, прислонившись к дереву. В руке — истлевшая фотография.', 6),
  M('Следы шин на грязи. Кто-то проехал недавно — может, торговцы, может, бандиты.'),
  M('Ощущение, что за нами следят. Обернулись — никого. Просто нервы.'),
  M('Слышен отдалённый гул. Похоже на работу генератора. Где-то рядом есть люди.'),
  M('Рация ловит обрывки переговоров: «…повторяю, сектор 4 — чисто. Приём».', 6),
  M('На обочине — ржавый велосипед. Когда-то на нём катался ребёнок.', 5),
  M('Сломанный ветряк скрипит на ветру. Лопасти почти отвалились.'),
  M('Находим старую карту в ржавом ящике. Выцветшая, бесполезная, но красивая.'),
  M('Граната, пролежавшая здесь чёрт знает сколько. Чеку не дёргаем — обходим.'),
  M('Музыка слышна издалека. Кто-то играет на гитаре. Цивилизация ещё жива.', 12),
  M('Пролетает военный дрон. Зависает, сканирует — и летит дальше. Заметил?'),
  M('Костёр на привале. Угли ещё тёплые. Кто-то ушёл не больше часа назад.', 5),
  M('Консервные банки, пустые гильзы, окурок самокрутки. Место чьей-то стоянки.', 3),
  M('Автомобиль-амфибия на колёсах. Пережиток военных экспериментов. Ржавеет в канаве.'),
  M('Самодельный крест на обочине. Кто-то похоронил здесь близкого. Останавливаемся на минуту.', 8),
  M('Чья-то потерянная фляга. Наполовину полная. Вода мутноватая, но пить можно.', 5),
  M('Рваный ботинок валяется в грязи. Второго нет. Кто-то шёл босиком дальше.'),
  M('Патроны россыпью. Пустые гильзы. Калибр не наш, но можно собрать на переплавку.', 5),
  M('Потрёпанная книга в луже. Страницы размокли, но название читается: «Как закалялась сталь».'),
  M('Военный жетон на цепочке. «Иванов А.С., 1985 г.р.». Капсула пуста.', 8),
  M('Дым вдалеке. Столб чёрный, жирный — горит что-то нефтяное. Держимся наветренной стороны.'),
  M('Обрывок газеты: «Правительство призывает сохранять спокойствие». Газете лет двадцать.'),
  M('Ржавый сейф с распахнутой дверцей. Внутри — пусто. Успели до нас.'),
  M('Следы крови на земле. Кровь старая, чёрная. Кто-то отбивался.'),
  M('Стреляные гильзы от крупного калибра. Бой был серьёзный.'),
  M('Бинты валяются. Кровавые. Кто-то перевязывал рану на ходу.'),
  M('Пустая бутылка самогона. Этикетка самодельная: «Первач Пустоши 60°».', 3),
  M('Могила без имени. Крест сбит. Лежат искусственные цветы — кто-то помнит.'),
  M('Детская игрушка в пыли. Плюшевый медведь с оторванной лапой. Подбирать не будем.'),
  M('Надпись на стене: «Здесь был Вася. Лето 2025». Через год Вася стал историей.'),
  M('Самодельная растяжка. Обезврежена кем-то до нас. Спасибо, неизвестный сапёр.', 10),
  M('Лагерь сталкеров. Кострище, спальные мешки, сушится одежда. Хозяева где-то рядом.', 5),
  M('Капкан. Старый, проржавевший. Захлопнулся на пустом месте.'),
  M('Огарок свечи на пне. Кто-то сидел здесь ночью, глядя на звёзды.', 5),
  M('На полу — детский рисунок. Солнце, дом, мама с папой. У кого-то было счастливое детство.'),
  M('Аккумулятор от машины. Подключаем тестер — ещё жив! Можно зарядить приборы.', 8),
  M('Следы от пуль на стене. Кучно — стрелял профессионально.'),
  M('Разорванный рюкзак. Останки еды, карман пуст. Мародёры уже проверили.'),
  M('Фонарик, ещё работающий. Слабый, но жёлтый свет даёт.', 3),
  M('Странный запах — химия и гниль. Где-то рядом разлились реактивы.', -5),
  M('Самодельный указатель: «До безопасной зоны 3 км →». Оптимизм — наше всё.', 5),
  M('Спальник на дереве. На дереве! Кто-то боялся ночных тварей.', 5),
  M('Радиостанция на частоте шипит. Среди помех слышен женский голос: «…если кто-то слышит, ответьте…»', 10),
  M('Порванная военная форма. Нашивки сняты. Дезертир переоделся в гражданское.'),
  M('Следы шин уходят в воду. Машина утонула? Или следы просто смыло?', 3),
  M('Зеркало заднего вида на дереве. Всматриваемся — лицо уставшее, но живое.'),
  M('Ржавый велосипедный насос. Валяется без дела.'),
  M('Обрывок карты с пометкой «Клад». Проверять не будем — сто процентов ловушка.', 5),

  // --- Combat aftermath (30) ---
  M('Вдалеке слышны выстрелы. Решаем обойти стороной.'),
  M('Земля дрожит. Где-то рвануло. Недалеко, но не критично.'),
  M('Следы недавнего боя: гильзы, кровь, воронка от гранаты. Кто-то здесь не выжил.', 8),
  M('Труп мутанта с огнестрельным ранением. Кто-то хорошо поработал до нас.'),
  M('Запах пороха и смерти в воздухе. Бой был сегодня утром.'),
  M('Пулемётная лента, наполовину расстрелянная. Стреляный металл ещё тёплый.'),
  M('Сгоревший БТР на обочине. Внутри всё выгорело. Оплавленный металл застыл причудливыми формами.', 10),
  M('Поле, перепаханное взрывами. Ни травинки, ни кустика — только чёрная земля.'),
  M('Воронка от снаряда, заполненная дождевой водой. Вода красноватая.', -5),
  M('Брошенный окоп. Мешки с песком порваны, внутри — пустые патронные ящики.'),
  M('Противогаз висит на штыре. Стекла запотевшие. Надевать не будем — мало ли что.'),
  M('Вертолёт, упавший носом в землю. Лопасти сломаны, хвост оторван. Пилит не выжил.', 8),
  M('Гильзы от снарядов разного калибра. Коллекционировать не будем — тяжело.'),
  M('Следы гусениц. Танк проходил здесь недавно. Земля ещё влажная от перепаханного слоя.', 5),
  M('Запах палёной проводки и горелой резины. Где-то рядом горела техника.'),
  M('Рация на частоте передаёт «mayday». Сигнал слабый, ничего не разобрать.', 3),
  M('Обгоревший остов джипа. Сиденья выгорели, краска облупилась. Остов ещё тёплый.'),
  M('Магазин от автомата Калашникова. Пустой. Кто-то отстрелялся до последнего патрона.'),
  M('Фляга с пробоиной. Рядом — пятно… Вода? Кровь? Не разобрать.'),
  M('Сбитый дрон. Корпус треснул, камера выбита. Можно снять микросхемы.', 5),
  M('Бинокль на земле. Стекла треснули, но оптическая труба цела. На память.', 3),
  M('Каска с пулевым отверстием. Внутри — сухая кровь. Надеваем быстрее свою.'),
  M('Взрывчатка C4, примотанная скотчем к дереву. Радиус поражения — 20 метров. Не дёргать.', 5),
  M('Упаковка патронов, рассыпанная по земле. Часть ушла в грязь, часть можно собрать.', 8),
  M('Штык-нож, вонзённый в ствол дерева. Силы удара хватило, чтобы войти на два сантиметра.'),
  M('Поле боя усеяно стреляными гильзами. Бой был долгий и ожесточённый.', 5),
  M('Танковая гусеница, оторванная взрывом. Весит полтонны. Рядом — воронка глубиной в метр.', 8),
  M('Радиопомехи усиливаются. Кто-то глушит сигнал. Мы в зоне действия РЭБ.', 5),
  M('Баллистическая маска с трещиной. Пуля застряла в кевларе. Спасла чью-то жизнь.'),
  M('Пламя на горизонте. Горит склад горючего. Столб огня видно за километры.', 5),

  // --- Environmental anomalies (25) ---
  M('Воздух потрескивает. Статическое электричество. Где-то рядом аномалия.', 5),
  M('Странное свечение из-за холма. Голубоватое, пульсирующее. Не идём туда.'),
  M('Пахнет озоном. Волосы встают дыбом. Электромагнитное поле повышенное.'),
  M('Счётчик Гейгера слегка потрескивает. Фон повышен, но терпимо.', -8),
  M('Мёртвая зона: ни звуков, ни насекомых, ни ветра. Абсолютная тишина давит на психику.', -10),
  M('Песок странного зелёного цвета. Под микроскопом можно разглядеть светящиеся вкрапления.', 5),
  M('Трава на участке растёт спиралью. Неестественно правильная геометрия.'),
  M('Лужа кислоты проедает бетон. Пузырьки газа поднимаются. Обходим за 10 метров.', -8),
  M('Камень левитирует в метре над землёй. Гравитационная аномалия. Бросаем болт — летит вверх.', 10),
  M('Радужная плёнка на поверхности воды. Химия. Не трогать, не пить, не дышать.', -5),
  M('Поляна, где ничего не растёт. Даже сорняки обходят это место стороной.', 5),
  M('Грибы-мутанты светятся в темноте. Фосфоресцирующие, синие. Необычно красиво.', 8),
  M('Температура резко падает на несколько градусов. Проходим сквозь холодное пятно.', -5),
  M('Ржавчина на металле распространяется прямо на глазах. Аномалия ускоренной коррозии.'),
  M('Струя пара бьёт из трещины в земле. Геотермальная активность. Рядом горячий источник.', 10),
  M('Звук собственного дыхания искажается. Акустическая аномалия — эхо с задержкой.', 5),
  M('Камни на вершине холма сложены в правильную пирамиду. Природа? Человек? Аномалия?'),
  M('Зона пониженной гравитации. Прыжок — и взлетаешь на три метра. Весело!', 12),
  M('Железо магнитится к одному из камней. Природный магнит? Или артефакт?', 5),
  M('Холодный туман, не рассеивающийся на солнце. Внутри ничего не видно. Обходим.'),
  M('Растения с металлическим блеском листьев. Не мутация — аномалия.', 5),
  M('Стеклянная пустыня: песок спекётся в стекло от высоких температур. Блестит на солнце.'),
  M('Гейзеры пара. Кратерное поле. Между ними можно пройти, но горячо.', 8),
  M('Озеро с ярко-розовой водой. Цвет неестественный химический. Рыбы нет.', -5),
  M('Вспышки света в небе. Северное сияние? Слишком низко и локально.', 5),

  // --- Loot & scavenging (20) ---
  L('Овраг, заваленный мусором. Среди бытовых отходов блестит ржавый гаечный ключ.'),
  L('На обочине — разбитый мотоцикл. Запчасти можно снять.'),
  M('Старый колодец. Ведро целое. Вытаскиваем — внутри вода, но пить не рискнём.'),
  L('Свалка металлолома. Среди ржавых железяк находим целый аккумулятор.'),
  M('Сундук под камнем. Крышка поддаётся с трудом. Внутри — гнилое тряпьё и пустота.'),
  L('Брошенный грузовик. Кузов пуст, но под сиденьем завалялась коробка патронов.'),
  M('Ящик с инструментами, забытый на обочине. Молоток и отвёртка ещё пригодятся.'),
  L('Под корягой — чей-то схрон. Неглубоко, присыпано ветками. Внутри — консервы.'),
  M('Банка тушёнки, закатившаяся под куст. Срок годности вышел, но герметичность не нарушена.'),
  L('Старый телевизор с разбитым экраном. Внутри — микросхемы и медные провода.'),
  M('Рыболовные снасти на берегу. Кто-то убежал и бросил удочку. Леска ещё крепкая.'),
  L('Чемодан без ручки. Внутри — одежда и пара старых наручных часов.'),
  M('Противогазная сумка. Фильтр отработанный, но сама сумка крепкая. Можно приспособить.'),
  L('Пустой ящик из-под боеприпасов. Дерево крепкое — на растопку или постройку.'),
  M('Батарейки в упаковке. Пролежали долго, но две из четырёх ещё живые.'),
  L('Сапёрная лопатка, торчащая из земли. Ручка треснула, но лезвие острое.'),
  M('Набор гаечных ключей в масляной тряпке. Кто-то спрятал и забыл.'),
  L('Стеклянная банка с гвоздями и шурупами. Мелочь, а приятно.'),
  M('Портативное радио. Корпус треснул, но на батарейках ловит помехи.'),
  L('Бинт, нераспечатанный, в герметичной упаковке. Медицина — на вес золота.'),

  // --- Danger & close calls (20) ---
  D('Земля проваливается под ногой. Едва успеваю отпрыгнуть — нора какого-то зверя.', 15),
  M('С дерева падает сухая ветка. Чуть не задевает голову. Нервы шалят.', -5),
  D('Камень, сорвавшийся со скалы, проносится в сантиметре от виска.', 20),
  M('Под ногами — хруст. Смотрю вниз — кости. Много костей. Бойня была здесь.', -8),
  D('Ветка, которую я отвёл, срывается и хлещет по глазам. Больно, но глаз цел.', 12),
  M('Скользкий участок. Нога едет — падаю на спину. Рюкзак смягчает удар.', -5),
  D('Из-под камня вылетает змея и бросается на ногу! Ботинок спасает, гадюка бьёт хвостом.', 25),
  M('Слышу шипение — рядом газовый баллон под давлением. Вентиль сорвало, газ травит.', -10),
  M('Бегу от роя ос. Они злые и быстрые. Успеваю нырнуть в кусты.', -8),
  D('Осыпается край обрыва. Едва успеваю отпрыгнуть назад. Камни летят в пропасть долго.', 20),
  M('Наступаю на ржавый гвоздь. Сапог толстый — не пробило. Удача.', -3),
  D('Ветром срывает мою кепку. Догонять? Ну её — другую найду.'),
  M('Что-то скользкое под ногой. Змея? Нет, просто мокрая коряга. Сердце колотится.', -5),
  M('Нога проваливается в нору. Вытаскиваю — ботинок в грязи, но цел.', -8),
  D('Пуля пролетает над головой. Стреляли издалека — не поняли, кто мы. Ложимся и ждём.', 30),
  M('Где-то рядом обвалилась стена. Грохот — как взрыв. Сердце ушло в пятки.', -5),
  M('Колючка впивается в руку. Выдёргиваю, кровь сочится. Пустяк.', -3),
  D('Топкое место. Грязь засасывает ногу. Рывком выдираю — ботинок остаётся в болоте!', 20),
  M('Из темноты — два огонька. Глаза. Замираем. Нет, просто светлячки.', -5),
  M('Граната! Лежит прямо на тропе. Чеку не дёргаем — обходим за километр.', -8),
];

// ---------------------------------------------------------------------------
// Micro-event variant generator — creates thousands of unique combinations
// ---------------------------------------------------------------------------
const MICRO_BUILDINGS = [
  'сгоревшего дома', 'разрушенного моста', 'старой церкви', 'заброшенной школы',
  'ржавого ангара', 'разбитой заправки', 'рухнувшей вышки', 'сгоревшего грузовика',
  'брошенного поезда', 'пустого склада', 'тёмного подвала', 'заросшего сада',
  'старого кладбища', 'разрушенного замка', 'военного бункера', 'сгоревшего кинотеатра',
  'затопленного магазина', 'рухнувшего моста', 'пустого дома', 'старого завода',
  'брошенного магазина игрушек', 'разрушенной больницы', 'сгоревшей библиотеки',
  'покинутого посёлка', 'ржавой водонапорной башни',
];
const MICRO_OBSERVATIONS = [
  'Изнутри доносится странный скрип.', 'Окна выбиты, двери распахнуты настежь.',
  'Внутри темно и тихо. Слишком тихо.', 'Стены в копоти, крыша обвалилась.',
  'Пахнет сыростью и запустением.', 'Крыша чудом уцелела, стены в трещинах.',
  'Из щелей пробивается зелень — жизнь берёт своё.', 'Внутри кто-то был недавно — следы свежие.',
  'Лучше не заходить — конструкция нестабильна.', 'Вокруг валяются ржавые детали и стекло.',
  'Кто-то явно обыскал место до нас.', 'Внутри — пустота и эхо собственных шагов.',
  'Дверь заперта. Или завалена с той стороны.', 'Следы огня, но здание выстояло.',
  'Пристройка обрушилась, но основное здание держится.',
];
const MICRO_SOUNDS = [
  'далёкий взрыв', 'вой сирены', 'треск веток', 'звук мотора', 'чей-то крик',
  'лай собак', 'шум воды', 'скрип металла', 'хлопок выстрела', 'гудок поезда',
  'звук вертолёта', 'электрический треск', 'грохот камней', 'звериный рык',
  'детский плач', 'звук шагов', 'радиопомехи', 'звук падающей воды', 'шёпот',
  'глухой удар',
];
const MICRO_DIRECTIONS = [
  'слева', 'справа', 'впереди', 'позади нас', 'из леса', 'со стороны реки',
  'из-за холма', 'с дороги', 'сверху', 'откуда-то из темноты',
];
const MICRO_REACTIONS = [
  'Настораживаемся, замедляя шаг.', 'Прислушиваемся — движемся дальше.',
  'Берём оружие наизготовку.', 'Ускоряемся, не оглядываясь.',
  'Останавливаемся и ждём минуту.', 'Уходим в сторону — не стоит рисковать.',
  'Смотрим в ту сторону, но ничего не видно.', 'Сердце колотится, но идём дальше.',
  'Осторожно движемся в направлении звука.', 'Замираем и гасим фонарь.',
  'Ныряем в ближайшее укрытие.', 'Достаём бинокль и всматриваемся.',
];
const MICRO_SMELLS = [
  'Пахнет дымом.', 'Запах горелой проводки.', 'Воняет болотом и тиной.',
  'Пахнет бензином и гарью.', 'Сладковатый запах разложения.',
  'Запах озона — где-то рядом аномалия.', 'Пахнет сосновой смолой и чистотой.',
  'Затхлый запах подвала.', 'Аромат полевых цветов — неожиданно приятно.',
  'Пахнет металлом и кровью.',
];
const MICRO_FOOTING = [
  'Земля под ногами твёрдая.', 'Грунт рыхлый — ноги утопают.',
  'Под ногами хрустит гравий.', 'Скользкая глина — идём осторожно.',
  'Песок, мелкий и сыпучий.', 'Ноги вязнут в грязи.',
  'Асфальт потрескался, но идти удобно.', 'Трава высокая — не видно, куда ступаем.',
  'Каменистая осыпь — каждый шаг риск.', 'Лужи, лужи, лужи — обувь промокла.',
];

const generateMicroVariant = (): ExplorationEventResult => {
  const roll = Math.random();
  if (roll < 0.25) {
    // Building + observation
    const b = PICK(MICRO_BUILDINGS);
    const o = PICK(MICRO_OBSERVATIONS);
    const s = Math.random() > 0.7 ? PICK(MICRO_SMELLS) : '';
    const text = `Проходим мимо ${b}. ${o}${s ? ' ' + s : ''}`;
    const xp = Math.random() > 0.6 ? RANGE(1, 8) : 0;
    return { text, type: 'neutral', effects: xp ? { exp: xp } : {} };
  } else if (roll < 0.50) {
    // Sound from direction + reaction
    const sd = PICK(MICRO_SOUNDS);
    const dir = PICK(MICRO_DIRECTIONS);
    const r = PICK(MICRO_REACTIONS);
    const text = `Слышен ${sd} ${dir}. ${r}`;
    return { text, type: Math.random() > 0.7 ? 'danger' : 'neutral', effects: Math.random() > 0.7 ? { damagePercent: RF(0.01, 0.02) } : {} };
  } else if (roll < 0.75) {
    // Footing + observation
    const f = PICK(MICRO_FOOTING);
    const o = PICK(MICRO_OBSERVATIONS).split('.')[0];
    const text = `${f} ${o.toLowerCase()}.`;
    return { text, type: 'neutral', effects: Math.random() > 0.7 ? { exp: RANGE(1, 5) } : {} };
  } else {
    // Simple atmospheric combo
    const smell = PICK(MICRO_SMELLS);
    const dir = PICK(MICRO_DIRECTIONS);
    const text = `${smell} Тянет ${dir}.`;
    const heal = Math.random() > 0.7 ? RANGE(5, 15) : 0;
    return { text, type: 'neutral', effects: heal ? { heal } : {} };
  }
};

export const generateMicroExplorationEvent = (_playerLevel: number = 1): ExplorationEventResult => {
  // 70% hand-crafted, 30% generated variant
  if (Math.random() < 0.7) {
    const template = PICK(microEventTemplates);
    const effects = template.effects?.('', 1) || {};
    return { text: template.text, type: template.type, effects };
  }
  return generateMicroVariant();
};

// ---------------------------------------------------------------------------
// NEW: Branching event templates (hand-crafted, replace auto-branch)
// ---------------------------------------------------------------------------
const branchingTemplates: EventTemplate[] = [
  // 1. Radioactive rain (danger)
  {
    text: 'Небо темнеет за считанные секунды — багровые тучи наливаются свинцом, воздух становится тяжёлым и горьким. Счётчик Гейгера захлёбывается треском. Радиационный дождь начинается, и крупные капли оставляют на коже химические ожоги. Вокруг — ни одного укрытия, только ржавые остовы машин да полуразрушенный дом в сотне метров.',
    type: 'danger',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Укрываемся в подвале дома — он сухой и тёплый. Пережидаем дождь без потерь, находим старый ящик с консервами, оставленный {male}-сталкером.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.03, 0.05), exp: E(level, 3), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `Укрываемся в подвале дома — он сухой и тёплый. Пережидаем дождь без потерь, находим старый ящик с консервами, оставленный {male}-сталкером.
[Благодаря Вода — результат x2!]`, noResourceText: `Укрываемся в подвале дома — он сухой и тёплый. Пережидаем дождь без потерь, находим старый ящик с консервами, оставленный {male}-сталкером.
[Вода нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В подвале сидит {female} — пожилая женщина с добрыми глазами. «Тоже прячешься? Садись к огоньку». Она делится горячим чаем и травами, восстанавливая силы.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.05, 0.09), exp: E(level, 4), chips: C(level, 4) }), resourceCost: nextResource(), resourceText: `В подвале сидит {female} — пожилая женщина с добрыми глазами. «Тоже прячешься? Садись к огоньку». Она делится горячим чаем и травами, восстанавливая силы.
[Благодаря Изолента — результат x2!]`, noResourceText: `В подвале сидит {female} — пожилая женщина с добрыми глазами. «Тоже прячешься? Садись к огоньку». Она делится горячим чаем и травами, восстанавливая силы.
[Изолента нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Надеваем защитный плащ и маску — подготовка окупается. Дождь практически не вредит, а под обломками находим ценные микросхемы.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 5) }), resourceCost: nextResource(), resourceText: `Надеваем защитный плащ и маску — подготовка окупается. Дождь практически не вредит, а под обломками находим ценные микросхемы.
[Благодаря Железо — результат x2!]`, noResourceText: `Надеваем защитный плащ и маску — подготовка окупается. Дождь практически не вредит, а под обломками находим ценные микросхемы.
[Железо нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В подвал просачивается вода с растворёнными химикатами — кожа горит, лёгкие обжигает едким паром. Выбираемся на поверхность, получив серьёзные ожоги.', weight: 20, effects: () => ({ damagePercent: 0.10 }), resourceCost: nextResource(), resourceText: `В подвал просачивается вода с растворёнными химикатами — кожа горит, лёгкие обжигает едким паром. Выбираемся на поверхность, получив серьёзные ожоги.
[С Дерево урон смягчён — потери -50%.]`, noResourceText: `В подвал просачивается вода с растворёнными химикатами — кожа горит, лёгкие обжигает едким паром. Выбираемся на поверхность, получив серьёзные ожоги.
[Без Дерево — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Продолжаем путь под дождём — находим труп сталкера {nick}, сбитый машиной. В рюкзаке припасы, но дождь успевает навредить, пока мы возимся.', weight: 15, effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), itemCount: RANGE(1, 3), chips: C(level, 4) }), resourceCost: nextResource(), resourceText: `Продолжаем путь под дождём — находим труп сталкера {nick}, сбитый машиной. В рюкзаке припасы, но дождь успевает навредить, пока мы возимся.
[С Инструменты урон смягчён — потери -50%.]`, noResourceText: `Продолжаем путь под дождём — находим труп сталкера {nick}, сбитый машиной. В рюкзаке припасы, но дождь успевает навредить, пока мы возимся.
[Без Инструменты — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 2. Жар-птица anomaly (danger)
  {
    text: 'Впереди воздух дрожит и плавится, словно над костром. Странное золотисто-багровое свечение исходит из центра поляны — аномалия «Жар-птица». Вокруг — выжженная земля, оплавившиеся камни и тишина, нарушаемая лишь потрескиванием плазмы. Запах озона смешивается с гарью. Внутри аномалии угадывается тёмный силуэт — возможно, артефакт.',
    type: 'danger',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'В центре аномалии находим светящийся кристалл — «Перо Жар-птицы». Он пульсирует теплом и стоит целое состояние. «Жар-птица» окупилась сторицей!', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: 1 }), resourceCost: nextResource(), resourceText: `В центре аномалии находим светящийся кристалл — «Перо Жар-птицы». Он пульсирует теплом и стоит целое состояние. «Жар-птица» окупилась сторицей!
[Благодаря Гвозди — результат x2!]`, noResourceText: `В центре аномалии находим светящийся кристалл — «Перо Жар-птицы». Он пульсирует теплом и стоит целое состояние. «Жар-птица» окупилась сторицей!
[Гвозди нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Кидаем камень, чтобы проверить реакцию — аномалия выстреливает плазмой, обнажая безопасный подход с другой стороны. Забираем мелкие артефакты на краю.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Кидаем камень, чтобы проверить реакцию — аномалия выстреливает плазмой, обнажая безопасный подход с другой стороны. Забираем мелкие артефакты на краю.
[Благодаря Пластмасса — результат x2!]`, noResourceText: `Кидаем камень, чтобы проверить реакцию — аномалия выстреливает плазмой, обнажая безопасный подход с другой стороны. Забираем мелкие артефакты на краю.
[Пластмасса нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Используем болты и верёвку, чтобы вытянуть артефакт дистанционно. Плазма бьёт мимо, но мы успеваем выхватить ценный образец.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), damagePercent: RF(0.01, 0.03) }), resourceCost: nextResource(), resourceText: `Используем болты и верёвку, чтобы вытянуть артефакт дистанционно. Плазма бьёт мимо, но мы успеваем выхватить ценный образец.
[Благодаря Топливо — результат x2!]`, noResourceText: `Используем болты и верёвку, чтобы вытянуть артефакт дистанционно. Плазма бьёт мимо, но мы успеваем выхватить ценный образец.
[Топливо нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Аномалия срабатывает спонтанно, выбрасывая поток плазмы. Сильные ожоги покрывают руки и лицо. Едва уползаем к ручью охладить раны.', weight: 20, effects: () => ({ damagePercent: 0.12 }), resourceCost: nextResource(), resourceText: `Аномалия срабатывает спонтанно, выбрасывая поток плазмы. Сильные ожоги покрывают руки и лицо. Едва уползаем к ручью охладить раны.
[С Батарейки урон смягчён — потери -50%.]`, noResourceText: `Аномалия срабатывает спонтанно, выбрасывая поток плазмы. Сильные ожоги покрывают руки и лицо. Едва уползаем к ручью охладить раны.
[Без Батарейки — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Из аномалии выходит мутировавшая тварь, питающаяся энергией. В бою получаем ожоги от её касаний, но тварь издохает, оставляя после себя светящуюся пыльцу.', weight: 15, effects: (_, level) => ({ combat: true, damagePercent: RF(0.08, 0.12), chips: C(level, 5) }), resourceCost: nextResource(), resourceText: `Из аномалии выходит мутировавшая тварь, питающаяся энергией. В бою получаем ожоги от её касаний, но тварь издохает, оставляя после себя светящуюся пыльцу.
[С Консервы урон смягчён — потери -50%.]`, noResourceText: `Из аномалии выходит мутировавшая тварь, питающаяся энергией. В бою получаем ожоги от её касаний, но тварь издохает, оставляя после себя светящуюся пыльцу.
[Без Консервы — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 3. Abandoned bunker (discovery)
  {
    text: 'Замечаем люк в земле, частично скрытый колючим кустарником и ржавыми листами шифера. Петли проржавели, но замок сбит — кто-то уже побывал здесь. Из щелей тянет сыростью и металлом. Судя по маркировке на плите — старый военный бункер связи, сектор «Гранит-7». Внизу может быть всё что угодно: от гнилых трупов до ящиков с довоенным снаряжением.',
    type: 'discovery',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Бункер не тронут! Герметичные стеллажи полны консервов, патронов и медикаментов. Дизель-генератор заправлен. Настоящая база для выживания — отличная находка!', weight: 20, effects: (_, level) => ({ itemCount: RANGE(3, 6), chips: C(level, 5), healPercent: RF(0.05, 0.10), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Бункер не тронут! Герметичные стеллажи полны консервов, патронов и медикаментов. Дизель-генератор заправлен. Настоящая база для выживания — отличная находка!
[Благодаря Лекарства — результат x2!]`, noResourceText: `Бункер не тронут! Герметичные стеллажи полны консервов, патронов и медикаментов. Дизель-генератор заправлен. Настоящая база для выживания — отличная находка!
[Лекарства нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Внутри — трупы прежних обитателей и запах разложения. Кто-то открыл дверь не тем. Проветриваем и собираем уцелевшее снаряжение с трупов.', weight: 20, effects: (_, level) => ({ itemCount: RANGE(2, 4), chips: C(level, 5), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Внутри — трупы прежних обитателей и запах разложения. Кто-то открыл дверь не тем. Проветриваем и собираем уцелевшее снаряжение с трупов.
[Благодаря Вода — результат x2!]`, noResourceText: `Внутри — трупы прежних обитателей и запах разложения. Кто-то открыл дверь не тем. Проветриваем и собираем уцелевшее снаряжение с трупов.
[Вода нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Находим командирский сейф с кодовым замком. Взламываем — внутри пачки чипов, карты с координатами других бункеров и личное оружие офицера.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `Находим командирский сейф с кодовым замком. Взламываем — внутри пачки чипов, карты с координатами других бункеров и личное оружие офицера.
[Благодаря Изолента — результат x2!]`, noResourceText: `Находим командирский сейф с кодовым замком. Взламываем — внутри пачки чипов, карты с координатами других бункеров и личное оружие офицера.
[Изолента нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Бункер служит логовом для мутировавшей твари с щупальцами. Едва уносим ноги, потеряв часть припасов в панике. Тварь преследует до самого выхода.', weight: 20, effects: (_, level) => ({ damagePercent: RF(0.08, 0.14), chips: NC(level, 2), combat: true }), resourceCost: nextResource(), resourceText: `Бункер служит логовом для мутировавшей твари с щупальцами. Едва уносим ноги, потеряв часть припасов в панике. Тварь преследует до самого выхода.
[С Железо урон смягчён — потери -50%.]`, noResourceText: `Бункер служит логовом для мутировавшей твари с щупальцами. Едва уносим ноги, потеряв часть припасов в панике. Тварь преследует до самого выхода.
[Без Железо — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Система вентиляции оказывается повреждена — внутри скопился радиоактивный газ. Получаем дозу облучения, но успеваем забрать несколько ценных предметов.', weight: 15, effects: (_, level) => ({ damagePercent: 0.08, itemCount: RANGE(1, 3), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Система вентиляции оказывается повреждена — внутри скопился радиоактивный газ. Получаем дозу облучения, но успеваем забрать несколько ценных предметов.
[С Дерево урон смягчён — потери -50%.]`, noResourceText: `Система вентиляции оказывается повреждена — внутри скопился радиоактивный газ. Получаем дозу облучения, но успеваем забрать несколько ценных предметов.
[Без Дерево — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 4. Merchant caravan (trade)
  {
    text: 'Странный караван расположился поперёк дороги — три грузовика с пулемётными турелями, пара мотоциклов и крытый фургон, расписанный яркими узорами. Охрана — вооружённые до зубов наёмники в пыльных плащах. Главный — высокий мужчина в длинном чёрном плаще и шляпе, курит сигару. «Подходи, путник, не стесняйся. У меня есть то, что тебе нужно». За его спиной — ящики с деталями, оружием и чипами.',
    type: 'trade',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'У торговца редкий товар — чипы данных с довоенными картами, немецкие медикаменты и ящик патронов. Сделка выгодная, расходимся довольные.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), itemCount: RANGE(2, 4), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `У торговца редкий товар — чипы данных с довоенными картами, немецкие медикаменты и ящик патронов. Сделка выгодная, расходимся довольные.
[Благодаря Инструменты — результат x2!]`, noResourceText: `У торговца редкий товар — чипы данных с довоенными картами, немецкие медикаменты и ящик патронов. Сделка выгодная, расходимся довольные.
[Инструменты нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Главарь узнаёт в нас сталкера из старых рейдов. «{nick}, ты ли это?» — он даёт скидку и делится информацией о безопасном маршруте через топи.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), healPercent: RF(0.03, 0.05) }), resourceCost: nextResource(), resourceText: `Главарь узнаёт в нас сталкера из старых рейдов. «{nick}, ты ли это?» — он даёт скидку и делится информацией о безопасном маршруте через топи.
[Благодаря Гвозди — результат x2!]`, noResourceText: `Главарь узнаёт в нас сталкера из старых рейдов. «{nick}, ты ли это?» — он даёт скидку и делится информацией о безопасном маршруте через топи.
[Гвозди нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Помогаем охране отбиться от стаи мутантов, напавших на караван. Главарь в благодарность открывает личный тайник с лучшим товаром.', weight: 20, effects: (_, level) => ({ combat: true, chips: C(level, 5), itemCount: RANGE(2, 3), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Помогаем охране отбиться от стаи мутантов, напавших на караван. Главарь в благодарность открывает личный тайник с лучшим товаром.
[Благодаря Пластмасса — результат x2!]`, noResourceText: `Помогаем охране отбиться от стаи мутантов, напавших на караван. Главарь в благодарность открывает личный тайник с лучшим товаром.
[Пластмасса нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Охрана требует «налог на проход» и обыскивает нас. «Здесь мои земли, чучело». Отбирают часть чипов и прогоняют с предупреждением.', weight: 20, effects: (_, level) => ({ chips: NC(level, 2), damagePercent: RF(0.01, 0.03) }), resourceCost: nextResource(), resourceText: `Охрана требует «налог на проход» и обыскивает нас. «Здесь мои земли, чучело». Отбирают часть чипов и прогоняют с предупреждением.
[С Топливо урон смягчён — потери -50%.]`, noResourceText: `Охрана требует «налог на проход» и обыскивает нас. «Здесь мои земли, чучело». Отбирают часть чипов и прогоняют с предупреждением.
[Без Топливо — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Торгуемся, но цены взвинчены. Покупаем кое-что по мелочи и узнаём новости региона. Без особой выгоды, но и без потерь.', weight: 15, effects: (_, level) => ({ chips: C(level, 3), exp: E(level, 3) }), resourceCost: nextResource(), resourceText: `Торгуемся, но цены взвинчены. Покупаем кое-что по мелочи и узнаём новости региона. Без особой выгоды, но и без потерь.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `Торгуемся, но цены взвинчены. Покупаем кое-что по мелочи и узнаём новости региона. Без особой выгоды, но и без потерь.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      ],
    },
  },
  // 5. Free fighters / save woman (story)
  {
    text: 'Звуки боя впереди — автоматные очереди, крики, звон стали. Из-за поворота выбегает раненый человек — молодая женщина с ребёнком на руках, в порванной куртке, запачканная кровью. За ней — трое вооружённых бандитов в масках, один целится из обреза. Женщина спотыкается, падает на колени, прикрывая ребёнка собой. «Помогите! — кричит она. — Они убьют нас!»',
    type: 'story',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Вместе с женщиной одолеваем бандитов. Спасённая представляется {female} — она военный врач. «Я твой должник, {nick}» — даёт редкие медикаменты и карты.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 3), healPercent: RF(0.03, 0.05) }), resourceCost: nextResource(), resourceText: `Вместе с женщиной одолеваем бандитов. Спасённая представляется {female} — она военный врач. «Я твой должник, {nick}» — даёт редкие медикаменты и карты.
[Благодаря Консервы — результат x2!]`, noResourceText: `Вместе с женщиной одолеваем бандитов. Спасённая представляется {female} — она военный врач. «Я твой должник, {nick}» — даёт редкие медикаменты и карты.
[Консервы нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Кидаем бандитам чипы и припасы — они подбирают и отпускают всех. Женщина шепчет «спасибо» и убегает. Совесть чиста, а главное — живы.', weight: 20, effects: (_, level) => ({ chips: NC(level, 2), exp: E(level, 4), healPercent: RF(0.02, 0.04) }), resourceCost: nextResource(), resourceText: `Кидаем бандитам чипы и припасы — они подбирают и отпускают всех. Женщина шепчет «спасибо» и убегает. Совесть чиста, а главное — живы.
[Благодаря Лекарства — результат x2!]`, noResourceText: `Кидаем бандитам чипы и припасы — они подбирают и отпускают всех. Женщина шепчет «спасибо» и убегает. Совесть чиста, а главное — живы.
[Лекарства нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Устраиваем засаду — заходим с фланга и снимаем бандитов одного за другим. Женщина хватает оружие убитого и помогает. Идеальная тактика!', weight: 20, effects: (_, level) => ({ combat: true, chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `Устраиваем засаду — заходим с фланга и снимаем бандитов одного за другим. Женщина хватает оружие убитого и помогает. Идеальная тактика!
[Благодаря Вода — результат x2!]`, noResourceText: `Устраиваем засаду — заходим с фланга и снимаем бандитов одного за другим. Женщина хватает оружие убитого и помогает. Идеальная тактика!
[Вода нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Бандиты сильнее, чем казалось. В бою получаем тяжёлое ранение, теряем припасы. Женщина успевает скрыться, но мы едва живы.', weight: 20, effects: (_, level) => ({ damagePercent: 0.12, chips: NC(level, 2), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Бандиты сильнее, чем казалось. В бою получаем тяжёлое ранение, теряем припасы. Женщина успевает скрыться, но мы едва живы.
[С Изолента урон смягчён — потери -50%.]`, noResourceText: `Бандиты сильнее, чем казалось. В бою получаем тяжёлое ранение, теряем припасы. Женщина успевает скрыться, но мы едва живы.
[Без Изолента — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Бандиты берут чипы и отпускают, но один замечает у нас дорогую вещь и нападает исподтишка. Отбиваемся, теряем часть снаряжения, но откупаемся.', weight: 15, effects: (_, level) => ({ damagePercent: RF(0.03, 0.05), chips: NC(level, 0), exp: E(level, 3) }), resourceCost: nextResource(), resourceText: `Бандиты берут чипы и отпускают, но один замечает у нас дорогую вещь и нападает исподтишка. Отбиваемся, теряем часть снаряжения, но откупаемся.
[С Железо урон смягчён — потери -50%.]`, noResourceText: `Бандиты берут чипы и отпускают, но один замечает у нас дорогую вещь и нападает исподтишка. Отбиваемся, теряем часть снаряжения, но откупаемся.
[Без Железо — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 6. Mutant bear (combat)
  {
    text: 'Из тумана выступает огромная тень — земля содрогается от тяжёлых шагов. Мутант-медведь размером с грузовик, шкура покрыта костяными наростами, из пасти капает зелёная слюна. Красные глаза горят в полумраке. Он поднимается на задние лапы, издавая рёв, от которого закладывает уши. За ним видна берлога, где блестит что-то металлическое.',
    type: 'combat',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Тяжёлый бой, но медведь повержен. Из шкуры можно сделать отличную броню, а в берлоге находим останки прежних жертв с ценными вещами.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), itemCount: RANGE(2, 4), chips: C(level, 5) }), resourceCost: nextResource(), resourceText: `Тяжёлый бой, но медведь повержен. Из шкуры можно сделать отличную броню, а в берлоге находим останки прежних жертв с ценными вещами.
[Благодаря Дерево — результат x2!]`, noResourceText: `Тяжёлый бой, но медведь повержен. Из шкуры можно сделать отличную броню, а в берлоге находим останки прежних жертв с ценными вещами.
[Дерево нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Граната пугает зверя — он убегает в туман. В берлоге находим детёныша мутанта и ценные артефакты, которые мать собирала для гнезда.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 5), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `Граната пугает зверя — он убегает в туман. В берлоге находим детёныша мутанта и ценные артефакты, которые мать собирала для гнезда.
[Благодаря Инструменты — результат x2!]`, noResourceText: `Граната пугает зверя — он убегает в туман. В берлоге находим детёныша мутанта и ценные артефакты, которые мать собирала для гнезда.
[Инструменты нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Замираем и прячемся — медведь проходит мимо, фыркает и скрывается. Подбираем сброшенный им клок шерсти с костяной пластиной — ценный материал.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 5) }), resourceCost: nextResource(), resourceText: `Замираем и прячемся — медведь проходит мимо, фыркает и скрывается. Подбираем сброшенный им клок шерсти с костяной пластиной — ценный материал.
[Благодаря Гвозди — результат x2!]`, noResourceText: `Замираем и прячемся — медведь проходит мимо, фыркает и скрывается. Подбираем сброшенный им клок шерсти с костяной пластиной — ценный материал.
[Гвозди нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Медведь слишком силён — едва уносим ноги, получив глубокие раны когтями. Кровь течёт, рюкзак порван, часть припасов выпала на бегу.', weight: 20, effects: (_, level) => ({ damagePercent: 0.15, chips: NC(level, 0) }), resourceCost: nextResource(), resourceText: `Медведь слишком силён — едва уносим ноги, получив глубокие раны когтями. Кровь течёт, рюкзак порван, часть припасов выпала на бегу.
[С Пластмасса урон смягчён — потери -50%.]`, noResourceText: `Медведь слишком силён — едва уносим ноги, получив глубокие раны когтями. Кровь течёт, рюкзак порван, часть припасов выпала на бегу.
[Без Пластмасса — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Отступаем в болото, медведь не рискует лезть. Трясина засасывает, едва выбираемся, грязные и мокрые, но находим ценный артефакт среди коряг.', weight: 15, effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), chips: C(level, 5), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Отступаем в болото, медведь не рискует лезть. Трясина засасывает, едва выбираемся, грязные и мокрые, но находим ценный артефакт среди коряг.
[С Топливо урон смягчён — потери -50%.]`, noResourceText: `Отступаем в болото, медведь не рискует лезть. Трясина засасывает, едва выбираемся, грязные и мокрые, но находим ценный артефакт среди коряг.
[Без Топливо — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 7. Survivor settlement (story)
  {
    text: 'Натыкаемся на небольшое поселение на берегу высохшей реки. Дома сколочены из обломков и сайдинга, между ними — огороды с чахлыми кустами помидоров и картошки. Дети бегают босиком по пыльной улице, гоняют мяч из тряпок. Из трубы кузницы идёт дым, пахнет хлебом и металлом. Жизнь теплится вопреки всему. Староста — седой мужчина с нашивками старой армии — выходит навстречу.', type: 'story', noAutoBranch: true, branch: { prompt: '', outcomes: [
        { text: 'Нас принимают тепло — староста угощает обедом, даёт припасы в дорогу и чинит снаряжение. «Добрые люди всегда нужны Пустоши».', weight: 20, effects: (_, level) => ({ healPercent: RF(0.10, 0.18), chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `Нас принимают тепло — староста угощает обедом, даёт припасы в дорогу и чинит снаряжение. «Добрые люди всегда нужны Пустоши».
[Благодаря Батарейки — результат x2!]`, noResourceText: `Нас принимают тепло — староста угощает обедом, даёт припасы в дорогу и чинит снаряжение. «Добрые люди всегда нужны Пустоши».
[Батарейки нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Помогаем жителям починить водяной насос и генератор. В благодарность нас кормят и дают запас топлива и фильтры для воды.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.06, 0.12), chips: C(level, 5), exp: E(level, 4), itemCount: 1 }), resourceCost: nextResource(), resourceText: `Помогаем жителям починить водяной насос и генератор. В благодарность нас кормят и дают запас топлива и фильтры для воды.
[Благодаря Консервы — результат x2!]`, noResourceText: `Помогаем жителям починить водяной насос и генератор. В благодарность нас кормят и дают запас топлива и фильтры для воды.
[Консервы нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Староста {male} — бывший военный медик. Он лечит наши раны и рассказывает о безопасных маршрутах через радиоактивные болота к северу.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.08, 0.14), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Староста {male} — бывший военный медик. Он лечит наши раны и рассказывает о безопасных маршрутах через радиоактивные болота к северу.
[Благодаря Лекарства — результат x2!]`, noResourceText: `Староста {male} — бывший военный медик. Он лечит наши раны и рассказывает о безопасных маршрутах через радиоактивные болота к северу.
[Лекарства нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В поселении вспышка заразы. Нас не пускают за ограду — «Уходи! Здесь смерть!» — но кричат координаты другого убежища в обмен на обещание привести помощь.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.04) }), resourceCost: nextResource(), resourceText: `В поселении вспышка заразы. Нас не пускают за ограду — «Уходи! Здесь смерть!» — но кричат координаты другого убежища в обмен на обещание привести помощь.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `В поселении вспышка заразы. Нас не пускают за ограду — «Уходи! Здесь смерть!» — но кричат координаты другого убежища в обмен на обещание привести помощь.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Поселение закрытое — чужаков не любят. Сторожевые провожают до околицы с ружьями наперевес, но на прощание кидают банку тушёнки. «Не возвращайся».', weight: 15, effects: (_, level) => ({ healPercent: RF(0.02, 0.05), exp: E(level, 2) }), resourceCost: nextResource(), resourceText: `Поселение закрытое — чужаков не любят. Сторожевые провожают до околицы с ружьями наперевес, но на прощание кидают банку тушёнки. «Не возвращайся».
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `Поселение закрытое — чужаков не любят. Сторожевые провожают до околицы с ружьями наперевес, но на прощание кидают банку тушёнки. «Не возвращайся».
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      ] } },
  // 8. Hidden cache (loot)
  {
    text: 'Собака — худая, с облезлой шерстью — роет землю под старым дубом, у которого когда-то была развилка. Под лапами блестит ржавый металл. Пёс рычит, не подпуская, но в глазах — голод и отчаяние. Под корнями угадывается край дощатого ящика, обитого жестью. Похоже на чей-то тайник, забытый ещё до Катастрофы.',
    type: 'loot',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Отгоняем собаку и начинаем копать — закопанный ящик с оружием: два автомата, патроны и масло для чистки. Вековая находка в отличном состоянии!', weight: 20, effects: (_, level) => ({ itemCount: RANGE(3, 5), chips: C(level, 5), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Отгоняем собаку и начинаем копать — закопанный ящик с оружием: два автомата, патроны и масло для чистки. Вековая находка в отличном состоянии!
[Благодаря Железо — результат x2!]`, noResourceText: `Отгоняем собаку и начинаем копать — закопанный ящик с оружием: два автомата, патроны и масло для чистки. Вековая находка в отличном состоянии!
[Железо нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Делаем ящик рывком — внутри консервы, сухпайки и аптечка. Делимся с собакой галетой, она виляет хвостом и уходит, оставляя нам всё остальное.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.05, 0.10), itemCount: RANGE(2, 4), chips: C(level, 4) }), resourceCost: nextResource(), resourceText: `Делаем ящик рывком — внутри консервы, сухпайки и аптечка. Делимся с собакой галетой, она виляет хвостом и уходит, оставляя нам всё остальное.
[Благодаря Дерево — результат x2!]`, noResourceText: `Делаем ящик рывком — внутри консервы, сухпайки и аптечка. Делимся с собакой галетой, она виляет хвостом и уходит, оставляя нам всё остальное.
[Дерево нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В яме — не только ящик, но и запечатанный контейнер с чипами данных. Кто-то хорошо подготовился к концу света. Содержимое контейнера — карты и коды.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `В яме — не только ящик, но и запечатанный контейнер с чипами данных. Кто-то хорошо подготовился к концу света. Содержимое контейнера — карты и коды.
[Благодаря Инструменты — результат x2!]`, noResourceText: `В яме — не только ящик, но и запечатанный контейнер с чипами данных. Кто-то хорошо подготовился к концу света. Содержимое контейнера — карты и коды.
[Инструменты нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Собака кусает за руку, пока мы копаем — рана глубокая, может быть заражение. Бросаем затею, отступаем, перевязываем руку. Ящик остаётся неоткрытым.', weight: 20, effects: () => ({ damagePercent: RF(0.05, 0.09) }), resourceCost: nextResource(), resourceText: `Собака кусает за руку, пока мы копаем — рана глубокая, может быть заражение. Бросаем затею, отступаем, перевязываем руку. Ящик остаётся неоткрытым.
[С Гвозди урон смягчён — потери -50%.]`, noResourceText: `Собака кусает за руку, пока мы копаем — рана глубокая, может быть заражение. Бросаем затею, отступаем, перевязываем руку. Ящик остаётся неоткрытым.
[Без Гвозди — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'В яме — человеческие кости и ржавый нож. Забираем нож — хоть какое-то оружие — и несколько старых монет. Не густо, но на безрыбье и шука — чип.', weight: 15, effects: (_, level) => ({ itemCount: 1, chips: C(level, 4), exp: E(level, 1) }), resourceCost: nextResource(), resourceText: `В яме — человеческие кости и ржавый нож. Забираем нож — хоть какое-то оружие — и несколько старых монет. Не густо, но на безрыбье и шука — чип.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `В яме — человеческие кости и ржавый нож. Забираем нож — хоть какое-то оружие — и несколько старых монет. Не густо, но на безрыбье и шука — чип.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      ],
    },
  },
  // 9. Trap in the mist (danger)
  {
    text: 'Густой туман опускается внезапно — словно кто-то включил гигантскую машину смога. Видимость падает до пары метров, мир становится серым и ватным. В тумане слышны шаги — то приближаются, то удаляются. Кто-то ходит вокруг, невидимый в белой мгле. Воздух влажный и холодный, компас сходит с ума, стрелка крутится волчком. Впереди угадываются тени — то ли деревья, то ли люди.',
    type: 'danger',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Останавливаемся, прислушиваемся, готовим оружие. Из тумана выходят путники — обычные сталкеры, тоже заблудились. Идём вместе, находим дорогу.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.03, 0.05), chips: C(level, 3) }), resourceCost: nextResource(), resourceText: `Останавливаемся, прислушиваемся, готовим оружие. Из тумана выходят путники — обычные сталкеры, тоже заблудились. Идём вместе, находим дорогу.
[Благодаря Топливо — результат x2!]`, noResourceText: `Останавливаемся, прислушиваемся, готовим оружие. Из тумана выходят путники — обычные сталкеры, тоже заблудились. Идём вместе, находим дорогу.
[Топливо нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Разводим сигнальный костёр — туман редеет, становятся видны тропы. Выходим к старой ферме, где можно отдохнуть и собрать припасы.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.04, 0.08), exp: E(level, 4), chips: C(level, 4) }), resourceCost: nextResource(), resourceText: `Разводим сигнальный костёр — туман редеет, становятся видны тропы. Выходим к старой ферме, где можно отдохнуть и собрать припасы.
[Благодаря Батарейки — результат x2!]`, noResourceText: `Разводим сигнальный костёр — туман редеет, становятся видны тропы. Выходим к старой ферме, где можно отдохнуть и собрать припасы.
[Батарейки нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Идём на звук воды — выходим к ручью. Вода чистая, рядом — поляна без тумана. Устраиваем привал, восстанавливаем силы.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.06, 0.11), exp: E(level, 3) }), resourceCost: nextResource(), resourceText: `Идём на звук воды — выходим к ручью. Вода чистая, рядом — поляна без тумана. Устраиваем привал, восстанавливаем силы.
[Благодаря Консервы — результат x2!]`, noResourceText: `Идём на звук воды — выходим к ручью. Вода чистая, рядом — поляна без тумана. Устраиваем привал, восстанавливаем силы.
[Консервы нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Шаги приближаются — это бандитская засада. Начинается перестрелка в молоке, получаем ранение, но прорываемся. Патроны потрачены, аптечки израсходованы.', weight: 20, effects: (_, level) => ({ combat: true, damagePercent: RF(0.04, 0.08), chips: NC(level, 2) }), resourceCost: nextResource(), resourceText: `Шаги приближаются — это бандитская засада. Начинается перестрелка в молоке, получаем ранение, но прорываемся. Патроны потрачены, аптечки израсходованы.
[С Лекарства урон смягчён — потери -50%.]`, noResourceText: `Шаги приближаются — это бандитская засада. Начинается перестрелка в молоке, получаем ранение, но прорываемся. Патроны потрачены, аптечки израсходованы.
[Без Лекарства — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Проваливаемся в овраг, скрытый туманом. Падение болезненное, но выбираемся. Внизу находим труп неудачливого сталкера с парой ценных вещей.', weight: 15, effects: (_, level) => ({ damagePercent: RF(0.03, 0.06), itemCount: RANGE(1, 2), chips: C(level, 3) }), resourceCost: nextResource(), resourceText: `Проваливаемся в овраг, скрытый туманом. Падение болезненное, но выбираемся. Внизу находим труп неудачливого сталкера с парой ценных вещей.
[С Вода урон смягчён — потери -50%.]`, noResourceText: `Проваливаемся в овраг, скрытый туманом. Падение болезненное, но выбираемся. Внизу находим труп неудачливого сталкера с парой ценных вещей.
[Без Вода — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 10. Abandoned lab (discovery)
  {
    text: 'Трёхэтажное здание с герметичными дверями и разбитыми окнами. Табличка: «НИИ Биохимии, сектор 7 — вход строго по пропускам». Стены покрыты плесенью, на полу — битое стекло и высохшие лужи неизвестной жидкости. Изнутри доносится гул работающих генераторов — спустя столько лет здесь всё ещё есть электричество. В пробирках на стеллажах что-то светится тусклым зелёным светом.',
    type: 'discovery',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Лаборатория законсервирована идеально. В морозильниках — опытные образцы сывороток регенерации и карты генома. Настоящее сокровище для учёных!', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(2, 5), healPercent: RF(0.05, 0.10) }), resourceCost: nextResource(), resourceText: `Лаборатория законсервирована идеально. В морозильниках — опытные образцы сывороток регенерации и карты генома. Настоящее сокровище для учёных!
[Благодаря Изолента — результат x2!]`, noResourceText: `Лаборатория законсервирована идеально. В морозильниках — опытные образцы сывороток регенерации и карты генома. Настоящее сокровище для учёных!
[Изолента нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В кабинете завлаба находим сейф с документами и чипами данных. Терминал ещё работает. Скачиваем исследования, продаём торговцам информацией.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `В кабинете завлаба находим сейф с документами и чипами данных. Терминал ещё работает. Скачиваем исследования, продаём торговцам информацией.
[Благодаря Железо — результат x2!]`, noResourceText: `В кабинете завлаба находим сейф с документами и чипами данных. Терминал ещё работает. Скачиваем исследования, продаём торговцам информацией.
[Железо нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Находим склад готовой продукции — ящики с антирадином, стимуляторами и бинтами. Берём сколько унесём, снаряжение пополнено на годы вперёд.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.10, 0.18), itemCount: RANGE(3, 5), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Находим склад готовой продукции — ящики с антирадином, стимуляторами и бинтами. Берём сколько унесём, снаряжение пополнено на годы вперёд.
[Благодаря Дерево — результат x2!]`, noResourceText: `Находим склад готовой продукции — ящики с антирадином, стимуляторами и бинтами. Берём сколько унесём, снаряжение пополнено на годы вперёд.
[Дерево нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Срабатывает охранная система — автоматические турели открывают огонь. Укрываемся за стеллажами, получаем царапины от рикошетов, но теряем часть припасов.', weight: 20, effects: (_, level) => ({ damagePercent: RF(0.08, 0.14), combat: true, chips: NC(level, 2) }), resourceCost: nextResource(), resourceText: `Срабатывает охранная система — автоматические турели открывают огонь. Укрываемся за стеллажами, получаем царапины от рикошетов, но теряем часть припасов.
[С Инструменты урон смягчён — потери -50%.]`, noResourceText: `Срабатывает охранная система — автоматические турели открывают огонь. Укрываемся за стеллажами, получаем царапины от рикошетов, но теряем часть припасов.
[Без Инструменты — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Внутри — утечка газа из разбитых контейнеров. Едва успеваем надеть противогазы. Травимся, но успеваем забрать ценное оборудование из ламинарного шкафа.', weight: 15, effects: (_, level) => ({ damagePercent: 0.08, chips: C(level, 5), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Внутри — утечка газа из разбитых контейнеров. Едва успеваем надеть противогазы. Травимся, но успеваем забрать ценное оборудование из ламинарного шкафа.
[С Гвозди урон смягчён — потери -50%.]`, noResourceText: `Внутри — утечка газа из разбитых контейнеров. Едва успеваем надеть противогазы. Травимся, но успеваем забрать ценное оборудование из ламинарного шкафа.
[Без Гвозди — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 11. Nomad camp (neutral)
  {
    text: 'Шатры и кибитки из цветной парусины раскинулись на равнине — стоянка кочевников. Горят костры, на вертелах жарится мясо, пахнет дымом и специями. Женщины в длинных юбках хлопочут у котлов, мужчины в высоких шапках сидят кружком, играют на варганах и самодельных барабанах. Дети бегают между шатрами, поднимая пыль. Старший — старик с длинной седой бородой — поднимает голову и смотрит на нас.', type: 'neutral', noAutoBranch: true, branch: { prompt: '', outcomes: [
        { text: 'Старейшина рассказывает легенды Пустоши — о городах-призраках, подземных реках и летающих людях. В благодарность дарит амулет из кости и припасы.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.06, 0.12), chips: C(level, 5), exp: E(level, 4), itemCount: 1 }), resourceCost: nextResource(), resourceText: `Старейшина рассказывает легенды Пустоши — о городах-призраках, подземных реках и летающих людях. В благодарность дарит амулет из кости и припасы.
[Благодаря Пластмасса — результат x2!]`, noResourceText: `Старейшина рассказывает легенды Пустоши — о городах-призраках, подземных реках и летающих людях. В благодарность дарит амулет из кости и припасы.
[Пластмасса нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В лагере торгуют — свежее мясо, кожа, шкуры мутантов и информация о дорогах. Покупаем провизию и узнаём о бандитской засаде южнее.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.04, 0.08), exp: E(level, 4), chips: C(level, 4) }), resourceCost: nextResource(), resourceText: `В лагере торгуют — свежее мясо, кожа, шкуры мутантов и информация о дорогах. Покупаем провизию и узнаём о бандитской засаде южнее.
[Благодаря Топливо — результат x2!]`, noResourceText: `В лагере торгуют — свежее мясо, кожа, шкуры мутантов и информация о дорогах. Покупаем провизию и узнаём о бандитской засаде южнее.
[Топливо нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Знакомимся с местной знахаркой {female}. Она лечит наши раны травяными отварами и даёт мешочек целебных кореньев. «Пусть земля тебя хранит, странник».', weight: 20, effects: (_, level) => ({ healPercent: RF(0.08, 0.14), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Знакомимся с местной знахаркой {female}. Она лечит наши раны травяными отварами и даёт мешочек целебных кореньев. «Пусть земля тебя хранит, странник».
[Благодаря Батарейки — результат x2!]`, noResourceText: `Знакомимся с местной знахаркой {female}. Она лечит наши раны травяными отварами и даёт мешочек целебных кореньев. «Пусть земля тебя хранит, странник».
[Батарейки нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Кочевники принимают нас за лазутчика бандитов. «Ты пахнешь железом и кровью!». Приходится уходить без лишних вопросов, под градом камней и проклятий.', weight: 20, effects: (_, level) => ({ damagePercent: RF(0.02, 0.04), exp: E(level, 1) }), resourceCost: nextResource(), resourceText: `Кочевники принимают нас за лазутчика бандитов. «Ты пахнешь железом и кровью!». Приходится уходить без лишних вопросов, под градом камней и проклятий.
[С Консервы урон смягчён — потери -50%.]`, noResourceText: `Кочевники принимают нас за лазутчика бандитов. «Ты пахнешь железом и кровью!». Приходится уходить без лишних вопросов, под градом камней и проклятий.
[Без Консервы — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Участвуем в вечернем круге — песни, пляски, угощение. Отдыхаем душой и телом, но наутро просыпаемся с лёгкой головной болью от кумыса.', weight: 15, effects: (_, level) => ({ healPercent: RF(0.05, 0.09), exp: E(level, 3), chips: C(level, 1) }), resourceCost: nextResource(), resourceText: `Участвуем в вечернем круге — песни, пляски, угощение. Отдыхаем душой и телом, но наутро просыпаемся с лёгкой головной болью от кумыса.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Участвуем в вечернем круге — песни, пляски, угощение. Отдыхаем душой и телом, но наутро просыпаемся с лёгкой головной болью от кумыса.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      ] } },
  // 12. Underground garage (loot)
  {
    text: 'Пандус уходит под землю, скрываясь в темноте. С потолка свисают ржавые трубы, слышен мерный звук капающей воды — где-то прорвало магистраль. На стенах — граффити и старые плакаты с рекламой машин. Внизу угадываются силуэты автомобилей, превратившихся в груды ржавчины. Но в углу — верстак с инструментами и закрытый металлический контейнер. Гаражная мастерская может хранить сокровища.',
    type: 'loot',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Машины сгнили, но в мастерской — полный набор инструментов, сварочный аппарат и канистры с топливом. Всё это можно продать или использовать.', weight: 20, effects: (_, level) => ({ itemCount: RANGE(3, 5), chips: C(level, 5), exp: E(level, 3) }), resourceCost: nextResource(), resourceText: `Машины сгнили, но в мастерской — полный набор инструментов, сварочный аппарат и канистры с топливом. Всё это можно продать или использовать.
[Благодаря Вода — результат x2!]`, noResourceText: `Машины сгнили, но в мастерской — полный набор инструментов, сварочный аппарат и канистры с топливом. Всё это можно продать или использовать.
[Вода нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Находим мотоцикл в рабочем состоянии. Ключей нет, но можно замкнуть провода. До утра чиним его — теперь у нас есть транспорт.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `Находим мотоцикл в рабочем состоянии. Ключей нет, но можно замкнуть провода. До утра чиним его — теперь у нас есть транспорт.
[Благодаря Изолента — результат x2!]`, noResourceText: `Находим мотоцикл в рабочем состоянии. Ключей нет, но можно замкнуть провода. До утра чиним его — теперь у нас есть транспорт.
[Изолента нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В контейнере — ящики с автозапчастями и аккумуляторами. Среди хлама находим редкий спутниковый навигатор с картами региона.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: 1 }), resourceCost: nextResource(), resourceText: `В контейнере — ящики с автозапчастями и аккумуляторами. Среди хлама находим редкий спутниковый навигатор с картами региона.
[Благодаря Железо — результат x2!]`, noResourceText: `В контейнере — ящики с автозапчастями и аккумуляторами. Среди хлама находим редкий спутниковый навигатор с картами региона.
[Железо нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В гараже живёт семейство крысиных мутантов и одно крупное — вожак. Приходится уносить ноги, потеряв часть припасов в суматохе. Укусы болят.', weight: 20, effects: (_, level) => ({ damagePercent: RF(0.06, 0.12), chips: NC(level, 0), combat: true }), resourceCost: nextResource(), resourceText: `В гараже живёт семейство крысиных мутантов и одно крупное — вожак. Приходится уносить ноги, потеряв часть припасов в суматохе. Укусы болят.
[С Дерево урон смягчён — потери -50%.]`, noResourceText: `В гараже живёт семейство крысиных мутантов и одно крупное — вожак. Приходится уносить ноги, потеряв часть припасов в суматохе. Укусы болят.
[Без Дерево — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Обшариваем старую легковушку — в багажнике чемодан с одеждой и личными вещами. В подкладке пиджака зашита пачка чипов. Мелочь, а приятно.', weight: 15, effects: (_, level) => ({ chips: C(level, 5), itemCount: 1, exp: E(level, 2) }), resourceCost: nextResource(), resourceText: `Обшариваем старую легковушку — в багажнике чемодан с одеждой и личными вещами. В подкладке пиджака зашита пачка чипов. Мелочь, а приятно.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Обшариваем старую легковушку — в багажнике чемодан с одеждой и личными вещами. В подкладке пиджака зашита пачка чипов. Мелочь, а приятно.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      ],
    },
  },
  // 13. Electromagnetic storm (danger)
  {
    text: 'Волосы на руках встают дыбом, воздух начинает потрескивать и пахнуть озоном. Счётчик Гейгера зашкаливает, электроника в рюкзаке издаёт высокий писк. В небе вспыхивают лиловые сполохи — электромагнитная буря приближается с угрожающей скоростью. Вокруг искрят металлические предметы, статическое электричество щиплет кожу. Нужно срочно прятать электронику и искать укрытие — или рисковать всем снаряжением.',
    type: 'danger',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Прячем электронику в экранированный бокс и укрываемся в бетонном строении. Буря проходит стороной. Всё оборудование цело — подготовка окупилась.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.02, 0.04) }), resourceCost: nextResource(), resourceText: `Прячем электронику в экранированный бокс и укрываемся в бетонном строении. Буря проходит стороной. Всё оборудование цело — подготовка окупилась.
[Благодаря Гвозди — результат x2!]`, noResourceText: `Прячем электронику в экранированный бокс и укрываемся в бетонном строении. Буря проходит стороной. Всё оборудование цело — подготовка окупилась.
[Гвозди нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Буря застаёт на открытой местности, но находим старый трубопровод — залезаем внутрь. Металл принимает разряды на себя, мы отбиваемся лишь испугом.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 3) }), resourceCost: nextResource(), resourceText: `Буря застаёт на открытой местности, но находим старый трубопровод — залезаем внутрь. Металл принимает разряды на себя, мы отбиваемся лишь испугом.
[Благодаря Пластмасса — результат x2!]`, noResourceText: `Буря застаёт на открытой местности, но находим старый трубопровод — залезаем внутрь. Металл принимает разряды на себя, мы отбиваемся лишь испугом.
[Пластмасса нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Успеваем натянуть диэлектрические перчатки и плащ. Статическое электричество стекает, не причиняя вреда. Находим среди камней оплавленный метеорит.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), damagePercent: RF(0.01, 0.02) }), resourceCost: nextResource(), resourceText: `Успеваем натянуть диэлектрические перчатки и плащ. Статическое электричество стекает, не причиняя вреда. Находим среди камней оплавленный метеорит.
[Благодаря Топливо — результат x2!]`, noResourceText: `Успеваем натянуть диэлектрические перчатки и плащ. Статическое электричество стекает, не причиняя вреда. Находим среди камней оплавленный метеорит.
[Топливо нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Идём прямо в бурю — спешка берёт верх. Получаем сильный удар током, теряем часть электроники. Приборы сгорели, чипы памяти потеряны.', weight: 20, effects: (_, level) => ({ damagePercent: 0.10, chips: NC(level, 2) }), resourceCost: nextResource(), resourceText: `Идём прямо в бурю — спешка берёт верх. Получаем сильный удар током, теряем часть электроники. Приборы сгорели, чипы памяти потеряны.
[С Батарейки урон смягчён — потери -50%.]`, noResourceText: `Идём прямо в бурю — спешка берёт верх. Получаем сильный удар током, теряем часть электроники. Приборы сгорели, чипы памяти потеряны.
[Без Батарейки — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Укрываемся в металлическом ангаре — плохое решение. Здание притягивает разряды. Контужены, но живы. Электроника частично вышла из строя.', weight: 15, effects: (_, level) => ({ damagePercent: RF(0.05, 0.10), chips: NC(level, 2), exp: E(level, 2) }), resourceCost: nextResource(), resourceText: `Укрываемся в металлическом ангаре — плохое решение. Здание притягивает разряды. Контужены, но живы. Электроника частично вышла из строя.
[С Консервы урон смягчён — потери -50%.]`, noResourceText: `Укрываемся в металлическом ангаре — плохое решение. Здание притягивает разряды. Контужены, но живы. Электроника частично вышла из строя.
[Без Консервы — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 14. Pit stop shelter (heal)
  {
    text: 'Придорожное кафе «Последняя закусочная» — вывеска покосилась, краска облупилась, но неоновая трубка над дверью всё ещё тускло светится. Изнутри доносится старая музыка — шансон на кассете. Дверь открыта, на пороге — мужчина в грязном фартуке, вытирает кружку. «Заходи, путник. У меня есть горячий кофе и яичница. Давно не заглядывали гости». Внутри тепло, пахнет жареным луком и хлебом. Настоящий оазис в пустоши.',
    type: 'heal',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Хозяин — ветеран, варит отличный кофе и кормит яичницей с хлебом. «Давно у меня таких гостей не было». Сытный обед восстанавливает силы.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.12, 0.22), chips: C(level, 3), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Хозяин — ветеран, варит отличный кофе и кормит яичницей с хлебом. «Давно у меня таких гостей не было». Сытный обед восстанавливает силы.
[Благодаря Лекарства — результат x2!]`, noResourceText: `Хозяин — ветеран, варит отличный кофе и кормит яичницей с хлебом. «Давно у меня таких гостей не было». Сытный обед восстанавливает силы.
[Лекарства нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В кафе пусто — хозяин ушёл. В холодильнике — пара банок газировки и консервы. Отдыхаем в тишине под старую музыку. Никто не мешает.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.06, 0.11), itemCount: RANGE(1, 2), exp: E(level, 3) }), resourceCost: nextResource(), resourceText: `В кафе пусто — хозяин ушёл. В холодильнике — пара банок газировки и консервы. Отдыхаем в тишине под старую музыку. Никто не мешает.
[Благодаря Вода — результат x2!]`, noResourceText: `В кафе пусто — хозяин ушёл. В холодильнике — пара банок газировки и консервы. Отдыхаем в тишине под старую музыку. Никто не мешает.
[Вода нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Хозяин — бывший полевой врач {male} {nick}. Он осматривает наши раны, делает перевязку и даёт обезболивающее. «С такими ранами далеко не уйдёшь, брат».', weight: 20, effects: (_, level) => ({ healPercent: RF(0.10, 0.18), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Хозяин — бывший полевой врач {male} {nick}. Он осматривает наши раны, делает перевязку и даёт обезболивающее. «С такими ранами далеко не уйдёшь, брат».
[Благодаря Изолента — результат x2!]`, noResourceText: `Хозяин — бывший полевой врач {male} {nick}. Он осматривает наши раны, делает перевязку и даёт обезболивающее. «С такими ранами далеко не уйдёшь, брат».
[Изолента нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Засада — в подсобке сидят трое бандитов, ждут добычу. Бой в тесном помещении, переворачиваем столы, получаем удар ножом, но вырываемся.', weight: 20, effects: (_, level) => ({ combat: true, damagePercent: RF(0.05, 0.10), chips: NC(level, 2) }), resourceCost: nextResource(), resourceText: `Засада — в подсобке сидят трое бандитов, ждут добычу. Бой в тесном помещении, переворачиваем столы, получаем удар ножом, но вырываемся.
[С Железо урон смягчён — потери -50%.]`, noResourceText: `Засада — в подсобке сидят трое бандитов, ждут добычу. Бой в тесном помещении, переворачиваем столы, получаем удар ножом, но вырываемся.
[Без Железо — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Еда оказывается просроченной — тушёнка горчит, хлеб чёрствый. Но горячий чай греет, и крыша над головой — уже роскошь для Пустоши.', weight: 15, effects: (_, level) => ({ healPercent: RF(0.03, 0.06), exp: E(level, 2), chips: NC(level, 0) }), resourceCost: nextResource(), resourceText: `Еда оказывается просроченной — тушёнка горчит, хлеб чёрствый. Но горячий чай греет, и крыша над головой — уже роскошь для Пустоши.
[С Дерево урон смягчён — потери -50%.]`, noResourceText: `Еда оказывается просроченной — тушёнка горчит, хлеб чёрствый. Но горячий чай греет, и крыша над головой — уже роскошь для Пустоши.
[Без Дерево — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 15. Mysterious signal (discovery)
  {
    text: 'Детектор аномалий издаёт ритмичный писк — рядом источник неизвестного сигнала. Прибор показывает слабое электромагнитное поле. В кустах, частично скрытый ветками, лежит работающий маяк старых военных образцов. Красный индикатор мерцает, антенна медленно вращается. Кто-то оставил его здесь — или потерял, или намеренно поставил как приманку. Рядом — следы шин и обрывки парашютной стропы.',
    type: 'discovery',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Сигнал от дрона-курьера с грузовым отсеком. Внутри — заказанные кем-то лекарства, карты и пачка чипов. Забираем — в Пустоше нет хозяев.', weight: 20, effects: (_, level) => ({ itemCount: RANGE(2, 4), chips: C(level, 5), exp: E(level, 4), healPercent: RF(0.03, 0.05) }), resourceCost: nextResource(), resourceText: `Сигнал от дрона-курьера с грузовым отсеком. Внутри — заказанные кем-то лекарства, карты и пачка чипов. Забираем — в Пустоше нет хозяев.
[Благодаря Инструменты — результат x2!]`, noResourceText: `Сигнал от дрона-курьера с грузовым отсеком. Внутри — заказанные кем-то лекарства, карты и пачка чипов. Забираем — в Пустоше нет хозяев.
[Инструменты нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Маяк указывает на схрон в расщелине скалы — герметичный контейнер с довоенным оружием и боеприпасами. Кто-то хорошо подготовился.', weight: 20, effects: (_, level) => ({ itemCount: RANGE(2, 4), chips: C(level, 5), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Маяк указывает на схрон в расщелине скалы — герметичный контейнер с довоенным оружием и боеприпасами. Кто-то хорошо подготовился.
[Благодаря Гвозди — результат x2!]`, noResourceText: `Маяк указывает на схрон в расщелине скалы — герметичный контейнер с довоенным оружием и боеприпасами. Кто-то хорошо подготовился.
[Гвозди нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Сигнал от потерпевшего крушение вертолёта. Внутри — мёртвый пилот и ценные приборы. Забираем навигационное оборудование и бортовой журнал.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), itemCount: RANGE(1, 3), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Сигнал от потерпевшего крушение вертолёта. Внутри — мёртвый пилот и ценные приборы. Забираем навигационное оборудование и бортовой журнал.
[Благодаря Пластмасса — результат x2!]`, noResourceText: `Сигнал от потерпевшего крушение вертолёта. Внутри — мёртвый пилот и ценные приборы. Забираем навигационное оборудование и бортовой журнал.
[Пластмасса нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Маяк — ловушка. Вокруг растяжки с гранатами. Чудом замечаем тонкую проволоку, но при отступлении подрываем сигнальную мину — контузия.', weight: 20, effects: (_, level) => ({ damagePercent: RF(0.08, 0.12), exp: E(level, 2) }), resourceCost: nextResource(), resourceText: `Маяк — ловушка. Вокруг растяжки с гранатами. Чудом замечаем тонкую проволоку, но при отступлении подрываем сигнальную мину — контузия.
[С Топливо урон смягчён — потери -50%.]`, noResourceText: `Маяк — ловушка. Вокруг растяжки с гранатами. Чудом замечаем тонкую проволоку, но при отступлении подрываем сигнальную мину — контузия.
[Без Топливо — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Маяк оказывается пустышкой — батарея села, сигнал слабый. Вокруг — никакого схрона. Только старый ржавый ящик с гнилыми тряпками внутри.', weight: 15, effects: (_, level) => ({ exp: E(level, 3), chips: C(level, 2) }), resourceCost: nextResource(), resourceText: `Маяк оказывается пустышкой — батарея села, сигнал слабый. Вокруг — никакого схрона. Только старый ржавый ящик с гнилыми тряпками внутри.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `Маяк оказывается пустышкой — батарея села, сигнал слабый. Вокруг — никакого схрона. Только старый ржавый ящик с гнилыми тряпками внутри.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      ],
    },
  },
  // 16. Bandit checkpoint (combat)
  {
    text: 'Дорога перекрыта самодельным шлагбаумом из ржавых труб и колючей проволоки. За ним — укрепление из мешков с песком и трое вооружённых бандитов. У одного — обрез, у второго — автомат, третий лениво жуёт травинку. «Стоять! Плати за проезд, чучело!» — кричит главный, поигрывая монтировкой. За их спинами видна палатка с награбленным добром. Вариантов немного: платить, драться или искать обход.',
    type: 'combat',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Бандиты повержены — забираем их припасы, чипы и оружие. В палатке находим карту с пометками других засад — ценная информация.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), itemCount: RANGE(2, 4), exp: E(level, 4), combat: true }), resourceCost: nextResource(), resourceText: `Бандиты повержены — забираем их припасы, чипы и оружие. В палатке находим карту с пометками других засад — ценная информация.
[Благодаря Консервы — результат x2!]`, noResourceText: `Бандиты повержены — забираем их припасы, чипы и оружие. В палатке находим карту с пометками других засад — ценная информация.
[Консервы нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Платим дань — бандиты довольны, пропускают без проблем. Обходимся малой кровью, сохраняя здоровье для более важных дел.', weight: 20, effects: (_, level) => ({ chips: NC(level, 2), exp: E(level, 2) }), resourceCost: nextResource(), resourceText: `Платим дань — бандиты довольны, пропускают без проблем. Обходимся малой кровью, сохраняя здоровье для более важных дел.
[Благодаря Лекарства — результат x2!]`, noResourceText: `Платим дань — бандиты довольны, пропускают без проблем. Обходимся малой кровью, сохраняя здоровье для более важных дел.
[Лекарства нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Используем тактику — заходим с фланга через лес. Снимаем часового арбалетом, остальные разбегаются. Забираем трофеи без лишнего шума.', weight: 20, effects: (_, level) => ({ combat: true, chips: C(level, 5), exp: E(level, 4), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `Используем тактику — заходим с фланга через лес. Снимаем часового арбалетом, остальные разбегаются. Забираем трофеи без лишнего шума.
[Благодаря Вода — результат x2!]`, noResourceText: `Используем тактику — заходим с фланга через лес. Снимаем часового арбалетом, остальные разбегаются. Забираем трофеи без лишнего шума.
[Вода нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Бандиты оказываются опытными бойцами — в бою получаем тяжёлое ранение, теряем припасы. Едва выживаем и уходим в лес зализывать раны.', weight: 20, effects: (_, level) => ({ damagePercent: RF(0.10, 0.16), chips: NC(level, 2), exp: E(level, 3) }), resourceCost: nextResource(), resourceText: `Бандиты оказываются опытными бойцами — в бою получаем тяжёлое ранение, теряем припасы. Едва выживаем и уходим в лес зализывать раны.
[С Изолента урон смягчён — потери -50%.]`, noResourceText: `Бандиты оказываются опытными бойцами — в бою получаем тяжёлое ранение, теряем припасы. Едва выживаем и уходим в лес зализывать раны.
[Без Изолента — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Увидев деньги, бандиты жалеют, что запросили мало. Начинается бой, отбиваемся, но часть чипов уже потеряна в суматохе.', weight: 15, effects: (_, level) => ({ combat: true, damagePercent: RF(0.03, 0.07), chips: NC(level, 2), exp: E(level, 3) }), resourceCost: nextResource(), resourceText: `Увидев деньги, бандиты жалеют, что запросили мало. Начинается бой, отбиваемся, но часть чипов уже потеряна в суматохе.
[С Железо урон смягчён — потери -50%.]`, noResourceText: `Увидев деньги, бандиты жалеют, что запросили мало. Начинается бой, отбиваемся, но часть чипов уже потеряна в суматохе.
[Без Железо — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 17. Hermit in the woods (neutral)
  {
    text: 'Маленькая избушка в глубине леса, почти скрытая среди вековых сосен. Из трубы идёт ровный дымок, на подоконнике — герань в глиняном горшке. На крыльце сидит старик с длинной седой бородой и старым охотничьим ружьём на коленях. Он чинит рыболовную сеть, напевая что-то себе под нос. Рядом — связка сушёных грибов и трав. Завидев нас, он не пугается, а спокойно кивает: «Проходи, коли с миром».',
    type: 'neutral',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Отшельник представляется {male} {nick}, бывшим военным врачом. Он лечит наши раны, даёт травяной чай и подробную карту местных аномалий.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.12, 0.22), exp: E(level, 4), chips: C(level, 3) }), resourceCost: nextResource(), resourceText: `Отшельник представляется {male} {nick}, бывшим военным врачом. Он лечит наши раны, даёт травяной чай и подробную карту местных аномалий.
[Благодаря Дерево — результат x2!]`, noResourceText: `Отшельник представляется {male} {nick}, бывшим военным врачом. Он лечит наши раны, даёт травяной чай и подробную карту местных аномалий.
[Дерево нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Старик — коллекционер. Показывает коллекцию довоенных артефактов: телефоны, флешки, CD-диски, старые журналы. Дарит книгу c ценными схемами.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), chips: C(level, 5), itemCount: 1 }), resourceCost: nextResource(), resourceText: `Старик — коллекционер. Показывает коллекцию довоенных артефактов: телефоны, флешки, CD-диски, старые журналы. Дарит книгу c ценными схемами.
[Благодаря Инструменты — результат x2!]`, noResourceText: `Старик — коллекционер. Показывает коллекцию довоенных артефактов: телефоны, флешки, CD-диски, старые журналы. Дарит книгу c ценными схемами.
[Инструменты нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Помогаем по хозяйству — колем дрова, чиним крышу. Старик доволен, угощает ужином из лесных грибов и даёт настойку от радиации.', weight: 20, effects: (_, level) => ({ healPercent: RF(0.06, 0.12), exp: E(level, 4), itemCount: RANGE(1, 2) }), resourceCost: nextResource(), resourceText: `Помогаем по хозяйству — колем дрова, чиним крышу. Старик доволен, угощает ужином из лесных грибов и даёт настойку от радиации.
[Благодаря Гвозди — результат x2!]`, noResourceText: `Помогаем по хозяйству — колем дрова, чиним крышу. Старик доволен, угощает ужином из лесных грибов и даёт настойку от радиации.
[Гвозди нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Отшельник безумен — принимает нас за «солдата Империи». Под дулом ружья выгоняет, стреляет вслед. Едва уносим ноги, царапина от дроби.', weight: 20, effects: () => ({ damagePercent: RF(0.08, 0.12) }), resourceCost: nextResource(), resourceText: `Отшельник безумен — принимает нас за «солдата Империи». Под дулом ружья выгоняет, стреляет вслед. Едва уносим ноги, царапина от дроби.
[С Пластмасса урон смягчён — потери -50%.]`, noResourceText: `Отшельник безумен — принимает нас за «солдата Империи». Под дулом ружья выгоняет, стреляет вслед. Едва уносим ноги, царапина от дроби.
[Без Пластмасса — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'В избе — засада. Трое бандитов отдыхали после налёта. Бой в тесной избе, используем старика как прикрытие. Вырываемся с потерями.', weight: 15, effects: (_, level) => ({ combat: true, damagePercent: RF(0.08, 0.12), chips: C(level, 1), exp: E(level, 3) }), resourceCost: nextResource(), resourceText: `В избе — засада. Трое бандитов отдыхали после налёта. Бой в тесной избе, используем старика как прикрытие. Вырываемся с потерями.
[С Топливо урон смягчён — потери -50%.]`, noResourceText: `В избе — засада. Трое бандитов отдыхали после налёта. Бой в тесной избе, используем старика как прикрытие. Вырываемся с потерями.
[Без Топливо — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
  // 18. Radio tower (discovery)
  {
    text: 'Впереди возвышается старая радиовышка — ржавая конструкция, уходящая в самое небо. Антенны тянутся к тучам, провода искрят при порывах ветра. Лестница выглядит надёжной, хотя некоторые ступеньки проржавели. Поднимаемся на смотровую площадку — оттуда открывается панорама всего региона: леса, болота, руины города на горизонте, столбы дыма. В кабине под площадкой — работающая рация и пульт. Лампочки горят, динамик шипит помехами.',
    type: 'discovery',
    noAutoBranch: true,
    branch: {
      prompt: '',
      outcomes: [
        { text: 'Выходим на связь — неизвестный представляется {male} «{nick}», местный искатель артефактов. Он даёт координаты ценного трофея в руинах.', weight: 20, effects: (_, level) => ({ chips: C(level, 5), exp: E(level, 4), itemCount: 1 }), resourceCost: nextResource(), resourceText: `Выходим на связь — неизвестный представляется {male} «{nick}», местный искатель артефактов. Он даёт координаты ценного трофея в руинах.
[Благодаря Батарейки — результат x2!]`, noResourceText: `Выходим на связь — неизвестный представляется {male} «{nick}», местный искатель артефактов. Он даёт координаты ценного трофея в руинах.
[Батарейки нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Находим журнал радиста с картами местности и координатами складов припасов. Целый кладезь информации для дальнейших рейдов.', weight: 20, effects: (_, level) => ({ itemCount: RANGE(2, 4), chips: C(level, 5), exp: E(level, 4) }), resourceCost: nextResource(), resourceText: `Находим журнал радиста с картами местности и координатами складов припасов. Целый кладезь информации для дальнейших рейдов.
[Благодаря Консервы — результат x2!]`, noResourceText: `Находим журнал радиста с картами местности и координатами складов припасов. Целый кладезь информации для дальнейших рейдов.
[Консервы нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'Из рации слышен сигнал бедствия — кто-то просит помощи в паре километров. Помогаем путникам, получаем награду и благословение.', weight: 20, effects: (_, level) => ({ exp: E(level, 4), healPercent: RF(0.04, 0.08), chips: C(level, 5) }), resourceCost: nextResource(), resourceText: `Из рации слышен сигнал бедствия — кто-то просит помощи в паре километров. Помогаем путникам, получаем награду и благословение.
[Благодаря Лекарства — результат x2!]`, noResourceText: `Из рации слышен сигнал бедствия — кто-то просит помощи в паре километров. Помогаем путникам, получаем награду и благословение.
[Лекарства нет — упускаем выгоду.]`, resourceEffects: (_, level) => ({ itemCount: RANGE(1, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
        { text: 'В рубке — ловушка. Провода под напряжением, получаем разряд. Контужены, но успеваем вырубить рубильник и забрать трофеи со стола.', weight: 20, effects: (_, level) => ({ damagePercent: RF(0.08, 0.12), chips: C(level, 1) }), resourceCost: nextResource(), resourceText: `В рубке — ловушка. Провода под напряжением, получаем разряд. Контужены, но успеваем вырубить рубильник и забрать трофеи со стола.
[С Вода урон смягчён — потери -50%.]`, noResourceText: `В рубке — ловушка. Провода под напряжением, получаем разряд. Контужены, но успеваем вырубить рубильник и забрать трофеи со стола.
[Без Вода — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
        { text: 'Внизу слышны голоса — к вышке приближается бандитский патруль. Приходится быстро покидать вышку, прыгая с нижней площадки и ловя ветки.', weight: 15, effects: (_, level) => ({ damagePercent: RF(0.02, 0.04), exp: E(level, 3), combat: true }), resourceCost: nextResource(), resourceText: `Внизу слышны голоса — к вышке приближается бандитский патруль. Приходится быстро покидать вышку, прыгая с нижней площадки и ловя ветки.
[С Изолента урон смягчён — потери -50%.]`, noResourceText: `Внизу слышны голоса — к вышке приближается бандитский патруль. Приходится быстро покидать вышку, прыгая с нижней площадки и ловя ветки.
[Без Изолента — урон x2, потери серьёзные.]`, resourceEffects: (_, level) => ({ damagePercent: -0.04 }), noResourceEffects: (_, level) => ({ damagePercent: 0.04 }) },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Final generator
// ---------------------------------------------------------------------------
type EventCategory = {
  templates: EventTemplate[];
  weight: number;
};

const ALL_EVENT_CATEGORIES: EventCategory[] = [
  { templates: combatTemplates, weight: 35 },
  { templates: tradeTemplates, weight: 12 },
  { templates: helpTemplates, weight: 12 },
  { templates: trapTemplates, weight: 10 },
  { templates: lootTemplates, weight: 15 },
  { templates: discoveryTemplates, weight: 10 },
  { templates: anomalyTemplates, weight: 5 },
  { templates: npcTemplates, weight: 12 },
  { templates: restTemplates, weight: 4 },
  { templates: factionSpecific, weight: 6 },
  { templates: specialTemplates, weight: 3 },
  { templates: branchingTemplates, weight: 24 },
];

const ZONE_DESC: Record<string, string> = {
  'Болото': 'туманных болот',
  'Заброшенная военная база и окрестности': 'заброшенной военной базы и окрестностей',
  'Свалка мусора': 'свалки',
  'Темный лес': 'тёмного леса',
  'База бандитов': 'бандитского лагеря',
  'Руины города': 'городских руин',
  'Старый завод': 'старого завода',
};

const randomName = (male = true) => PICK(male ? MALE_NAMES : FEMALE_NAMES);
const randomNick = () => PICK(NICKNAMES);
const randomItem = () => PICK(ITEM_NAMES);
const randomRoom = () => PICK(LOOT_ROOMS);

const renderEffects = (effects: EventEffects): string => {
  const parts: string[] = [];
  if (effects.chips && effects.chips > 0) parts.push(`💾+${effects.chips}`);
  if (effects.chips && effects.chips < 0) parts.push(`💾${effects.chips}`);
  if (effects.exp && effects.exp > 0) parts.push(`⚡+${effects.exp}`);
  if (effects.damage && effects.damage > 0) parts.push(`💥-${effects.damage}`);
  if (effects.damagePercent && effects.damagePercent > 0) parts.push(`💥-${Math.round(effects.damagePercent * 100)}%`);
  if (effects.heal && effects.heal > 0) parts.push(`💚+${effects.heal}`);
  if (effects.healPercent && effects.healPercent > 0) parts.push(`💚+${Math.round(effects.healPercent * 100)}%`);
  if (effects.combat) parts.push('⚔️');
  return parts.length > 0 ? `\n${parts.join(' ')}` : '';
};

const substitute = (text: string, zoneDesc: string, faction: string): string =>
  text
    .replace(/\{zone\}/g, zoneDesc)
    .replace(/\{faction\}/g, faction)
    .replace(/\{male\}/g, randomName(true))
    .replace(/\{female\}/g, randomName(false))
    .replace(/\{nick\}/g, randomNick())
    .replace(/\{item\}/g, randomItem())
    .replace(/\{room\}/g, randomRoom());

export const generateExplorationEvent = (
  zoneName: string,
  _zoneDifficulty: number,
  zoneFactions: string[],
  _playerLevel: number,
): ExplorationEventResult => {
  const faction = zoneFactions.length > 0 ? PICK(zoneFactions) : 'Бандиты';
  const zoneDesc = ZONE_DESC[zoneName] || zoneName;

  const totalWeight = ALL_EVENT_CATEGORIES.reduce((s, c) => s + c.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosenCategory = ALL_EVENT_CATEGORIES[0];
  for (const cat of ALL_EVENT_CATEGORIES) {
    roll -= cat.weight;
    if (roll <= 0) { chosenCategory = cat; break; }
  }

  const template = PICK(chosenCategory.templates);
  const baseText = substitute(template.text, zoneDesc, faction);
  let baseEffects = template.effects?.(zoneName, _playerLevel) || {};
  let decision: string | undefined;

  // Resolve branching
  const branchToUse = template.branch || getAutoBranch(template, zoneName);
  if (branchToUse) {
    const branchResult = resolveBranch(branchToUse, zoneName, _playerLevel);
    const substitutedTexts = branchResult.texts.map((t) => substitute(t, zoneDesc, faction));
    const branchText = substitutedTexts.join(' → ');
    decision = substitutedTexts[0];
    // Merge effects
    for (const [k, v] of Object.entries(branchResult.effects)) {
      if (v) (baseEffects as any)[k] = ((baseEffects as any)[k] || 0) + (v as number);
    }

    const fullText = `${baseText} → ${branchText}`;
    return { text: fullText, type: template.type, effects: baseEffects, decision, resourceCost: branchResult.resourceCost, resourceHad: branchResult.resourceHad };
  }

  const fullText = baseText;
  return { text: fullText, type: template.type, effects: baseEffects, decision };
};

// ---------------------------------------------------------------------------
// Legendary events — multi-stage chains with 70/30 continue/end at each stage
// ---------------------------------------------------------------------------
export const LEGENDARY_EVENTS: LegendaryEventData[] = [
  {
    id: 'bunker_zarya',
    title: 'Затерянный бункер «Заря»',
    description: 'Вы натыкаетесь на полузасыпанный вход в старый бункер. Тяжёлая гермодверь поддаётся с натужным скрипом. Внутри — холодный воздух и запах ржавчины. Скорее всего, здесь никого не было со времён Войны.',
    stages: [
      { text: 'Тёмный коридор уходит вглубь. Лампы аварийного освещения тускло мерцают, выхватывая из темноты облупившиеся стены и кабельные лотки под потолком.', continueChoice: 'Включить фонарь и идти дальше', retreatChoice: 'Вернуться, пока не поздно', successText: 'Фонарь выхватывает ржавую табличку: «Объект Заря — особый сектор». Вы осторожно продвигаетесь вглубь.', failText: 'Сердце колотится. В темноте чудятся шаги. Вы решаете, что риск слишком велик, и поворачиваете назад.', rewards: (level) => ({ chips: LC(level, 0), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `Тёмный коридор уходит вглубь. Лампы аварийного освещения тускло мерцают, выхватывая из темноты облупившиеся стены и кабельные лотки под потолком.
[Железо помог выжать максимум из ситуации.]`, noResourceText: `Тёмный коридор уходит вглубь. Лампы аварийного освещения тускло мерцают, выхватывая из темноты облупившиеся стены и кабельные лотки под потолком.
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Коридор ведёт в просторный зал с рядами металлических шкафов. Часть шкафов взломана, содержимое разбросано по полу.', continueChoice: 'Обыскать шкафы', retreatChoice: 'Не рисковать, уйти', successText: 'В одном из шкафов находите ящик с армейскими пайками и аптечкой. Среди хлама — несколько чипов.', failText: 'Дыхание сбивается, в глазах темнеет от напряжения. Нужно выбираться, пока силы не оставили окончательно.', rewards: (level) => ({ chips: LC(level, 0), exp: LE(level, 0), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Коридор ведёт в просторный зал с рядами металлических шкафов. Часть шкафов взломана, содержимое разбросано по полу.
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `Коридор ведёт в просторный зал с рядами металлических шкафов. Часть шкафов взломана, содержимое разбросано по полу.
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Из зала ведут три двери. На одной табличка «Серверная», на другой «Архив», третья — просто железная, без опознавательных знаков.', continueChoice: 'Идти в серверную', retreatChoice: 'Дальше опасно, возвращаемся', successText: 'Серверная уцелела частично. Один блок питания всё ещё гудит. Находите съёмные жёсткие диски — ценный груз.', failText: 'Ноги подкашиваются от усталости. Вы прислоняетесь к стене и понимаете — ещё немного, и вы потеряете сознание. Пора уходить.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Из зала ведут три двери. На одной табличка «Серверная», на другой «Архив», третья — просто железная, без опознавательных знаков.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Из зала ведут три двери. На одной табличка «Серверная», на другой «Архив», третья — просто железная, без опознавательных знаков.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'За серверной обнаруживается жилой отсек. Койки, тумбочки, на стене — выцветший плакат с распорядком дня. Кто-то жил здесь годами.', continueChoice: 'Обыскать жилой отсек', retreatChoice: 'Слишком жутко, уходим', successText: 'Под матрасом одной из коек находите дневник и личные вещи офицера. В тумбочке — заначка чипов.', failText: 'Вас пробивает дрожь — то ли от холода, то ли от нервов. Стены давят. Вы решаете, что хватит.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `За серверной обнаруживается жилой отсек. Койки, тумбочки, на стене — выцветший плакат с распорядком дня. Кто-то жил здесь годами.
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `За серверной обнаруживается жилой отсек. Койки, тумбочки, на стене — выцветший плакат с распорядком дня. Кто-то жил здесь годами.
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Дневник офицера упоминает «секретный склад №7». Судя по схеме в конце тетради, склад находится этажом ниже. Лестница цела.', continueChoice: 'Спуститься на нижний уровень', retreatChoice: 'Хватит приключений на сегодня', successText: 'Вы спускаетесь по шаткой лестнице. Внизу — массивная дверь с кодовым замком. Код записан в дневнике!', failText: 'Ступеньки жалобно скрипят. Снизу тянет сыростью и чем-то кислым. Чутьё кричит: «Назад!»', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Дневник офицера упоминает «секретный склад №7». Судя по схеме в конце тетради, склад находится этажом ниже. Лестница цела.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `Дневник офицера упоминает «секретный склад №7». Судя по схеме в конце тетради, склад находится этажом ниже. Лестница цела.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Дверь открывается. За ней — небольшой склад. Ящики с маркировкой «Мед. имущество», стеллажи с оружием в смазке, и главное — сейф в углу.', continueChoice: 'Вскрыть сейф', retreatChoice: 'Не искушать судьбу, уйти с тем, что есть', successText: 'Сейф открывается. Внутри — пачки чипов, несколько артефактов в свинцовых контейнерах и старая нашивка «Заря».', failText: 'Пальцы немеют при попытке набрать код. Адреналин зашкаливает. Вы отступаете.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Дверь открывается. За ней — небольшой склад. Ящики с маркировкой «Мед. имущество», стеллажи с оружием в смазке, и главное — сейф в углу.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `Дверь открывается. За ней — небольшой склад. Ящики с маркировкой «Мед. имущество», стеллажи с оружием в смазке, и главное — сейф в углу.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Сзади внезапно срабатывает автоматика — гермодверь склада начинает закрываться! Нужно выбираться, пока не замуровало.', continueChoice: 'Рвануть к выходу', retreatChoice: 'Это конец, сдаться', successText: 'Вы ныряете в щель за секунду до того, как створки смыкаются. За дверью — очередной коридор, ведущий ещё глубже.', failText: 'Гермодверь захлопывается перед самым носом. Вы пытаетесь открыть — бесполезно. Приходится искать другой путь наверх.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 2), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Сзади внезапно срабатывает автоматика — гермодверь склада начинает закрываться! Нужно выбираться, пока не замуровало.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `Сзади внезапно срабатывает автоматика — гермодверь склада начинает закрываться! Нужно выбираться, пока не замуровало.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Новый коридор выводит в командный центр. Мониторы погасли, но один — всё ещё моргает. На экране — предупреждение: «Утечка радиации в секторе 7».', continueChoice: 'Проверить командный центр', retreatChoice: 'Радиация — не шутка, уходим', successText: 'Вы находите аварийный протокол и отключаете сигнализацию. В терминале — координаты других бункеров.', failText: 'Счётчик Гейгера трещит. Вы разворачиваетесь и бежите прочь, забив на всё.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 2), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `Новый коридор выводит в командный центр. Мониторы погасли, но один — всё ещё моргает. На экране — предупреждение: «Утечка радиации в секторе 7».
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `Новый коридор выводит в командный центр. Мониторы погасли, но один — всё ещё моргает. На экране — предупреждение: «Утечка радиации в секторе 7».
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Из командного центра ведёт потайная дверь, замаскированная под шкаф. За ней — крутая лестница вниз, в самое сердце бункера.', continueChoice: 'Спуститься по потайной лестнице', retreatChoice: 'Чувство самосохранения побеждает', successText: 'Лестница ведёт в главное хранилище. Мощные генераторы всё ещё работают, освещая ряды стеллажей с артефактами.', failText: 'На середине лестницы доска под ногами проваливается. Вы чудом не ломаете ногу. Дальше нельзя.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `Из командного центра ведёт потайная дверь, замаскированная под шкаф. За ней — крутая лестница вниз, в самое сердце бункера.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Из командного центра ведёт потайная дверь, замаскированная под шкаф. За ней — крутая лестница вниз, в самое сердце бункера.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Хранилище «Зари». Здесь, по легендам, хранились прототипы технологий, способные изменить ход войны. В центре зала — пьедестал с кейсом.', continueChoice: 'Открыть центральный кейс', retreatChoice: 'Слишком ценно, чтобы забирать', successText: 'Кейс открывается. Внутри — переливающийся артефакт невероятной красоты. Вы чувствуете, как сила разливается по телу. Легендарная находка!', failText: 'Система охраны активируется. Из всех динамиков раздаётся сирена. Хватайте что есть и уносите ноги!', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 3), healPercent: 0.01 }), resourceCost: nextResource(), resourceText: `Хранилище «Зари». Здесь, по легендам, хранились прототипы технологий, способные изменить ход войны. В центре зала — пьедестал с кейсом.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `Хранилище «Зари». Здесь, по легендам, хранились прототипы технологий, способные изменить ход войны. В центре зала — пьедестал с кейсом.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: 'Перед вами центральный артефакт бункера «Заря» — кристалл, пульсирующий ровным синим светом. Вы чувствуете, как он откликается на ваше присутствие. Такого трофея нет больше ни у кого в Зоне!',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.50, itemCount: 1 }),
  },
  {
    id: 'dead_place',
    title: 'Гиблое место',
    description: 'Воздух дрожит. Впереди земля искажена — аномальное поле простирается на сотни метров. Гравий парит в воздухе, металл гнётся сам собой. В центре, по слухам, находится источник силы.',
    stages: [
      { text: 'Край аномального поля. Воздух потрескивает от статического электричества. Волосы встают дыбом. Вход в зону — узкий коридор между гравитационными ловушками.', continueChoice: 'Войти в аномальное поле', retreatChoice: 'Обойти стороной', successText: 'Вы находите безопасную тропу между воронок. За спиной с глухим гулом схлопывается очередная аномалия.', failText: 'Первый же шаг — и земля уходит из-под ног. Вас с силой бросает на землю, рюкзак разрывает. Нужно убираться.', rewards: (level) => ({ chips: LC(level, 0), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `Край аномального поля. Воздух потрескивает от статического электричества. Волосы встают дыбом. Вход в зону — узкий коридор между гравитационными ловушками.
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `Край аномального поля. Воздух потрескивает от статического электричества. Волосы встают дыбом. Вход в зону — узкий коридор между гравитационными ловушками.
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Вы углубляетесь в поле. Вокруг — искорёженные останки техники. Остов грузовика сплющен в гармошку неведомой силой. В кабине — скелет водителя, застывший в крике.', continueChoice: 'Осмотреть грузовик', retreatChoice: 'Здесь не место для живых', successText: 'В бардачке находите карту аномалий, составленную прошлым исследователем. Бесценная находка!', failText: 'Вокруг начинают вспыхивать разряды. Воздух пахнет озоном. Вы бежите назад, спотыкаясь о камни.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Вы углубляетесь в поле. Вокруг — искорёженные останки техники. Остов грузовика сплющен в гармошку неведомой силой. В кабине — скелет водителя, застывший в крике.
[Железо помог выжать максимум из ситуации.]`, noResourceText: `Вы углубляетесь в поле. Вокруг — искорёженные останки техники. Остов грузовика сплющен в гармошку неведомой силой. В кабине — скелет водителя, застывший в крике.
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Карта указывает путь через «гравитационный лабиринт» — зону, где сила тяжести меняется хаотично. Приходится идти, буквально ощупывая каждый шаг.', continueChoice: 'Пройти лабиринт', retreatChoice: 'Это безумие, назад', successText: 'Вы проходите лабиринт, используя подсказки из карты. За ним открывается поляна, усыпанная мелкими артефактами.', failText: 'Гравитация резко меняется, и вас швыряет вбок. Ребро трещит при ударе о камень. Дальше нельзя.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Карта указывает путь через «гравитационный лабиринт» — зону, где сила тяжести меняется хаотично. Приходится идти, буквально ощупывая каждый шаг.
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `Карта указывает путь через «гравитационный лабиринт» — зону, где сила тяжести меняется хаотично. Приходится идти, буквально ощупывая каждый шаг.
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Поляна артефактов. В траве светятся десятки мелких камней — «бирюльки», как их называют сталкеры. Собирать можно, но нужно следить за аномалиями.', continueChoice: 'Собрать артефакты', retreatChoice: 'Слишком опасно, уходим', successText: 'Вы быстро набиваете карманы. Самое ценное — тёплый камень размером с кулак. Он пульсирует в такт сердцебиению.', failText: 'Одна из «бирюлек» взрывается при прикосновении. Ожог на руке, боль адская. Бегом отсюда!', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 1), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Поляна артефактов. В траве светятся десятки мелких камней — «бирюльки», как их называют сталкеры. Собирать можно, но нужно следить за аномалиями.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Поляна артефактов. В траве светятся десятки мелких камней — «бирюльки», как их называют сталкеры. Собирать можно, но нужно следить за аномалиями.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'За поляной начинается «мёртвый лес» — деревья превратились в каменные изваяния. Тишина здесь абсолютная. Ни звука, ни ветра.', continueChoice: 'Идти через мёртвый лес', retreatChoice: 'Жуть, возвращаемся', successText: 'Каменные деревья хранят память. На одном вы замечаете вырезанную надпись: «Ищи колодец в центре».', failText: 'Каменное дерево с оглушительным треском раскалывается от внутреннего напряжения. Осколки летят во все стороны.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `За поляной начинается «мёртвый лес» — деревья превратились в каменные изваяния. Тишина здесь абсолютная. Ни звука, ни ветра.
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `За поляной начинается «мёртвый лес» — деревья превратились в каменные изваяния. Тишина здесь абсолютная. Ни звука, ни ветра.
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'На пути — овраг, на дне которого клубится туман. Он переливается ядовито-зелёным. Над оврагом висят обломки скал, удерживаемые аномалией.', continueChoice: 'Пересечь овраг по камням', retreatChoice: 'Туман явно радиоактивен, назад', successText: 'Вы прыгаете с камня на камень, балансируя над пропастью. За оврагом — вход в пещеру, откуда исходит сияние.', failText: 'Камень под ногой сдвигается, и вы едва не срываетесь в туманную бездну. Сердце ушло в пятки — назад!', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `На пути — овраг, на дне которого клубится туман. Он переливается ядовито-зелёным. Над оврагом висят обломки скал, удерживаемые аномалией.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `На пути — овраг, на дне которого клубится туман. Он переливается ядовито-зелёным. Над оврагом висят обломки скал, удерживаемые аномалией.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В пещере светло как днём — стены покрыты светящимся мхом. В центре — что-то вроде алтаря из камней. На алтаре — три предмета.', continueChoice: 'Осмотреть алтарь', retreatChoice: 'Трогать непонятное — плохая идея', successText: 'На алтаре лежат: старый КПК с последними записями учёного, артефакт-«слеза» и нож с гравировкой. Вы забираете всё.', failText: 'При приближении к алтарю мох гаснет. Пещера погружается во тьму. Паника накрывает — вы бежите наружу.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `В пещере светло как днём — стены покрыты светящимся мхом. В центре — что-то вроде алтаря из камней. На алтаре — три предмета.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `В пещере светло как днём — стены покрыты светящимся мхом. В центре — что-то вроде алтаря из камней. На алтаре — три предмета.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Записи учёного говорят об «источнике» глубоко под землёй. Он описывает механизм, способный генерировать аномалии — или управлять ими.', continueChoice: 'Спуститься к источнику', retreatChoice: 'Игра с аномалиями до добра не доведёт', successText: 'Узкий лаз ведёт вниз. Вы ползёте, сжимая в руке нож. Лаз расширяется, и вы попадаете в огромный грот.', failText: 'Лаз начинает обваливаться. Вы едва успеваете выползти обратно, обдирая спину о камни.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 2), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `Записи учёного говорят об «источнике» глубоко под землёй. Он описывает механизм, способный генерировать аномалии — или управлять ими.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `Записи учёного говорят об «источнике» глубоко под землёй. Он описывает механизм, способный генерировать аномалии — или управлять ими.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Грот — искусственного происхождения. Стены укреплены бетоном. В центре — прибор, напоминающий генератор, окружённый маревым свечением.', continueChoice: 'Попытаться отключить генератор', retreatChoice: 'Не лезь в непонятные механизмы', successText: 'Вы дёргаете рубильник. Генератор затихает, свечение гаснет. Земля перестаёт дрожать. Аномалия над полем начинает рассеиваться!', failText: 'Прикосновение к генератору бьёт током. Вас отбрасывает на несколько метров, одежда дымится.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `Грот — искусственного происхождения. Стены укреплены бетоном. В центре — прибор, напоминающий генератор, окружённый маревым свечением.
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `Грот — искусственного происхождения. Стены укреплены бетоном. В центре — прибор, напоминающий генератор, окружённый маревым свечением.
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'С затихающим генератором открывается проход в тайную лабораторию. Здесь работали над «гравитационным оружием». На стенде — готовый прототип.', continueChoice: 'Забрать прототип', retreatChoice: 'Не тащить оружие массового поражения', successText: 'Прототип умещается в рюкзак. Вы чувствуете его вес — не физический, а энергетический. Это изменит всё!', failText: 'Система самоуничтожения активируется. Вы бежите со всех ног, пригибаясь от падающих камней.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.01 }), resourceCost: nextResource(), resourceText: `С затихающим генератором открывается проход в тайную лабораторию. Здесь работали над «гравитационным оружием». На стенде — готовый прототип.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `С затихающим генератором открывается проход в тайную лабораторию. Здесь работали над «гравитационным оружием». На стенде — готовый прототип.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: 'Прототип гравитационного излучателя — оружие, способное создавать и гасить аномалии. С таким артефактом вы станете повелителем Зоны!',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.45, itemCount: 1 }),
  },
  {
    id: 'lab_vector',
    title: 'Секретная лаборатория «Вектор»',
    description: 'Среди холмов вы замечаете вентиляционную шахту, замаскированную под естественное возвышение. Из неё тянется слабый электрический кабель — кто-то или что-то всё ещё потребляет энергию.',
    stages: [
      { text: 'Шахта ведёт в подземный лабораторный комплекс. Стены выложены белой плиткой, частично обвалившейся. На полу — лужицы ржавой воды. Лампы дневного света мигают, создавая стробоскопический эффект.', continueChoice: 'Пойти по главному коридору', retreatChoice: 'Выбраться на поверхность, пока есть шанс', successText: 'Вы осторожно ступаете по коридору. За стеклянной стеной — пустые клетки с табличками «Образец 1-А», «Образец 1-Б»…', failText: 'Одна из ламп взрывается от перенапряжения. Осколки стекла сыплются на голову. Нервно — нужно валить!', rewards: (level) => ({ chips: LC(level, 0), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `Шахта ведёт в подземный лабораторный комплекс. Стены выложены белой плиткой, частично обвалившейся. На полу — лужицы ржавой воды. Лампы дневного света мигают, создавая стробоскопический эффект.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `Шахта ведёт в подземный лабораторный комплекс. Стены выложены белой плиткой, частично обвалившейся. На полу — лужицы ржавой воды. Лампы дневного света мигают, создавая стробоскопический эффект.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Клетки для образцов. Одна из них открыта. Внутри — останки, прикованные наручниками к стойке. На стене — царапины. Много царапин.', continueChoice: 'Осмотреть клетки', retreatChoice: 'Отсюда нужно убираться', successText: 'Находите журнал наблюдений. Каждый образец описан в деталях. В конце — запись: «Проект Вектор завершён. Результат превзошёл ожидания».', failText: 'Царапины на стенах складываются в слова: «ОНИ ВСЕГДА РЯДОМ». По спине бежит холодок. Вы отступаете.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Клетки для образцов. Одна из них открыта. Внутри — останки, прикованные наручниками к стойке. На стене — царапины. Много царапин.
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `Клетки для образцов. Одна из них открыта. Внутри — останки, прикованные наручниками к стойке. На стене — царапины. Много царапин.
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Журнал упоминает «основной зал» и «субъекта Ноль». Вектор — проект по созданию идеального солдата. Субъект Ноль — их главный успех.', continueChoice: 'Найти основной зал', retreatChoice: 'Секретные эксперименты — не наше дело', successText: 'Вы находите основную лабораторию через служебный проход. В центре — огромная капсула, заполненная жидкостью.', failText: 'Из темноты коридора доносится низкий гул. Пол вибрирует. Что-то приближается. Вы бежите.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Журнал упоминает «основной зал» и «субъекта Ноль». Вектор — проект по созданию идеального солдата. Субъект Ноль — их главный успех.
[Железо помог выжать максимум из ситуации.]`, noResourceText: `Журнал упоминает «основной зал» и «субъекта Ноль». Вектор — проект по созданию идеального солдата. Субъект Ноль — их главный успех.
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В капсуле — человек. Или то, что от него осталось. Он открывает глаза и смотрит прямо на вас. Жидкость начинает пузыриться.', continueChoice: 'Попытаться открыть капсулу', retreatChoice: 'Бежать, сейчас же!', successText: 'До упора жмёте кнопку аварийного открытия. Жидкость стекает, капсула с шипением открывается. Субъект Ноль делает вдох.', failText: 'Капсула идёт трещинами. Жидкость вытекает на пол, шипя. Вы отпрыгиваете и бежите.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 1), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `В капсуле — человек. Или то, что от него осталось. Он открывает глаза и смотрит прямо на вас. Жидкость начинает пузыриться.
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `В капсуле — человек. Или то, что от него осталось. Он открывает глаза и смотрит прямо на вас. Жидкость начинает пузыриться.
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Субъект Ноль — молодой парень, едва живой. Он говорит хрипло: «Они хотели сделать из меня машину. Я сбежал… почти». Он протягивает чип с данными.', continueChoice: 'Взять чип и помочь парню', retreatChoice: 'Не связываться, уйти', successText: 'Вы подхватываете парня и ведёте к выходу. Чип тяжёлый в кармане. Парень бормочет: «Там ещё… оружейная…».', failText: 'Из динамиков раздаётся механический голос: «Обнаружен побег. Протокол ликвидации». Субъект Ноль закатывает глаза. Вы бежите.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Субъект Ноль — молодой парень, едва живой. Он говорит хрипло: «Они хотели сделать из меня машину. Я сбежал… почти». Он протягивает чип с данными.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Субъект Ноль — молодой парень, едва живой. Он говорит хрипло: «Они хотели сделать из меня машину. Я сбежал… почти». Он протягивает чип с данными.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Субъект Ноль показывает проход к оружейной. Дверь массивная, бронированная. Кодовый замок требует высокий уровень допуска.', continueChoice: 'Попробовать взломать замок', retreatChoice: 'Эту дверь не открыть', successText: 'Парень знает код — «0-0-0-0», иронично. Дверь открывается. Внутри — стеллажи с экспериментальным оружием!', failText: 'Сигнализация воет. Из коридоров доносится топот ног. Кто-то бежит сюда. Вы уходите.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Субъект Ноль показывает проход к оружейной. Дверь массивная, бронированная. Кодовый замок требует высокий уровень допуска.
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `Субъект Ноль показывает проход к оружейной. Дверь массивная, бронированная. Кодовый замок требует высокий уровень допуска.
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Оружейная полна прототипов. На столе — чертежи «энергетического куба» — источника питания для оружия нового поколения.', continueChoice: 'Забрать чертежи и прототип куба', retreatChoice: 'Слишком тяжело, берём что помельче', successText: 'Чертежи и куб умещаются в рюкзак. Вес чувствуется, но это того стоит. С таким знанием можно всё!', failText: 'Куб активируется при прикосновении и обжигает руку. Вы роняете его и отступаете.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Оружейная полна прототипов. На столе — чертежи «энергетического куба» — источника питания для оружия нового поколения.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `Оружейная полна прототипов. На столе — чертежи «энергетического куба» — источника питания для оружия нового поколения.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Из лаборатории ведёт секретный тоннель эвакуации. Субъект Ноль говорит, что он выведет прямо к поверхности, но заминирован.', continueChoice: 'Идти через тоннель', retreatChoice: 'Искать другой выход', successText: 'Вы аккуратно проходите минное поле, используя показания детектора. За спиной гремит взрыв — но вы уже на поверхности.', failText: 'Вы наступаете на мину. Взрывной волной вас отбрасывает к стене. Контужены, но живы. Дальше не пройти.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `Из лаборатории ведёт секретный тоннель эвакуации. Субъект Ноль говорит, что он выведет прямо к поверхности, но заминирован.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `Из лаборатории ведёт секретный тоннель эвакуации. Субъект Ноль говорит, что он выведет прямо к поверхности, но заминирован.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'На поверхности — заброшенный КПП лаборатории. Субъект Ноль садится на землю, тяжело дыша. «Спасибо… Я думал, там и сгину».', continueChoice: 'Проводить парня до безопасного места', retreatChoice: 'Каждый сам за себя', successText: 'Вы доводите парня до сталкерского кордона. Он обещает, что найдёт вас, чтобы отблагодарить. В руке — найденный в тоннеле артефакт.', failText: 'Парень теряет сознание. Вам приходится тащить его на себе, теряя время и силы. Артефакт утерян.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `На поверхности — заброшенный КПП лаборатории. Субъект Ноль садится на землю, тяжело дыша. «Спасибо… Я думал, там и сгину».
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `На поверхности — заброшенный КПП лаборатории. Субъект Ноль садится на землю, тяжело дыша. «Спасибо… Я думал, там и сгину».
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Субъект Ноль перед уходом отдаёт вам личный артефакт — «Сердце Вектора». «Они убивали, чтобы создать его. Пусть он послужит добру».', continueChoice: 'Принять артефакт', retreatChoice: 'Слишком тёмная история, отказаться', successText: 'Вы принимаете «Сердце Вектора». Оно пульсирует теплом, как живое. Субъект Ноль улыбается впервые — и уходит в туман.', failText: 'Вы отказываетесь. Субъект Ноль кивает, прячет артефакт и исчезает. Быть может, к лучшему.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.01 }), resourceCost: nextResource(), resourceText: `Субъект Ноль перед уходом отдаёт вам личный артефакт — «Сердце Вектора». «Они убивали, чтобы создать его. Пусть он послужит добру».
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `Субъект Ноль перед уходом отдаёт вам личный артефакт — «Сердце Вектора». «Они убивали, чтобы создать его. Пусть он послужит добру».
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: '«Сердце Вектора» — биотехнологический артефакт, созданный в недрах секретной лаборатории. Он дарует своему владельцу нечеловеческую регенерацию и силу. Легенды говорят, что таких осталось всего три во всей Зоне.',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.55, itemCount: 1 }),
  },
  {
    id: 'stash_fox',
    title: 'Схрон сталкера «Лис»',
    description: 'По Зоне ходят легенды о сталкере по прозвищу Лис — удачливом, хитрый, неуловимом. Говорят, он собрал несметные богатства и спрятал их в тайнике, который не нашёл никто. Вы натыкаетесь на первую зацепку — ржавый люк с выцарапанным силуэтом лисы.',
    stages: [
      { text: 'Люк ведёт в старую дренажную систему. Вода по колено, холодная и мутная. Стены покрыты слизью. Фонарь выхватывает стрелку, нарисованную краской — хвост лисы.', continueChoice: 'Следовать за стрелкой', retreatChoice: 'Вода может быть заражена, назад!', successText: 'Стрелки ведут через лабиринт труб. Вы выходите к сухой площадке, где кто-то оставил зажигалку и записку.', failText: 'Вода начинает прибывать. Система заполняется! Вы едва успеваете нырнуть в боковой проход, чтобы не утонуть.', rewards: (level) => ({ chips: LC(level, 0), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `Люк ведёт в старую дренажную систему. Вода по колено, холодная и мутная. Стены покрыты слизью. Фонарь выхватывает стрелку, нарисованную краской — хвост лисы.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Люк ведёт в старую дренажную систему. Вода по колено, холодная и мутная. Стены покрыты слизью. Фонарь выхватывает стрелку, нарисованную краской — хвост лисы.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В записке — загадка: «Где ночует зверь, там и клад. Нора Лиса — под носом у всех». Вокруг — три ответвления труб.', continueChoice: 'Искать нору под главными ходами', retreatChoice: 'Загадки не для меня, ухожу', successText: 'Вы замечаете, что одна из труб замаскирована — за ней скрывается лаз. Лаз ведёт в небольшой бункер.', failText: 'Выбираете не тот тоннель. Тупик и труп сталкера с простреленной головой. Назад, быстро!', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `В записке — загадка: «Где ночует зверь, там и клад. Нора Лиса — под носом у всех». Вокруг — три ответвления труб.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `В записке — загадка: «Где ночует зверь, там и клад. Нора Лиса — под носом у всех». Вокруг — три ответвления труб.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Бункер Лиса. Стены увешаны картами, фотографиями, заметками. На столе — раскрытый сейф с пачками чипов. Лис явно готовился к долгой осаде.', continueChoice: 'Обыскать бункер', retreatChoice: 'Слишком похоже на ловушку', successText: 'Под картами находите тайник в полу. В нём — оружие с гравировкой «Лис», патроны и координаты основного схрона.', failText: 'Только вы начинаете обыск, как слышите шаги снаружи. Кто-то идёт. Прятаться некогда — вы сбегаете.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Бункер Лиса. Стены увешаны картами, фотографиями, заметками. На столе — раскрытый сейф с пачками чипов. Лис явно готовился к долгой осаде.
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `Бункер Лиса. Стены увешаны картами, фотографиями, заметками. На столе — раскрытый сейф с пачками чипов. Лис явно готовился к долгой осаде.
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Координаты ведут к заброшенной церкви на холме. Купол обрушился, но колокольня стоит. На колокольне — гнездо, а в нём — рюкзак.', continueChoice: 'Забраться на колокольню', retreatChoice: 'Высоко и опасно, не стоит', successText: 'Вы карабкаетесь по шаткой лестнице. В рюкзаке — карта с отметками всех аномалий в радиусе 50 км и ключ-карта.', failText: 'Лестница обрывается под весом. Вы летите вниз, ломая рёбра. Хорошо, что не шею.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Координаты ведут к заброшенной церкви на холме. Купол обрушился, но колокольня стоит. На колокольне — гнездо, а в нём — рюкзак.
[Железо помог выжать максимум из ситуации.]`, noResourceText: `Координаты ведут к заброшенной церкви на холме. Купол обрушился, но колокольня стоит. На колокольне — гнездо, а в нём — рюкзак.
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Ключ-карта открывает сейф на старой заправке, указанной на карте. Сейф вмурован в стену мужского туалета. Оригинальное место.', continueChoice: 'Открыть сейф', retreatChoice: 'Туалет? Серьёзно? Уходим.', successText: 'В сейфе — дневник Лиса и мешочек с чипами. В дневнике описан его главный трофей — «Золотая лиса».', failText: 'Замок заедает. Вы дёргаете сейф — он отрывается от стены, и на вас сыплется штукатурка. Тревожно.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Ключ-карта открывает сейф на старой заправке, указанной на карте. Сейф вмурован в стену мужского туалета. Оригинальное место.
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `Ключ-карта открывает сейф на старой заправке, указанной на карте. Сейф вмурован в стену мужского туалета. Оригинальное место.
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: '«Золотая лиса» — статуэтка из чистого золота с рубиновыми глазами. Лис пишет, что спрятал её «там, где всё началось» — в родной деревне.', continueChoice: 'Ехать в деревню', retreatChoice: 'Статуэтка не стоит риска', successText: 'Деревня сгорела дотла. Среди пепелищ вы находите погреб, а в нём — уцелевший сейф.', failText: 'Деревня кишит мутантами. Приходится отбиваться. Вы теряете след.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 2), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `«Золотая лиса» — статуэтка из чистого золота с рубиновыми глазами. Лис пишет, что спрятал её «там, где всё началось» — в родной деревне.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `«Золотая лиса» — статуэтка из чистого золота с рубиновыми глазами. Лис пишет, что спрятал её «там, где всё началось» — в родной деревне.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Сейф в погребе пуст, но на дне — записка: «Копай под качелями». Рядом стоит обгоревший остов детской площадки.', continueChoice: 'Копать под качелями', retreatChoice: 'Рискованно — могут быть растяжки', successText: 'Лопата звякает о металл. Вы откапываете герметичный контейнер. В нём — статуэтка и ещё кое-что.', failText: 'При первом ударе лопаты земля проваливается. Вы падаете в подвал. Нога вывихнута. Нужно уходить.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Сейф в погребе пуст, но на дне — записка: «Копай под качелями». Рядом стоит обгоревший остов детской площадки.
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `Сейф в погребе пуст, но на дне — записка: «Копай под качелями». Рядом стоит обгоревший остов детской площадки.
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В контейнере, помимо «Золотой лисы», лежит толстая пачка писем к Лису от разных людей — все благодарят его за помощь. Похоже, Лис был не просто удачливым, а хорошим человеком.', continueChoice: 'Забрать всё и прочитать письма', retreatChoice: 'Прошлое пусть остаётся прошлым', successText: 'Письма рассказывают историю Лиса — он помогал выжившим, делился добычей, спасал людей. В конверте — координаты последнего схрона.', failText: 'Письма рассыпаются в руках. От сырости чернила расплылись. Только «Золотая лиса» смотрит рубиновыми глазами.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `В контейнере, помимо «Золотой лисы», лежит толстая пачка писем к Лису от разных людей — все благодарят его за помощь. Похоже, Лис был не просто удачливым, а хорошим человеком.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `В контейнере, помимо «Золотой лисы», лежит толстая пачка писем к Лису от разных людей — все благодарят его за помощь. Похоже, Лис был не просто удачливым, а хорошим человеком.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Последний схрон — на старой водонапорной башне. Лис писал: «Вершина — ближе всего к небу». Туда ведёт винтовая лестница без ограждений.', continueChoice: 'Подняться на башню', retreatChoice: 'Страшно высота, не пойду', successText: 'Наверху, в цистерне, оборудовано жильё. Всё аккуратно, чисто. На стене — карта с подписью: «Моя Зона».', failText: 'Ступенька проваливается. Вы вцепляетесь в перила, сердце бешено колотится. Спускаетесь.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `Последний схрон — на старой водонапорной башне. Лис писал: «Вершина — ближе всего к небу». Туда ведёт винтовая лестница без ограждений.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `Последний схрон — на старой водонапорной башне. Лис писал: «Вершина — ближе всего к небу». Туда ведёт винтовая лестница без ограждений.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В башне — финальный сюрприз Лиса. На столе — ключ от банковской ячейки в старом городе. Ключ из чистого золота с гравировкой: «Храни удачу, путник. Лис».', continueChoice: 'Взять ключ', retreatChoice: 'Это уже чья-то чужая удача', successText: 'Ключ греет руку. Вы чувствуете — это не просто ключ. Это наследие. Лис выбрал вас, чтобы продолжить его путь.', failText: 'Вы колеблетесь слишком долго. Внизу слышны голоса — кто-то идёт. Хватаете ключ и прыгаете в окно.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.01 }), resourceCost: nextResource(), resourceText: `В башне — финальный сюрприз Лиса. На столе — ключ от банковской ячейки в старом городе. Ключ из чистого золота с гравировкой: «Храни удачу, путник. Лис».
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `В башне — финальный сюрприз Лиса. На столе — ключ от банковской ячейки в старом городе. Ключ из чистого золота с гравировкой: «Храни удачу, путник. Лис».
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: 'Золотой ключ Лиса — к банковской ячейке в старом городе. Говорят, там хранится нечто, способное обеспечить безбедную жизнь десяти поколений. А может, просто ещё одна легенда Лиса. Но проверить стоит!',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.40, itemCount: 1 }),
  },
  {
    id: 'radioactive_tunnel',
    title: 'Радиоактивный тоннель',
    description: 'Железнодорожный тоннель, пробитый сквозь скалу. Рельсы уходят в темноту. Счётчик Гейгера зашкаливает, но ветер дует наружу — значит, внутри есть проход. Местные сталкеры говорят, что с другой стороны — «благословенная земля», чистая от радиации.',
    stages: [
      { text: 'Вход в тоннель завален битой техникой. Придётся пробираться между ржавых вагонеток. Некоторые из них всё ещё на рельсах.', continueChoice: 'Пробираться между вагонетками', retreatChoice: 'Радиация слишком сильная, назад', successText: 'Вы протискиваетесь через завал. Счётчик трещит, но вы надеваете респиратор — дышать можно.', failText: 'Дозиметр зашкаливает. Вы чувствуете тошноту. Организм кричит: прочь отсюда!', rewards: (level) => ({ chips: LC(level, 0), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `Вход в тоннель завален битой техникой. Придётся пробираться между ржавых вагонеток. Некоторые из них всё ещё на рельсах.
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `Вход в тоннель завален битой техникой. Придётся пробираться между ржавых вагонеток. Некоторые из них всё ещё на рельсах.
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Внутри тоннеля темно, хоть глаз выколи. Стены покрыты светящимся мхом — он даёт достаточно света, чтобы различать силуэты. Вдалеке — силуэт человека.', continueChoice: 'Подойти к силуэту', retreatChoice: 'В темноте лучше не рисковать', successText: 'Это манекен в военной форме, установленный как предупреждение. На груди — табличка: «Радиация. Смерть через 100 шагов».', failText: 'Вы окликаете фигуру. Она не отвечает, но начинает двигаться к вам. Панический страх гонит вас обратно.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Внутри тоннеля темно, хоть глаз выколи. Стены покрыты светящимся мхом — он даёт достаточно света, чтобы различать силуэты. Вдалеке — силуэт человека.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Внутри тоннеля темно, хоть глаз выколи. Стены покрыты светящимся мхом — он даёт достаточно света, чтобы различать силуэты. Вдалеке — силуэт человека.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Табличка не врёт. Через сто шагов радиация становится смертельной. Но вы замечаете вентиляционную шахту слева — возможно, там чище.', continueChoice: 'Полезть в вентиляцию', retreatChoice: 'Смертельная радиация — не шутка', successText: 'Вентиляция выводит в боковой тоннель. Здесь радиация фоново-безопасная. Странно — будто кто-то проложил этот маршрут намеренно.', failText: 'Вентиляция забита. Воздуха нет, вы задыхаетесь. Приходится вылезать обратно.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Табличка не врёт. Через сто шагов радиация становится смертельной. Но вы замечаете вентиляционную шахту слева — возможно, там чище.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `Табличка не врёт. Через сто шагов радиация становится смертельной. Но вы замечаете вентиляционную шахту слева — возможно, там чище.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В боковом тоннеле — оборудованная стоянка. Спальник, горелка, банки с тушёнкой, и главное — несколько противогазов с новыми фильтрами.', continueChoice: 'Взять противогаз и идти дальше', retreatChoice: 'Кто-то живёт здесь — лучше не встречаться с хозяином', successText: 'Вы надеваете свежий фильтр. Дышать становится легче. За стоянкой — дверь с табличкой «Бункер-3».', failText: 'Вы берёте противогаз, но сзади слышится лязг — капкан! Нога зажата. С трудом освобождаетесь и хромаете назад.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `В боковом тоннеле — оборудованная стоянка. Спальник, горелка, банки с тушёнкой, и главное — несколько противогазов с новыми фильтрами.
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `В боковом тоннеле — оборудованная стоянка. Спальник, горелка, банки с тушёнкой, и главное — несколько противогазов с новыми фильтрами.
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Бункер-3 — небольшое убежище. Стены обиты свинцом. Внутри чисто, есть свечи, кровать, радиоприёмник. Кто-то явно готовился к ядерной войне.', continueChoice: 'Обыскать бункер', retreatChoice: 'Не тревожить чужое убежище', successText: 'Под кроватью — ящик с инструментами и картой тоннелей. Карта показывает проход сквозь скалу, избегая зон радиации.', failText: 'Радиоприёмник внезапно включается. Голос шипит: «Убирайся, пока цел». Хватайте что есть и бегом!', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Бункер-3 — небольшое убежище. Стены обиты свинцом. Внутри чисто, есть свечи, кровать, радиоприёмник. Кто-то явно готовился к ядерной войне.
[Железо помог выжать максимум из ситуации.]`, noResourceText: `Бункер-3 — небольшое убежище. Стены обиты свинцом. Внутри чисто, есть свечи, кровать, радиоприёмник. Кто-то явно готовился к ядерной войне.
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Карта показывает «чистый маршрут» — подземную реку, текущую сквозь скалу. Вода должна была вымыть радиацию. Тоннель ведёт к реке.', continueChoice: 'Идти вдоль подземной реки', retreatChoice: 'Вода может быть заражена', successText: 'Река бурлит, воздух влажный. Вы идёте вдоль русла. Уровень радиации падает с каждым шагом. Работает!', failText: 'Земля под ногами обрушивается. Вы падаете в ледяную воду. Течение подхватывает и несёт в темноту.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Карта показывает «чистый маршрут» — подземную реку, текущую сквозь скалу. Вода должна была вымыть радиацию. Тоннель ведёт к реке.
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `Карта показывает «чистый маршрут» — подземную реку, текущую сквозь скалу. Вода должна была вымыть радиацию. Тоннель ведёт к реке.
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Река приводит в огромный грот. Свод теряется в темноте. В центре — кристально чистое озеро. Над водой — туман, но не радиоактивный, а обычный.', continueChoice: 'Искупаться в озере', retreatChoice: 'Красиво, но подозрительно', successText: 'Вода тёплая и мягкая. Вы чувствуете, как она смывает усталость. На дне замечаете что-то блестящее.', failText: 'От воды исходит странное свечение. Вы зачерпываете ладонью — вода светится фосфором. Трогать такое нельзя!', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `Река приводит в огромный грот. Свод теряется в темноте. В центре — кристально чистое озеро. Над водой — туман, но не радиоактивный, а обычный.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Река приводит в огромный грот. Свод теряется в темноте. В центре — кристально чистое озеро. Над водой — туман, но не радиоактивный, а обычный.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'На дне озера — старый сейф, полузасыпанный илом. С трудом вытаскиваете его на берег. Замок проржавел — можно вскрыть.', continueChoice: 'Вскрыть сейф', retreatChoice: 'Сейф — это всегда проблемы', successText: 'В сейфе — герметичные упаковки с медикаментами, пачки чипов и дневник геолога, нашедшего этот грот.', failText: 'При вскрытии из сейфа вырывается облако ржавой пыли. Вы вдыхаете её и начинаете кашлять. Нужно на воздух!', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `На дне озера — старый сейф, полузасыпанный илом. С трудом вытаскиваете его на берег. Замок проржавел — можно вскрыть.
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `На дне озера — старый сейф, полузасыпанный илом. С трудом вытаскиваете его на берег. Замок проржавел — можно вскрыть.
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Дневник геолога описывает «Врата» — естественный тоннель, пробитый водой сквозь скалу, который выводит на другую сторону горы.', continueChoice: 'Найти Врата', retreatChoice: 'Хватит подземелий, на выход!', successText: 'Врата — узкий проход, настолько узкий, что приходится ползти. Свет в конце тоннеля становится всё ярче.', failText: 'Проход завален камнями. Вы пытаетесь разобрать завал, но сверху сыплется ещё больше. Назад!', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `Дневник геолога описывает «Врата» — естественный тоннель, пробитый водой сквозь скалу, который выводит на другую сторону горы.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `Дневник геолога описывает «Врата» — естественный тоннель, пробитый водой сквозь скалу, который выводит на другую сторону горы.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Вы выбираетесь на поверхность — и замираете. Перед вами — долина, не тронутая войной. Зелёная трава, чистый воздух, птицы. Счётчик Гейгера молчит. «Благословенная земля» — не миф.', continueChoice: 'Исследовать долину', retreatChoice: 'Это слишком хорошо, чтобы быть правдой', successText: 'В центре долины — монолит из чёрного камня, испещрённый древними письменами. Он излучает тепло и спокойствие. Вы прикасаетесь — и чувствуете, как сила наполняет вас.', failText: 'Вы делаете шаг — и долина исчезает. Мираж? Вы стоите на краю обрыва. Едва не шагнули в пропасть!', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.15 }), resourceCost: nextResource(), resourceText: `Вы выбираетесь на поверхность — и замираете. Перед вами — долина, не тронутая войной. Зелёная трава, чистый воздух, птицы. Счётчик Гейгера молчит. «Благословенная земля» — не миф.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `Вы выбираетесь на поверхность — и замираете. Перед вами — долина, не тронутая войной. Зелёная трава, чистый воздух, птицы. Счётчик Гейгера молчит. «Благословенная земля» — не миф.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: 'Долина оказалась реальной. Настоящий оазис среди радиоактивной пустоши. Вы берёте пробу земли и воды — это может стать новым домом для выживших. А монолит… он явно хранит тайну древних.',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.60, itemCount: 1 }),
  },
  {
    id: 'factory_hammer',
    title: 'Завод «Красный молот»',
    description: 'Промышленный гигант, застывший во времени. Трубы завода «Красный молот» пронзают небо, как скелеты древних чудовищ. Говорят, здесь производили не только трактора — под землёй расположен секретный цех.',
    stages: [
      { text: 'Главные ворота заварены. Придётся лезть через дыру в заборе. За забором — административное здание с выбитыми окнами. Внутри — остатки офисной жизни.', continueChoice: 'Обыскать администрацию', retreatChoice: 'Вернуться, пока завод не рухнул', successText: 'В кабинете директора — сейф, вскрытый автогеном. Внутри пусто, но под сейфом — люк в подвал.', failText: 'Перекрытия угрожающе скрипят. Потолок проседает. Вы ретируетесь.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `Главные ворота заварены. Придётся лезть через дыру в заборе. За забором — административное здание с выбитыми окнами. Внутри — остатки офисной жизни.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `Главные ворота заварены. Придётся лезть через дыру в заборе. За забором — административное здание с выбитыми окнами. Внутри — остатки офисной жизни.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В подвале — старые чертежи и архив. В документах упоминается «Цех №7» — засекреченный объект. Его нет на планах завода.', continueChoice: 'Искать Цех №7', retreatChoice: 'Если его нет на планах — туда не нужно', successText: 'Вы находите старую схему эвакуации. Цех №7 отмечен красным — глубоко под землёй, доступ через лифт.', failText: 'В подвале темно, и вы наступаете на что-то хрупкое. Пол усеян костями мелких животных. Мурашки по коже.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `В подвале — старые чертежи и архив. В документах упоминается «Цех №7» — засекреченный объект. Его нет на планах завода.
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `В подвале — старые чертежи и архив. В документах упоминается «Цех №7» — засекреченный объект. Его нет на планах завода.
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Лифт не работает. Шахта уходит в темноту. По стенам идут скобы — можно спуститься вручную.', continueChoice: 'Спуститься по скобам', retreatChoice: 'Темнота и глубина — плохая комбинация', successText: 'Вы спускаетесь, считая пролёты. 10, 20, 30 метров. Наконец — дно. Тяжёлая гермодверь.', failText: 'Скоба вырывается из стены. Вы срываетесь, но успеваете вцепиться в соседнюю. Сердце колотится. Наверх!', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Лифт не работает. Шахта уходит в темноту. По стенам идут скобы — можно спуститься вручную.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Лифт не работает. Шахта уходит в темноту. По стенам идут скобы — можно спуститься вручную.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Гермодверь поддаётся. За ней — просторный цех, освещённый аварийными лампами. Посередине — конвейер с недостроенными механизмами, похожими на шагающие танки.', continueChoice: 'Осмотреть цех', retreatChoice: 'Это военное производство — лучше не связываться', successText: 'На стене — чертежи «шагающего танка». Технология опередила время. Вы копируете чертежи в КПК.', failText: 'Один из танков внезапно оживает — срабатывает аварийный протокол. Он делает шаг, и земля дрожит.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Гермодверь поддаётся. За ней — просторный цех, освещённый аварийными лампами. Посередине — конвейер с недостроенными механизмами, похожими на шагающие танки.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `Гермодверь поддаётся. За ней — просторный цех, освещённый аварийными лампами. Посередине — конвейер с недостроенными механизмами, похожими на шагающие танки.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В углу цеха — лаборатория. Стеллажи с колбами и реактивами. Часть маркирована символом радиационной опасности.', continueChoice: 'Осмотреть лабораторию', retreatChoice: 'Химия и радиация — смертельный коктейль', successText: 'Находите герметичный контейнер с образцом «жидкого металла». Он меняет форму при прикосновении.', failText: 'Колба разбивается, едкий дым поднимается к потолку. Вы закрываете лицо и бежите.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `В углу цеха — лаборатория. Стеллажи с колбами и реактивами. Часть маркирована символом радиационной опасности.
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `В углу цеха — лаборатория. Стеллажи с колбами и реактивами. Часть маркирована символом радиационной опасности.
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Образец «жидкого металла» — нанотехнологии старого мира. В сопроводительной записке сказано: «Программа самовосстановления активна».', continueChoice: 'Взять образец с собой', retreatChoice: 'Непонятная технология — непредсказуемая опасность', successText: 'Помещаете образец в свинцовый контейнер. Он слегка вибрирует — живой материал.', failText: 'Образец выскальзывает и падает. Он растекается по полу, въедаясь в бетон. Вы отступаете.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Образец «жидкого металла» — нанотехнологии старого мира. В сопроводительной записке сказано: «Программа самовосстановления активна».
[Железо помог выжать максимум из ситуации.]`, noResourceText: `Образец «жидкого металла» — нанотехнологии старого мира. В сопроводительной записке сказано: «Программа самовосстановления активна».
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'За лабораторией — казармы. Стены исписаны граффити рабочих: «Мы не знаем, что собираем». «Они убили инженера». «ВЫБИРАЙСЯ ОТСЮДА».', continueChoice: 'Обыскать казармы', retreatChoice: 'Здесь убивали — нам здесь не место', successText: 'Под нарами — тайник с личными вещами рабочих. Находите дневник и несколько ценных чипов.', failText: 'Граффити складываются в жуткую картину. Вам становится дурно. Воздух спёртый — нужно наверх!', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `За лабораторией — казармы. Стены исписаны граффити рабочих: «Мы не знаем, что собираем». «Они убили инженера». «ВЫБИРАЙСЯ ОТСЮДА».
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `За лабораторией — казармы. Стены исписаны граффити рабочих: «Мы не знаем, что собираем». «Они убили инженера». «ВЫБИРАЙСЯ ОТСЮДА».
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Дневник рабочего описывает «директора» — сущность, управлявшую заводом из подземного бункера. Говорят, он всё ещё там.', continueChoice: 'Найти бункер директора', retreatChoice: 'Сказки сталкеров — не руководство к действию', successText: 'За шкафом в кабинете начальника цеха — проход вниз. Винтовая лестница уходит в самое сердце завода.', failText: 'Землетрясение! С потолка сыплются плиты. Вы бежите, уворачиваясь от обломков.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `Дневник рабочего описывает «директора» — сущность, управлявшую заводом из подземного бункера. Говорят, он всё ещё там.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Дневник рабочего описывает «директора» — сущность, управлявшую заводом из подземного бункера. Говорят, он всё ещё там.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В бункере — жилой отсек. В кресле — скелет в дорогом костюме. В руке — пистолет, в виске — пулевое отверстие. На столе — предсмертная записка.', continueChoice: 'Прочитать записку', retreatChoice: 'Не тревожить мёртвых', successText: '«Я создал монстра. Технология не должна существовать. Уничтожьте всё». Рядом — флешка с данными и ключ.', failText: 'Скелет падает с кресла, когда вы приближаетесь. Нервы сдают — вы выбегаете из бункера.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `В бункере — жилой отсек. В кресле — скелет в дорогом костюме. В руке — пистолет, в виске — пулевое отверстие. На столе — предсмертная записка.
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `В бункере — жилой отсек. В кресле — скелет в дорогом костюме. В руке — пистолет, в виске — пулевое отверстие. На столе — предсмертная записка.
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Флешка содержит чертежи уникального сплава, самовосстанавливающегося при повреждении. Такой броне нет аналогов. Ключ подходит к сейфу в углу.', continueChoice: 'Открыть сейф', retreatChoice: 'Слишком ценно — не искушать судьбу', successText: 'В сейфе — образец сплава в виде слитка. Он тёплый, пульсирующий. С ним можно создать непробиваемую броню!', failText: 'Сейф заминирован. Срабатывает звуковая сигнализация. Вы хватаете что успели и бежите.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.01 }), resourceCost: nextResource(), resourceText: `Флешка содержит чертежи уникального сплава, самовосстанавливающегося при повреждении. Такой броне нет аналогов. Ключ подходит к сейфу в углу.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `Флешка содержит чертежи уникального сплава, самовосстанавливающегося при повреждении. Такой броне нет аналогов. Ключ подходит к сейфу в углу.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: 'Слиток самовосстанавливающегося сплава — «Регенеративная сталь». Из такого металла в древности ковали легендарные доспехи. На чёрном рынке за такой слиток отдадут пол-Зоны.',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.50, itemCount: 1 }),
  },
  {
    id: 'chimera_lair',
    title: 'Гнездо химеры',
    description: 'Существо, наводящее ужас на всю Зону. Химера — мутант, сочетающий черты нескольких видов. Её гнездо находят единицы, а возвращаются — ещё меньше. Вы натыкаетесь на его логово случайно, провалившись в старую шахту.',
    stages: [
      { text: 'Шахта уходит глубоко под землю. Стены покрыты слизью и свежими царапинами — огромными, от когтей размером с нож. Воздух тяжёлый, спёртый.', continueChoice: 'Идти по следу царапин', retreatChoice: 'Здесь живёт что-то крупное. Наверх!', successText: 'Царапины ведут в систему пещер. В одной из них — останки оленя, разорванного на части.', failText: 'Рёв, от которого закладывает уши, доносится из глубины. Вы замираете, потом бежите без оглядки.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `Шахта уходит глубоко под землю. Стены покрыты слизью и свежими царапинами — огромными, от когтей размером с нож. Воздух тяжёлый, спёртый.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `Шахта уходит глубоко под землю. Стены покрыты слизью и свежими царапинами — огромными, от когтей размером с нож. Воздух тяжёлый, спёртый.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Олень убит недавно — мясо ещё свежее. Химера где-то рядом. В пещере несколько проходов. В одном — слабый свет.', continueChoice: 'Идти на свет', retreatChoice: 'Химера может вернуться в любой момент', successText: 'Свет исходит от светящегося грибка на стенах. Грибы неестественно яркие — возможно, мутировали от радиации.', failText: 'Из темноты доносится хруст — химера жрёт. Жуткий звук. Уходите на цыпочках.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Олень убит недавно — мясо ещё свежее. Химера где-то рядом. В пещере несколько проходов. В одном — слабый свет.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `Олень убит недавно — мясо ещё свежее. Химера где-то рядом. В пещере несколько проходов. В одном — слабый свет.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Грибы образуют светящуюся дорожку вглубь пещеры. Вы идёте, стараясь ступать бесшумно. Вдалеке — отблески костра.', continueChoice: 'Подкрасться к костру', retreatChoice: 'Кострище — значит, здесь люди. Или нелюди.', successText: 'У костра — сталкер. Он сидит, сжимая дробовик. «Тоже на химеру охотишься?» — спрашивает он, не оборачиваясь.', failText: 'Из темноты вылетает камень — кто-то заметил вас. Бежать!', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Грибы образуют светящуюся дорожку вглубь пещеры. Вы идёте, стараясь ступать бесшумно. Вдалеке — отблески костра.
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `Грибы образуют светящуюся дорожку вглубь пещеры. Вы идёте, стараясь ступать бесшумно. Вдалеке — отблески костра.
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Сталкер представился — Дед. Он выслеживает химеру уже неделю. У него есть план: заманить её в ловушку и убить.', continueChoice: 'Помочь Деду с охотой', retreatChoice: 'Охота на химеру — самоубийство', successText: 'Дед показывает ловушку — яму с кольями, прикрытую ветками. Осталось заманить туда зверя.', failText: 'Дед внезапно хватается за сердце. «Оно… моё сердце…». Вы не успеваете помочь. Он затихает.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Сталкер представился — Дед. Он выслеживает химеру уже неделю. У него есть план: заманить её в ловушку и убить.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Сталкер представился — Дед. Он выслеживает химеру уже неделю. У него есть план: заманить её в ловушку и убить.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'План Деда: вы — приманка. Он прячется с дробовиком у ямы. Вы должны выманить химеру из её логова.', continueChoice: 'Стать приманкой', retreatChoice: 'Я не наживка!', successText: 'Вы находите логово — кучу веток и костей. Химеры нет. Но внутри — куча скелетов, а рядом — блестящий предмет.', failText: 'Химера возвращается в логово. Вы прячетесь за скалой, зажимая рот рукой. Она проходит в метре от вас.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `План Деда: вы — приманка. Он прячется с дробовиком у ямы. Вы должны выманить химеру из её логова.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `План Деда: вы — приманка. Он прячется с дробовиком у ямы. Вы должны выманить химеру из её логова.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В логове — труп сталкера в дорогой броне. Он пролежал здесь долго. Рядом — автомат с полным магазином и портативный сейф.', continueChoice: 'Обыскать труп', retreatChoice: 'Не грабить мёртвого', successText: 'В сейфе — чипы, артефакт «Капля крови» и КПК с картой всех аномалий региона.', failText: 'При прикосновении к сейфу срабатывает растяжка. Граната взрывается, вы оглушены, но живы. Валим!', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `В логове — труп сталкера в дорогой броне. Он пролежал здесь долго. Рядом — автомат с полным магазином и портативный сейф.
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `В логове — труп сталкера в дорогой броне. Он пролежал здесь долго. Рядом — автомат с полным магазином и портативный сейф.
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: '«Капля крови» — артефакт, ради которого многие рисковали жизнью. Он светится тёмно-красным, пульсирует в ритм сердцебиению.', continueChoice: 'Взять артефакт', retreatChoice: 'Артефакты всегда приносят проблемы', successText: 'Артефакт тёплый. Вы чувствуете, как пульс выравнивается, дыхание становится глубже. Он лечит.', failText: 'Артефакт обжигает пальцы. Вы роняете его, и он закатывается в трещину. Ищи-свищи!', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.01 }), resourceCost: nextResource(), resourceText: `«Капля крови» — артефакт, ради которого многие рисковали жизнью. Он светится тёмно-красным, пульсирует в ритм сердцебиению.
[Железо помог выжать максимум из ситуации.]`, noResourceText: `«Капля крови» — артефакт, ради которого многие рисковали жизнью. Он светится тёмно-красным, пульсирует в ритм сердцебиению.
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Дед подаёт сигнал — химера вернулась. Она огромна — размером с машину, покрыта бронёй, с двумя головами на длинных шеях.', continueChoice: 'Бежать к яме-ловушке', retreatChoice: 'Бежать от ямы — нахрен такой план', successText: 'Вы бежите к ловушке, химера за вами. Она не видит яму под ветками — проваливается! Дед открывает огонь сверху.', failText: 'Химера быстрее. Она настигает вас в десяти метрах от ямы. Вы падаете, прикрывая голову.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `Дед подаёт сигнал — химера вернулась. Она огромна — размером с машину, покрыта бронёй, с двумя головами на длинных шеях.
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `Дед подаёт сигнал — химера вернулась. Она огромна — размером с машину, покрыта бронёй, с двумя головами на длинных шеях.
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Химера в яме, но она не сдаётся. Она пытается выбраться, раздирая стены когтями. Дед кричит: «Добей её!» и бросает вам гранату.', continueChoice: 'Бросить гранату в яму', retreatChoice: 'Не убивать — брать живьём', successText: 'Граната падает в яму. Глухой взрыв. Химера затихает. Дед спускается и забирает трофей — шкуру и зубы.', failText: 'Химера выбирается из ямы прежде, чем вы бросаете гранату. Вы взрываете её в последний момент, но она успевает ранить вас.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 4), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `Химера в яме, но она не сдаётся. Она пытается выбраться, раздирая стены когтями. Дед кричит: «Добей её!» и бросает вам гранату.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Химера в яме, но она не сдаётся. Она пытается выбраться, раздирая стены когтями. Дед кричит: «Добей её!» и бросает вам гранату.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Дед разделывает тушу. Внутри химеры — то, что она не переварила: остатки снаряжения её жертв. Среди них — золотой артефакт «Сердце Зоны».', continueChoice: 'Взять «Сердце Зоны»', retreatChoice: 'Пусть остаётся с мёртвой', successText: 'Артефакт идеальной сферической формы, золотого свечения. Дед кивает: «Заслужил. Бери. Ты прошёл испытание химерой».', failText: 'Дед забирает артефакт себе. «Я охотился на неё неделю. Это моё». Он уходит, оставляя вас с малой частью добычи.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.10 }), resourceCost: nextResource(), resourceText: `Дед разделывает тушу. Внутри химеры — то, что она не переварила: остатки снаряжения её жертв. Среди них — золотой артефакт «Сердце Зоны».
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `Дед разделывает тушу. Внутри химеры — то, что она не переварила: остатки снаряжения её жертв. Среди них — золотой артефакт «Сердце Зоны».
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: '«Сердце Зоны» — легендарный артефакт, который, по слухам, исполняет желания. С ним вы становитесь настоящим хозяином Пустоши. Ни один мутант не посмеет встать на вашем пути!',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.55, itemCount: 1 }),
  },
  {
    id: 'base_citadel',
    title: 'Военная база «Цитадель»',
    description: 'На холме, господствующем над всей округой, стоит военная база. Бетонные укрепления, пулемётные гнёзда, антенны связи. База выглядит заброшенной, но флаг всё ещё реет над КПП — чей-то чёрный стяг с белой звездой.',
    stages: [
      { text: 'КПП завален мешками с песком. В будке — пустые гильзы и окровавленный бинт. Проход на базу преграждают бронированные ворота.', continueChoice: 'Попробовать открыть ворота', retreatChoice: 'Военные объекты — всегда проблемы', successText: 'Электропитание отключено. Ворота можно открыть вручную, покрутив штурвал. Скрежет металла — и проход свободен.', failText: 'Из динамика на воротах раздаётся голос: «Назови пароль». Вы молчите. Очередь из пулемёта прошивает воздух над головой.', rewards: (level) => ({ chips: LC(level, 0), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `КПП завален мешками с песком. В будке — пустые гильзы и окровавленный бинт. Проход на базу преграждают бронированные ворота.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `КПП завален мешками с песком. В будке — пустые гильзы и окровавленный бинт. Проход на базу преграждают бронированные ворота.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Внутри базы — плац. Посередине — сгоревший БТР. Вокруг — казармы, штаб, склад ГСМ. Тишина, только ветер гуляет между зданий.', continueChoice: 'Обыскать штаб', retreatChoice: 'Слишком подозрительно тихо', successText: 'В штабе — карты, рации, компьютеры. На стене — доска с фотографиями. «Разыскиваются: сталкеры-рейдеры».', failText: 'Из казармы доносится кашель. Там кто-то есть. Вы прячетесь за БТРом и ждёте.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Внутри базы — плац. Посередине — сгоревший БТР. Вокруг — казармы, штаб, склад ГСМ. Тишина, только ветер гуляет между зданий.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `Внутри базы — плац. Посередине — сгоревший БТР. Вокруг — казармы, штаб, склад ГСМ. Тишина, только ветер гуляет между зданий.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'На доске — ваше фото. Вы в розыске! Подпись: «Живым или мёртвым. Награда — 50 000 чипов». Похоже, здесь вас ждали.', continueChoice: 'Найти командование и разобраться', retreatChoice: 'Убираться с базы, пока не поздно', successText: 'Командный бункер находится под штабом. Вниз ведёт лестница, охраняемая пуленепробиваемой дверью.', failText: 'Вокруг базы начинают заводиться машины. Вы слышите голоса военных. Оцепление!', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `На доске — ваше фото. Вы в розыске! Подпись: «Живым или мёртвым. Награда — 50 000 чипов». Похоже, здесь вас ждали.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `На доске — ваше фото. Вы в розыске! Подпись: «Живым или мёртвым. Награда — 50 000 чипов». Похоже, здесь вас ждали.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В бункере — командный центр. На стульях — трое офицеров, мёртвых. В груди каждого — пулевое отверстие. Кто-то их казнил.', continueChoice: 'Осмотреть командный центр', retreatChoice: 'Мёртвые офицеры — плохой знак', successText: 'Среди документов находите приказ: «Эвакуировать базу. Уничтожить улики. Сжечь архивы». Не успели.', failText: 'Из темноты вылетает пуля — вы её слышите. Кто-то стреляет! Вы падаете на пол и ползёте к выходу.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `В бункере — командный центр. На стульях — трое офицеров, мёртвых. В груди каждого — пулевое отверстие. Кто-то их казнил.
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `В бункере — командный центр. На стульях — трое офицеров, мёртвых. В груди каждого — пулевое отверстие. Кто-то их казнил.
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Архив уцелел частично. В несгоревшей папке — досье на секретный проект «Цитадель». Проект по созданию биооружия на основе артефактов.', continueChoice: 'Изучить досье', retreatChoice: 'Секреты военных — могильная плита', successText: 'Проект «Цитадель» курировал полковник, запершийся в личном бункере. Его бункер — под главным ангаром.', failText: 'Досье заминировано — между страниц вставлен детонатор. Взрыв! Вас контузит, но вы успеваете отползти.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Архив уцелел частично. В несгоревшей папке — досье на секретный проект «Цитадель». Проект по созданию биооружия на основе артефактов.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Архив уцелел частично. В несгоревшей папке — досье на секретный проект «Цитадель». Проект по созданию биооружия на основе артефактов.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Ангар. Внутри — недоделанный прототип «брони монстра» — бронескелет, оснащённый артефактами. Рядом — проход в личный бункер полковника.', continueChoice: 'Спуститься в бункер полковника', retreatChoice: 'Живой полковник с биооружием — это перебор', successText: 'Бункер роскошен — ковры, бар, картины. В кресле — полковник, мёртвый. Рядом — шприц с зелёной жидкостью.', failText: 'Из бункера доносится смех. Безумный, надрывный. Там кто-то жив. Вы не рискуете.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Ангар. Внутри — недоделанный прототип «брони монстра» — бронескелет, оснащённый артефактами. Рядом — проход в личный бункер полковника.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `Ангар. Внутри — недоделанный прототип «брони монстра» — бронескелет, оснащённый артефактами. Рядом — проход в личный бункер полковника.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В столе полковника — ключ-карта и журнал эксперимента: «Субъект показал нечеловеческую силу. Регенерация — 500%. Побочка — агрессия. Применять осторожно».', continueChoice: 'Взять ключ-карту', retreatChoice: 'Не тащить военные разработки', successText: 'Ключ-карта открывает арсенал. Там — экспериментальное оружие, броня, приборы. Вы набиваете рюкзак.', failText: 'Сигнализация! Вы активировали тревогу. База оживает — бегите!', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `В столе полковника — ключ-карта и журнал эксперимента: «Субъект показал нечеловеческую силу. Регенерация — 500%. Побочка — агрессия. Применять осторожно».
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `В столе полковника — ключ-карта и журнал эксперимента: «Субъект показал нечеловеческую силу. Регенерация — 500%. Побочка — агрессия. Применять осторожно».
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Арсенал «Цитадели». Стеллажи с оружием, гранатами, бронежилетами. В углу — сейф с пометкой «Хрупко. Биоопасно».', continueChoice: 'Открыть сейф', retreatChoice: 'Биоопасно — это явно не то, что нужно брать', successText: 'В сейфе — герметичный контейнер с пульсирующим артефактом «Абсолют». Энергия бьёт ключом.', failText: 'Из сейфа вырывается газ. Вы задерживаете дыхание и захлопываете дверцу. В глазах темнеет.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `Арсенал «Цитадели». Стеллажи с оружием, гранатами, бронежилетами. В углу — сейф с пометкой «Хрупко. Биоопасно».
[Железо помог выжать максимум из ситуации.]`, noResourceText: `Арсенал «Цитадели». Стеллажи с оружием, гранатами, бронежилетами. В углу — сейф с пометкой «Хрупко. Биоопасно».
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Снаружи слышны голоса — на базу вернулись военные. Они обнаружили взломанные ворота и идут к штабу. Нужно выбираться.', continueChoice: 'Прорываться с боем', retreatChoice: 'Спрятаться и переждать', successText: 'Вы выходите через окно арсенала и бежите к забору. За спиной — крики и выстрелы. Вы прыгаете — и вы на свободе!', failText: 'Военные окружают штаб. Вас берут в плен, но вы сбегаете ночью, прихватив трофеи.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 4), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `Снаружи слышны голоса — на базу вернулись военные. Они обнаружили взломанные ворота и идут к штабу. Нужно выбираться.
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `Снаружи слышны голоса — на базу вернулись военные. Они обнаружили взломанные ворота и идут к штабу. Нужно выбираться.
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Вы выбрались с базы живым — и с ценным грузом. «Абсолют» — артефакт, способный многократно усиливать физические способности. С таким можно стать неуязвимым.', continueChoice: 'Активировать артефакт', retreatChoice: 'Продать на базаре — хватит на год беззаботной жизни', successText: 'Артефакт впитывается в кожу. Вы чувствуете, как каждая клетка тела наполняется силой. Мир становится чётче. Вы — сверхчеловек.', failText: 'Вы решаете не рисковать. Артефакт слишком опасен. Продажа обеспечит вас до конца дней.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.10 }), resourceCost: nextResource(), resourceText: `Вы выбрались с базы живым — и с ценным грузом. «Абсолют» — артефакт, способный многократно усиливать физические способности. С таким можно стать неуязвимым.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Вы выбрались с базы живым — и с ценным грузом. «Абсолют» — артефакт, способный многократно усиливать физические способности. С таким можно стать неуязвимым.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: '«Абсолют» — легендарный артефакт, усиливающий все физические параметры. Военные искали его десятилетиями. Теперь он ваш. С ним вы способны на то, что другим сталкерам и не снилось!',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.50, itemCount: 1 }),
  },
  {
    id: 'underground_city',
    title: 'Подземный город «Кимры»',
    description: 'По слухам, под руинами старого города выжившие построили подземное поселение. «Кимры» — город под городом, где жизнь идёт своим чередом. Но вход туда знают немногие. Вы находите его — замаскированный люк в подвале библиотеки.',
    stages: [
      { text: 'Люк ведёт в тоннель, освещённый электрическими лампами. Стены укреплены, пол бетонный. Кто-то содержит это место в порядке.', continueChoice: 'Спуститься в тоннель', retreatChoice: 'Люди редко строят города глубоко без причины', successText: 'Тоннель выводит к посту охраны. Двое вооружённых мужчин оглядывают вас. «Свой? Или турист?»', failText: 'Лампа над головой взрывается. Темнота. Вы нащупываете путь обратно.', rewards: (level) => ({ chips: LC(level, 0), exp: LE(level, 0), healPercent: 0.003 }), resourceCost: nextResource(), resourceText: `Люк ведёт в тоннель, освещённый электрическими лампами. Стены укреплены, пол бетонный. Кто-то содержит это место в порядке.
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `Люк ведёт в тоннель, освещённый электрическими лампами. Стены укреплены, пол бетонный. Кто-то содержит это место в порядке.
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Охранники обыскивают вас. «Оружие сдай. В городе свои законы». Они ведут вас к массивной двери с гербом — шестерня и колос.', continueChoice: 'Пройти в город', retreatChoice: 'Не нравится мне этот «город»', successText: 'Дверь открывается. Перед вами — настоящий подземный город. Улицы, дома, фонари. Люди ходят по делам.', failText: 'Охранники находят ваш артефакт и конфискуют. «Запрещено». Вы без трофеев, но живы.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Охранники обыскивают вас. «Оружие сдай. В городе свои законы». Они ведут вас к массивной двери с гербом — шестерня и колос.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `Охранники обыскивают вас. «Оружие сдай. В городе свои законы». Они ведут вас к массивной двери с гербом — шестерня и колос.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: '«Кимры» процветают. Магазины, мастерские, даже бар. Местные смотрят с любопытством — новое лицо здесь редкость. В центре города — базарная площадь.', continueChoice: 'Пойти на базар', retreatChoice: 'Вернуться — лучшее, что можно сделать', successText: 'На базаре торгуют всем — от патронов до артефактов. Местный торговец предлагает редкий товар: «карту Старого мира».', failText: 'Базарный воришка пытается обчистить ваш карман. Вы замечаете, ловите его за руку. Инцидент.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `«Кимры» процветают. Магазины, мастерские, даже бар. Местные смотрят с любопытством — новое лицо здесь редкость. В центре города — базарная площадь.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `«Кимры» процветают. Магазины, мастерские, даже бар. Местные смотрят с любопытством — новое лицо здесь редкость. В центре города — базарная площадь.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Карта Старого мира показывает расположение всех известных хранилищ довоенных технологий. Карта неполная — часть оторвана.', continueChoice: 'Купить карту', retreatChoice: 'Слишком дорого для неполной карты', successText: 'Торгуетесь — сбиваете цену вдвое. Карта ваша. Торговец подмигивает: «Удачи в поисках, сталкер».', failText: 'Цена кусается. Пока торгуетесь, подходит патруль — спрашивают документы. Валите.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Карта Старого мира показывает расположение всех известных хранилищ довоенных технологий. Карта неполная — часть оторвана.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `Карта Старого мира показывает расположение всех известных хранилищ довоенных технологий. Карта неполная — часть оторвана.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В баре узнаёте, что мэр города — коллекционер артефактов. У него есть ключ от «храма предков» — древнего бункера под городом.', continueChoice: 'Идти к мэру', retreatChoice: 'Не связываться с властями подземного города', successText: 'Мэр — старик с живыми глазами. «Поможешь с проблемой — ключ твой». Проблема: мутанты в нижних уровнях.', failText: 'Мэр отказывается говорить. «Чужакам — не доверяю». Охрана выпроваживает вас.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `В баре узнаёте, что мэр города — коллекционер артефактов. У него есть ключ от «храма предков» — древнего бункера под городом.
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `В баре узнаёте, что мэр города — коллекционер артефактов. У него есть ключ от «храма предков» — древнего бункера под городом.
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Нижние уровни — старые туннели метро. Мутантов там тьма. Мэр даёт вам детектор и ключ-карту.', continueChoice: 'Спуститься в туннели', retreatChoice: 'Есть границы риска', successText: 'Вы проходите через заражённые тоннели, отстреливая мутантов. За старым вагоном — тайник с чипами.', failText: 'Мутанты окружают. Вы отбиваетесь, расходуя патроны, и отступаете, раненый.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Нижние уровни — старые туннели метро. Мутантов там тьма. Мэр даёт вам детектор и ключ-карту.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Нижние уровни — старые туннели метро. Мутантов там тьма. Мэр даёт вам детектор и ключ-карту.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'В конце тоннеля — дверь «Храма предков». Ключ-карта подходит. За дверью — зал с голограммами довоенных учёных. Они рассказывают историю создания Зоны.', continueChoice: 'Смотреть голограммы', retreatChoice: 'Не копаться в прошлом', successText: 'Голограммы показывают: Зона создана искусственно, как полигон для испытаний. В центре — «Регулятор».', failText: 'Система опознаёт вас как «неавторизованного» и запускает протокол стирания памяти. Вы едва сбегаете.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `В конце тоннеля — дверь «Храма предков». Ключ-карта подходит. За дверью — зал с голограммами довоенных учёных. Они рассказывают историю создания Зоны.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `В конце тоннеля — дверь «Храма предков». Ключ-карта подходит. За дверью — зал с голограммами довоенных учёных. Они рассказывают историю создания Зоны.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: '«Регулятор» — устройство, способное локально изменять реальность. Хранится глубоко под городом, в герметичном саркофаге. Мэр знает проход.', continueChoice: 'Убедить мэра открыть саркофаг', retreatChoice: 'Не трогать то, что может уничтожить всех', successText: 'Мэр соглашается после долгих уговоров. «Ты готов? Обратного пути не будет».', failText: 'Мэр отказывается наотрез. «Это убьёт нас всех». Он запирает проход.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.007 }), resourceCost: nextResource(), resourceText: `«Регулятор» — устройство, способное локально изменять реальность. Хранится глубоко под городом, в герметичном саркофаге. Мэр знает проход.
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `«Регулятор» — устройство, способное локально изменять реальность. Хранится глубоко под городом, в герметичном саркофаге. Мэр знает проход.
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Саркофаг открывается. Внутри — Регулятор. Устройство из сплавов, не известных науке. Оно пульсирует — и город над вами вздрагивает. Землетрясение.', continueChoice: 'Активировать Регулятор', retreatChoice: 'Закрыть саркофаг и уйти', successText: 'Регулятор активируется. Вспышка. Тишина. Вы чувствуете, как Зона меняется — становится мягче, добрее. Вы изменили мир.', failText: 'Регулятор даёт сбой. Энергетический выброс. Вы теряете сознание. Очнувшись, находите себя на поверхности.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.10 }), resourceCost: nextResource(), resourceText: `Саркофаг открывается. Внутри — Регулятор. Устройство из сплавов, не известных науке. Оно пульсирует — и город над вами вздрагивает. Землетрясение.
[Железо помог выжать максимум из ситуации.]`, noResourceText: `Саркофаг открывается. Внутри — Регулятор. Устройство из сплавов, не известных науке. Оно пульсирует — и город над вами вздрагивает. Землетрясение.
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Город «Кимры» в безопасности. Мэр благодарит вас. «Ты сделал то, что не удавалось никому». Он вручает вам знак — «Ключ Кимр» — символ вечной дружбы подземного города.', continueChoice: 'Принять знак', retreatChoice: 'Отказаться — я сталкер-одиночка', successText: 'Ключ Кимр — не просто символ. Это артефакт, открывающий любые замки и порталы. Настоящая легенда!', failText: 'Мэр понимает. «Воля твоя. Но знай — двери Кимр всегда для тебя открыты».', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.10 }), resourceCost: nextResource(), resourceText: `Город «Кимры» в безопасности. Мэр благодарит вас. «Ты сделал то, что не удавалось никому». Он вручает вам знак — «Ключ Кимр» — символ вечной дружбы подземного города.
[Дерево помог выжать максимум из ситуации.]`, noResourceText: `Город «Кимры» в безопасности. Мэр благодарит вас. «Ты сделал то, что не удавалось никому». Он вручает вам знак — «Ключ Кимр» — символ вечной дружбы подземного города.
[Без Дерево — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: '«Ключ Кимр» — легендарный артефакт-ключ, способный открыть любой замок, дверь или портал в Зоне. С ним весь мир становится доступным. Ни одна дверь не устоит перед вами!',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.50, itemCount: 1 }),
  },
  {
    id: 'crystal_anomaly',
    title: 'Аномалия «Кристалл»',
    description: 'Глубокая ночь. Небо озаряется сиянием — далеко за горизонтом, в запретной зоне, вырастает кристаллическая структура. Она излучает свет и низкий гул. Старожилы говорят: «Кристалл растёт раз в сто лет. Кто доберётся до него — получит силу богов».',
    stages: [
      { text: 'Вы идёте на свет. Кристалл виден за десятки километров — он переливается всеми цветами радуги. Земля под ногами становится странной — трава светится, камни парят.', continueChoice: 'Идти к кристаллу', retreatChoice: 'Природа Зоны не прощает любопытства', successText: 'С каждым шагом свечение усиливается. Гул переходит в мелодию — красивую, неземную. Кристалл зовёт вас.', failText: 'Гул становится невыносимым. Голова раскалывается. Вы падаете на колени и ползёте назад.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Вы идёте на свет. Кристалл виден за десятки километров — он переливается всеми цветами радуги. Земля под ногами становится странной — трава светится, камни парят.
[Инструменты помог выжать максимум из ситуации.]`, noResourceText: `Вы идёте на свет. Кристалл виден за десятки километров — он переливается всеми цветами радуги. Земля под ногами становится странной — трава светится, камни парят.
[Без Инструменты — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Зона вокруг кристалла меняет физику. Ваши шаги не оставляют следов, тени падают не в ту сторону. Компас сходит с ума.', continueChoice: 'Довериться интуиции', retreatChoice: 'Здесь сломана физика — сломаюсь и я', successText: 'Вы закрываете глаза и идёте на звук. Интуиция ведёт вас через искажённое пространство.', failText: 'Земля под ногами исчезает, и вы падаете в пустоту. Через мгновение — снова на земле, но в другом месте.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 1), healPercent: 0.004 }), resourceCost: nextResource(), resourceText: `Зона вокруг кристалла меняет физику. Ваши шаги не оставляют следов, тени падают не в ту сторону. Компас сходит с ума.
[Гвозди помог выжать максимум из ситуации.]`, noResourceText: `Зона вокруг кристалла меняет физику. Ваши шаги не оставляют следов, тени падают не в ту сторону. Компас сходит с ума.
[Без Гвозди — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Перед вами — поле кристаллов. Тысячи маленьких кристаллов разной формы торчат из земли. Они переливаются, создавая причудливые узоры.', continueChoice: 'Собрать мелкие кристаллы', retreatChoice: 'Осторожно — кристаллы могут быть радиоактивны', successText: 'Кристаллы легко отламываются. Они тёплые и гладкие. Пара штук помещается в карман. Они светятся в темноте.', failText: 'Острый кристалл режет руку. Кровь капает на землю — кристаллы начинают расти быстрее. Бегом!', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Перед вами — поле кристаллов. Тысячи маленьких кристаллов разной формы торчат из земли. Они переливаются, создавая причудливые узоры.
[Пластмасса помог выжать максимум из ситуации.]`, noResourceText: `Перед вами — поле кристаллов. Тысячи маленьких кристаллов разной формы торчат из земли. Они переливаются, создавая причудливые узоры.
[Без Пластмасса — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Кристаллы реагируют на вашу кровь — они тянутся к ней. Растут прямо на глазах. Один из них формируется в подобие цветка.', continueChoice: 'Прикоснуться к кристаллу-цветку', retreatChoice: 'Явно живая реакция — опасно', successText: 'Кристалл раскрывается. Внутри — жидкий свет. Он впитывается в руку — вы чувствуете знание. Древнее знание.', failText: 'Лепестки кристалла смыкаются на пальце. Он впивается в кожу. С трудом отдираете.', rewards: (level) => ({ chips: LC(level, 1), exp: LE(level, 2), healPercent: 0.005 }), resourceCost: nextResource(), resourceText: `Кристаллы реагируют на вашу кровь — они тянутся к ней. Растут прямо на глазах. Один из них формируется в подобие цветка.
[Топливо помог выжать максимум из ситуации.]`, noResourceText: `Кристаллы реагируют на вашу кровь — они тянутся к ней. Растут прямо на глазах. Один из них формируется в подобие цветка.
[Без Топливо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Знание показывает: кристалл — не природное явление. Это маяк, посланный древней цивилизацией. Он ищет достойных.', continueChoice: 'Следовать зову кристалла', retreatChoice: 'Не связываться с внеземным', successText: 'Кристалл указывает путь — цепочка светящихся камней ведёт к центральному обелиску.', failText: 'В видении вы видите свою смерть под этим кристаллом. Страх берёт верх. Назад!', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 2), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Знание показывает: кристалл — не природное явление. Это маяк, посланный древней цивилизацией. Он ищет достойных.
[Батарейки помог выжать максимум из ситуации.]`, noResourceText: `Знание показывает: кристалл — не природное явление. Это маяк, посланный древней цивилизацией. Он ищет достойных.
[Без Батарейки — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Центральный обелиск — огромный кристалл высотой с десятиэтажный дом. Он пульсирует в ритме, совпадающем с вашим сердцебиением.', continueChoice: 'Приложить руку к обелиску', retreatChoice: 'Это слишком — размер пугает', successText: 'Обелиск отзывается. Ваше тело наполняется светом. Вы видите историю Зоны — от создания до… будущего.', failText: 'От касания обелиск излучает энергетический импульс. Вас отбрасывает на десяток метров. Боль пронзает всё тело.', rewards: (level) => ({ chips: LC(level, 2), exp: LE(level, 3), healPercent: 0.006 }), resourceCost: nextResource(), resourceText: `Центральный обелиск — огромный кристалл высотой с десятиэтажный дом. Он пульсирует в ритме, совпадающем с вашим сердцебиением.
[Консервы помог выжать максимум из ситуации.]`, noResourceText: `Центральный обелиск — огромный кристалл высотой с десятиэтажный дом. Он пульсирует в ритме, совпадающем с вашим сердцебиением.
[Без Консервы — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Видение показывает: вы — один из немногих, кто может управлять Кристаллом. Он даёт власть над реальностью. Но цена — часть души.', continueChoice: 'Принять дар Кристалла', retreatChoice: 'Душа дороже', successText: 'Кристалл входит в ваше тело. Вы становитесь едины. Границы реальности размываются. Вы чувствуете всемогущество.', failText: 'Вы отказываетесь. Кристалл понимает. Он даёт вам малую часть силы — на удачу. Вы чувствуете лёгкость.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `Видение показывает: вы — один из немногих, кто может управлять Кристаллом. Он даёт власть над реальностью. Но цена — часть души.
[Лекарства помог выжать максимум из ситуации.]`, noResourceText: `Видение показывает: вы — один из немногих, кто может управлять Кристаллом. Он даёт власть над реальностью. Но цена — часть души.
[Без Лекарства — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'С силой Кристалла вы замечаете — вокруг обелиска парят обломки других миров. Кристалл — точка сборки реальностей.', continueChoice: 'Исследовать обломки', retreatChoice: 'Слишком много информации для одного раза', successText: 'В обломках находите предметы из других миров — оружие, доспехи, технологии, не известные на Земле. Бесценно!', failText: 'Обломок исчезает при прикосновении. Реальность схлопывается. Вы едва успеваете отпрыгнуть.', rewards: (level) => ({ chips: LC(level, 3), exp: LE(level, 3), healPercent: 0.008 }), resourceCost: nextResource(), resourceText: `С силой Кристалла вы замечаете — вокруг обелиска парят обломки других миров. Кристалл — точка сборки реальностей.
[Вода помог выжать максимум из ситуации.]`, noResourceText: `С силой Кристалла вы замечаете — вокруг обелиска парят обломки других миров. Кристалл — точка сборки реальностей.
[Без Вода — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: 'Кристалл начинает светиться ярче. Он готов к «переходу» — отправке избранного в центр мироздания. Вы стоите на пороге.', continueChoice: 'Пройти сквозь кристалл', retreatChoice: 'Мне есть что терять на Земле', successText: 'Свет поглощает вас. Вы проходите сквозь кристалл и чувствуете, как пространство сворачивается. Вы возвращаетесь — но другим. Обновлённым. С «Искрой Творения».', failText: 'В последний момент страх побеждает. Вы отступаете. Кристалл гаснет. Возможно, навсегда.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.15 }), resourceCost: nextResource(), resourceText: `Кристалл начинает светиться ярче. Он готов к «переходу» — отправке избранного в центр мироздания. Вы стоите на пороге.
[Изолента помог выжать максимум из ситуации.]`, noResourceText: `Кристалл начинает светиться ярче. Он готов к «переходу» — отправке избранного в центр мироздания. Вы стоите на пороге.
[Без Изолента — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
      { text: '«Искра Творения» — частица силы Кристалла, запертая в вашем теле. Вы можете изменять реальность вокруг себя силой мысли. Отныне вы — не просто сталкер. Вы — легенда.', continueChoice: 'Принять судьбу', retreatChoice: 'Слишком большая ответственность', successText: 'Искра разгорается в груди. Вы чувствуете пульс вселенной. Будущее Зоны теперь в ваших руках.', failText: 'Вы отказываетесь от дара. Искра покидает тело, оставляя лёгкую грусть. Но вы живы — и это главное.', rewards: (level) => ({ chips: LC(level, 4), exp: LE(level, 4), healPercent: 0.20 }), resourceCost: nextResource(), resourceText: `«Искра Творения» — частица силы Кристалла, запертая в вашем теле. Вы можете изменять реальность вокруг себя силой мысли. Отныне вы — не просто сталкер. Вы — легенда.
[Железо помог выжать максимум из ситуации.]`, noResourceText: `«Искра Творения» — частица силы Кристалла, запертая в вашем теле. Вы можете изменять реальность вокруг себя силой мысли. Отныне вы — не просто сталкер. Вы — легенда.
[Без Железо — увы, могло быть лучше.]`, resourceEffects: (_, level) => ({ chips: C(level, 2) }), noResourceEffects: (_, level) => ({ chips: NC(level, 0) }) },
    ],
    finalRewardText: '«Искра Творения» — частица силы древней цивилизации, способная изменять реальность. Вы стали хранителем Зоны, её новым хозяином. Ваше имя войдёт в легенды наравне с Кристаллом.',
    finalReward: (level) => ({ chips: LC(level, 5), exp: LE(level, 5), healPercent: 0.60, itemCount: 1 }),
  },
];

export const pickLegendaryEvent = (): LegendaryEventData | null => {
  if (LEGENDARY_EVENTS.length === 0) return null;
  return LEGENDARY_EVENTS[Math.floor(Math.random() * LEGENDARY_EVENTS.length)];
};
