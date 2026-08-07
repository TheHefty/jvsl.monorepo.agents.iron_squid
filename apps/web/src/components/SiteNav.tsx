import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {DisplayPrefs} from '@/lib/display';
import {DisplaySettings} from './DisplaySettings';

type NavKey = 'rules' | 'runs' | 'leaderboard' | 'myRun' | 'armory' | 'log';

export function SiteNav({
  prefs,
  links,
  current,
  action
}: {
  prefs: DisplayPrefs;
  links: {key: NavKey; href: string}[];
  current?: NavKey;
  action?: {key: 'startRun'; href: string};
}) {
  const t = useTranslations('nav');

  return (
    <nav className="nav site-nav">
      <Link href="/" className="nav-brand">
        {t('brand')}
      </Link>
      {links.map(({key, href}) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? 'page' : undefined}
        >
          {t(key)}
        </Link>
      ))}
      <DisplaySettings initial={prefs} />
      {action ? (
        <Link href={action.href} className="btn btn-primary">
          {t(action.key)}
        </Link>
      ) : null}
    </nav>
  );
}
