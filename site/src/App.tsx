import { FormattedMessage, IntlProvider } from 'react-intl';
import { currentVersion } from './catalogue';
import type { Locale } from './i18n/locales';
import { Layout } from './Layout';
import { PrivacyNotice, TermsOfUse } from './notices/Notices';
import type { Page } from './pages';
import { RunPage } from './run/RunPage';
import { SharedRunPage } from './share/SharedRunPage';

type Props = {
  locale: Locale;
  messages: Record<string, string>;
  page: Page;
  basePath: string;
  catalogueVersion?: string;
};

export function App({
  locale,
  messages,
  page,
  basePath,
  catalogueVersion = currentVersion,
}: Props) {
  return (
    <IntlProvider locale={locale} messages={messages}>
      <Layout
        catalogueVersion={catalogueVersion}
        home={`${basePath}${locale}/`}
        basePath={basePath}
      >
        {page === 'home' && <RunPage newestVersion={catalogueVersion} />}
        {page === 'shared' && <SharedRunPage home={`${basePath}${locale}/`} />}
        {page === 'privacy' && <PrivacyNotice />}
        {page === 'terms' && <TermsOfUse privacy={`${basePath}${locale}/privacy/`} />}
        {page === 'not-found' && <NotFound home={`${basePath}${locale}/`} />}
      </Layout>
    </IntlProvider>
  );
}

function NotFound({ home }: { home: string }) {
  return (
    <>
      <h1>
        <FormattedMessage id="notFound.title" />
      </h1>
      <p>
        <FormattedMessage id="notFound.body" />
      </p>
      <p>
        <a href={home}>
          <FormattedMessage id="notFound.home" />
        </a>
      </p>
    </>
  );
}
