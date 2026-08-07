import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

/**
 * Next.js 16 renamed Middleware to Proxy; the contract is unchanged, so
 * next-intl's `createMiddleware` is what gets exported here.
 *
 * This is what redirects a bare `/` to `/en` (or the reader's best match) and
 * keeps every route under a locale prefix.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals, and anything with a file
  // extension (static assets).
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
};
