import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { imageUrl, loadCatalogues } from '../catalogue/load';
import { NamesContext, useItemNames, useLoadedNames } from '../catalogue/names';
import type { Catalogue, Item } from '../catalogue/types';
import {
  currentSet,
  nextSet,
  reportLoss,
  replaysRemaining,
  reportWin,
  isComplete,
  isReplay,
  startRun,
  undo,
  totals,
  winsToNextLife,
  type RunState,
} from './engine';
import { exportRun, MAX_FILE_BYTES, readRunFile } from './file';
import { ShareControls } from '../share/ShareControls';
import { displayName } from './name';
import { cryptoSource } from './random';
import { browserStorage, createRunStore, type LoadResult, type RunStore } from './storage';

const MAX_NAME = 30;

const findItem = (items: Item[], id: string) => items.find((i) => i.id === id);

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
  // Kit and gear names in the page's locale, loaded beside the catalogues (story localized-names).
  const names = useLoadedNames();
  return (
    <NamesContext.Provider value={names ?? (() => '')}>
      <RunView newestVersion={newestVersion} namesLoaded={names !== undefined} />
    </NamesContext.Provider>
  );
}

function RunView({ newestVersion, namesLoaded }: { newestVersion: string; namesLoaded: boolean }) {
  const intl = useIntl();
  const names = useItemNames();
  const nameOf = (item: Item | undefined, version: string) => (item ? names(version, item.id) : '');
  const [catalogues, setCatalogues] = useState<Record<string, Catalogue>>();
  const [store, setStore] = useState<RunStore>();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [notice, setNotice] = useState<string>();
  // Whether the browser is keeping the run; false when storage is refused or full (FR-30).
  const [kept, setKept] = useState(true);
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
      const first = s.load();
      setKept(!('persistent' in first) || first.persistent !== false);
      show(first);
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
        { id: isReplay(s) ? 'set.announceReplay' : 'set.announce' },
        {
          kit: nameOf(p.kit, c.version),
          head: nameOf(p.head, c.version),
          clothes: nameOf(p.clothes, c.version),
          shoes: nameOf(p.shoes, c.version),
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
      setKept(saved.persistent);
      setView({ kind: 'run', state, revision: saved.revision });
      return true;
    }
    if ('conflict' in saved) {
      show(saved.conflict);
      setNotice(intl.formatMessage({ id: 'run.updatedElsewhere' }));
    }
    return false;
  };

  if (view.kind === 'loading' || !catalogues || !namesLoaded) {
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
      <>
        {!kept && <NotKeptNotice />}
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
        <FileControls
          catalogues={catalogues}
          onImport={(state) => {
            const replace = replacing.current;
            if (commit(state, replace?.basedOn ?? 0, { replaceUnreadable: replace?.unreadable })) {
              replacing.current = undefined;
              announceSet(state);
            }
          }}
        />
      </>
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
          kit: nameOf(pieces.kit, catalogue.version),
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
      {!kept && <NotKeptNotice run={state} />}
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
      {state.catalogueVersion !== newestVersion && (
        // A run is held to the game it started on (FR-33): it keeps its own kits after an update.
        <p className="notice older-catalogue">
          {intl.formatMessage(
            { id: 'run.olderCatalogue' },
            { version: state.catalogueVersion, newest: newestVersion },
          )}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {isComplete(state) ? (
        <FinishCard state={state} onUndo={(event) => act(event, () => undo(state), announceSet)} />
      ) : (
        <section className="card set-card" aria-labelledby="set-heading">
          <span className="sticker">
            <FormattedMessage
              id={
                state.phase === 'conquered'
                  ? 'set.conquered'
                  : isReplay(state)
                    ? 'set.replay'
                    : 'set.playing'
              }
            />
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
          {isReplay(state) && (
            <p className="replays-remaining">
              {intl.formatMessage(
                { id: 'set.replaysRemaining' },
                { remaining: replaysRemaining(state) },
              )}
            </p>
          )}
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
                      (after) =>
                        isComplete(after)
                          ? setAnnouncement(intl.formatMessage({ id: 'finish.announce' }))
                          : announceResult('announce.win', after),
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
      )}
      <RunLog state={state} catalogue={catalogue} />
      <ShareControls state={state} catalogue={catalogue} />
      <FileControls
        run={state}
        catalogues={catalogues}
        onImport={(imported) => {
          if (commit(imported, revision)) announceSet(imported);
        }}
      />
      <NewRunButton
        label="run.newRun"
        onConfirm={() => {
          replacing.current = { basedOn: revision, unreadable: false };
          setView({ kind: 'start' });
        }}
      />
      <p className="visually-hidden run-announcement" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

// The ink strip at the top of a page: several splats of our own drawing, decorative, behind the
// content (design-alignment, FR-62).
export function Hero({ children }: { children: React.ReactNode }) {
  return (
    <section className="ink-strip">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`splat splat-${n}`} aria-hidden="true" />
      ))}
      {children}
    </section>
  );
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
  const names = useItemNames();
  if (!item) return null;
  const name = names(version, item.id);
  return (
    <figure className={kit ? 'piece piece-kit' : 'piece'}>
      {kit ? (
        // The kit sits on a splat that tilts as it lands, still under reduced motion (NFR-A7). Keyed
        // by the kit, so every new draw lands again.
        <span key={item.id} className="kit-splat">
          <img src={imageUrl(version, item.image)} alt={name} width={128} height={128} />
        </span>
      ) : (
        <img src={imageUrl(version, item.image)} alt={name} width={72} height={72} />
      )}
      <figcaption>
        <span className="piece-label tag">{children}</span>
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
        checked.reason === 'length'
          ? intl.formatMessage(
              { id: 'start.nameTooLong' },
              { max: MAX_NAME, length: checked.length },
            )
          : intl.formatMessage({ id: 'start.nameTooLongForLink' }),
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
          {(['roll', 'win', 'lives', 'reset', 'end'] as const).map((rule, i) => (
            // The rule's label is the tilted sticker; the card and its text stay straight.
            <li key={rule} className="card">
              <span className="sticker">
                <FormattedMessage
                  id="rules.sticker"
                  values={{
                    number: String(i + 1).padStart(2, '0'),
                    title: <FormattedMessage id={`rules.${rule}Title`} />,
                  }}
                />
              </span>
              <p>
                <FormattedMessage id={`rules.${rule}`} />
              </p>
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

// The run log (FR-24): every result, newest first, each one sentence a screen reader reads whole, with
// the date written for the page's locale. Collapsed by default, so the set stays first on screen.
function RunLog({ state, catalogue }: { state: RunState; catalogue: Catalogue }) {
  const intl = useIntl();
  const names = useItemNames();
  const kitName = (draw: number) => names(catalogue.version, state.order.kits[draw] ?? '');
  const title = intl.formatMessage({ id: 'log.title' });
  return (
    <details className="run-log">
      <summary>{intl.formatMessage({ id: 'log.summary' }, { count: state.log.length })}</summary>
      {state.logSince > state.startedAt && (
        <p className="field-hint">
          {intl.formatMessage(
            { id: 'log.since' },
            { date: intl.formatDate(state.logSince, { dateStyle: 'long' }) },
          )}
        </p>
      )}
      {state.log.length === 0 ? (
        <p>{intl.formatMessage({ id: 'log.empty' })}</p>
      ) : (
        <ol aria-label={title} reversed>
          {state.log
            .map((entry, i) => (
              <li key={i}>
                {/* Read as part of the sentence after it, which already says the result. */}
                <span
                  className={`log-mark ${entry.result === 'win' ? 'log-mark-win' : 'log-mark-loss'}`}
                  aria-hidden="true"
                >
                  {intl.formatMessage({
                    id: entry.result === 'win' ? 'log.markWin' : 'log.markLoss',
                  })}
                </span>{' '}
                {intl.formatMessage(
                  { id: 'log.entry' },
                  {
                    replay: String(entry.replay),
                    result: entry.result,
                    kit: kitName(entry.draw),
                    conquered: entry.conqueredAfter,
                    total: state.order.kits.length,
                    lives: intl.formatMessage({ id: 'run.lives' }, { lives: entry.livesAfter }),
                    reset: String(entry.reset),
                  },
                )}{' '}
                <time dateTime={entry.at}>{intl.formatDate(entry.at, { dateStyle: 'long' })}</time>
              </li>
            ))
            .reverse()}
        </ol>
      )}
    </details>
  );
}

// The end of a run (FR-21): what it took, and nothing more to play. Wins and losses come from the log;
// when the log began after the run did, the card says so rather than show a part as the whole.
function FinishCard({
  state,
  onUndo,
}: {
  state: RunState;
  onUndo: (event: React.MouseEvent) => void;
}) {
  const intl = useIntl();
  const t = totals(state);
  return (
    <section className="card set-card finish-card" aria-labelledby="finish-heading">
      <span className="sticker">
        <FormattedMessage id="set.conquered" />
      </span>
      <h2 id="finish-heading" className="finish-title">
        <FormattedMessage id="finish.title" />
      </h2>
      <p>
        {intl.formatMessage(
          { id: 'finish.summary' },
          { matches: t.matches, wins: t.wins, losses: t.losses, resets: t.resets },
        )}
      </p>
      {t.since && (
        <p className="field-hint">
          {intl.formatMessage(
            { id: 'finish.since' },
            { date: intl.formatDate(t.since, { dateStyle: 'long' }) },
          )}
        </p>
      )}
      {state.previous && (
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onUndo}>
            <FormattedMessage id="run.undo" />
          </button>
        </div>
      )}
    </section>
  );
}

// Export and import of a run file (FR-31, FR-32). A file is checked whole before anything is
// stored, and over a run in progress it is stored only after the player confirms.
function FileControls({
  run,
  catalogues,
  onImport,
}: {
  run?: RunState;
  catalogues: Record<string, Catalogue>;
  onImport: (state: RunState) => void;
}) {
  const intl = useIntl();
  const [error, setError] = useState<string>();
  const pending = useRef<RunState | undefined>(undefined);
  const dialog = useRef<HTMLDialogElement>(null);

  async function choose(file: File) {
    setError(undefined);
    const result =
      file.size > MAX_FILE_BYTES
        ? ({ ok: false, reason: 'not-a-run' } as const)
        : readRunFile(await file.text(), catalogues);
    if (!result.ok) {
      setError(
        result.reason === 'unknown-catalogue'
          ? intl.formatMessage({ id: 'import.unknownCatalogue' }, { version: result.version })
          : intl.formatMessage({ id: 'import.notARun' }),
      );
      return;
    }
    if (!run) {
      onImport(result.state);
      return;
    }
    pending.current = result.state;
    dialog.current?.showModal();
  }

  return (
    <div className="file-controls">
      {run && <ExportButton run={run} />}
      <label className="btn btn-secondary">
        <FormattedMessage id="run.import" />
        <input
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void choose(file);
          }}
        />
      </label>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <dialog ref={dialog} aria-labelledby="import-title">
        <h2 id="import-title">
          <FormattedMessage id="import.title" />
        </h2>
        <p>
          <FormattedMessage id="import.warning" />
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
              const imported = pending.current;
              pending.current = undefined;
              if (imported) onImport(imported);
            }}
          >
            <FormattedMessage id="import.confirm" />
          </button>
        </div>
      </dialog>
    </div>
  );
}

function ExportButton({ run }: { run: RunState }) {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => download(exportRun(run, new Date().toISOString()))}
    >
      <FormattedMessage id="run.export" />
    </button>
  );
}

// Storage refused or full: the run lives only in this page, so the player is told, and offered the
// export as the way to keep it (FR-30).
function NotKeptNotice({ run }: { run?: RunState }) {
  return (
    <div className="notice storage-notice" role="alert">
      <p>
        <FormattedMessage id="storage.notKept" />
      </p>
      {run && <ExportButton run={run} />}
    </div>
  );
}

// Hands the player a file made in the page; nothing is sent anywhere.
function download({ name, content }: { name: string; content: string }) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
