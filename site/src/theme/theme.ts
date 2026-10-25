// The player's theme (FR-61): none until they choose, and the device's appearance decides; once
// chosen, kept under its own key (the data map lists it) and set as data-theme on the root
// element, which tokens.css reads.
export const THEME_KEY = 'iron-squid:theme';
export type Theme = 'light' | 'dark';

const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';

export function storedTheme(storage: Pick<Storage, 'getItem'> | undefined): Theme | undefined {
  try {
    const value = storage?.getItem(THEME_KEY);
    return isTheme(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function storeTheme(theme: Theme, storage: Pick<Storage, 'setItem'> | undefined) {
  try {
    storage?.setItem(THEME_KEY, theme);
  } catch {
    // Not kept: the choice holds for this page, and the device decides on the next visit.
  }
}

export function applyTheme(theme: Theme | undefined, root: HTMLElement) {
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
}

// Storage the browser refuses to open counts as none.
export function pageStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
