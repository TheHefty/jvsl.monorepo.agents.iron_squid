import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {LivesMeter} from '@/components/LivesMeter';
import {Link} from '@/i18n/navigation';
import {getDemoChallenge} from '@/lib/demo';
import {GEAR_SLOTS} from '@/domain/types';
import type {Locale} from '@/i18n/routing';

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
  const {draw, progress, run, handle, site} = await getDemoChallenge(
    locale as Locale
  );

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
              {t('stats', {runs: site.runs, completed: site.completed})}
            </span>
            <h1 className="hero-title">{t('headline')}</h1>
            <p className="hero-body">
              {t('body')} {t('record', {count: progress.best})}
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
              <span className="text-muted">{t('nowRolling', {handle})}</span>
              <span
                className="tnum"
                style={{color: 'var(--color-accent-text)'}}
              >
                {t('progress', {
                  cleared: progress.cleared,
                  total: progress.total
                })}
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
              {GEAR_SLOTS.map((slot) => (
                <div className="gear-slot" key={slot}>
                  <dt>{td(slot)}</dt>
                  <dd>{draw.gear[slot].name}</dd>
                </div>
              ))}
            </dl>

            <div className="roll-foot">
              <span>{t('lives')}</span>
              <LivesMeter lives={run.lives} max={progress.livesMax} />
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
