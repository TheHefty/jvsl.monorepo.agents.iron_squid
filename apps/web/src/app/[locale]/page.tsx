import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {LivesMeter} from '@/components/LivesMeter';
import {StartChallenge} from '@/components/StartChallenge';
import {landing} from '@/lib/landing.server';
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
  const page = await landing(locale as Locale);

  // What the roll card shows: somebody's live run when there is one, and an
  // example draw when the site is empty. Everything below reads from `card`,
  // so the two cases differ in their label and their footer only.
  const card =
    page.kind === 'live'
      ? {
          label: t('nowRolling', {handle: page.challenge.handle}),
          draw: page.challenge.draw,
          progress: page.challenge.progress,
          run: page.challenge.run
        }
      : {label: t('sampleDraw'), draw: page.draw, progress: null, run: null};

  return (
    <>
      <SiteNav
        prefs={prefs}
        links={[
          {key: 'rules', href: '/'},
          {key: 'runs', href: '/'},
          {key: 'leaderboard', href: '/'}
        ]}
      />

      <main id="main" className="page">
        <div className="hero">
          <div>
            <span className="kicker">
              {t('stats', {runs: page.runs, completed: page.completed})}
            </span>
            <h1 className="hero-title">{t('headline')}</h1>
            <p className="hero-body">
              {t('body')}{' '}
              {page.kind === 'live'
                ? t('record', {count: page.challenge.progress.best})
                : t('nobodyYet')}
            </p>
            <StartChallenge />
          </div>

          <div className="roll-card">
            <div className="roll-head">
              <span className="text-muted">{card.label}</span>
              {card.progress ? (
                <span
                  className="tnum"
                  style={{color: 'var(--color-accent-text)'}}
                >
                  {t('progress', {
                    cleared: card.progress.cleared,
                    total: card.progress.total
                  })}
                </span>
              ) : null}
            </div>

            <div className="roll-weapon">
              <span className="roll-badge" aria-hidden="true">
                {card.draw.weapon.name.slice(0, 2).toUpperCase()}
              </span>
              <div style={{minWidth: 0}}>
                <p className="roll-name">{card.draw.weapon.name}</p>
                <p className="roll-class">{card.draw.weapon.className}</p>
              </div>
            </div>

            <dl className="gear-slots">
              {GEAR_SLOTS.map((slot) => (
                <div className="gear-slot" key={slot}>
                  <dt>{td(slot)}</dt>
                  <dd>{card.draw.gear[slot].name}</dd>
                </div>
              ))}
            </dl>

            {card.run && card.progress ? (
              <div className="roll-foot">
                <span>{t('lives')}</span>
                <LivesMeter
                  lives={card.run.lives}
                  max={card.progress.livesMax}
                />
              </div>
            ) : null}
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
