import NavBtns from '../components/NavBtn';
import { MIN_QUANTITY } from '../config';
import { digitsOnly } from '../utils/sanitize';

// The old "Product Quantity" step. Where the other ConvertCalculator shops showed
// "YOUR PRICE" here, Backstage's read "SUBMIT FOR A PRICE", and so does this one.
//
// Quantity defect guard (reference_quote_form_quantity_phone_defect): the heading asks
// for PIECES, the placeholder is an example count, the keyboard is numeric, and seven or
// more digits is stopped as a phone number (utils/flow.js) instead of being sent.
export default function QuantitySlide({ form, update, onNext, onBack, error }) {
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); onNext(); } };
  return (
    <>
      <div className='slide-header'>
        <h1 className='slide-heading'>How Many Pieces Do You Need?</h1>
        <p className='slide-sub'>Product quantity. Orders start at {MIN_QUANTITY} pieces, and a ballpark is fine.</p>
      </div>
      <div className='slide-content'>
        <label htmlFor='qty' className='sr-only'>Number of pieces</label>
        <div className='qty-row'>
          <input
            id='qty'
            className='text-input qty-input'
            type='text'
            inputMode='numeric'
            autoComplete='off'
            placeholder='e.g. 48'
            maxLength={9}
            value={form.quantity}
            onChange={(e) => update({ quantity: digitsOnly(e.target.value).slice(0, 9) })}
            onKeyDown={onKey}
            data-qty
          />
          <span className='qty-unit'>pieces</span>
        </div>
        <div className='price-panel' data-price-panel>
          <p className='price-panel-head'>Submit For A Price</p>
          <p className='price-panel-sub'>Every job here is priced by hand. Send us your project and we will get back to you with your price.</p>
        </div>
        {error && <p className='form-error' role='alert'>{error}</p>}
      </div>
      <NavBtns onBack={onBack} onNext={onNext} />
    </>
  );
}
