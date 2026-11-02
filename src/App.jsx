import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { SHOP, LOGO_SRC, LOGO_RATIO, SLIDES, SLIDE_NAMES, PLACEMENTS, MIN_QUANTITY, MAX_QUANTITY } from './config';
import { initAnalytics, trackFunnelStep } from './utils/analytics';
import { readContext } from './utils/context';
import { EMPTY_FORM, slideError, firstIncomplete, garmentTypeOf, newLocation, countNumber, quantityNumber } from './utils/flow';
import { sendQuoteRequest } from './utils/emailService';
import { conversionValue, clampQuantity } from './utils/conversion';
import { postSlide, postStart, postSubmission } from './utils/bridge';
import GarmentTypeSelect from './pages/GarmentTypeSelect';
import GarmentModelSelect from './pages/GarmentModelSelect';
import ColorSelect from './pages/ColorSelect';
import ArtReady from './pages/ArtReady';
import PrintLocations from './pages/PrintLocations';
import QuantitySlide from './pages/QuantitySlide';
import ContactSlide from './pages/ContactSlide';
import ThankYou from './pages/ThankYou';

// The Backstage Screen Printing quote request. Seven questions, one per step, then the
// thank you, which only a successful send can reach.
function App() {
  const [ctx] = useState(readContext);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slide, setSlide] = useState('garmentType');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [result, setResult] = useState(null);
  // The hidden field the mail service's spam screen reads. Never shown.
  const [honeypot, setHoneypot] = useState('');
  const [openedAt] = useState(() => Date.now());

  // Synchronous guard against a double send (reference_quote_form_double_send). State
  // alone lands a render late: Enter in a field plus a tap on the button in the same
  // tick both read the stale `isSending` and the lead went out twice on Express. A ref
  // flips immediately. It reopens only when a send fails, so a retry can go.
  const submitLock = useRef(false);
  const startedRef = useRef(false);
  const navigatedRef = useRef(false);

  const index = SLIDES.indexOf(slide);
  const total = SLIDES.length;
  const isSuccess = slide === 'success';
  const step = isSuccess ? total : index + 1;

  useEffect(() => { initAnalytics(); }, []);
  useEffect(() => {
    trackFunnelStep(slide);
    postSlide(slide, step, total, !navigatedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per slide
  }, [slide]);

  const markStarted = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    postStart();
  }, []);

  /** Patch the answers. `quiet` is for defaults the form sets itself, not the customer. */
  const update = useCallback((patch, { quiet = false } = {}) => {
    if (!quiet) { markStarted(); setError(''); }
    setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }));
  }, [markStarted]);

  const goTo = (id) => {
    navigatedRef.current = true;
    setError('');
    setSlide(id);
    try { if (window.self === window.top) window.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* framed */ }
  };

  const next = () => {
    const problem = slideError(slide, form, { busy });
    if (problem) { setError(problem); return; }
    markStarted();
    if (slide === 'quantity') {
      const qty = Math.min(Math.max(countNumber(form.quantity), MIN_QUANTITY), MAX_QUANTITY);
      if (String(qty) !== form.quantity) setForm((f) => ({ ...f, quantity: String(qty) }));
    }
    // A style with no colorways has nothing to pick.
    let to = SLIDES[index + 1] || 'contact';
    if (to === 'colorSelect' && !form.garment?.colors?.length) to = 'artReady';
    goTo(to);
  };

  const back = () => {
    let to = SLIDES[index - 1];
    if (to === 'colorSelect' && !form.garment?.colors?.length) to = 'garmentModel';
    if (to) goTo(to);
  };

  // ---- one-tap steps: the tap is the answer, so it moves on by itself.
  const pickType = (id) => {
    update((f) => (f.garmentType === id ? {} : { garmentType: id, garment: null, color: null }));
    goTo('garmentModel');
  };
  const pickGarment = (g) => {
    update((f) => (f.garment?.id === g.id ? {} : { garment: g, color: null }));
    goTo(g.colors?.length ? 'colorSelect' : 'artReady');
  };
  const pickArtReady = (answer) => {
    update((f) => ({
      artReady: answer,
      // First visit: open the art step with the front chest tab ready. Later visits keep
      // whatever they set up.
      locations: f.locations.length ? f.locations : [newLocation(PLACEMENTS[0])],
    }));
    goTo('printLocations');
  };

  // --------------------------------------------------------------------- send
  const handleSend = async () => {
    if (submitLock.current) return;
    const stop = firstIncomplete(form);
    if (stop !== 'contact') { goTo(stop); return; }
    const problem = slideError('contact', form);
    if (problem) { setError(problem); return; }

    submitLock.current = true;
    setError('');
    setIsSending(true);
    setSendFailed(false);

    const meta = { website: honeypot, elapsedMs: Date.now() - openedAt };
    // allSettled: this array is every delivery path the lead has. Today that is one (the
    // mail service). Only the lead itself decides which screen the customer sees.
    const [lead] = await Promise.allSettled([sendQuoteRequest(form, ctx, meta)]);

    if (lead.status === 'fulfilled') {
      // Conversion fires on SUCCESS ONLY, fenced off so nothing can undo the thank you.
      try {
        postSubmission({ quantity: clampQuantity(quantityNumber(form)), value: conversionValue(quantityNumber(form)), source: ctx.source });
      } catch (err) { console.error('Conversion message failed:', err); }
      setResult(lead.value);
      setIsSending(false);
      goTo('success');
      // The lock stays shut. This lead is in.
      return;
    }

    // The lead did not land. No thank you: keep the customer on the form with a retry
    // and the shop's number, and reopen the lock so the retry can go.
    console.error('Quote request could not be sent:', lead.reason);
    setSendFailed(true);
    setIsSending(false);
    submitLock.current = false;
  };

  const typeName = garmentTypeOf(form)?.name;
  const firstName = form.name.trim().split(/\s+/)[0] || '';
  const common = { form, update, error, onBack: back };

  return (
    <div className='slide-container'>
      <main className='slide-page' data-slide={slide}>
        {!isSuccess && (
          <header className='form-head'>
            <img className='form-logo' src={LOGO_SRC} alt={SHOP.name} width={Math.round(30 * LOGO_RATIO)} height='30' />
            <nav className='progress' aria-label={`Step ${step} of ${total}`}>
              <ol className='progress-steps'>
                {SLIDES.map((id, i) => {
                  const done = i < index;
                  return (
                    <li key={id} className={`progress-seg ${done ? 'is-done' : ''} ${i === index ? 'is-current' : ''}`}>
                      {done ? (
                        <button type='button' className='progress-hit' onClick={() => goTo(id)} disabled={busy || isSending}
                          aria-label={`Go back to step ${i + 1}, ${SLIDE_NAMES[id]}`} data-step-link={id}>
                          <span className='progress-bar' />
                        </button>
                      ) : (
                        <span className='progress-hit' aria-current={i === index ? 'step' : undefined}><span className='progress-bar' /></span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className='progress-label'>Step {step} of {total}</p>
            </nav>
          </header>
        )}

        <div className='slide-body' key={slide}>
          {slide === 'garmentType' && <GarmentTypeSelect form={form} pick={pickType} error={error} />}
          {slide === 'garmentModel' && <GarmentModelSelect {...common} typeName={typeName} pick={pickGarment} />}
          {slide === 'colorSelect' && <ColorSelect {...common} onNext={next} />}
          {slide === 'artReady' && <ArtReady {...common} pick={pickArtReady} />}
          {slide === 'printLocations' && <PrintLocations {...common} busy={busy} setBusy={setBusy} onNext={next} />}
          {slide === 'quantity' && <QuantitySlide {...common} onNext={next} />}
          {slide === 'contact' && (
            <ContactSlide {...common} onSend={handleSend} isSending={isSending} sendFailed={sendFailed}
              honeypot={honeypot} setHoneypot={setHoneypot} />
          )}
          {isSuccess && <ThankYou result={result} firstName={firstName} />}
        </div>
      </main>
    </div>
  );
}

export default App;
