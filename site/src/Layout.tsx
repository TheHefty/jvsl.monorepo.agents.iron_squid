import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

type Props = { catalogueVersion: string; home: string; children: ReactNode };

// The frame every page is drawn in: the site's mark, the page, and the footer that says which game
// version the draws come from (FR-4). The notices story adds its links to the same footer.
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
        <p>
          <FormattedMessage id="catalogue.version" values={{ version: catalogueVersion }} />
        </p>
      </footer>
    </>
  );
}
