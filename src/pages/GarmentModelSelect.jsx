import { useEffect, useState } from 'react';
import NavBtns from '../components/NavBtn';
import GARMENTS from '../data/garments.json';
import { searchCatalog, countCatalog, catalogEnabled, PAGE_SIZE } from '../utils/catalog';

// The garment step, carried over from the Local Threads calculator (which took it from
// the Olive Branch Apparel design studio): photographed cards with the mill's own
// product line and a row of color dots, the shop's own list first, and the full S&S
// catalog one tap behind it.
//
// Backstage's list is the twelve styles its old calculator offered, in its order, with
// its own tag line on each ("Next Level 3600 - Most Popular"). Local Threads shows a
// price band on every card. Backstage shows no price anywhere, so that band is gone.
//
// One tap on a card picks it and moves on to the color.

// A row of colour dots so nobody thinks the blank only comes in white.
function Swatches({ colors, max = 8 }) {
  if (!colors?.length) return null;
  const shown = colors.slice(0, max);
  const more = colors.length - shown.length;
  return (
    <div className='pick-swatches' role='img' aria-label={`${colors.length} colors available`}>
      {shown.map((c) => (
        <span
          key={c.name}
          title={c.name}
          className='pick-swatch'
          style={c.hex ? { backgroundColor: c.hex } : { backgroundImage: `url(${c.image})`, backgroundSize: 'cover' }}
        />
      ))}
      {more > 0 && <span className='pick-swatch-more'>+{more}</span>}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox='0 0 16 16' fill='none' aria-hidden='true' className='pick-check'>
      <path d='M3 8.5L6.5 12L13 4' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

function PickCard({ garment, active, onClick, index = 0 }) {
  const { brand, styleName, label, tag, title, stockImage, colors, fromCatalog } = garment;
  const heading = fromCatalog ? styleName : (label || styleName);
  return (
    <button
      type='button'
      onClick={onClick}
      className={`pick-card ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      data-garment={garment.id}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {active && (
        <span className='pick-selected' aria-hidden='true'><CheckIcon /></span>
      )}
      <div className='pick-card-img'>
        {stockImage ? <img src={stockImage} alt={`${brand || ''} ${styleName}`.trim()} loading='lazy' /> : <span className='pick-card-noimg'>No photo</span>}
      </div>
      <div className='pick-card-body'>
        {tag && <span className='pick-badge'>{tag}</span>}
        {fromCatalog && brand && <div className='pick-card-brand'>{brand}</div>}
        <div className='pick-card-style'>{heading}</div>
        {title && <div className='pick-card-title'>{title}</div>}
        <div className='pick-card-foot'>
          <Swatches colors={colors} />
          {colors?.length > 0 && <div className='pick-card-count'>{colors.length} {colors.length === 1 ? 'color' : 'colors'}</div>}
        </div>
      </div>
    </button>
  );
}

// A real brand and a real style number for the type being browsed, so the hint is
// something the customer could actually type.
const SEARCH_HINT = {
  tshirts: 'Try "Comfort Colors" or "1717"',
  longsleeves: 'Try "Gildan" or "2400"',
  hoodies: 'Try "Independent" or "18500"',
};

export default function GarmentModelSelect({ form, typeName, pick, onBack, error }) {
  const typeId = form.garmentType;
  const list = GARMENTS[typeId] || [];

  const [browsing, setBrowsing] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [results, setResults] = useState([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // How many styles sit behind the "explore all" prompt.
  useEffect(() => {
    if (!catalogEnabled || !typeId) return undefined;
    let cancelled = false;
    countCatalog(typeId).then((n) => { if (!cancelled) setCatalogTotal(n); });
    return () => { cancelled = true; };
  }, [typeId]);

  // Debounce typing so we are not firing a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!browsing || !typeId) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    searchCatalog({ garmentTypeId: typeId, search, page })
      .then(({ garments, total }) => {
        if (cancelled) return;
        setResults(garments);
        setResultTotal(total);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e.message);
        setResults([]);
        setResultTotal(0);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [browsing, typeId, search, page]);

  const lastPage = Math.max(0, Math.ceil(resultTotal / PAGE_SIZE) - 1);
  const typeLower = (typeName || 'garment').toLowerCase();

  if (browsing) {
    return (
      <>
        <div className='slide-header'>
          <h1 className='slide-heading'>Full Catalog</h1>
          <p className='slide-sub'>
            {resultTotal || catalogTotal} {typeLower} options, most popular first. Search by brand or style number.
          </p>
        </div>
        <div className='slide-content'>
          <input
            type='search'
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={SEARCH_HINT[typeId] || 'Search by brand or style number'}
            className='catalog-search'
            aria-label='Search the catalog'
            data-catalog-search
          />
          {loadError && (
            <p className='catalog-msg' role='alert'>
              We could not load the full catalog right now. Go back and pick one of our regulars, and tell us what you had in mind in your artwork notes.
            </p>
          )}
          {!loadError && loading && <p className='catalog-msg'>Loading styles...</p>}
          {!loadError && !loading && results.length === 0 && (
            <p className='catalog-msg'>Nothing matched that. Try a brand name or a style number.</p>
          )}
          {!loadError && !loading && results.length > 0 && (
            <div className='pick-grid pick-grid--catalog' data-catalog-grid>
              {results.map((g, i) => (
                <PickCard key={g.id} garment={g} active={form.garment?.id === g.id} onClick={() => pick(g)} index={i} />
              ))}
            </div>
          )}
          {!loadError && resultTotal > PAGE_SIZE && (
            <div className='catalog-pager'>
              <button type='button' className='btn-back' onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</button>
              <span>{page + 1} of {lastPage + 1}</span>
              <button type='button' className='btn-back' onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>Next Page</button>
            </div>
          )}
        </div>
        <NavBtns onBack={() => setBrowsing(false)} />
      </>
    );
  }

  const pickedFromCatalog = form.garment?.fromCatalog ? form.garment : null;

  return (
    <>
      <div className='slide-header'>
        <h1 className='slide-heading'>Choose Garment</h1>
        <p className='slide-sub'>We can print on countless garments. These are our most popular, and the full catalog is right below them.</p>
      </div>
      <div className='slide-content'>
        <div className='pick-grid' data-pick-grid>
          {/* A catalog pick is not on the shop's list, so it rides along first. */}
          {pickedFromCatalog && <PickCard garment={pickedFromCatalog} active onClick={() => pick(pickedFromCatalog)} />}
          {list.map((g, i) => (
            <PickCard key={g.id} garment={g} active={form.garment?.id === g.id} onClick={() => pick(g)} index={i} />
          ))}
        </div>
        {catalogEnabled && catalogTotal > 0 && (
          <button type='button' className='catalog-open' onClick={() => { setSearchInput(''); setSearch(''); setPage(0); setBrowsing(true); }} data-explore>
            Explore all {catalogTotal.toLocaleString('en-US')} {typeLower} options
          </button>
        )}
        {error && <p className='form-error' role='alert'>{error}</p>}
      </div>
      <NavBtns onBack={onBack} />
    </>
  );
}
