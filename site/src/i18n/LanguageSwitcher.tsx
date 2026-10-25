import { FormattedMessage, useIntl } from 'react-intl';
import autonyms from './autonyms.json';
import { locales, type Locale } from './locales';
import { browserStorage } from '../run/storage';
import { localeHref, rememberLocale } from './switch';

const nameOf = (l: Locale) => (autonyms as Record<string, string>)[l] ?? l;

// The language switcher on every page (story choose-language): a disclosure of links, each to the
// same page in another locale, every language named in itself and an unreviewed one marked. Links,
// not a select that navigates on change, so browsing the options changes nothing (WCAG 3.2.2).
export function LanguageSwitcher({ basePath }: { basePath: string }) {
  const intl = useIntl();
  const here = intl.locale as Locale;
  const href = (target: Locale) =>
    localeHref(window.location.pathname, window.location.hash, basePath, target);
  return (
    <nav className="language-switcher" aria-label={intl.formatMessage({ id: 'language.label' })}>
      <details>
        <summary>{intl.formatMessage({ id: 'language.current' }, { name: nameOf(here) })}</summary>
        <ul>
          {locales.map((locale) => (
            <li key={locale}>
              <a
                href={href(locale)}
                lang={locale}
                hrefLang={locale}
                aria-current={locale === here ? 'true' : undefined}
                onClick={(e) => {
                  // The fragment may have changed since this was drawn (a shared run opened).
                  e.currentTarget.href = href(locale);
                  rememberLocale(locale, browserStorage());
                }}
              >
                {nameOf(locale)}
              </a>
              {__TRANSLATION_STATUS__[locale] === 'unreviewed' && (
                <span className="language-note">
                  {' '}
                  <FormattedMessage id="language.unreviewed" />
                </span>
              )}
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
