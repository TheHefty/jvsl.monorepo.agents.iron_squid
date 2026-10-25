import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadMessages } from './i18n/load';
import { defaultLocale, localeFromPath } from './i18n/locales';
import { pageFromPath, type Page } from './pages';
import './styles.css';

const basePath = import.meta.env.BASE_URL;
// The build writes one page per address; the page says what it is rather than the app guessing
// from the URL, because 404.html is served at whatever address was missing.
const declared = document.querySelector<HTMLMetaElement>('meta[name="iron-squid-page"]')?.content;
const locale = localeFromPath(location.pathname, basePath);
const page: Page =
  declared === 'not-found' ? 'not-found' : pageFromPath(location.pathname, basePath);

const root = document.getElementById('root');
if (!root) throw new Error('main: the page has no #root element');

const active = locale ?? defaultLocale;
const messages = await loadMessages(active);
createRoot(root).render(
  <StrictMode>
    <App locale={active} messages={messages} page={page} basePath={basePath} />
  </StrictMode>,
);
