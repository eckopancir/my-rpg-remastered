import type { BattleEnemy, Fx } from '../../stores/dungeonStore';
import styles from './dungeon.module.css';

const intentText = (enemy: BattleEnemy): { text: string; cls: string } | null => {
  const intent = enemy.intent;
  if (!intent) return null;
  if (intent.type === 'stun') return { text: '💤 пропуск', cls: styles.intentStun };
  if (intent.type === 'summon') return { text: '🕷️ призыв', cls: styles.intentSummon };
  if (intent.type === 'buff') return { text: `⬆️ +${intent.value} атаки`, cls: styles.intentBuff };
  if (intent.type === 'aoe') return { text: `☄️ ${intent.value} всем`, cls: styles.intentAoe };
  if (intent.type === 'shield') return { text: `🛡 +${intent.value}`, cls: styles.intentShield };
  if (intent.type === 'debuff') return { text: `☠️ ${intent.label || 'дебафф'}`, cls: styles.intentDebuff };
  if ((intent.hits || 1) > 1) return { text: `⚔️ ${intent.value}×${intent.hits}`, cls: styles.intentAttack };
  if (intent.drain) return { text: `🩸 ${intent.value}`, cls: styles.intentDrain };
  return { text: `⚔️ ${intent.value}`, cls: styles.intentAttack };
};

interface Props {
  enemy: BattleEnemy;
  targetable?: boolean;
  fx?: Fx | null;
  onClick?: () => void;
}

export const EnemyCard = ({ enemy, targetable, fx, onClick }: Props) => {
  const dead = enemy.hp <= 0;
  const isFx = !!fx && fx.targetUid === enemy.uid;
  const hpPct = Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.maxHp)) * 100));
  const intent = dead ? null : intentText(enemy);

  const cls = [
    styles.enemyCard,
    targetable && !dead ? styles.enemyTargetable : '',
    dead ? styles.enemyDead : '',
    enemy.isBoss ? styles.enemyBossCard : '',
    isFx && fx?.kind === 'hit' ? styles.shake : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{ ['--enemy-color' as string]: enemy.color }}
      onClick={dead ? undefined : onClick}
      data-target-kind="enemy"
      data-target-uid={enemy.uid}
    >
      {intent && (
        <span className={`${styles.intent} ${intent.cls}`}>{intent.text}</span>
      )}

      <div className={styles.enemyArt}>
        {enemy.image ? (
          <img className={styles.enemyArtImg} src={enemy.image} alt="" draggable={false} />
        ) : (
          <div className={styles.enemyIcon} style={{ color: enemy.color }}>{enemy.icon}</div>
        )}
        <span className={styles.enemyArtFade} />
        {enemy.armor > 0 && <span className={styles.enemyArmor}>🛡 {enemy.armor}</span>}
        {enemy.isBoss && !!enemy.phase && <span className={styles.enemyPhase}>ФАЗА {enemy.phase}</span>}
      </div>

      <div className={styles.enemyName}>{enemy.name}</div>
      <div className={styles.abilityChip} title={enemy.abilityDesc}>{enemy.ability}</div>

      <div className={styles.statusRow}>
        {enemy.vuln > 0 && <span className={styles.statusBadge} style={{ color: '#f472b6' }}>уязв. {enemy.vuln}</span>}
        {enemy.weak > 0 && <span className={styles.statusBadge} style={{ color: '#a3a3a3' }}>слаб. {enemy.weak}</span>}
        {enemy.stun > 0 && <span className={styles.statusBadge} style={{ color: '#94a3b8' }}>оглуш. {enemy.stun}</span>}
        {enemy.isElite && <span className={styles.statusBadge} style={{ color: '#c084fc' }}>элита</span>}
        {enemy.isBoss && <span className={styles.statusBadge} style={{ color: '#ef4444' }}>босс</span>}
      </div>

      <div className={styles.bar}>
        <div className={`${styles.barFill} ${styles.barHp}`} style={{ width: `${hpPct}%` }} />
      </div>
      <div className={styles.barRow}>
        <span>{Math.max(0, Math.round(enemy.hp))} / {enemy.maxHp}</span>
        <span>⚔ {enemy.atk}</span>
      </div>

      {isFx && (
        <>
          {fx.kind === 'hit' && <img className={styles.hitImg} src="/art/dungeon/hit.png" alt="" draggable={false} />}
          <span className={`${styles.dmgNum} ${fx.kind === 'stun' ? styles.dmgShield : ''}`}>
            {fx.kind === 'hit' ? `-${fx.value}` : `✦${fx.value}`}
          </span>
        </>
      )}
    </div>
  );
};
