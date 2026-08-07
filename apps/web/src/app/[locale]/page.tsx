import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {LivesMeter} from '@/components/LivesMeter';
import {Link} from '@/i18n/navigation';
import {
  CLEARED_COUNT,
  RUN_SUMMARY,
  TOTAL_WEAPONS,
  getCurrentDraw
} from '@/lib/mock';

const RULE_KEYS = ['roll', 'lives', 'win', 'reset', 'end'] as const;

/** Landing — design option 1b: split hero with the live roll card beside it. */
export default async function LandingPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('landing');
  const tr = await getTranslations('rules');
  const td = await getTranslations('dashboard');
  const prefs = await getDisplayPrefs();
  const draw = getCurrentDraw();

  return (
    <>
      <SiteNav
        prefs={prefs}
        links={[
          {key: 'rules', href: '/'},
          {key: 'runs', href: '/run/demo'},
          {key: 'leaderboard', href: '/'}
        ]}
        action={{key: 'startRun', href: '/run/demo'}}
      />

      <main id="main" className="page">
        <div className="hero">
          <div>
            <span className="kicker">
              {t('stats', {
                runs: RUN_SUMMARY.totalRuns,
                completed: RUN_SUMMARY.completedRuns
              })}
            </span>
            <h1 className="hero-title">{t('headline')}</h1>
            <p className="hero-body">
              {t('body')} {t('record', {count: RUN_SUMMARY.personalBest})}
            </p>
            <div className="hero-actions">
              <Link href="/run/demo" className="btn btn-primary">
                {t('rollFirst')}
              </Link>
              <Link href="/r/demo" className="btn btn-secondary">
                {t('seeRecord')}
              </Link>
            </div>
          </div>

          <div className="roll-card">
            <div className="roll-head">
              <span className="text-muted">
                {t('nowRolling', {handle: RUN_SUMMARY.handle})}
              </span>
              <span
                className="tnum"
                style={{color: 'var(--color-accent-text)'}}
              >
                {t('progress', {cleared: CLEARED_COUNT, total: TOTAL_WEAPONS})}
              </span>
            </div>

            <div className="roll-weapon">
              <span className="roll-badge" aria-hidden="true">
                {draw.weapon.name.slice(0, 2).toUpperCase()}
              </span>
              <div style={{minWidth: 0}}>
                <p className="roll-name">{draw.weapon.name}</p>
                <p className="roll-class">{draw.weapon.className}</p>
              </div>
            </div>

            <dl className="gear-slots">
              <div className="gear-slot">
                <dt>{td('head')}</dt>
                <dd>{draw.gear.head}</dd>
              </div>
              <div className="gear-slot">
                <dt>{td('body')}</dt>
                <dd>{draw.gear.body}</dd>
              </div>
              <div className="gear-slot">
                <dt>{td('shoes')}</dt>
                <dd>{draw.gear.shoes}</dd>
              </div>
            </dl>

            <div className="roll-foot">
              <span>{t('lives')}</span>
              <LivesMeter
                lives={RUN_SUMMARY.lives}
                max={RUN_SUMMARY.maxLives}
              />
            </div>
          </div>
        </div>

        <h2 className="visually-hidden">{t('rulesHeading')}</h2>
        <ol className="ledger">
          {RULE_KEYS.map((key) => (
            <li key={key}>
              <h3>{tr(`${key}.title`)}</h3>
              <p>{tr(`${key}.text`)}</p>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
