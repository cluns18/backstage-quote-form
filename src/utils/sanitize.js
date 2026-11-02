// Every value that leaves this form goes through one of these.
//
// The mail service's fill() does NOT escape, so anything that lands in the email HTML is
// escaped here. Control characters are stripped everywhere as header injection defence
// (a name of "Bob\r\nBcc: someone" once put a real Bcc on a shop's lead email).

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

export const stripControl = (value) => String(value ?? '').replace(CONTROL, ' ');

/** Trim and cap. The ellipsis is three plain dots so nothing non ASCII is added. */
export const cap = (value, max) => {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

/**
 * For typed text that lands in the email HTML body.
 *
 * Braces are escaped too. The mail service fills its templates by plain replacement of
 * {{token}} over the finished HTML, shop registry values included, so a customer who
 * typed {{some_shop_key}} into a notes box would get that value printed into their own
 * confirmation email. As entities they still read as braces and match no token.
 */
export const esc = (value) => stripControl(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
  .replace(/\{/g, '&#123;')
  .replace(/\}/g, '&#125;');

/**
 * For values that land in a header as well as the HTML body (`name` is in the subject
 * line). Escaping would render the subject as "Bob &amp; Sons", so the dangerous
 * characters are removed instead. Braces go for the same reason they are escaped above.
 */
export const plain = (value) => stripControl(value)
  .replace(/[<>{}]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** Anything typed by the customer, on its way into the email body. */
export const freeText = (value, max) => esc(cap(stripControl(value).replace(/[ \t]+/g, ' '), max));

/** Keep only the members of `list` that are real options. Used on anything restored or passed in. */
export const onlyKnown = (list, options) => (Array.isArray(list) ? list.filter((item) => options.includes(item)) : []);

export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

/** (406) 212-8654 as the customer types. Anything past ten digits is ignored. */
export const formatPhone = (value) => {
  let d = digitsOnly(value);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

export const isValidPhone = (value) => {
  let d = digitsOnly(value);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.length === 10;
};

export const isValidEmail = (value) => /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(String(value ?? '').trim());
