import { useEffect, useRef } from 'react';
import Note from '../components/Note';
import { SHOP, LOGO_SRC, LOGO_RATIO } from '../config';
import { postCallClick } from '../utils/bridge';

// Shown ONLY after the mail service accepted the lead. The old calculator's promise
// ("We will send you mockups & a final proof to approve") plus the shop's number, the
// way Syndicate's ConvertCalculator confirmation carried theirs.
export default function ThankYou({ result, firstName }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus({ preventScroll: true }); }, []);
  const undelivered = result?.undelivered || [];
  const mailto = `mailto:${SHOP.email}?subject=${encodeURIComponent('Artwork for my project')}`;

  return (
    <div className='thanks' data-success>
      <img className='thanks-logo' src={LOGO_SRC} alt={SHOP.name} width={Math.round(48 * LOGO_RATIO)} height='48' />
      <h1 className='slide-heading' tabIndex={-1} ref={ref}>Submitted!</h1>
      <p className='slide-sub'>
        {firstName ? `Thanks, ${firstName}. ` : ''}Your project is in. We will send you mockups and a final proof to approve, and a copy of everything you sent is on its way to your inbox.
      </p>
      {undelivered.length > 0 && (
        // The lead landed but a file did not. Say so plainly, by name.
        <Note tone='error' live data-art-undelivered>
          <p>Your project went through, but {undelivered.join(', ')} did not come with it. Email it to {SHOP.email} so we have it.</p>
          <a href={mailto} className='btn-ghost' data-email-art>Email Your Art</a>
        </Note>
      )}
      <p className='slide-sub'>Questions? Call us.</p>
      <a href={SHOP.phoneHref} onClick={postCallClick} className='btn-primary btn-primary--block' data-call>Call {SHOP.phoneDisplay}</a>
    </div>
  );
}
