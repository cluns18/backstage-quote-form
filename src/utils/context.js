import { plain, cap } from './sanitize';

// Where the form is sitting. It runs in an iframe on another origin, so it only knows
// what the parent puts on the iframe src (?source=, ?gclid=) plus document.referrer.
// Every value is attacker controllable (anyone can craft a link), so each one is
// stripped and capped here and escaped again on the way into the email.

const clean = (value, max) => cap(plain(value), max).replace(/\.\.\.$/, '');

const parseGclid = (raw) => {
  const value = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{8,200}$/.test(value) ? value : '';
};

const safeUrl = (raw) => {
  try {
    const url = new URL(String(raw || ''));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url;
  } catch {
    return null;
  }
};

export function readContext(search = window.location.search, referrer = document.referrer) {
  const params = new URLSearchParams(search);
  const ref = safeUrl(referrer);
  const page = ref ? clean(ref.origin + ref.pathname, 300) : '';
  const explicitSource = clean(params.get('source') || params.get('src'), 80);
  const refTail = ref ? clean(ref.pathname.split('/').filter(Boolean).pop() || '', 80) : '';
  const source = explicitSource || refTail || 'live pricing form';
  const gclid = parseGclid(params.get('gclid')) || (ref ? parseGclid(ref.searchParams.get('gclid')) : '');
  return { source, page, gclid };
}
