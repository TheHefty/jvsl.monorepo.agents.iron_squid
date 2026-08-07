import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {ArmoryGrid} from '@/components/ArmoryGrid';
import {CLEARED_COUNT, TOTAL_WEAPONS, getWeapons} from '@/lib/mock';

/** The armory — design option 1d: dense tile grid, state by fill and symbol. */
export default async function ArmoryPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('armory');
  const prefs = await getDisplayPrefs();
  const weapons = getWeapons();
  const untouched = TOTAL_WEAPONS - CLEARED_COUNT - 1;

  return (
    <>
      <SiteNav
        prefs={prefs}
        current="armory"
        links={[
          {key: 'myRun', href: `/run/${id}`},
          {key: 'armory', href: `/run/${id}/armory`},
          {key: 'log', href: `/run/${id}/log`}
        ]}
      />

      <main id="main" className="page" style={{paddingBlock: 'var(--space-8)'}}>
        <div className="section-head">
          <h1 style={{margin: 0}}>{t('heading')}</h1>
          <span className="note tnum">
            {CLEARED_COUNT} / {TOTAL_WEAPONS}
          </span>
        </div>

        <p className="note">{t('intro')}</p>

        <div className="legend">
          <span className="tag tag-accent">
            {t('cleared', {count: CLEARED_COUNT})}
          </span>
          <span className="tag tag-outline">{t('current', {count: 1})}</span>
          <span className="tag tag-neutral">
            {t('untouched', {count: untouched})}
          </span>
        </div>

        <ArmoryGrid weapons={weapons} columns={12} />
      </main>
    </>
  );
}
