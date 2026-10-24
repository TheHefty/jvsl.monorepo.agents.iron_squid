import { FormattedMessage, IntlProvider } from 'react-intl';
import type { Locale } from './i18n/locales';
import enUS from './i18n/messages/en-US.json';

const catalogues: Record<Locale, Record<string, string>> = { 'en-US': enUS };

export type Page = 'home' | 'not-found';

type Props = { locale: Locale; page: Page; basePath: string };

export function App({ locale, page, basePath }: Props) {
  return (
    <IntlProvider locale={locale} messages={catalogues[locale]}>
      <main>{page === 'home' ? <Home /> : <NotFound home={`${basePath}${locale}/`} />}</main>
    </IntlProvider>
  );
}

function Home() {
  return (
    <>
      <h1>
        <FormattedMessage id="site.name" />
      </h1>
      <p>
        <FormattedMessage id="home.tagline" />
      </p>
    </>
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
