import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { imageUrl, loadCatalogues } from '../catalogue/load';
import { NamesContext, useItemNames, useLoadedNames } from '../catalogue/names';
import type { Catalogue, GearItem, GearSlot, Item } from '../catalogue/types';
import {
  currentSet,
  reportLoss,
  replaysRemaining,
  reportWin,
  isComplete,
  isReplay,
  reroll,
  rerollRefusal,
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

const findItem = <T extends Item>(items: T[], id: string) => items.find((i) => i.id === id);

// The brand a gear piece wears (gear-brand), with its icon.
const brandOf = (catalogue: Catalogue, piece: GearItem | undefined) =>
  piece ? findItem(catalogue.brands, piece.brand) : undefined;

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

// The run, as the player plays it (story draw-a-set): start a run, see the set, report a result with
// the mode it was played in, undo the last result, start over only after confirming. The rules are the
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
  // The result whose mode is being asked for (match-modes); nothing is recorded until one is chosen.
  const [asking, setAsking] = useState<'win' | 'loss'>();

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

  function setAnnouncementFor(s: RunState) {
    const c = catalogues?.[s.catalogueVersion];
    if (!c) return '';
    const p = setPieces(c, s);
    return intl.formatMessage(
      { id: isReplay(s) ? 'set.announceReplay' : 'set.announce' },
      {
        kit: nameOf(p.kit, c.version),
        head: nameOf(p.head, c.version),
        clothes: nameOf(p.clothes, c.version),
        shoes: nameOf(p.shoes, c.version),
      },
    );
  }

  function announceSet(s: RunState) {
    setAnnouncement(setAnnouncementFor(s));
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

  // What a result did, for screen readers (NFR-A4): the result, the kit, the mode and the lives now.
  const announceResult = (id: string, after: RunState, mode: string) =>
    intl.formatMessage(
      { id },
      {
        kit: nameOf(pieces.kit, catalogue.version),
        mode: names(catalogue.version, mode),
        lives: intl.formatMessage({ id: 'run.lives' }, { lives: after.lives }),
      },
    );

  // After a click, the next control can appear under the pointer, so the second click of a double
  // click (or a quick double tap) lands on it: on a mode, or on "I won" behind the closed dialog, it
  // would report a result for a set never played. A click that is part of a multiple click is
  // ignored; so is a tap within 300 ms of the last action, since not every phone counts taps.
  // Keyboard activation (detail 0) always counts.
  const deliberate = (event: React.MouseEvent) => {
    const now = Date.now();
    const touch = (event.nativeEvent as PointerEvent).pointerType === 'touch';
    if (event.detail > 1 || (touch && now - lastAction.current < 300)) return false;
    lastAction.current = now;
    return true;
  };

  // Each action names the step on screen; the engine refuses one made on a state already moved on.
  const act = (
    event: React.MouseEvent,
    change: () => RunState,
    announce: (s: RunState) => void,
  ) => {
    if (!deliberate(event)) return false;
    let changed: RunState;
    try {
      changed = change();
    } catch {
      return true;
    }
    setNotice(undefined);
    if (commit(changed, revision)) announce(changed);
    return true;
  };

  // The re-roll a gear piece offers (FR-25): none on a replay, after a result, or once the run is
  // complete. With no spare left the button stays, and says why it does nothing.
  const rerollOffered = (slot: GearSlot) => {
    const refused = rerollRefusal(state, slot);
    return refused === undefined || refused === 'no-spare';
  };
  const onReroll = (event: React.MouseEvent, slot: GearSlot) => {
    if (rerollRefusal(state, slot) === 'no-spare') {
      if (deliberate(event)) setNotice(intl.formatMessage({ id: 'reroll.noSpare' }, { slot }));
      return;
    }
    act(
      event,
      () => reroll(state, { step: state.step, at: new Date().toISOString(), slot }),
      (after) =>
        setAnnouncement(
          intl.formatMessage(
            { id: 'reroll.announce' },
            { slot, piece: names(catalogue.version, currentSet(after)[slot]) },
          ),
        ),
    );
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
      {!isComplete(state) && <JustConquered state={state} catalogue={catalogue} />}
      {isComplete(state) ? (
        <FinishCard state={state} onUndo={(event) => act(event, () => undo(state), announceSet)} />
      ) : (
        <section className="card set-card" aria-labelledby="set-heading">
          <span className="sticker">
            <FormattedMessage id={isReplay(state) ? 'set.replay' : 'set.playing'} />
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
            <Piece
              version={catalogue.version}
              item={pieces.head}
              brand={brandOf(catalogue, pieces.head)}
              reroll={rerollOffered('head') ? { slot: 'head', onReroll } : undefined}
            >
              <FormattedMessage id="set.head" />
            </Piece>
            <Piece
              version={catalogue.version}
              item={pieces.clothes}
              brand={brandOf(catalogue, pieces.clothes)}
              reroll={rerollOffered('clothes') ? { slot: 'clothes', onReroll } : undefined}
            >
              <FormattedMessage id="set.clothes" />
            </Piece>
            <Piece
              version={catalogue.version}
              item={pieces.shoes}
              brand={brandOf(catalogue, pieces.shoes)}
              reroll={rerollOffered('shoes') ? { slot: 'shoes', onReroll } : undefined}
            >
              <FormattedMessage id="set.shoes" />
            </Piece>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={(event) => deliberate(event) && setAsking('win')}
            >
              <FormattedMessage id="run.won" />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={(event) => deliberate(event) && setAsking('loss')}
            >
              <FormattedMessage id="run.lost" />
            </button>
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
      {asking && (
        <ModeDialog
          result={asking}
          catalogue={catalogue}
          onCancel={() => setAsking(undefined)}
          onChoose={(event, mode) => {
            const at = new Date().toISOString();
            const result = asking;
            // Closed once the choice counts, whether or not the store took it: a refused one shows
            // what is stored instead.
            const counted = act(
              event,
              () =>
                result === 'win'
                  ? reportWin(state, { step: state.step, at, mode })
                  : reportLoss(state, { step: state.step, at, mode }),
              (after) => {
                if (result === 'win') {
                  setAnnouncement(
                    isComplete(after)
                      ? intl.formatMessage({ id: 'finish.announce' })
                      : `${announceResult('announce.win', after, mode)} ${setAnnouncementFor(after)}`,
                  );
                } else if (after.resets > state.resets) {
                  // A loss on the last life resets the run (FR-18); say so on the page too.
                  setAnnouncement(announceResult('announce.reset', after, mode));
                  setNotice(intl.formatMessage({ id: 'run.resetNotice' }));
                } else {
                  setAnnouncement(announceResult('announce.loss', after, mode));
                }
              },
            );
            if (counted) setAsking(undefined);
          }}
        />
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
  brand,
  reroll,
  kit = false,
  children,
}: {
  version: string;
  item: Item | undefined;
  brand?: Item;
  reroll?: { slot: GearSlot; onReroll: (event: React.MouseEvent, slot: GearSlot) => void };
  kit?: boolean;
  children: React.ReactNode;
}) {
  const names = useItemNames();
  const intl = useIntl();
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
        {(brand || reroll) && (
          // Under the name, so the name keeps the row's width on a phone.
          <span className="piece-tools">
            {brand && (
              // The brand, so the player knows which shop or locker to look in (FR-5); its name is
              // the icon's text, in the page's language.
              <img
                className="brand-icon"
                src={imageUrl(version, brand.image)}
                alt={names(version, brand.id)}
                width={32}
                height={32}
              />
            )}
            {reroll && (
              // Its name says which piece; its text is the same word on every piece.
              <button
                type="button"
                className="btn btn-ghost reroll"
                aria-label={intl.formatMessage({ id: 'reroll.label' }, { slot: reroll.slot })}
                onClick={(event) => reroll.onReroll(event, reroll.slot)}
              >
                <FormattedMessage id="reroll.button" />
              </button>
            )}
          </span>
        )}
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

// The result whose mode is asked for (match-modes): the six modes, by the game's own names, in a native
// dialog, so focus moves into it and Escape dismisses it with nothing recorded.
function ModeDialog({
  result,
  catalogue,
  onCancel,
  onChoose,
}: {
  result: 'win' | 'loss';
  catalogue: Catalogue;
  onCancel: () => void;
  onChoose: (event: React.MouseEvent, mode: string) => void;
}) {
  const names = useItemNames();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="mode-dialog"
      aria-labelledby="mode-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="mode-title">
        <FormattedMessage id={result === 'win' ? 'mode.titleWin' : 'mode.titleLoss'} />
      </h2>
      <div className="mode-choices">
        {catalogue.modes.map((m) => (
          <button
            key={m.id}
            type="button"
            className="btn btn-secondary"
            onClick={(event) => onChoose(event, m.id)}
          >
            {names(catalogue.version, m.id)}
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <FormattedMessage id="mode.cancel" />
        </button>
      </div>
    </dialog>
  );
}

// The set a win just conquered, on show while that win can still be undone: a win moves straight on
// to the next set (FR-23), and this says which one was left behind.
function JustConquered({ state, catalogue }: { state: RunState; catalogue: Catalogue }) {
  const intl = useIntl();
  const names = useItemNames();
  const last = state.log.at(-1);
  if (!state.previous || last?.result !== 'win') return null;
  return (
    <p className="notice just-conquered" role="status">
      {intl.formatMessage(
        { id: 'run.justConquered' },
        {
          kit: names(catalogue.version, state.order.kits[last.draw] ?? ''),
          recorded: String(last.mode !== undefined),
          mode: last.mode ? names(catalogue.version, last.mode) : '',
        },
      )}
    </p>
  );
}

// The results and the re-rolls in the order they happened: a re-roll comes after the result it
// followed (its afterMatches), before the next. The log may begin after the run did (a run migrated
// from format 1), so a result's place is counted back from the matches played.
function logItems(state: RunState) {
  const first = state.matches - state.log.length;
  return [
    ...state.log.map((entry, j) => ({ kind: 'result' as const, entry, key: (first + j + 1) * 2 })),
    ...state.rerolls.map((entry) => ({
      kind: 'reroll' as const,
      entry,
      key: entry.afterMatches * 2 + 1,
    })),
  ].sort((a, b) => a.key - b.key);
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
          {logItems(state)
            .map((item, i) =>
              item.kind === 'reroll' ? (
                <li key={i}>
                  {intl.formatMessage(
                    { id: 'log.reroll' },
                    {
                      from: names(catalogue.version, item.entry.from),
                      to: names(catalogue.version, item.entry.to),
                    },
                  )}{' '}
                  <time dateTime={item.entry.at}>
                    {intl.formatDate(item.entry.at, { dateStyle: 'long' })}
                  </time>
                </li>
              ) : (
                <li key={i}>
                  {/* Read as part of the sentence after it, which already says the result. */}
                  <span
                    className={`log-mark ${item.entry.result === 'win' ? 'log-mark-win' : 'log-mark-loss'}`}
                    aria-hidden="true"
                  >
                    {intl.formatMessage({
                      id: item.entry.result === 'win' ? 'log.markWin' : 'log.markLoss',
                    })}
                  </span>{' '}
                  {intl.formatMessage(
                    { id: 'log.entry' },
                    {
                      replay: String(item.entry.replay),
                      result: item.entry.result,
                      kit: kitName(item.entry.draw),
                      conquered: item.entry.conqueredAfter,
                      total: state.order.kits.length,
                      lives: intl.formatMessage(
                        { id: 'run.lives' },
                        { lives: item.entry.livesAfter },
                      ),
                      reset: String(item.entry.reset),
                      recorded: String(item.entry.mode !== undefined),
                      mode: item.entry.mode ? names(catalogue.version, item.entry.mode) : '',
                      notRecorded: intl.formatMessage({ id: 'log.modeNotRecorded' }),
                    },
                  )}{' '}
                  <time dateTime={item.entry.at}>
                    {intl.formatDate(item.entry.at, { dateStyle: 'long' })}
                  </time>
                </li>
              ),
            )
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
