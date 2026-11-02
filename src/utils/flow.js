import {
  GARMENT_TYPES, PLACEMENT_LEAD, SCREENS_PER_COLOR, MIN_INK, MAX_INK,
  MIN_QUANTITY, MAX_QUANTITY, PHONE_LIKE_DIGITS, SLIDES,
} from '../config';
import { isValidEmail, isValidPhone } from './sanitize';

// Every answer the form holds.
export const EMPTY_FORM = {
  garmentType: '',      // 'tshirts' | 'longsleeves' | 'hoodies'
  garment: null,        // a row from src/data/garments.json or the live catalog
  color: null,          // { name, hex, image, previewImage }
  artReady: '',         // 'yes' | 'no'  (the old AYN question)
  locations: [],        // see newLocation()
  quantity: '',
  name: '',
  email: '',
  company: '',
  phone: '',
  address: '',
};

let nextId = 1;
/** One print location: its own artwork and its own ink count, the way the job prices. */
export const newLocation = (name) => ({
  id: nextId++,
  name,
  colors: MIN_INK,
  description: '',
  files: [],        // { name, type, size, data(base64)|null, url|null }
  artFailures: [],  // { name, reason }
});

export const garmentTypeOf = (form) => GARMENT_TYPES.find((t) => t.id === form.garmentType) || null;
export const placementLead = (name) => PLACEMENT_LEAD[name] || name;

export const allFiles = (form) => form.locations.flatMap((l) => l.files);
export const allFailures = (form) => form.locations.flatMap((l) => l.artFailures);

/** A location counts once it has a file, a failed file (named to the shop) or a description. */
export const locationHasArt = (loc) => Boolean(loc.files.length || loc.artFailures.length || loc.description.trim());

/** Screens the job needs: every ink color at every location, sleeves twice (the old IMP formula). */
export const screenCount = (form) => form.locations
  .reduce((sum, l) => sum + clampInk(l.colors) * (SCREENS_PER_COLOR[l.name] || 1), 0);

export const clampInk = (n) => Math.min(MAX_INK, Math.max(MIN_INK, parseInt(n, 10) || MIN_INK));

export const countNumber = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
};
export const quantityNumber = (form) => countNumber(form.quantity);

// ------------------------------------------------------------------- validation
/**
 * Returns a customer facing sentence when the step is not ready, otherwise ''.
 * Artwork never blocks except while a file is loading, and a file that failed to
 * upload still counts: the shop email names it so it can be chased.
 */
export const slideError = (id, form, { busy = false } = {}) => {
  switch (id) {
    case 'garmentType':
      return garmentTypeOf(form) ? '' : 'Pick a garment type.';
    case 'garmentModel':
      return form.garment ? '' : 'Pick a garment.';
    case 'colorSelect':
      return form.color || !form.garment?.colors?.length ? '' : 'Pick a color.';
    case 'artReady':
      return form.artReady ? '' : 'Pick yes or no.';
    case 'printLocations':
      if (busy) return 'Hold on, your file is still loading.';
      if (!form.locations.length) return 'Add at least one spot for your art.';
      if (!form.locations.some(locationHasArt)) {
        return form.artReady === 'yes'
          ? 'Upload your artwork, or describe it, for at least one location.'
          : 'Describe your artwork for at least one location. A sentence is plenty.';
      }
      return '';
    case 'quantity': {
      const n = quantityNumber(form);
      if (!form.quantity) return 'How many pieces? A ballpark is fine.';
      if (form.quantity.length >= PHONE_LIKE_DIGITS) return 'That looks like a phone number. Just the number of pieces here, we ask for your phone on the next step.';
      if (n < MIN_QUANTITY) return `Orders start at ${MIN_QUANTITY} pieces.`;
      if (n > MAX_QUANTITY) return `For more than ${MAX_QUANTITY.toLocaleString('en-US')} pieces, give us a call and we will work it out.`;
      return '';
    }
    case 'contact':
      if (!form.name.trim()) return 'Add your name.';
      if (!isValidEmail(form.email)) return 'Add an email address we can send your mockups to.';
      if (!isValidPhone(form.phone)) return 'Add a 10 digit phone number.';
      return '';
    default:
      return '';
  }
};

/** First step that still needs an answer. `contact` is always last. */
export const firstIncomplete = (form) => SLIDES.find((id) => slideError(id, form)) || 'contact';

// ---------------------------------------------------------------------- answers
const garmentAnswer = (form) => {
  const g = form.garment;
  if (!g) return 'Not picked';
  const name = g.fromCatalog ? `${g.brand} ${g.styleName}` : `${g.label}${g.tag ? ` (${g.tag})` : ''}`;
  return g.fromCatalog ? `${name}, picked from the full catalog` : name;
};

const styleAnswer = (form) => {
  const g = form.garment;
  if (!g) return '';
  const bits = [`${g.brand} ${g.styleName}`];
  if (g.styleNumber) bits.push(`S&S style ${g.styleNumber}`);
  if (g.title) bits.push(g.title);
  return bits.join(', ');
};

const locationAnswer = (loc, artReady) => {
  const ink = clampInk(loc.colors);
  const parts = [`${ink} ink ${ink === 1 ? 'color' : 'colors'}`];
  const names = loc.files.map((f) => f.name);
  if (names.length) parts.push(`file: ${names.join(', ')}`);
  if (loc.artFailures.length) parts.push(`did not attach: ${loc.artFailures.map((f) => f.name).join(', ')}`);
  if (loc.description.trim()) parts.push(`${artReady === 'yes' ? 'notes' : 'artwork description'}: ${loc.description.trim()}`);
  if (!names.length && !loc.artFailures.length && !loc.description.trim()) parts.push('no artwork yet');
  return `${placementLead(loc.name)}: ${parts.join('. ')}`;
};

/**
 * Every answer, in the order it was asked, as plain text [label, value] rows (a value
 * may hold line breaks). This is the "Details" block of the lead email, in the shop's
 * copy and in the customer's own confirmation.
 */
export const answers = (form) => {
  const screens = screenCount(form);
  const rows = [
    ['Garment type', garmentTypeOf(form)?.lead || 'Not picked'],
    ['Garment', garmentAnswer(form)],
    ['Style', styleAnswer(form)],
    ['Color', form.color?.name || 'Not picked'],
    ['Artwork ready', form.artReady === 'yes' ? 'Yes' : form.artReady === 'no' ? 'No, needs design help' : 'Not answered'],
    ['Print locations', form.locations.map((l) => locationAnswer(l, form.artReady)).join('\n') || 'None'],
    ['Screens', `${screens} (each ink color on each location, sleeves count twice)`],
    ['Quantity', `${quantityNumber(form).toLocaleString('en-US')} pieces`],
  ];
  if (form.company.trim()) rows.push(['Company', form.company.trim()]);
  if (form.address.trim()) rows.push(['Delivery address', form.address.trim()]);
  return rows;
};
