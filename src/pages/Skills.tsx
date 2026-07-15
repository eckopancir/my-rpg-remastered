import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { usePlayerStore } from '../stores/playerStore';

interface SkillDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  maxPoints: number;
  reqPoints: number;
  statsPerPoint: string[];
}

interface SkillClass {
  id: string;
  name: string;
  icon: string;
  color: string;
  skills: SkillDef[];
}

const SKILL_CLASSES: SkillClass[] = [
  {
    id: 'soldier', name: 'Воин', icon: '⚔️', color: '#ef4444',
    skills: [
      { id: 'soldier_toughened', name: 'Укрепление', icon: '🛡️', desc: 'Увеличивает здоровье', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+20 HP'] },
      { id: 'soldier_heavy_hand', name: 'Тяжёлая рука', icon: '👊', desc: 'Увеличивает урон', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2 DMG'] },
      { id: 'soldier_fighting_spirit', name: 'Боевой дух', icon: '🔥', desc: 'Увеличивает крит. шанс', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% CRIT'] },
      { id: 'soldier_iron_skin', name: 'Железная кожа', icon: '⛓️', desc: 'Увеличивает броню', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+3 ARM'] },
      { id: 'soldier_rage', name: 'Ярость', icon: '💢', desc: 'Скорость + крит', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3% SPEED', '+2% CRIT'] },
      { id: 'soldier_retaliation', name: 'Возмездие', icon: '⚡', desc: 'Доп. урон', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2 DMG'] },
      { id: 'soldier_unstoppable', name: 'Неудержимый', icon: '🧱', desc: 'Блок + HP', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2% BLOCK', '+10 HP'] },
      { id: 'soldier_juggernaut', name: 'Танк', icon: '🏰', desc: 'Броня + уклонение', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+5 ARM', '+2% EVADE'] },
      { id: 'soldier_capstone', name: 'Герой Пустоши', icon: '👑', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+50 HP', '+5% BLOCK', '+3% SPEED'] },
    ],
  },
  {
    id: 'demo', name: 'Подрывник', icon: '💥', color: '#f97316',
    skills: [
      { id: 'demo_explosives', name: 'Взрывчатка', icon: '💣', desc: 'Урон + огонь', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2 DMG', '+2 FIRE'] },
      { id: 'demo_swift_hand', name: 'Лёгкая рука', icon: '🖐️', desc: 'Скорость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% SPEED'] },
      { id: 'demo_burning', name: 'Горение', icon: '🔥', desc: 'Огненный урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+5 FIRE'] },
      { id: 'demo_shrapnel', name: 'Осколки', icon: '💫', desc: 'Крит. шанс', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% CRIT'] },
      { id: 'demo_fugas', name: 'Фугас', icon: '💢', desc: 'Огонь + дробящий', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+5 FIRE', '+2% PUNCH'] },
      { id: 'demo_molotov', name: 'Коктейль', icon: '🧪', desc: 'Урон + точность', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3 DMG', '+1% ACC'] },
      { id: 'demo_thermo', name: 'Термоядерный', icon: '☢️', desc: 'Огонь + крит', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+10 FIRE', '+2% CRIT'] },
      { id: 'demo_fireworks', name: 'Фейерверк', icon: '🎆', desc: 'Скорость + урон', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3% SPEED', '+3 DMG'] },
      { id: 'demo_capstone', name: 'Апокалипсис', icon: '💀', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+20 FIRE', '+5% CRIT', '+5 DMG'] },
    ],
  },
  {
    id: 'night', name: 'Ночной клинок', icon: '🗡️', color: '#a78bfa',
    skills: [
      { id: 'night_shadow_step', name: 'Теневой шаг', icon: '🌑', desc: 'Скорость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+3% SPEED'] },
      { id: 'night_sharp_blades', name: 'Острые клинки', icon: '🔪', desc: 'Крит + урон', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% CRIT', '+2 DMG'] },
      { id: 'night_dodge', name: 'Уклонение', icon: '💨', desc: 'Уклонение', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+3% EVADE'] },
      { id: 'night_precise', name: 'Точный удар', icon: '🎯', desc: 'Точность', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% ACC'] },
      { id: 'night_poison', name: 'Яд', icon: '☠️', desc: 'Вампиризм + урон', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2% VAMP', '+3 DMG'] },
      { id: 'night_bleeding', name: 'Кровотечение', icon: '🩸', desc: 'Крит + скорость', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3% CRIT', '+2% SPEED'] },
      { id: 'night_dark_mist', name: 'Тёмный туман', icon: '🌫️', desc: 'Уклонение + точность', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+4% EVADE', '+2% ACC'] },
      { id: 'night_death_dance', name: 'Танец смерти', icon: '💃', desc: 'Скорость + крит', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3% SPEED', '+3% CRIT'] },
      { id: 'night_capstone', name: 'Убийца', icon: '🗡️', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+10% CRIT', '+8% EVADE', '+10 DMG'] },
    ],
  },
  {
    id: 'arcanist', name: 'Арканист', icon: '🔮', color: '#60a5fa',
    skills: [
      { id: 'arcanist_shield', name: 'Маг. щит', icon: '🛡️', desc: 'Броня', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+3 ARM'] },
      { id: 'arcanist_focus', name: 'Концентрация', icon: '🧿', desc: 'Точность', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% ACC'] },
      { id: 'arcanist_regen', name: 'Регенерация', icon: '❤️', desc: 'Регенерация', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 REGEN'] },
      { id: 'arcanist_barrier', name: 'Энерг. барьер', icon: '🔵', desc: 'Блок', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% BLOCK'] },
      { id: 'arcanist_life_force', name: 'Живительная сила', icon: '💚', desc: 'HP + реген', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+10 HP', '+1 REGEN'] },
      { id: 'arcanist_distortion', name: 'Искажение', icon: '🌀', desc: 'Уклонение + блок', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2% EVADE', '+2% BLOCK'] },
      { id: 'arcanist_aura', name: 'Защитная аура', icon: '✨', desc: 'Броня + реген', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+5 ARM', '+2 REGEN'] },
      { id: 'arcanist_restoration', name: 'Восстановление', icon: '💖', desc: 'HP + реген', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+20 HP', '+3 REGEN'] },
      { id: 'arcanist_capstone', name: 'Бессмертный', icon: '♾️', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+50 HP', '+10 REGEN', '+5% BLOCK'] },
    ],
  },
  {
    id: 'occult', name: 'Оккультист', icon: '🔮', color: '#22c55e',
    skills: [
      { id: 'occult_dark_energy', name: 'Тёмная энергия', icon: '⚫', desc: 'ЭМИ + токс урон', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2 ЭМИ', '+2 ТОКС'] },
      { id: 'occult_blood_thirst', name: 'Жажда крови', icon: '🩸', desc: 'Вампиризм', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% VAMP'] },
      { id: 'occult_curse', name: 'Проклятие', icon: '🔮', desc: 'Экстро урон + вампиризм', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+3 ЭКСТРО', '+1% VAMP'] },
      { id: 'occult_ritual', name: 'Ритуал', icon: '🕯️', desc: 'Крит + урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% CRIT', '+2 DMG'] },
      { id: 'occult_corruption', name: 'Порча', icon: '💀', desc: 'Все стихии + вампиризм', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2 всех стихий', '+2% VAMP'] },
      { id: 'occult_necromancy', name: 'Некромантия', icon: '🧟', desc: 'Реген + вампиризм', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1 REGEN', '+2% VAMP'] },
      { id: 'occult_sacrifice', name: 'Жертвоприношение', icon: '🔥', desc: 'Все стихии + крит', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+4 всех стихий', '+3% CRIT'] },
      { id: 'occult_demonic', name: 'Демон. сила', icon: '👿', desc: 'Все стихии + вампиризм', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3 всех стихий', '+3% VAMP'] },
      { id: 'occult_capstone', name: 'Владыка тьмы', icon: '🌑', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+10 всех стихий', '+8% VAMP', '+5% CRIT'] },
    ],
  },
  {
    id: 'berserker', name: 'Берсерк', icon: '💢', color: '#ff6b35',
    skills: [
      { id: 'berserker_frenzy', name: 'Исступление', icon: '🔥', desc: 'Урон + скорость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2 DMG', '+2% SPD'] },
      { id: 'berserker_bloodlust', name: 'Кровожадность', icon: '🩸', desc: 'Вампиризм', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% VAMP'] },
      { id: 'berserker_warcry', name: 'Боевой клич', icon: '📯', desc: 'Урон + пробитие', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+3 DMG', '+2% PUNCH'] },
      { id: 'berserker_brutal', name: 'Звериная сила', icon: '🐻', desc: 'Крит + урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% CRIT', '+2 DMG'] },
      { id: 'berserker_adrenaline', name: 'Адреналин', icon: '⚡', desc: 'Скорость + уклонение', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3% SPD', '+2% EVADE'] },
      { id: 'berserker_berserk', name: 'Берсерк', icon: '😡', desc: 'Урон + крит', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+4 DMG', '+2% CRIT'] },
      { id: 'berserker_unleashed', name: 'Необузданность', icon: '💥', desc: 'Броня + урон', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+4 ARM', '+3 DMG'] },
      { id: 'berserker_eternal_rage', name: 'Вечная ярость', icon: '☄️', desc: 'Скорость + вампиризм', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3% SPD', '+3% VAMP'] },
      { id: 'berserker_capstone', name: 'Бог войны', icon: '⚔️', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+20 DMG', '+10% CRIT', '+5% VAMP'] },
    ],
  },
  {
    id: 'tank', name: 'Танк', icon: '🛡️', color: '#3b82f6',
    skills: [
      { id: 'tank_hardened', name: 'Закалка', icon: '⛓️', desc: 'Броня', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+3 ARM'] },
      { id: 'tank_vitality', name: 'Живучесть', icon: '❤️', desc: 'Здоровье', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+20 HP'] },
      { id: 'tank_shield_bash', name: 'Удар щитом', icon: '🛡️', desc: 'Блок + урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% BLOCK', '+2 DMG'] },
      { id: 'tank_iron_will', name: 'Железная воля', icon: '🧠', desc: 'Броня + реген', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+3 ARM', '+1 REGEN'] },
      { id: 'tank_fortress', name: 'Крепость', icon: '🏰', desc: 'HP + броня', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+15 HP', '+3 ARM'] },
      { id: 'tank_reflect', name: 'Отражение', icon: '🔁', desc: 'Блок + урон', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2% BLOCK', '+2 DMG'] },
      { id: 'tank_immortal', name: 'Бессмертный', icon: '♾️', desc: 'HP + реген', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+25 HP', '+2 REGEN'] },
      { id: 'tank_paladin', name: 'Паладин', icon: '✝️', desc: 'Броня + вампиризм', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+5 ARM', '+2% VAMP'] },
      { id: 'tank_capstone', name: 'Колосс', icon: '🗿', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+100 HP', '+15 ARM', '+5% BLOCK'] },
    ],
  },
  {
    id: 'sniper', name: 'Снайпер', icon: '🎯', color: '#22c55e',
    skills: [
      { id: 'sniper_focus', name: 'Фокус', icon: '👁️', desc: 'Меткость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% ACC'] },
      { id: 'sniper_precision', name: 'Точность', icon: '🎯', desc: 'Крит', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% CRIT'] },
      { id: 'sniper_long_shot', name: 'Дальний выстрел', icon: '🏹', desc: 'Урон + меткость', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 DMG', '+2% ACC'] },
      { id: 'sniper_deadly_aim', name: 'Смертельный прицел', icon: '☠️', desc: 'Крит + урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% CRIT', '+3 DMG'] },
      { id: 'sniper_kill_zone', name: 'Зона поражения', icon: '📡', desc: 'Экстро + огонь', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3 ЭКСТРО', '+3 FIRE'] },
      { id: 'sniper_executioner', name: 'Палач', icon: '🔪', desc: 'Урон + крит', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+4 DMG', '+2% CRIT'] },
      { id: 'sniper_armor_piercing', name: 'Бронебойность', icon: '💠', desc: 'Пробитие + урон', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3% PUNCH', '+3 DMG'] },
      { id: 'sniper_nerves_steel', name: 'Стальные нервы', icon: '🧊', desc: 'Меткость + скорость', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3% ACC', '+2% SPD'] },
      { id: 'sniper_capstone', name: 'Легенд. стрелок', icon: '🏆', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+15 DMG', '+10% CRIT', '+10% ACC'] },
    ],
  },
  {
    id: 'survivor', name: 'Выживальщик', icon: '🏕️', color: '#eab308',
    skills: [
      { id: 'survivor_toughness', name: 'Выносливость', icon: '💪', desc: 'Здоровье', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+15 HP'] },
      { id: 'survivor_dodge', name: 'Уклонение', icon: '💨', desc: 'Уклонение', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% EVADE'] },
      { id: 'survivor_field_medic', name: 'Полевой медик', icon: '🩹', desc: 'Регенерация', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 REGEN'] },
      { id: 'survivor_scavenger', name: 'Добытчик', icon: '🔦', desc: 'Броня + уклонение', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 ARM', '+2% EVADE'] },
      { id: 'survivor_makeshift', name: 'Импровизация', icon: '🔧', desc: 'Блок + реген', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2% BLOCK', '+1 REGEN'] },
      { id: 'survivor_camouflage', name: 'Камуфляж', icon: '🌿', desc: 'Уклонение + меткость', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3% EVADE', '+2% ACC'] },
      { id: 'survivor_windrunner', name: 'Быстроногий', icon: '💨', desc: 'Скорость + уклонение', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3% SPD', '+3% EVADE'] },
      { id: 'survivor_revitalize', name: 'Восстановление', icon: '💚', desc: 'Реген + HP', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3 REGEN', '+20 HP'] },
      { id: 'survivor_capstone', name: 'Мастер выживания', icon: '🌟', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+50 HP', '+10% EVADE', '+10 REGEN'] },
    ],
  },
  {
    id: 'merchant', name: 'Торговец', icon: '💰', color: '#f59e0b',
    skills: [
      { id: 'merchant_diplomacy', name: 'Дипломатия', icon: '🤝', desc: 'Меткость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2% ACC'] },
      { id: 'merchant_coin_throw', name: 'Метание монет', icon: '🪙', desc: 'Урон', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2 DMG'] },
      { id: 'merchant_insider', name: 'Осведомитель', icon: '🕵️', desc: 'Крит', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% CRIT'] },
      { id: 'merchant_black_market', name: 'Чёрный рынок', icon: '🏴', desc: 'Вампиризм', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2% VAMP'] },
      { id: 'merchant_protection', name: 'Крыша', icon: '☂️', desc: 'Броня + HP', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3 ARM', '+10 HP'] },
      { id: 'merchant_money_talk', name: 'Деньги решают', icon: '💵', desc: 'Скорость + меткость', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2% SPD', '+2% ACC'] },
      { id: 'merchant_armored_transport', name: 'Бронетранспорт', icon: '🚛', desc: 'Броня + блок', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+4 ARM', '+2% BLOCK'] },
      { id: 'merchant_lucky', name: 'Фартовый', icon: '🍀', desc: 'Уклонение + крит', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3% EVADE', '+3% CRIT'] },
      { id: 'merchant_capstone', name: 'Магнат', icon: '👑', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+50 HP', '+10% CRIT', '+5 DMG', '+10% ACC'] },
    ],
  },
];

const formatCumulative = (stats: string[], level: number): string => {
  return stats.map((s) => {
    const m = s.match(/^([+-]\d+(?:\.\d+)?)(.*)$/);
    if (!m) return s;
    const num = parseFloat(m[1]) * level;
    return `${num > 0 ? '+' : ''}${num}${m[2]}`;
  }).join(' • ');
};

const getTotalSpent = (skills: Record<string, number>, classSkills: SkillDef[]): number => {
  return classSkills.reduce((sum, s) => sum + (skills[s.id] || 0), 0);
};

export const Skills = () => {
  const skills = usePlayerStore((s) => s.skills);
  const skillPoints = usePlayerStore((s) => s.skillPoints);
  const spendSkillPoint = usePlayerStore((s) => s.spendSkillPoint);
  const resetSkills = usePlayerStore((s) => s.resetSkills);
  const level = usePlayerStore((s) => s.level);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>⭐ Древо навыков</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
              Ур. {level} — 🎯 {skillPoints} очков
            </span>
            <Button size="sm" variant="ghost" onClick={resetSkills}>
              🔄 Сброс
            </Button>
          </div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Row 1: classes 0-4 */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {SKILL_CLASSES.slice(0, 5).map((cls) => {
            const spent = getTotalSpent(skills, cls.skills);
            return (
              <div
                key={cls.id}
                style={{
                  minWidth: 200, flex: 1,
                  background: 'var(--bg-glass)',
                  border: `1px solid ${cls.color}33`,
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                }}
              >
                {/* Class header */}
                <div style={{
                  textAlign: 'center', padding: '8px 0 16px',
                  borderBottom: `1px solid ${cls.color}22`,
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{cls.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: cls.color }}>{cls.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {spent} / {cls.skills.reduce((s, sk) => s + sk.maxPoints, 0)} очков
                  </div>
                </div>

                {/* Skills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cls.skills.map((sk) => {
                    const current = skills[sk.id] || 0;
                    const isMaxed = current >= sk.maxPoints;
                    const classTotal = getTotalSpent(skills, cls.skills);
                    const locked = classTotal < sk.reqPoints && current === 0;

                    return (
                      <div
                        key={sk.id}
                        onClick={() => {
                          if (!locked && !isMaxed && skillPoints > 0) {
                            spendSkillPoint(sk.id);
                          }
                        }}
                        style={{
                          padding: '8px 10px',
                          background: current > 0 ? `${cls.color}15` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${current > 0 ? cls.color + '44' : locked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: 'var(--radius-sm)',
                          cursor: locked || isMaxed || skillPoints <= 0 ? 'default' : 'pointer',
                          opacity: locked ? 0.4 : 1,
                          transition: 'all 100ms',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 16 }}>{sk.icon}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>{sk.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sk.desc}</div>
                                {current > 0 && (
                                  <div style={{ fontSize: 10, color: cls.color }}>
                                    {formatCumulative(sk.statsPerPoint, current)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{
                              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                              color: isMaxed ? 'var(--accent-success)' : cls.color,
                              whiteSpace: 'nowrap',
                            }}>
                              {current}/{sk.maxPoints}
                            </div>
                          </div>
                          {sk.reqPoints > 0 && current === 0 && (
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                              🔒 нужно {sk.reqPoints} очков в ветке
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
            {/* Row 2: classes 5-9 */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {SKILL_CLASSES.slice(5, 10).map((cls) => {
                const spent = getTotalSpent(skills, cls.skills);
                return (
                  <div
                    key={cls.id}
                    style={{
                      minWidth: 200, flex: 1,
                      background: 'var(--bg-glass)',
                      border: `1px solid ${cls.color}33`,
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                    }}
                  >
                    <div style={{
                      textAlign: 'center', padding: '8px 0 16px',
                      borderBottom: `1px solid ${cls.color}22`,
                      marginBottom: 12,
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 4 }}>{cls.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: cls.color }}>{cls.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {spent} / {cls.skills.reduce((s, sk) => s + sk.maxPoints, 0)} очков
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {cls.skills.map((sk) => {
                        const current = skills[sk.id] || 0;
                        const isMaxed = current >= sk.maxPoints;
                        const classTotal = getTotalSpent(skills, cls.skills);
                        const locked = classTotal < sk.reqPoints && current === 0;
                        return (
                          <div
                            key={sk.id}
                            onClick={() => {
                              if (!locked && !isMaxed && skillPoints > 0) spendSkillPoint(sk.id);
                            }}
                            style={{
                              padding: '8px 10px',
                              background: current > 0 ? `${cls.color}15` : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${current > 0 ? cls.color + '44' : locked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'}`,
                              borderRadius: 'var(--radius-sm)',
                              cursor: locked || isMaxed || skillPoints <= 0 ? 'default' : 'pointer',
                              opacity: locked ? 0.4 : 1,
                              transition: 'all 100ms',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 16 }}>{sk.icon}</span>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 500 }}>{sk.name}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sk.desc}</div>
                                  {current > 0 && (
                                    <div style={{ fontSize: 10, color: cls.color }}>
                                      {formatCumulative(sk.statsPerPoint, current)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{
                                fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                                color: isMaxed ? 'var(--accent-success)' : cls.color,
                                whiteSpace: 'nowrap',
                              }}>
                                {current}/{sk.maxPoints}
                              </div>
                            </div>
                            {sk.reqPoints > 0 && current === 0 && (
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                                🔒 нужно {sk.reqPoints} очков в ветке
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </WapPanel>
    </motion.div>
  );
};
