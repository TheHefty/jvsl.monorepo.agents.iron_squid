import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {ArmoryGrid} from '@/components/ArmoryGrid';
import {LivesMeter} from '@/components/LivesMeter';
import {Link} from '@/i18n/navigation';
import {
  CLEARED_COUNT,
  RUN_SUMMARY,
  TOTAL_WEAPONS,
  getCurrentDraw,
  getWeapons
} from '@/lib/mock';

/**
 * Run dashboard — design option 1c.
 *
 * Mock 1f is not a separate screen: it is this one at 390px, so the layout is
 * responsive rather than duplicated.
 */
export default async function RunPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const prefs = await getDisplayPrefs();
  const weapons = getWeapons();
  const draw = getCurrentDraw();
  const untouched = TOTAL_WEAPONS - CLEARED_COUNT - 1;
  const winsToNextLife = 10 - (RUN_SUMMARY.streak % 10);

  return (
    <>
      <SiteNav
        prefs={prefs}
        current="myRun"
        links={[
          {key: 'myRun', href: `/run/${id}`},
          {key: 'armory', href: `/run/${id}/armory`},
          {key: 'log', href: `/run/${id}/log`}
        ]}
      />

      <main id="main" className="page dashboard">
        <div>
          <div className="section-head">
            <h1 style={{margin: 0, fontSize: '1.5625rem'}}>
              {t('runTitle', {number: RUN_SUMMARY.number})} —{' '}
              {t('runDay', {day: RUN_SUMMARY.day})}
            </h1>
            <span className="note">
              {t('started', {date: RUN_SUMMARY.startedISO})}
            </span>
          </div>

          <section className="roll-card" aria-label={t('yourWeapon')}>
            <div className="roll-head">
              <span style={{color: 'var(--color-accent-text)'}}>
                {t('yourWeapon')}
              </span>
              <span className="text-muted tnum">
                {t('weaponOf', {
                  index: CLEARED_COUNT + 1,
                  total: TOTAL_WEAPONS
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
              {(
                [
                  ['head', draw.gear.head],
                  ['body', draw.gear.body],
                  ['shoes', draw.gear.shoes]
                ] as const
              ).map(([slot, name]) => (
                <div className="gear-slot" key={slot}>
                  <dt>
                    {t(slot)} · {t('singleUse')}
                  </dt>
                  <dd>{name}</dd>
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
                cleared: CLEARED_COUNT,
                current: 1,
                untouched
              })}
            </span>
          </div>

          <ArmoryGrid weapons={weapons} columns={20} showCode={false} />

          <p style={{marginTop: 'var(--space-6)'}}>
            <Link href={`/run/${id}/armory`} className="btn btn-ghost">
              {t('armoryHeading')}
            </Link>
          </p>
        </div>

        <aside className="dashboard-side">
          <div className="card stat-card">
            <p className="stat-label">{t('livesLabel')}</p>
            <LivesMeter lives={RUN_SUMMARY.lives} max={RUN_SUMMARY.maxLives} />
            <p className="note" style={{margin: 0}}>
              {t('livesNote', {count: winsToNextLife})}
            </p>
          </div>

          <div className="card stat-card">
            <p className="stat-label">{t('streak')}</p>
            <p className="stat-value">{RUN_SUMMARY.streak}</p>
            <p className="note" style={{margin: 0}}>
              {t('personalBest', {count: RUN_SUMMARY.personalBest})}
            </p>
          </div>

          <div className="card stat-card">
            <p className="stat-label">{t('replayQueue')}</p>
            <p className="note">{t('replayNote', {count: CLEARED_COUNT})}</p>
            <div
              className="meter"
              role="progressbar"
              aria-valuenow={CLEARED_COUNT}
              aria-valuemin={0}
              aria-valuemax={TOTAL_WEAPONS}
              aria-label={t('armoryCleared', {
                cleared: CLEARED_COUNT,
                total: TOTAL_WEAPONS
              })}
            >
              <span
                style={{width: `${(CLEARED_COUNT / TOTAL_WEAPONS) * 100}%`}}
              />
            </div>
            <p className="note tnum" style={{margin: 'var(--space-3) 0 0'}}>
              {t('armoryCleared', {
                cleared: CLEARED_COUNT,
                total: TOTAL_WEAPONS
              })}
            </p>
          </div>

          <div className="card stat-card">
            <p className="stat-label">{t('gearLedger')}</p>
            <ul className="ledger-rows">
              <li>
                <span>{t('headBurned')}</span>
                <span className="tnum">
                  {RUN_SUMMARY.gearBurned.head} / {RUN_SUMMARY.gearTotals.head}
                </span>
              </li>
              <li>
                <span>{t('clothesBurned')}</span>
                <span className="tnum">
                  {RUN_SUMMARY.gearBurned.body} / {RUN_SUMMARY.gearTotals.body}
                </span>
              </li>
              <li>
                <span>{t('shoesBurned')}</span>
                <span className="tnum">
                  {RUN_SUMMARY.gearBurned.shoes} /{' '}
                  {RUN_SUMMARY.gearTotals.shoes}
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </main>
    </>
  );
}
