import { LOCALE_KEY } from '../i18n/switch';
import { RUN_KEY } from '../run/storage';

// What the site keeps in the visitor's browser: the SRS data map, as the privacy notice states it.
// The notice is rendered from this list, and src/notices/data-map.test.ts fails if the site stores a
// key the list does not name, so the two cannot drift apart (docs/RULES.md).
export const storedInBrowser: { id: string; message: string; key?: string }[] = [
  { id: 'run', message: 'privacy.item.run', key: RUN_KEY },
  // Kept inside the run's own record, under the same key.
  { id: 'display-name', message: 'privacy.item.name' },
  { id: 'language', message: 'privacy.item.language', key: LOCALE_KEY },
];
