import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';

// The frame every page is drawn in. The footer says which game version the draws come from (FR-4);
// the notices story adds its links to the same footer.
export function Layout({
  catalogueVersion,
  children,
}: {
  catalogueVersion: string;
  children: ReactNode;
}) {
  return (
    <>
      <main>{children}</main>
      <footer>
        <p>
          <FormattedMessage id="catalogue.version" values={{ version: catalogueVersion }} />
        </p>
      </footer>
    </>
  );
}
