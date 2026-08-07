import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {ArmoryGrid} from '@/components/ArmoryGrid';
import {
  CLEARED_COUNT,
  RUN_SUMMARY,
  TOTAL_WEAPONS,
  getWeapons
} from '@/lib/mock';

/**
 * The public run page — design option 1h, "the thing people paste in Discord".
 *
 * This is the page the whole architecture bends around: it renders on the
 * server so that a shared link has real content and a real link preview, and
 * the theme comes from a cookie so it never paints the wrong one first.
 *
 * Nothing here may ever render the secret edit token. This route is reached by
 * a public read URL only.
 */

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'publicRun'});

  const title = t('headline', {
    handle: RUN_SUMMARY.handle,
    cleared: CLEARED_COUNT,
    deaths: RUN_SUMMARY.deaths
  });

  return {
    title,
    openGraph: {title, type: 'article'},
    twitter: {card: 'summary_large_image', title}
  };
}

export default async function PublicRunPage({
  params
}: {
  params: Promise<{locale: string; token: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('publicRun');
  const prefs = await getDisplayPrefs();
  const weapons = getWeapons();

  return (
    <>
      <SiteNav
        prefs={prefs}
        links={[{key: 'rules', href: '/'}]}
        action={{key: 'startRun', href: '/run/demo'}}
      />

      <main id="main" className="page public-run">
        <span className="kicker">{t('kicker')}</span>
        <h1 className="public-headline">
          {t('headline', {
            handle: RUN_SUMMARY.handle,
            cleared: CLEARED_COUNT,
            deaths: RUN_SUMMARY.deaths
          })}
        </h1>
        <p className="note" style={{marginTop: 'var(--space-6)'}}>
          {t('summary', {
            run: RUN_SUMMARY.number,
            days: RUN_SUMMARY.day,
            best: RUN_SUMMARY.personalBest
          })}
        </p>

        <div className="stat-row">
          <div>
            <p>{CLEARED_COUNT}</p>
            <p>{t('cleared')}</p>
          </div>
          <div>
            <p>{TOTAL_WEAPONS - CLEARED_COUNT}</p>
            <p>{t('toGo')}</p>
          </div>
          <div>
            <p>{RUN_SUMMARY.deaths}</p>
            <p>{t('deaths')}</p>
          </div>
          <div>
            <p>{RUN_SUMMARY.matches}</p>
            <p>{t('matches')}</p>
          </div>
        </div>

        <div style={{marginTop: 'var(--space-8)'}}>
          <ArmoryGrid weapons={weapons} columns={20} showCode={false} />
        </div>
      </main>
    </>
  );
}
