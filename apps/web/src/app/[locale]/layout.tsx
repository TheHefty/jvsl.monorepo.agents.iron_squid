import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {Inter} from 'next/font/google';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import {displayAttributes} from '@/lib/display';
import {getDisplayPrefs} from '@/lib/display.server';
import '@/styles/nocturne.css';
import '@/styles/app.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap'
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'meta'});

  return {
    title: t('title'),
    description: t('description')
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Lets the page render statically rather than falling back to dynamic.
  setRequestLocale(locale);

  const prefs = await getDisplayPrefs();
  const {style, ...attrs} = displayAttributes(prefs);
  const t = await getTranslations({locale, namespace: 'nav'});

  return (
    // `lang` tracks the locale, which the always-prefixed URL gives for free.
    <html lang={locale} className={inter.variable} style={style} {...attrs}>
      <body>
        <NextIntlClientProvider>
          <a className="skip-link" href="#main">
            {t('skipToContent')}
          </a>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
