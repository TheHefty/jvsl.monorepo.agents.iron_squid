'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {MATCH_MODES, type MatchMode, type MatchResult} from '@/domain/types';

/**
 * The two buttons that move a challenge forward.
 *
 * A mode has to be chosen before either works, and that is the rule rather
 * than a form preference: rule 3 counts a win only in Anarchy or X Battle, and
 * naming the mode is the only trace the honour system leaves. Turf War is not
 * offered because there is no value that could report it.
 *
 * The idempotency key is generated once per attempt and *kept* across retries.
 * That is the whole point of it: a report that failed on a flaky connection
 * must arrive under the same key when it is sent again, or the second attempt
 * spends a second life.
 */
export function ReportMatch({
  editSecret,
  modeNames
}: {
  editSecret: string;
  /** From the dataset, per locale — never written in this component. */
  modeNames: Record<MatchMode, string>;
}) {
  const t = useTranslations('dashboard');
  const router = useRouter();

  const [mode, setMode] = useState<MatchMode>(MATCH_MODES[0]);
  const [busy, setBusy] = useState<MatchResult | null>(null);
  const [failed, setFailed] = useState(false);

  // Held outside the request so a retry reuses it.
  const [key, setKey] = useState(() => crypto.randomUUID());

  async function send(result: MatchResult) {
    if (busy) return;
    setBusy(result);
    setFailed(false);

    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({editSecret, result, mode, idempotencyKey: key})
      });

      if (!response.ok) throw new Error(String(response.status));

      // A fresh key, because the next report is a different match. The server
      // has accepted this one — whether it applied it or recognised a replay.
      setKey(crypto.randomUUID());
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="report">
      <fieldset className="field">
        <legend>{t('modeLabel')}</legend>
        <div className="seg">
          {MATCH_MODES.map((option) => (
            <label className="seg-opt" key={option}>
              <input
                type="radio"
                name="mode"
                value={option}
                checked={mode === option}
                onChange={() => setMode(option)}
              />
              {modeNames[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => send('win')}
          disabled={busy !== null}
        >
          {busy === 'win' ? t('rolling') : t('iWon')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => send('loss')}
          disabled={busy !== null}
        >
          {busy === 'loss' ? t('rolling') : t('iLost')}
        </button>
      </div>

      {/* Announced, not merely shown: a failed report that the reader does not
          notice is a match they believe they recorded and did not. */}
      <p role="status" aria-live="polite" className="text-muted">
        {failed ? t('reportFailed') : ''}
      </p>
    </div>
  );
}
