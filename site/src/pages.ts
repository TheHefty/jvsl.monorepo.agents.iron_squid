import { localeFromPath } from './i18n/locales';

// The pages the site has, under each locale (NFR-I8): the run, and the two notices (FR-50).
export const routes = ['', 'terms', 'privacy'] as const;
export type Page = 'home' | 'terms' | 'privacy' | 'not-found';

export function pageFromPath(pathname: string, basePath: string): Page {
  const locale = localeFromPath(pathname, basePath);
  if (!locale) return 'not-found';
  const rest = pathname.slice(basePath.length + locale.length + 1).replace(/\/$/, '');
  if (rest === '') return 'home';
  if (rest === 'terms' || rest === 'privacy') return rest;
  return 'not-found';
}
