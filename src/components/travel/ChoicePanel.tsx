import type { TravelChoice } from '../../types/travel';
import styles from './travel.module.css';

export interface ChoicePanelProps {
  choices: TravelChoice[];
  onChoose: (id: string) => void;
  /** Выбор уже сделан — кнопки неактивны. */
  done?: boolean;
}

/** Панель выбора ветки (появится вместе с good/bad ветками событий). */
export const ChoicePanel = ({ choices, onChoose, done }: ChoicePanelProps) => {
  if (!choices || choices.length === 0) return null;
  return (
    <div className={styles.choices}>
      {choices.map((c) => {
        const risky = c.id === 'risky';
        return (
          <button
            key={c.id}
            className={`${styles.choiceBtn} ${risky ? styles.choiceRisky : ''} ${done ? styles.choiceDone : ''}`}
            onClick={() => !done && onChoose(c.id)}
            disabled={done}
            title={c.hint}
          >
            {c.label}
            {typeof c.chance === 'number' && !done
              ? ` · ${Math.round(c.chance * 100)}%`
              : ''}
          </button>
        );
      })}
    </div>
  );
};
