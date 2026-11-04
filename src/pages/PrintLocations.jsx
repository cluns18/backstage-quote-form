import { useState } from 'react';
import NavBtns from '../components/NavBtn';
import Uploader from '../components/Uploader';
import { PLACEMENTS, MIN_INK, MAX_INK, SCREENS_PER_COLOR } from '../config';
import { newLocation, clampInk, locationHasArt } from '../utils/flow';

// Front and back tabs, carried over from the Local Threads calculator (PR #17, Ryan:
// "add front and back tabs so customers can upload artwork and enter the number of colors
// per location"). Each spot gets its own tab with its own artwork and its own ink count.
//
// Backstage's old calculator asked these as separate questions: "Where do you want your
// art?" (Front Chest, Full Front, Full Back, Sleeves), then "How many colors are on the
// design?" per location, then "on the other design?", "on the sleeves?". Here every
// location the customer taps becomes a tab holding all three answers for that spot.

const inkQuestion = (name, index) => {
  if (name === 'Sleeves') return 'How Many Colors Are On The Sleeves?';
  return index === 0 ? 'How Many Colors Are On The Design?' : 'How Many Colors Are On The Other Design?';
};

export default function PrintLocations({ form, update, busy, setBusy, onNext, onBack, error }) {
  const { locations, artReady } = form;
  const [activeId, setActiveId] = useState(locations[0]?.id ?? null);
  const active = locations.find((l) => l.id === activeId) || locations[0] || null;

  const setLocations = (fn) => update((f) => ({ locations: fn(f.locations) }));
  const patchLoc = (id, patch) => setLocations((locs) => locs.map((l) => (l.id === id ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l)));

  const tapPlacement = (name) => {
    const existing = locations.find((l) => l.name === name);
    if (existing) { setActiveId(existing.id); return; }
    const loc = newLocation(name);
    setLocations((locs) => [...locs, loc].sort((a, b) => PLACEMENTS.indexOf(a.name) - PLACEMENTS.indexOf(b.name)));
    setActiveId(loc.id);
  };

  const remove = (id) => {
    const rest = locations.filter((l) => l.id !== id);
    setLocations(() => rest);
    setActiveId(rest[0]?.id ?? null);
  };

  // The attachment budget is shared by every location on the quote.
  const usedElsewhere = active
    ? locations.filter((l) => l.id !== active.id).reduce((sum, l) => sum + l.files.reduce((s, f) => s + (f.data ? f.data.length : 0), 0), 0)
    : 0;
  const index = active ? locations.findIndex((l) => l.id === active.id) : 0;

  return (
    <>
      <div className='slide-header'>
        <h1 className='slide-heading'>Where Do You Want Your Art?</h1>
        <p className='slide-sub'>Every ink color on each design location requires another screen. Screens &amp; setup time determine price.</p>
      </div>
      <div className='slide-content'>
        <div className='loc-tabs' role='tablist' aria-label='Print locations'>
          {PLACEMENTS.map((name) => {
            const loc = locations.find((l) => l.name === name);
            const isActive = loc && active && loc.id === active.id;
            return (
              <button
                key={name}
                type='button'
                role='tab'
                aria-selected={Boolean(isActive)}
                className={`loc-tab ${loc ? 'is-added' : ''} ${isActive ? 'is-on' : ''}`}
                onClick={() => tapPlacement(name)}
                disabled={busy}
                data-placement={name}
              >
                {!loc && <span aria-hidden='true'>+ </span>}
                {name}
                {loc && locationHasArt(loc) && <span className='loc-tab-dot' aria-label='has artwork' />}
              </button>
            );
          })}
        </div>

        {!active && <p className='loc-empty'>Tap a spot above to add your art. Add as many as you need.</p>}

        {active && (
          <div className='loc-panel' role='tabpanel' aria-label={active.name} data-panel={active.name}>
            <div className='loc-col'>
              {artReady === 'yes' ? (
                <>
                  <p className='field-label'>Upload Artwork Here</p>
                  <Uploader
                    key={active.id}
                    form={active}
                    update={(patch) => patchLoc(active.id, patch)}
                    busy={busy}
                    setBusy={setBusy}
                    noun='Artwork'
                    usedElsewhere={usedElsewhere}
                  />
                  <label htmlFor={`desc-${active.id}`} className='field-label field-label--sm'>Notes on this design (optional)</label>
                </>
              ) : (
                <>
                  <label htmlFor={`desc-${active.id}`} className='field-label'>Please Describe Your Artwork</label>
                  <p className='field-help'>This will help us price without a file or get some info on how we can help design something awesome with you. When designing, keep how many colors there will be in mind, this will impact pricing.</p>
                </>
              )}
              <textarea
                key={`d-${active.id}`}
                id={`desc-${active.id}`}
                className='text-input text-area'
                placeholder='Wording, colors, layout...'
                value={active.description}
                maxLength={2000}
                onChange={(e) => patchLoc(active.id, { description: e.target.value })}
                data-desc
              />
            </div>

            <div className='loc-col'>
              <p className='field-label' id={`ink-${active.id}`}>{inkQuestion(active.name, index)}</p>
              <div className='loc-stepper' role='group' aria-labelledby={`ink-${active.id}`}>
                <button type='button' className='loc-step' aria-label='Fewer ink colors' disabled={active.colors <= MIN_INK}
                  onClick={() => patchLoc(active.id, (l) => ({ colors: clampInk(l.colors - 1) }))}>-</button>
                <span className='loc-count' aria-live='polite' data-ink>{active.colors}</span>
                <button type='button' className='loc-step' aria-label='More ink colors' disabled={active.colors >= MAX_INK}
                  onClick={() => patchLoc(active.id, (l) => ({ colors: clampInk(l.colors + 1) }))}>+</button>
                <span className='loc-unit'>{active.colors === 1 ? 'color' : 'colors'}{SCREENS_PER_COLOR[active.name] ? ', both sleeves' : ''}</span>
                <button type='button' className='loc-remove' onClick={() => remove(active.id)} disabled={busy} aria-label={`Remove ${active.name}`}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <p className='form-error' role='alert'>{error}</p>}
      </div>
      <NavBtns onBack={onBack} onNext={onNext} disabled={busy} nextLabel={busy ? 'Uploading' : 'Continue'} />
    </>
  );
}
