import {createNavigation} from 'next-intl/navigation';
import {routing} from './routing';

/**
 * Locale-aware replacements for `next/link` and the navigation hooks. Using
 * these rather than the Next.js originals is what keeps the locale prefix on
 * every internal link without each call site remembering it.
 */
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
