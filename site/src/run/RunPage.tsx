import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { imageUrl, loadCatalogues } from '../catalogue/load';
import type { Catalogue, Item } from '../catalogue/types';
import {
  currentSet,
  nextSet,
  reportLoss,
  reportWin,
  startRun,
  undo,
  winsToNextLife,
  type RunState,
} from './engine';
import { displayName } from './name';
import { cryptoSource } from './random';
import { browserStorage, createRunStore, type LoadResult, type RunStore } from './storage';

const MAX_NAME = 30;

const findItem = (items: Item[], id: string) => items.find((i) => i.id === id);
const nameOf = (item: Item | undefined) => item?.name['en-US'] ?? '';

function setPieces(catalogue: Catalogue, state: RunState) {
  const set = currentSet(state);
  return {
    kit: findItem(catalogue.kits, set.kit),
    head: findItem(catalogue.gear.head, set.head),
    clothes: findItem(catalogue.gear.clothes, set.clothes),
    shoes: findItem(catalogue.gear.shoes, set.shoes),
  };
}

type View =
  | { kind: 'loading' }
  | { kind: 'start' }
  | { kind: 'run'; state: RunState; revision: number }
  | { kind: 'unreadable'; detail: string };

// The run, as the player plays it (story draw-a-set): start a run, see the set, report the win, ask
// for the next set, undo the last result, start over only after confirming. The rules are the
// engine's; this page shows them and keeps every change in the store.
export function RunPage({ newestVersion }: { newestVersion: string }) {
  const intl = useIntl();
  const [catalogues, setCatalogues] = useState<Record<string, Catalogue>>();
  const [store, setStore] = useState<RunStore>();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [notice, setNotice] = useState<string>();
  const [announcement, setAnnouncement] = useState('');
  const replacing = useRef<{ basedOn: number; unreadable: boolean } | undefined>(undefined);
  const lastAction = useRef(0);

  const show = useCallback((result: LoadResult) => {
    if (result.status === 'ok')
      setView({ kind: 'run', state: result.state, revision: result.revision });
    else if (result.status === 'unreadable') setView({ kind: 'unreadable', detail: result.detail });
    else setView({ kind: 'start' });
  }, []);

  useEffect(() => {
    let live = true;
    let detach: (() => void) | undefined;
    void loadCatalogues().then((loaded) => {
      if (!live) return;
      const s = createRunStore(browserStorage(), loaded);
      s.onExternalChange((result) => {
        show(result);
        setNotice(intl.formatMessage({ id: 'run.updatedElsewhere' }));
      });
      const onStorage = (e: StorageEvent) => s.storageEvent(e);
      window.addEventListener('storage', onStorage);
      detach = () => window.removeEventListener('storage', onStorage);
      setCatalogues(loaded);
      setStore(s);
      show(s.load());
    });
    return () => {
      live = false;
      detach?.();
    };
  }, [intl, show]);

  function announceSet(s: RunState) {
    const c = catalogues?.[s.catalogueVersion];
    if (!c) return;
    const p = setPieces(c, s);
    setAnnouncement(
      intl.formatMessage(
        { id: 'set.announce' },
        {
          kit: nameOf(p.kit),
          head: nameOf(p.head),
          clothes: nameOf(p.clothes),
          shoes: nameOf(p.shoes),
        },
      ),
    );
  }

  // Every change goes through the store; one refused because another tab or a second click got
  // there first shows what is stored instead.
  const commit = (state: RunState, basedOn: number, options?: { replaceUnreadable?: boolean }) => {
    if (!store) return false;
    const saved = store.save(state, basedOn, options);
    if (saved.ok) {
      setView({ kind: 'run', state, revision: saved.revision });
      return true;
    }
    if ('conflict' in saved) {
      show(saved.conflict);
      setNotice(intl.formatMessage({ id: 'run.updatedElsewhere' }));
    }
    return false;
  };

  if (view.kind === 'loading' || !catalogues) {
    return (
      <Hero>
        <h1 className="hero-title">
          <FormattedMessage id="site.name" />
        </h1>
        <p className="hero-lede">
          <FormattedMessage id="run.loading" />
        </p>
      </Hero>
    );
  }

  if (view.kind === 'unreadable') {
    return (
      <Hero>
        <p className="hero-lede" role="alert">
          <FormattedMessage id="run.unreadable" values={{ detail: view.detail }} />
        </p>
        <NewRunButton
          label="run.replaceUnreadable"
          onConfirm={() => {
            replacing.current = { basedOn: 0, unreadable: true };
            setView({ kind: 'start' });
          }}
        />
      </Hero>
    );
  }

  if (view.kind === 'start') {
    const catalogue = catalogues[newestVersion];
    return (
      <StartForm
        onStart={(name) => {
          if (!catalogue) return;
          const state = startRun(catalogue, { name }, cryptoSource, new Date().toISOString());
          const replace = replacing.current;
          if (commit(state, replace?.basedOn ?? 0, { replaceUnreadable: replace?.unreadable })) {
            replacing.current = undefined;
            announceSet(state);
          }
        }}
      />
    );
  }

  const { state, revision } = view;
  const catalogue = catalogues[state.catalogueVersion];
  if (!catalogue) return null;
  const pieces = setPieces(catalogue, state);

  // What a result did, for screen readers (NFR-A4): the result, the kit and the lives now.
  const announceResult = (id: string, after: RunState) =>
    setAnnouncement(
      intl.formatMessage(
        { id },
        {
          kit: nameOf(pieces.kit),
          lives: intl.formatMessage({ id: 'run.lives' }, { lives: after.lives }),
        },
      ),
    );

  // Each action names the step on screen; the engine refuses one made on a state already moved on.
  //
  // After a result, the next button appears where the last one was, so the second click of a double
  // click (or a quick double tap) lands on it: on "Next set" it would report a win for a set never
  // played. A click that is part of a multiple click is ignored; so is a tap within 300 ms of the
  // last action, since not every phone counts taps. Keyboard activation (detail 0) always counts.
  const act = (
    event: React.MouseEvent,
    change: () => RunState,
    announce: (s: RunState) => void,
  ) => {
    const now = Date.now();
    const touch = (event.nativeEvent as PointerEvent).pointerType === 'touch';
    if (event.detail > 1 || (touch && now - lastAction.current < 300)) return;
    lastAction.current = now;
    let changed: RunState;
    try {
      changed = change();
    } catch {
      return;
    }
    setNotice(undefined);
    if (commit(changed, revision)) announce(changed);
  };

  return (
    <>
      <Hero>
        <h1 className="run-title">{state.name ?? intl.formatMessage({ id: 'run.untitled' })}</h1>
        <div className="run-stats">
          <p className="run-conquered">
            {intl.formatMessage(
              { id: 'run.conquered' },
              { conquered: state.conquered, total: state.order.kits.length },
            )}
          </p>
          <ul
            className="drops"
            aria-label={intl.formatMessage({ id: 'run.lives' }, { lives: state.lives })}
          >
            {Array.from({ length: Math.max(state.lives, 1) }, (_, i) => (
              <li key={i} data-full={i < state.lives} />
            ))}
          </ul>
          <p className="run-next-life">
            {intl.formatMessage({ id: 'run.nextLife' }, { wins: winsToNextLife(state) })}
          </p>
          <p className="run-resets">
            {intl.formatMessage({ id: 'run.resets' }, { resets: state.resets })}
          </p>
        </div>
      </Hero>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="card set-card" aria-labelledby="set-heading">
        <span className="sticker">
          <FormattedMessage id={state.phase === 'conquered' ? 'set.conquered' : 'set.playing'} />
        </span>
        <h2 id="set-heading" className="visually-hidden">
          <FormattedMessage id="set.label" />
        </h2>
        <Piece version={catalogue.version} item={pieces.kit} kit>
          <FormattedMessage
            id="set.weaponNumber"
            values={{ number: state.cursor + 1, total: state.order.kits.length }}
          />
        </Piece>
        <div className="gear">
          <Piece version={catalogue.version} item={pieces.head}>
            <FormattedMessage id="set.head" />
          </Piece>
          <Piece version={catalogue.version} item={pieces.clothes}>
            <FormattedMessage id="set.clothes" />
          </Piece>
          <Piece version={catalogue.version} item={pieces.shoes}>
            <FormattedMessage id="set.shoes" />
          </Piece>
        </div>
        <div className="actions">
          {state.phase === 'playing' ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(event) =>
                  act(
                    event,
                    () => reportWin(state, { step: state.step, at: new Date().toISOString() }),
                    (after) => announceResult('announce.win', after),
                  )
                }
              >
                <FormattedMessage id="run.won" />
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={(event) =>
                  act(
                    event,
                    () => reportLoss(state, { step: state.step, at: new Date().toISOString() }),
                    (after) => {
                      // A loss on the last life resets the run (FR-18); say so on the page too.
                      if (after.resets > state.resets) {
                        announceResult('announce.reset', after);
                        setNotice(intl.formatMessage({ id: 'run.resetNotice' }));
                      } else {
                        announceResult('announce.loss', after);
                      }
                    },
                  )
                }
              >
                <FormattedMessage id="run.lost" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={(event) =>
                act(event, () => nextSet(state, { step: state.step }), announceSet)
              }
            >
              <FormattedMessage id="run.next" />
            </button>
          )}
          {state.previous && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={(event) => act(event, () => undo(state), announceSet)}
            >
              <FormattedMessage id="run.undo" />
            </button>
          )}
        </div>
      </section>
      <NewRunButton
        label="run.newRun"
        onConfirm={() => {
          replacing.current = { basedOn: revision, unreadable: false };
          setView({ kind: 'start' });
        }}
      />
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

