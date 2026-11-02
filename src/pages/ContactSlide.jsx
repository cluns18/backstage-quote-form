import NavBtns from '../components/NavBtn';
import Note from '../components/Note';
import { SHOP } from '../config';
import { formatPhone } from '../utils/sanitize';
import { postCallClick } from '../utils/bridge';

// The last step, and the one that sends. The old calculator's contact fields, in its
// order: Your Name, Your Best Email, Company Name, Phone Number, Delivery Address. Its
// heading was "We will send you mockups & a final proof to approve", and its send button
// read "Sumbit Your Project Now" (typo fixed here).
//
// A failed send never shows the thank you: the customer stays right here, every answer
// still on screen, with Try Again and the shop's number.
export default function ContactSlide({ form, update, onSend, onBack, error, isSending, sendFailed, honeypot, setHoneypot }) {
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); onSend(); } };
  const input = (key, extra) => ({
    id: `f-${key}`,
    className: 'text-input',
    value: form[key],
    onChange: (e) => update({ [key]: key === 'phone' ? formatPhone(e.target.value) : e.target.value }),
    onKeyDown: onKey,
    ...extra,
  });

  return (
    <>
      <div className='slide-header'>
        <h1 className='slide-heading'>We Will Send You Mockups &amp; A Final Proof To Approve</h1>
      </div>
      <div className='slide-content'>
        <div className='contact-grid'>
          <div className='field'>
            <label htmlFor='f-name' className='field-label'>Your Name</label>
            <input {...input('name', { type: 'text', autoComplete: 'name', maxLength: 120 })} />
          </div>
          <div className='field'>
            <label htmlFor='f-email' className='field-label'>Your Best Email</label>
            <input {...input('email', { type: 'email', inputMode: 'email', autoComplete: 'email', autoCapitalize: 'none', spellCheck: false, maxLength: 200 })} />
          </div>
          <div className='field'>
            <label htmlFor='f-phone' className='field-label'>Phone Number</label>
            <input {...input('phone', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', maxLength: 18 })} />
          </div>
          <div className='field'>
            <label htmlFor='f-company' className='field-label'>Company Name <span className='field-opt'>(optional)</span></label>
            <input {...input('company', { type: 'text', autoComplete: 'organization', maxLength: 120 })} />
          </div>
          <div className='field field--wide'>
            <label htmlFor='f-address' className='field-label'>Delivery Address <span className='field-opt'>(optional)</span></label>
            <input {...input('address', { type: 'text', autoComplete: 'street-address', maxLength: 240 })} />
          </div>
        </div>

        {/* The mail service's spam screen drops any lead where this box has a value. A
            person never sees it or tabs into it. Its value is sent as `website`. */}
        <div className='hp' aria-hidden='true'>
          <label htmlFor='f-leave-empty'>Leave this one empty</label>
          <input id='f-leave-empty' type='text' name='qf_leave_empty' tabIndex={-1} autoComplete='off'
            value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        {error && <p className='form-error' role='alert' id='f-error'>{error}</p>}
      </div>
      <NavBtns
        onBack={onBack}
        onNext={onSend}
        disabled={isSending}
        sendAttr
        nextLabel={isSending ? 'Sending' : (sendFailed ? 'Try Again' : 'Submit Your Project Now')}
      />
      {/* Under the button, so Try Again stays where the thumb already is. */}
      {sendFailed && (
        <Note tone='error' live data-send-failed>
          <p>That did not go through. Your answers are still here. Try again, or call us at <span className='nowrap'>{SHOP.phoneDisplay}</span>.</p>
          <a href={SHOP.phoneHref} className='btn-ghost' onClick={postCallClick} data-call>Call {SHOP.phoneDisplay}</a>
        </Note>
      )}
    </>
  );
}
