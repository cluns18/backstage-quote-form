// Everything Backstage specific lives here.
//
// This form replaces the ConvertCalculator embed `TJhn2CwDsEBqn6Dfi` on
// backstagescreenprinting.com/live-pricing ("Backstage Screenprinting (w/ Client Changes)").
// That calculator showed NO price: it read "SUBMIT FOR A PRICE" and Backstage quoted each
// job by hand. So this is a guided quote request, not a calculator. Its questions, options
// and copy come from ~/Projects/convertcalc-export/backstage-spec.md (and the shared copy in
// syndicate-messaging.md, which the spec says Backstage carries word for word).
//
// THE FACT SHEET. Copy in this form may state these and nothing else:
//   the shop's phone and email, Rock Springs WY, the twelve garments it listed, that every
//   ink color on each location is another screen, that the customer gets mockups and a
//   final proof to approve, that it has artists who can help with a design, and that the
//   old quantity slider started at 12 pieces.
// No turnaround and no reply time is promised anywhere.

// ---------------------------------------------------------------- lead delivery
// The ONE place the lead endpoint lives. `npm run dev` never talks to production: the dev
// server answers /__mock/send_lead itself (vite.config.js). A production build carries only
// the real URL. FLAT body, send_lead, never send_quote (calculator-build skill, 5c).
const PRODUCTION_LEAD_ENDPOINT = 'https://obg-mail-api.vercel.app/api/send_lead';
export const LEAD_ENDPOINT = import.meta.env.DEV ? '/__mock/send_lead' : PRODUCTION_LEAD_ENDPOINT;
export const SHOP_ID = 'backstage';

// ------------------------------------------------------------------------ shop
export const SHOP = {
  name: 'Backstage Screen Printing',
  phoneDisplay: '(307) 352-2442',
  phoneHref: 'tel:+13073522442',
  email: 'backstagescreenprinting@gmail.com',
};

// White wordmark on a transparent ground, byte for byte the file the site's hero serves
// (framerusercontent.com/images/BfdcrZpQ46sYJDsHMohiMuEt2x8.png, 2360x448), resized and
// hosted beside the form so a re-upload on their Framer site cannot break it.
export const LOGO_SRC = '/assets/backstage-wordmark.png';
export const LOGO_RATIO = 2360 / 448;

// -------------------------------------------------------------------- garments
// The old calculator's garment type question (GT): T Shirt = 1, Long Sleeve = 2, Hoodie = 3.
// `id` is the plural key the catalog code and src/data/garments.json use.
export const GARMENT_TYPES = [
  { id: 'tshirts', name: 'T-Shirt', lead: 'T-Shirt', image: '/assets/tshirtspgarment.png' },
  { id: 'longsleeves', name: 'Long Sleeve', lead: 'Long Sleeve', image: '/assets/longsleevespgarment.png' },
  { id: 'hoodies', name: 'Hoodie', lead: 'Hoodie', image: '/assets/hoodiespgarment.png' },
];

// ------------------------------------------------------------------- locations
// The old calculator's impression locations (SSI): Front Chest, Full Front, Full Back, and
// (LSI) Sleeves, which counted as TWO impressions because a sleeve print is both sleeves.
// The sweatpants (QBC, QAM) and tote (QAP) locations existed in the file but no garment
// type ever led to them, so a customer could never reach them. They are not carried over.
export const PLACEMENTS = ['Front Chest', 'Full Front', 'Full Back', 'Sleeves'];
// How each location is named in the lead email.
export const PLACEMENT_LEAD = { Sleeves: 'Sleeves (both)' };
// Screens per ink color at a location. Sleeves are two prints. Same as the old IMP formula.
export const SCREENS_PER_COLOR = { Sleeves: 2 };
// The old color counters were sliders 0 to 12. A location on the quote has at least one.
export const MIN_INK = 1;
export const MAX_INK = 12;

// -------------------------------------------------------------------- quantity
// The old quantity slider ran 12 to 500. 12 stays as the minimum. 500 was the slider's end,
// not a ceiling on what Backstage will print, so bigger orders are accepted here (up to the
// house cap) instead of being forced down to 500.
export const MIN_QUANTITY = 12;
export const MAX_QUANTITY = 5000;
// A count this many digits long is a phone number in the wrong box.
export const PHONE_LIKE_DIGITS = 7;

// ---------------------------------------------------------------------- slides
// One question per step. `success` is not a step.
export const SLIDES = ['garmentType', 'garmentModel', 'colorSelect', 'artReady', 'printLocations', 'quantity', 'contact'];
export const SLIDE_NAMES = {
  garmentType: 'garment type',
  garmentModel: 'garment',
  colorSelect: 'garment color',
  artReady: 'artwork',
  printLocations: 'print locations',
  quantity: 'quantity',
  contact: 'your details',
};
