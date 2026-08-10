import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {ArmoryGrid} from '@/components/ArmoryGrid';
import {publicChallenge} from '@/lib/challenge.server';
import type {Locale} from '@/i18n/routing';

/**
 * The public run page — design option 1h, "the thing people paste in Discord".
 *
 * This is the page the whole architecture bends around: it renders on the
 * server so that a shared link has real content and a real link preview, and
 * the theme comes from a cookie so it never paints the wrong one first.
 *
 * Reached by `publicId` only — the short random slug that goes in a shared
 * URL. The edit credential lives on `/edit/[editSecret]` and must never appear
 * here: not in the markup, not in a link, not in the metadata above.
 */

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string; publicId: string}>;
}): Promise<Metadata> {
  const {locale, publicId} = await params;
  const t = await getTranslations({locale, namespace: 'publicRun'});
  const {progress, handle} = await publicChallenge(publicId, locale as Locale);

  const title = t('headline', {
    handle,
    cleared: progress.cleared,
    deaths: progress.deaths
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
  params: Promise<{locale: string; publicId: string}>;
}) {
  const {locale, publicId} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('publicRun');
  const prefs = await getDisplayPrefs();
  const {armory, progress, run, day, handle} = await publicChallenge(
    publicId,
    locale as Locale
  );

  return (
    <>
      <SiteNav
        prefs={prefs}
        links={[{key: 'rules', href: '/'}]}
        action={{key: 'startRun', href: '/edit/demo'}}
      />

      <main id="main" className="page public-run">
        <span className="kicker">{t('kicker')}</span>
        <h1 className="public-headline">
          {t('headline', {
            handle,
            cleared: progress.cleared,
            deaths: progress.deaths
          })}
        </h1>
        <p className="note" style={{marginTop: 'var(--space-6)'}}>
          {t('summary', {
            run: run.number,
            days: day,
            best: progress.best
          })}
        </p>

        <div className="stat-row">
          <div>
            <p>{progress.cleared}</p>
            <p>{t('cleared')}</p>
          </div>
          <div>
            <p>{progress.remaining}</p>
            <p>{t('toGo')}</p>
          </div>
          <div>
            <p>{progress.deaths}</p>
            <p>{t('deaths')}</p>
          </div>
          <div>
            <p>{progress.matches}</p>
            <p>{t('matches')}</p>
          </div>
        </div>

        <div style={{marginTop: 'var(--space-8)'}}>
          <ArmoryGrid weapons={armory} columns={20} showCode={false} />
        </div>
      </main>
    </>
  );
}
