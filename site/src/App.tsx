import { FormattedMessage, IntlProvider } from 'react-intl';
import { currentVersion } from './catalogue';
import type { Locale } from './i18n/locales';
import { Layout } from './Layout';
import enUS from './i18n/messages/en-US.json';

const catalogues: Record<Locale, Record<string, string>> = { 'en-US': enUS };

export type Page = 'home' | 'not-found';

type Props = { locale: Locale; page: Page; basePath: string; catalogueVersion?: string };

export function App({ locale, page, basePath, catalogueVersion = currentVersion }: Props) {
  return (
    <IntlProvider locale={locale} messages={catalogues[locale]}>
      <Layout catalogueVersion={catalogueVersion} home={`${basePath}${locale}/`}>
        {page === 'home' ? <Home /> : <NotFound home={`${basePath}${locale}/`} />}
      </Layout>
    </IntlProvider>
  );
}

function Home() {
  return (
    <section className="ink-strip">
      <h1 className="hero-title">
        <FormattedMessage id="site.name" />
      </h1>
      <p className="hero-lede">
        <FormattedMessage id="home.tagline" />
      </p>
    </section>
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
