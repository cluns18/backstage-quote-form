import NavBtns from '../components/NavBtn';

// The old calculator's AYN question, word for word: "Do you have artwork ready?" with its
// own reassurance line under it. Yes leads to an upload per location, No to a description
// per location (the old "Please describe your artwork" box). One tap answers and moves on.
export default function ArtReady({ form, pick, onBack, error }) {
  return (
    <>
      <div className='slide-header'>
        <h1 className='slide-heading'>Do You Have Artwork Ready?</h1>
        <p className='slide-sub'>It's okay if you don't have any right now, we've got artists that can help you create an incredible design or logo.</p>
      </div>
      <div className='slide-content'>
        <div className='choice-row'>
          {[['yes', 'Yes'], ['no', 'No']].map(([id, label]) => (
            <button
              key={id}
              type='button'
              className={`choice choice--big ${form.artReady === id ? 'is-on' : ''}`}
              aria-pressed={form.artReady === id}
              onClick={() => pick(id)}
              data-art-ready={id}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <p className='form-error' role='alert'>{error}</p>}
      </div>
      <NavBtns onBack={onBack} />
    </>
  );
}
