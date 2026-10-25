import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { Catalogue } from '../catalogue/types';
import type { RunState } from '../run/engine';
import { encodeShare } from './link';

type Shown = { kind: 'none' } | { kind: 'copied' } | { kind: 'by-hand'; link: string };

// "Copy link", and "Share" where the device has a share sheet (FR-40). The link is made when the
// button is pressed, so it is the run at that moment: a snapshot, in the fragment, which a browser
// never sends to a server.
export function ShareControls({ state, catalogue }: { state: RunState; catalogue: Catalogue }) {
  const intl = useIntl();
  const [shown, setShown] = useState<Shown>({ kind: 'none' });
  const canShare = typeof navigator.share === 'function';

  const link = () =>
    `${window.location.origin}${import.meta.env.BASE_URL}${intl.locale}/run/#${encodeShare(state, catalogue)}`;

  async function copy() {
    const url = link();
    try {
      await navigator.clipboard.writeText(url);
      setShown({ kind: 'copied' });
    } catch {
      // Refused (permissions, an older browser): the player copies it themselves.
      setShown({ kind: 'by-hand', link: url });
    }
  }

  async function share() {
    const url = link();
    try {
      await navigator.share({ title: intl.formatMessage({ id: 'share.title' }), url });
    } catch (e) {
      // The player closing the share sheet is not a failure.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setShown({ kind: 'by-hand', link: url });
      }
    }
  }

  return (
    <div className="share-controls">
      <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
        <FormattedMessage id="share.copy" />
      </button>
      {canShare && (
        <button type="button" className="btn btn-secondary" onClick={() => void share()}>
          <FormattedMessage id="share.share" />
        </button>
      )}
      <p role="status" aria-live="polite" className="share-status">
        {shown.kind === 'copied' && <FormattedMessage id="share.copied" />}
      </p>
      {shown.kind === 'by-hand' && (
        <label className="share-by-hand">
          <FormattedMessage id="share.copyByHand" />
          <input
            type="text"
            readOnly
            value={shown.link}
            ref={(input) => input?.select()}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      )}
    </div>
  );
}
