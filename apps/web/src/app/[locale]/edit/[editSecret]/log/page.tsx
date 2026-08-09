import {
  getFormatter,
  getTranslations,
  setRequestLocale
} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {loadModeNames} from '@/data/catalogue';
import {getDemoChallenge} from '@/lib/demo';
import type {Locale} from '@/i18n/routing';

/** Run log — design option 1g: every win, and every death. */
export default async function LogPage({
  params
}: {
  params: Promise<{locale: string; editSecret: string}>;
}) {
  const {locale, editSecret} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('log');
  const format = await getFormatter();
  const prefs = await getDisplayPrefs();
  const [{log, run}, modeNames] = await Promise.all([
    getDemoChallenge(locale as Locale),
    loadModeNames(locale as Locale)
  ]);

  return (
    <>
      <SiteNav
        prefs={prefs}
        current="log"
        links={[
          {key: 'myRun', href: `/edit/${editSecret}`},
          {key: 'armory', href: `/edit/${editSecret}/armory`},
          {key: 'log', href: `/edit/${editSecret}/log`}
        ]}
      />

      <main id="main" className="page" style={{paddingBlock: 'var(--space-8)'}}>
        <h1 style={{marginBottom: 'var(--space-2)'}}>{t('heading')}</h1>
        <p className="note">{t('intro')}</p>

        {log.length === 0 ? (
          <p>{t('empty')}</p>
        ) : (
          <ul className="log-list">
            {log.map((entry) => (
              <li className="log-row" key={entry.id}>
                <span
                  className="log-mark"
                  data-kind={entry.result === 'win' ? 'win' : 'death'}
                >
                  {entry.result === 'win' ? t('win') : t('death')}
                </span>
                <div style={{minWidth: 0}}>
                  <p className="log-title">{entry.weaponName}</p>
                  <p className="log-detail">
                    {modeNames[entry.mode]}
                    {entry.runNumber === run.number
                      ? null
                      : ` · ${t('fromRun', {number: entry.runNumber})}`}
                  </p>
                </div>
                {/* Dates go through Intl, never hand-assembled: the format has
                    to follow the locale, not the author's habits. */}
                <time className="log-when" dateTime={entry.at}>
                  {format.dateTime(new Date(entry.at), {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
