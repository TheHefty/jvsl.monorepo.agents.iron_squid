// Every page's first script, built alone as a classic script by scripts/emit-pages.ts: it sets the
// chosen theme before anything paints, so the page never flashes in the other one.
import { applyTheme, pageStorage, storedTheme } from './theme';

applyTheme(storedTheme(pageStorage()), document.documentElement);
