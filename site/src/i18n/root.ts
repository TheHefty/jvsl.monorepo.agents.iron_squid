import { chooseLocale } from './choose';
import { LOCALE_KEY } from './switch';

// The address the site's root sends a visitor to. Storage that cannot be read counts as no choice,
// so the browser's language decides (task root-language, failure 1).
export function rootAddress(
  basePath: string,
  stored: () => string | null,
  preferences: readonly string[],
): string {
  let choice: string | null = null;
  try {
    choice = stored();
  } catch {
    choice = null;
  }
  return `${basePath}${chooseLocale(choice, preferences)}/`;
}

// Run as the root page's own script, before its refresh to the default locale fires. The base path
// is the script's own address, less its file name.
export function redirectFromRoot() {
  const script = document.currentScript as HTMLScriptElement | null;
  const basePath = script ? new URL('.', script.src).pathname : '/';
  window.location.replace(
    rootAddress(
      basePath,
      () => window.localStorage.getItem(LOCALE_KEY),
      navigator.languages ?? [navigator.language],
    ),
  );
}
