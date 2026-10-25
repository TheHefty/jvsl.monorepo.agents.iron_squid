import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { links } from './notices/links';

type Props = { catalogueVersion: string; home: string; children: ReactNode };

// The frame every page is drawn in: the site's mark, the page, and the footer with the notices
// (FR-50), the fan-project line (FR-51) and the game version the draws come from (FR-4).
export function Layout({ catalogueVersion, home, children }: Props) {
  const intl = useIntl();
  return (
    <>
      <header className="site-header">
        <a className="site-mark" href={home}>
          {intl.formatMessage({ id: 'site.name' })}
        </a>
      </header>
      <main>{children}</main>
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
