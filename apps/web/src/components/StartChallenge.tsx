'use client';

import {useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';

/**
 * The form that opens a challenge.
 *
 * It posts to `/api/challenges` rather than calling a server action, and that
 * is a security decision rather than a stylistic one. A server action posts to
 * the page's own URL, and the WAF rate-limit rule that RULES.md#security
 * requires matches `/api` — creating through an action would slip past the
 * only thing enforcing that rule. One protected write surface is worth needing
 * JavaScript for.
 *
 * The secret comes back exactly once, in this response, and goes straight into
 * the URL of the page we navigate to. It is never rendered here.
 */
export function StartChallenge() {
  const t = useTranslations('landing');
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFailed(false);

    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({handle})
      });

      if (!response.ok) throw new Error(String(response.status));

      const {editSecret} = (await response.json()) as {editSecret: string};
      router.push(`/edit/${editSecret}`);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <form className="start-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="handle">{t('handleLabel')}</label>
        <input
          id="handle"
          className="input"
          name="handle"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          maxLength={40}
          required
          autoComplete="off"
          aria-describedby="handle-hint"
        />
        <p id="handle-hint" className="text-muted">
          {t('handleHint')}
        </p>
      </div>

      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? t('creating') : t('rollFirst')}
      </button>

      {/* Announced rather than merely shown: a failure the reader cannot see
          is a failure they will repeat. */}
      <p role="status" aria-live="polite" className="text-muted">
        {failed ? t('createFailed') : ''}
      </p>
    </form>
  );
}
