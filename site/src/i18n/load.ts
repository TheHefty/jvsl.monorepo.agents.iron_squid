import type { Locale } from './locales';

// Each locale's catalogue is its own chunk, fetched by the page of that locale only.
const loaders = import.meta.glob<Record<string, string>>('./messages/*.json', {
  import: 'default',
});

export async function loadMessages(locale: Locale): Promise<Record<string, string>> {
  const load = loaders[`./messages/${locale}.json`];
  if (!load) throw new Error(`i18n: no message catalogue for ${locale}`);
  return load();
}
