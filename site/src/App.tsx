import { FormattedMessage, IntlProvider } from 'react-intl';
import { currentVersion } from './catalogue';
import type { Locale } from './i18n/locales';
import { Layout } from './Layout';
import { PrivacyNotice, TermsOfUse } from './notices/Notices';
import type { Page } from './pages';
import { RunPage } from './run/RunPage';
import enUS from './i18n/messages/en-US.json';

const catalogues: Record<Locale, Record<string, string>> = { 'en-US': enUS };

type Props = { locale: Locale; page: Page; basePath: string; catalogueVersion?: string };

export function App({ locale, page, basePath, catalogueVersion = currentVersion }: Props) {
  return (
    <IntlProvider locale={locale} messages={catalogues[locale]}>
      <Layout catalogueVersion={catalogueVersion} home={`${basePath}${locale}/`}>
        {page === 'home' && <RunPage newestVersion={catalogueVersion} />}
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
