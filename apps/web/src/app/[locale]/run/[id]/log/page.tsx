import {
  getFormatter,
  getTranslations,
  setRequestLocale
} from 'next-intl/server';
import {getDisplayPrefs} from '@/lib/display.server';
import {SiteNav} from '@/components/SiteNav';
import {getLog} from '@/lib/mock';

/** Run log — design option 1g: every win, and every death. */
export default async function LogPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('log');
  const format = await getFormatter();
  const prefs = await getDisplayPrefs();
  const entries = getLog();

  return (
    <>
      <SiteNav
        prefs={prefs}
        current="log"
        links={[
          {key: 'myRun', href: `/run/${id}`},
          {key: 'armory', href: `/run/${id}/armory`},
          {key: 'log', href: `/run/${id}/log`}
        ]}
      />

      <main id="main" className="page" style={{paddingBlock: 'var(--space-8)'}}>
        <h1 style={{marginBottom: 'var(--space-2)'}}>{t('heading')}</h1>
        <p className="note">{t('intro')}</p>

        {entries.length === 0 ? (
          <p>{t('empty')}</p>
        ) : (
          <ul className="log-list">
            {entries.map((entry) => (
              <li className="log-row" key={entry.id}>
                <span className="log-mark" data-kind={entry.kind}>
                  {entry.kind === 'win' ? t('win') : t('death')}
                </span>
                <div style={{minWidth: 0}}>
                  <p className="log-title">{entry.weapon}</p>
                  <p className="log-detail">{entry.detail}</p>
                </div>
                {/* Dates go through Intl, never hand-assembled: the format has
                    to follow the locale, not the author's habits. */}
                <time className="log-when" dateTime={entry.when}>
                  {format.dateTime(new Date(entry.when), {
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
