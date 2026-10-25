import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { applyTheme, pageStorage, storedTheme, storeTheme, type Theme } from './theme';

const systemTheme = (): Theme =>
  window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

// The Light/Dark control in every page's header (FR-61). It shows the theme in force: the chosen
// one, or the device's until a choice is made. Choosing applies at once, without a reload.
export function ThemeSwitch() {
  const intl = useIntl();
  const [chosen, setChosen] = useState<Theme | undefined>(() => storedTheme(pageStorage()));
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: light)');
    const onChange = () => setSystem(systemTheme());
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
  }, []);

  const shown = chosen ?? system;
  const choose = (theme: Theme) => {
    storeTheme(theme, pageStorage());
    applyTheme(theme, document.documentElement);
    setChosen(theme);
  };

  return (
    <div
      className="theme-switch"
      role="group"
      aria-label={intl.formatMessage({ id: 'theme.label' })}
    >
      {(['light', 'dark'] as const).map((theme) => (
        <button
          key={theme}
          type="button"
          aria-pressed={shown === theme}
          onClick={() => choose(theme)}
        >
          {intl.formatMessage({ id: theme === 'light' ? 'theme.light' : 'theme.dark' })}
        </button>
      ))}
    </div>
  );
}
