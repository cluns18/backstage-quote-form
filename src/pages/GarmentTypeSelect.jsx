import { GARMENT_TYPES } from '../config';

// Carried over from the Local Threads calculator: the garment photo beside the choices.
// Backstage's old calculator asked "What type of garment are you printing on?" with
// T Shirt, Long Sleeve and Hoodie. One tap answers it and moves on.
export default function GarmentTypeSelect({ form, pick, error }) {
  const shown = GARMENT_TYPES.find((t) => t.id === form.garmentType) || GARMENT_TYPES[0];
  return (
    <>
      <div className='slide-header'>
        <h1 className='slide-heading'>What Type Of Garment Are You Printing On?</h1>
        <p className='slide-sub'>Pick one and we will show you the options.</p>
      </div>
      <div className='slide-content'>
        <div className='garment-layout'>
          <div className='garment-preview'>
            <img src={shown.image} alt={shown.name} className='garment-img' />
          </div>
          <div className='garment-buttons'>
            {GARMENT_TYPES.map((t) => (
              <button
                key={t.id}
                type='button'
                className={`choice ${form.garmentType === t.id ? 'is-on' : ''}`}
                aria-pressed={form.garmentType === t.id}
                onClick={() => pick(t.id)}
                data-type={t.id}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
        {error && <p className='form-error' role='alert'>{error}</p>}
      </div>
    </>
  );
}
