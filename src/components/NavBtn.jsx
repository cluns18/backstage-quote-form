// Back is a quiet text button, the way forward is the site's own white button with ink
// on it ("Let's work together" on the homepage). Both are real <button>s so Enter and a
// tap reach the same handler.
const NavBtns = ({ onBack, showBack = true, onNext, nextLabel = 'Continue', disabled = false, sendAttr = false }) => (
  <div className='slide-nav'>
    {showBack ? (
      <button type='button' className='btn-back' onClick={onBack} disabled={disabled}>Back</button>
    ) : <span />}
    {onNext && (
      <button type='button' className='btn-primary' onClick={onNext} disabled={disabled} {...(sendAttr ? { 'data-send': true } : { 'data-next': true })}>
        {nextLabel}
      </button>
    )}
  </div>
);

export default NavBtns;
