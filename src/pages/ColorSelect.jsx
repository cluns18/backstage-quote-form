import { useEffect, useState } from 'react';
import NavBtns from '../components/NavBtn';

// Carried over from the Local Threads calculator: a big photo of the garment in the color
// picked, and a swatch per colorway. Backstage's old calculator had one color dropdown per
// style that only swapped the picture; this does the same, with every colorway S&S stocks.
//
// S&S serves the odd swatch chip as a 404. The hex fills the circle instead (Local
// Threads PR #13), and the garment photo is the last resort.
function swatchFallback(color) {
  return (e) => {
    const img = e.currentTarget;
    if (color.hex && img.parentElement) {
      img.style.display = 'none';
      img.parentElement.style.background = color.hex;
      return;
    }
    if (color.previewImage && !img.dataset.triedPreview) {
      img.dataset.triedPreview = '1';
      img.src = color.previewImage;
      return;
    }
    img.style.display = 'none';
  };
}

const heroSrc = (c) => c?.previewImage || c?.image;

export default function ColorSelect({ form, update, onNext, onBack, error }) {
  const garment = form.garment;
  const colors = garment?.colors || [];
  const selected = form.color;
  const [image, setImage] = useState(heroSrc(selected) || heroSrc(colors[0]));

  // Fall back to the first swatch whenever the held color does not belong to this garment
  // (they went back and picked a different style).
  const belongs = selected && colors.some((c) => c.name === selected.name);
  useEffect(() => {
    if (!belongs && colors.length > 0) {
      update({ color: colors[0] }, { quiet: true });
      setImage(heroSrc(colors[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per garment, not per render
  }, [garment?.id, belongs]);

  const choose = (c) => { update({ color: c }); setImage(heroSrc(c)); };
  const name = garment?.fromCatalog ? `${garment.brand} ${garment.styleName}` : garment?.label;

  return (
    <>
      <div className='slide-header'>
        <h1 className='slide-heading'>Choose Garment Color</h1>
        <p className='slide-sub' aria-live='polite'>
          {name}{selected ? `, ${selected.name}` : ''}
        </p>
      </div>
      <div className='slide-content color-content'>
        <div className='color-hero'>
          {image && (
            <img
              src={image}
              alt={selected ? `${name} in ${selected.name}` : name}
              className='color-img'
              onError={(e) => {
                const img = e.currentTarget;
                const alt = selected?.image;
                if (alt && img.src !== alt && !img.dataset.triedAlt) { img.dataset.triedAlt = '1'; img.src = alt; return; }
                img.style.visibility = 'hidden';
              }}
            />
          )}
        </div>
        <div className='swatch-grid' role='radiogroup' aria-label='Garment colors'>
          {colors.map((c) => {
            const on = selected?.name === c.name;
            return (
              <button
                key={c.name}
                type='button'
                role='radio'
                aria-checked={on}
                aria-label={c.name}
                title={c.name}
                className={`swatch ${on ? 'is-on' : ''}`}
                onClick={() => choose(c)}
                data-color={c.name}
              >
                {c.image
                  ? <img src={c.image} alt='' onError={swatchFallback(c)} loading='lazy' />
                  : <span style={{ background: c.hex || '#FFFFFF' }} />}
              </button>
            );
          })}
        </div>
        {error && <p className='form-error' role='alert'>{error}</p>}
      </div>
      <NavBtns onBack={onBack} onNext={onNext} />
    </>
  );
}
