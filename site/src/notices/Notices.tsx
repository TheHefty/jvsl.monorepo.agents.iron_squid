import { FormattedMessage } from 'react-intl';
import { storedInBrowser } from './data-map';
import { links } from './links';

// The two notices (FR-50). Drafted as plainly as possible and marked unreviewed: they are not legal
// advice, and say so first (docs/RULES.md). The privacy notice lists what is kept from data-map.ts,
// which the site's storage is tested against.
function Unreviewed() {
  return (
    <p className="notice">
      <FormattedMessage id="notice.unreviewed" />
    </p>
  );
}

export function PrivacyNotice() {
  return (
    <article className="notice-page">
      <h1>
        <FormattedMessage id="privacy.title" />
      </h1>
      <Unreviewed />
      <p>
        <FormattedMessage id="privacy.intro" />
      </p>
      <h2>
        <FormattedMessage id="privacy.keptTitle" />
      </h2>
      <ul>
        {storedInBrowser.map((item) => (
          <li key={item.id}>
            <FormattedMessage id={item.message} />
          </li>
        ))}
      </ul>
      <p>
        <FormattedMessage id="privacy.where" />
      </p>
      <h2>
        <FormattedMessage id="privacy.nameTitle" />
      </h2>
      <p>
        <FormattedMessage id="privacy.name" />
      </p>
      <h2>
        <FormattedMessage id="privacy.hostTitle" />
      </h2>
      <p>
        <FormattedMessage id="privacy.host" />{' '}
        <a href={links.githubPrivacy}>
          <FormattedMessage id="privacy.hostLink" />
        </a>
      </p>
      <p>
        <FormattedMessage id="privacy.dns" />{' '}
        <a href={links.cloudflarePrivacy}>
          <FormattedMessage id="privacy.dnsLink" />
        </a>
      </p>
      <h2>
        <FormattedMessage id="privacy.requestTitle" />
      </h2>
      <p>
        <FormattedMessage id="privacy.request" />
      </p>
      <ul>
        <li>
          <a href={links.issues}>
            <FormattedMessage id="privacy.issues" />
          </a>
        </li>
        <li>
          <a href={links.privateReport}>
            <FormattedMessage id="privacy.privateReport" />
          </a>
        </li>
      </ul>
    </article>
  );
}

export function TermsOfUse({ privacy }: { privacy: string }) {
  return (
    <article className="notice-page">
      <h1>
        <FormattedMessage id="terms.title" />
      </h1>
      <Unreviewed />
      {['terms.what', 'terms.warranty', 'terms.licence'].map((id) => (
        <p key={id}>
          <FormattedMessage id={id} />
        </p>
      ))}
      <p>
        <a href={privacy}>
          <FormattedMessage id="terms.data" />
        </a>
      </p>
      <p>
        <FormattedMessage id="terms.changes" />
      </p>
    </article>
  );
}
