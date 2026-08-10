import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {ArmoryGrid} from '@/components/ArmoryGrid';
import {editableChallenge} from '@/lib/challenge.server';
import type {Locale} from '@/i18n/routing';

/** The armory — design option 1d: dense tile grid, state by fill and symbol. */
export default async function ArmoryPage({
  params
}: {
  params: Promise<{locale: string; editSecret: string}>;
}) {
  const {locale, editSecret} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('armory');
  const prefs = await getDisplayPrefs();
  const {armory, progress} = await editableChallenge(
    editSecret,
    locale as Locale
  );
  const untouched = progress.remaining - 1;

  return (
    <>
      <SiteNav
        prefs={prefs}
        current="armory"
        links={[
          {key: 'myRun', href: `/edit/${editSecret}`},
          {key: 'armory', href: `/edit/${editSecret}/armory`},
          {key: 'log', href: `/edit/${editSecret}/log`}
        ]}
      />

      <main id="main" className="page" style={{paddingBlock: 'var(--space-8)'}}>
        <div className="section-head">
          <h1 style={{margin: 0}}>{t('heading')}</h1>
          <span className="note tnum">
            {progress.cleared} / {progress.total}
          </span>
        </div>

        <p className="note">{t('intro')}</p>

        <div className="legend">
          <span className="tag tag-accent">
            {t('cleared', {count: progress.cleared})}
          </span>
          <span className="tag tag-outline">{t('current', {count: 1})}</span>
          <span className="tag tag-neutral">
            {t('untouched', {count: untouched})}
          </span>
        </div>

        <ArmoryGrid weapons={armory} columns={12} />
      </main>
    </>
  );
}
