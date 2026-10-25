import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';
import { links } from './notices/links';
import { ThemeSwitch } from './theme/ThemeSwitch';

type Props = { catalogueVersion: string; home: string; basePath: string; children: ReactNode };

// The frame every page is drawn in: the site's mark, the page, and the footer with the notices
// (FR-50), the fan-project line (FR-51) and the game version the draws come from (FR-4).
export function Layout({ catalogueVersion, home, basePath, children }: Props) {
  const intl = useIntl();
  return (
    <>
      <header className="site-header">
        <a className="site-mark" href={home} aria-label={intl.formatMessage({ id: 'header.home' })}>
          {/* Decorative: the link is named "Iron Squid, home" (FR-60). */}
          <img src={`${basePath}logo.svg`} alt="" width={28} height={28} />
          {intl.formatMessage({ id: 'site.name' })}
        </a>
        <div className="header-controls">
          <ThemeSwitch />
          <LanguageSwitcher basePath={basePath} />
        </div>
      </header>
      <main>
        {intl.messages['translation.status'] === 'unreviewed' && (
          // A translation nobody fluent has checked says so, in its own language (NFR-I4).
          <p className="notice translation-notice">
            <FormattedMessage id="translation.unreviewed" />
          </p>
        )}
        {children}
      </main>
      <footer className="site-footer">
        <nav aria-label={intl.formatMessage({ id: 'footer.label' })}>
          <ul className="footer-links">
            <li>
              <a href={`${home}terms/`}>
                <FormattedMessage id="footer.terms" />
              </a>
            </li>
            <li>
              <a href={`${home}privacy/`}>
                <FormattedMessage id="footer.privacy" />
              </a>
            </li>
            <li>
              <a href={links.securityPolicy}>
                <FormattedMessage id="footer.security" />
              </a>
            </li>
          </ul>
        </nav>
        <p>
          <FormattedMessage id="footer.fan" />
        </p>
        <p>
          <FormattedMessage id="catalogue.version" values={{ version: catalogueVersion }} />
        </p>
      </footer>
    </>
  );
}
