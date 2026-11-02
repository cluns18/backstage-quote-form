// Everything the form says to the page it is embedded in (the Framer page at
// backstagescreenprinting.com/live-pricing, see EMBED-SNIPPET.html).
//
// Messages go to '*' because the parent is on another origin. That is only safe because
// NOTHING personal ever goes through here: no name, no email, no phone, no notes. A count,
// a capped value and a page label are all a parent ever sees. Keep it that way.
//
// The height message lives in utils/embedHeight.js (carried over from the Local Threads
// calculator). The rest are the house `obgform_` family the parent bridge listens for.

const post = (message) => {
  try {
    window.parent.postMessage(message, '*');
  } catch {
    /* a parent that cannot be reached must never break the form */
  }
};

/** Which question is showing. `initial` is true for the slide the form opened on. */
export const postSlide = (slide, step, total, initial = false) => post({
  type: 'obgform_slide', event: 'obgform_slide', slide, step, total, initial,
});

/** First real interaction. */
export const postStart = () => post({ event: 'obgform_start' });

/** SUCCESS ONLY. A failed send must never be counted as a conversion. */
export const postSubmission = ({ quantity, value, source }) => post({
  event: 'obgform_submission',
  quantity,
  conversion_value: value,
  totalQuote: value,
  decoration_method: 'Screen printing',
  source,
});

/** A tap on any Call button. The tel: link still dials, this only reports it. */
export const postCallClick = () => post({ event: 'obgform_call_click' });
