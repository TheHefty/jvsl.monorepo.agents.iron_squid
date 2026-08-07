import {useTranslations} from 'next-intl';

/**
 * The design shows lives as `●●●○○`. Read literally by a screen reader that is
 * "black circle black circle black circle white circle white circle", so the
 * marks are decoration behind a real text label.
 */
export function LivesMeter({lives, max = 5}: {lives: number; max?: number}) {
  const t = useTranslations('dashboard');

  return (
    <p className="lives-meter">
      <span className="visually-hidden">
        {t('livesRemaining', {count: lives})}
      </span>
      <span aria-hidden="true" className="lives-marks">
        {'●'.repeat(Math.max(0, lives))}
        {'○'.repeat(Math.max(0, max - lives))}
      </span>
    </p>
  );
}
