import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {ArmoryGrid} from '@/components/ArmoryGrid';
import {LivesMeter} from '@/components/LivesMeter';
import {Link} from '@/i18n/navigation';
import {GEAR_SLOTS} from '@/domain/types';
import {getDemoChallenge} from '@/lib/demo';
import type {Locale} from '@/i18n/routing';

/**
 * Run dashboard — design option 1c.
 *
 * Mock 1f is not a separate screen: it is this one at 390px, so the layout is
 * responsive rather than duplicated.
 */
export default async function RunPage({
  params
}: {
  params: Promise<{locale: string; editSecret: string}>;
}) {
  const {locale, editSecret} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const prefs = await getDisplayPrefs();
  const {armory, draw, progress, run, day} = await getDemoChallenge(
    locale as Locale
  );
  const untouched = progress.remaining - 1;

  return (
    <>
      <SiteNav
        prefs={prefs}
        current="myRun"
        links={[
          {key: 'myRun', href: `/edit/${editSecret}`},
          {key: 'armory', href: `/edit/${editSecret}/armory`},
          {key: 'log', href: `/edit/${editSecret}/log`}
        ]}
      />

      <main id="main" className="page dashboard">
        <div>
          <div className="section-head">
            <h1 style={{margin: 0, fontSize: '1.5625rem'}}>
              {t('runTitle', {number: run.number})} — {t('runDay', {day})}
            </h1>
            <span className="note">
              {t('started', {date: run.startedAt.slice(0, 10)})}
            </span>
          </div>

          <section className="roll-card" aria-label={t('yourWeapon')}>
            <div className="roll-head">
              <span style={{color: 'var(--color-accent-text)'}}>
                {t('yourWeapon')}
              </span>
              <span className="text-muted tnum">
                {t('weaponOf', {
                  index: progress.cleared + 1,
                  total: progress.total
                })}
              </span>
            </div>

            <div className="roll-weapon">
              <span className="roll-badge" aria-hidden="true">
                {draw.weapon.name.slice(0, 2).toUpperCase()}
              </span>
              <div style={{minWidth: 0}}>
                <p className="roll-name" style={{fontSize: '1.875rem'}}>
                  {draw.weapon.name}
                </p>
                <p className="roll-class">
                  {draw.weapon.className} · {t('neverCleared')}
                </p>
              </div>
            </div>

            <dl className="gear-slots">
              {GEAR_SLOTS.map((slot) => (
                <div className="gear-slot" key={slot}>
                  <dt>
                    {t(slot)} · {t('singleUse')}
                  </dt>
                  <dd>{draw.gear[slot].name}</dd>
                </div>
              ))}
            </dl>

            <div className="actions">
              <button type="button" className="btn btn-primary">
                {t('iWon')}
              </button>
              <button type="button" className="btn btn-secondary">
                {t('iLost')}
              </button>
            </div>

            <p className="note" style={{marginTop: 'var(--space-6)'}}>
              {t('honourSystem')}
            </p>
          </section>

          <div className="section-head">
            <h2 className="kicker" style={{margin: 0}}>
              {t('armoryHeading')}
            </h2>
            <span className="note tnum">
              {t('armoryCounts', {
                cleared: progress.cleared,
                current: 1,
                untouched
              })}
            </span>
          </div>

          <ArmoryGrid weapons={armory} columns={20} showCode={false} />

          <p style={{marginTop: 'var(--space-6)'}}>
            <Link href={`/edit/${editSecret}/armory`} className="btn btn-ghost">
              {t('armoryHeading')}
            </Link>
          </p>
        </div>

        <aside className="dashboard-side">
          <div className="card stat-card">
            <p className="stat-label">{t('livesLabel')}</p>
            <LivesMeter lives={run.lives} max={progress.livesMax} />
            <p className="note" style={{margin: 0}}>
              {t('livesNote', {count: progress.winsToNextLife})}
            </p>
          </div>

          <div className="card stat-card">
            <p className="stat-label">{t('streak')}</p>
            <p className="stat-value">{progress.streak}</p>
            <p className="note" style={{margin: 0}}>
              {t('personalBest', {count: progress.best})}
            </p>
          </div>

          <div className="card stat-card">
            <p className="stat-label">{t('replayQueue')}</p>
            <p className="note">{t('replayNote', {count: progress.cleared})}</p>
            <div
              className="meter"
              role="progressbar"
              aria-valuenow={progress.cleared}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-label={t('armoryCleared', {
                cleared: progress.cleared,
                total: progress.total
              })}
            >
              <span
                style={{
                  width: `${(progress.cleared / progress.total) * 100}%`
                }}
              />
            </div>
            <p className="note tnum" style={{margin: 'var(--space-3) 0 0'}}>
              {t('armoryCleared', {
                cleared: progress.cleared,
                total: progress.total
              })}
            </p>
          </div>

          <div className="card stat-card">
            <p className="stat-label">{t('gearLedger')}</p>
            <ul className="ledger-rows">
              {GEAR_SLOTS.map((slot) => (
                <li key={slot}>
                  <span>{t(`${slot}Burned`)}</span>
                  <span className="tnum">
                    {progress.gearSpent[slot]} / {progress.gearTotals[slot]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </>
  );
}