function Hero({ children }: { children: React.ReactNode }) {
  return <section className="ink-strip">{children}</section>;
}

function Piece({
  version,
  item,
  kit = false,
  children,
}: {
  version: string;
  item: Item | undefined;
  kit?: boolean;
  children: React.ReactNode;
}) {
  if (!item) return null;
  const name = item.name['en-US'] ?? '';
  return (
    <figure className={kit ? 'piece piece-kit' : 'piece'}>
      <img
        src={imageUrl(version, item.image)}
        alt={name}
        width={kit ? 128 : 72}
        height={kit ? 128 : 72}
      />
      <figcaption>
        <span className="piece-label">{children}</span>
        <span className="piece-name">{name}</span>
      </figcaption>
    </figure>
  );
}

function StartForm({ onStart }: { onStart: (name: string | undefined) => void }) {
  const intl = useIntl();
  const [error, setError] = useState<string>();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const field = new FormData(e.currentTarget).get('name');
    const checked = displayName(typeof field === 'string' ? field : '');
    if (!checked.ok) {
      setError(
        intl.formatMessage({ id: 'start.nameTooLong' }, { max: MAX_NAME, length: checked.length }),
      );
      return;
    }
    setError(undefined);
    onStart(checked.name);
  };
  return (
    <>
      <Hero>
        <h1 className="hero-title">
          <FormattedMessage id="site.name" />
        </h1>
        <p className="hero-lede">
          <FormattedMessage id="home.tagline" />
        </p>
      </Hero>
      <section className="rules" aria-labelledby="rules-heading">
        <h2 id="rules-heading">
          <FormattedMessage id="rules.title" />
        </h2>
        <ol>
          {['rules.roll', 'rules.win', 'rules.lives', 'rules.reset', 'rules.end'].map((id) => (
            <li key={id} className="card">
              <FormattedMessage id={id} />
            </li>
          ))}
        </ol>
      </section>
      <form className="start-form" onSubmit={submit} noValidate>
        <label htmlFor="run-name">
          <FormattedMessage id="start.nameLabel" />
        </label>
        <input
          id="run-name"
          name="name"
          className="input"
          autoComplete="off"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'run-name-hint run-name-error' : 'run-name-hint'}
        />
        <p id="run-name-hint" className="field-hint">
          <FormattedMessage id="start.nameHint" />
        </p>
        {error && (
          <p id="run-name-error" className="field-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          <FormattedMessage id="start.roll" />
        </button>
      </form>
    </>
  );
}

// Starting over discards the run in progress, so it is asked first, in a native dialog: focus moves
// into it, Escape declines, and focus returns to the button.
function NewRunButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary new-run"
        onClick={() => dialog.current?.showModal()}
      >
        <FormattedMessage id={label} />
      </button>
      <dialog ref={dialog} aria-labelledby="new-run-title">
        <h2 id="new-run-title">
          <FormattedMessage id="newRun.title" />
        </h2>
        <p>
          <FormattedMessage id="newRun.warning" />
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dialog.current?.close()}
          >
            <FormattedMessage id="newRun.keep" />
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              dialog.current?.close();
              onConfirm();
            }}
          >
            <FormattedMessage id="newRun.confirm" />
          </button>
        </div>
      </dialog>
    </>
  );
}
