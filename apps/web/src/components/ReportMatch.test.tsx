import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {NextIntlClientProvider} from 'next-intl';
import messages from '../../messages/en.json';
import {ReportMatch} from './ReportMatch';

const refresh = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({refresh, push: vi.fn()})
}));

const MODE_NAMES = {
  splatZones: 'Splat Zones',
  towerControl: 'Tower Control',
  rainmaker: 'Rainmaker',
  clamBlitz: 'Clam Blitz'
};

/** The bodies the component posted, in order, already parsed. */
function sent() {
  return vi
    .mocked(fetch)
    .mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
}

function ok() {
  return Promise.resolve(
    new Response(JSON.stringify({applied: true}), {status: 200})
  );
}

function down() {
  return Promise.reject(new Error('offline'));
}

describe('reporting a match', () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal('fetch', vi.fn(ok));
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ReportMatch editSecret="s3cret" modeNames={MODE_NAMES} />
      </NextIntlClientProvider>
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers the four ranked modes and not Turf War', () => {
    for (const name of Object.values(MODE_NAMES)) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText(/turf/i)).not.toBeInTheDocument();
  });

  it('reports the result and the chosen mode', async () => {
    await userEvent.click(screen.getByLabelText('Rainmaker'));
    await userEvent.click(screen.getByRole('button', {name: 'I won'}));

    expect(sent()[0]).toMatchObject({
      editSecret: 's3cret',
      result: 'win',
      mode: 'rainmaker'
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('reports a loss as a loss', async () => {
    await userEvent.click(screen.getByRole('button', {name: 'I lost'}));
    expect(sent()[0]).toMatchObject({result: 'loss'});
  });

  it('keeps the same idempotency key when a failed report is retried', async () => {
    // The one that matters. A key that changed between attempts would let a
    // flaky connection spend a second life, and the database could not tell:
    // two different keys are two different matches by definition.
    vi.mocked(fetch).mockImplementationOnce(down);

    await userEvent.click(screen.getByRole('button', {name: 'I won'}));
    expect(await screen.findByText(/did not go through/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'I won'}));

    const [first, second] = sent();
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });

  it('uses a fresh key for the next match once one is accepted', async () => {
    await userEvent.click(screen.getByRole('button', {name: 'I won'}));
    await userEvent.click(screen.getByRole('button', {name: 'I won'}));

    const [first, second] = sent();
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('says so when a report does not land, rather than failing quietly', async () => {
    vi.mocked(fetch).mockImplementation(down);

    await userEvent.click(screen.getByRole('button', {name: 'I won'}));

    // Announced, because a report the reader thinks landed and did not is a
    // match they will not report again.
    const note = await screen.findByRole('status');
    expect(note).toHaveTextContent(/did not go through/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refuses to send twice while one is in flight', async () => {
    let release = () => {};
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(new Response('{}', {status: 200}));
        })
    );

    await userEvent.click(screen.getByRole('button', {name: 'I won'}));
    await userEvent.click(screen.getByRole('button', {name: 'I lost'}));

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    release();
  });
});
