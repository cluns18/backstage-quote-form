/**
 * Google Ads conversion value for a sent quote request.
 *
 * This is a LOOKUP LADDER, not arithmetic, and that is the entire point. The old
 * `qty * qty * 0.5` model was unbounded: a phone number typed into a quantity box
 * logged multi billion dollar conversions that poisoned Smart Bidding for weeks.
 * A table cannot produce an out of range number no matter what is typed.
 *
 * Canonical house ladder (reference_quote_request_form_build, set 2026-06-16):
 * quantity clamped at 5000 pieces, value bounded to [25, 8000] before the method
 * multiplier, hard capped at 10000 after it.
 */

const LADDER = [
  { under: 12, value: 25 },
  { under: 24, value: 100 },
  { under: 48, value: 300 },
  { under: 72, value: 550 },
  { under: 100, value: 850 },
  { under: 150, value: 1300 },
  { under: 250, value: 2000 },
  { under: 400, value: 3500 },
  { under: 600, value: 5000 },
  { under: 1000, value: 6800 },
];

const TOP_VALUE = 8000;
const FLOOR = 25;
const HARD_CEILING = 10000;
export const MAX_QTY = 5000;

// This form only quotes screen printing, the house baseline (multiplier 1). The
// embroidery 1.3 / DTF 0.85 multipliers other forms carry do not apply here.

export const clampQuantity = (raw) => {
  const n = parseInt(String(raw ?? '').replace(/\D/g, ''), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), MAX_QTY);
};

/**
 * @param {string|number} rawCount the count this path collected (pieces, sheets, people), or 0
 * @returns {number} a whole number in [25, 10000]
 */
export function conversionValue(rawCount) {
  const qty = clampQuantity(rawCount);
  const base = (LADDER.find((row) => qty < row.under) || { value: TOP_VALUE }).value;
  return Math.min(Math.max(Math.round(base), FLOOR), HARD_CEILING);
}

export default conversionValue;
