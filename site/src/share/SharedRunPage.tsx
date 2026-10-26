import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { imageUrl, loadCatalogues } from '../catalogue/load';
import { NamesContext, useItemNames, useLoadedNames } from '../catalogue/names';
import { gearSlots, type Catalogue, type Item } from '../catalogue/types';
import { Hero } from '../run/RunPage';
import { browserStorage, hasStoredRun } from '../run/storage';
import { decodeShare, type SharedRun } from './link';

const nameIn = (items: Item[], id: string) => items.find((i) => i.id === id);

// Someone else's run, from the link's fragment (story view-shared-run). Read-only: nothing here can
// change it, and the visitor's own run is never loaded into a store or written (FR-41, FR-42). A
// link that cannot be read says why, and shows nothing of a run (FR-44).
export function SharedRunPage({ home }: { home: string }) {
  const intl = useIntl();
  const [catalogues, setCatalogues] = useState<Record<string, Catalogue>>();
  const [link, setLink] = useState(() => window.location.hash.slice(1));
  const [ownRun] = useState(() => hasStoredRun(browserStorage()));
  // Kit and gear names in the visitor's locale, whatever locale the link was made in.
  const names = useLoadedNames();

  useEffect(() => {
    let live = true;
    void loadCatalogues().then((loaded) => live && setCatalogues(loaded));
    const onHash = () => setLink(window.location.hash.slice(1));
    window.addEventListener('hashchange', onHash);
    return () => {
      live = false;
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const offer = (
    <p>
      <a className="btn btn-secondary" href={home}>
        <FormattedMessage id={ownRun ? 'shared.backToRun' : 'shared.startOwn'} />
      </a>
    </p>
  );

  if (!catalogues || !names) {
    return (
      <p>
        <FormattedMessage id="run.loading" />
      </p>
    );
  }

  const result = decodeShare(link, catalogues);
  if (!result.ok) {
    return (
      <>
        <p className="notice" role="alert">
          {result.reason === 'unknown-catalogue'
            ? intl.formatMessage({ id: 'shared.unknownCatalogue' }, { version: result.version })
            : intl.formatMessage({ id: 'shared.broken' })}
        </p>
        {offer}
      </>
    );
  }

  const { run } = result;
  const catalogue = catalogues[run.catalogueVersion];
  if (!catalogue) return null;
  return (
    <>
      <Hero>
        <span className="sticker">
          <FormattedMessage id={run.complete ? 'shared.complete' : 'shared.inProgress'} />
        </span>
        <h1 className="run-title">{run.name ?? intl.formatMessage({ id: 'shared.untitled' })}</h1>
        {/* The headline the design leads with, right under the name (design-alignment). */}
        <p className="shared-headline run-conquered">
          {intl.formatMessage(
            { id: 'run.conquered' },
            { conquered: run.conquered, total: run.total },
          )}
        </p>
        {/* Four numbers in one row, each named, so a screen reader hears "Lives: 2", not "2". */}
        <dl className="shared-numbers">
          {(
            [
              ['shared.statConquered', run.conquered],
              ['shared.statToGo', run.total - run.conquered],
              ['shared.statLives', run.lives],
              ['shared.statResets', run.resets],
            ] as const
          ).map(([id, value]) => (
            <div key={id}>
              <dt>
                <FormattedMessage id={id} />
              </dt>
              <dd>{intl.formatNumber(value)}</dd>
            </div>
          ))}
        </dl>
      </Hero>
      <p>
        <FormattedMessage id="shared.readOnly" />
      </p>
      {offer}
      <NamesContext.Provider value={names}>
        <SharedSets run={run} catalogue={catalogue} />
      </NamesContext.Provider>
    </>
  );
}

function SharedSets({ run, catalogue }: { run: SharedRun; catalogue: Catalogue }) {
  const intl = useIntl();
  const names = useItemNames();
  const name = (_items: Item[], id: string) => names(catalogue.version, id);
  return (
    <section className="card" aria-labelledby="shared-sets">
      <h2 id="shared-sets">
        <FormattedMessage id="shared.sets" />
      </h2>
      {run.sets.length === 0 ? (
        <p>
          <FormattedMessage id="shared.noSets" />
        </p>
      ) : (
        <ol className="shared-sets" aria-labelledby="shared-sets">
          {run.sets.map((set, n) => (
            <li key={set.kit}>
              {/* Decorative beside the sentence that names the kit; loaded only near the screen. */}
              <img
                src={imageUrl(catalogue.version, nameIn(catalogue.kits, set.kit)?.image ?? '')}
                alt=""
                width={48}
                height={48}
                loading="lazy"
              />
              <div className="shared-set-text">
                <span>
                  {intl.formatMessage(
                    { id: 'shared.set' },
                    {
                      number: n + 1,
                      kit: name(catalogue.kits, set.kit),
                      head: name(catalogue.gear.head, set.head),
                      clothes: name(catalogue.gear.clothes, set.clothes),
                      shoes: name(catalogue.gear.shoes, set.shoes),
                      // The mode it was conquered in, when the link carries one (share-mode).
                      recorded: String(set.mode !== undefined),
                      mode: set.mode ? names(catalogue.version, set.mode) : '',
                    },
                  )}
                </span>
                {/* Each piece's brand, in the order the sentence names them (gear-brand). */}
                <span className="shared-brands">
                  {gearSlots.map((slot) => {
                    const brand = catalogue.brands.find(
                      (b) => b.id === catalogue.gear[slot].find((g) => g.id === set[slot])?.brand,
                    );
                    return (
                      brand && (
                        <img
                          key={slot}
                          className="brand-icon"
                          src={imageUrl(catalogue.version, brand.image)}
                          alt={names(catalogue.version, brand.id)}
                          width={24}
                          height={24}
                          loading="lazy"
                        />
                      )
                    );
                  })}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
