// Routes the lead to the central OBG mail service (Vercel + Gmail API). No secrets here:
// the front end POSTs a registered shop_id and the lead fields, FLAT, to send_lead
// (never the nested calculator shape, never send_quote). The service sends the customer
// auto reply and the shop's lead notification. See obg-mail-api/lib/leads.py.
//
// Grafted from prodigal-design-quote-request (degrade ladder, retries, 4xx short circuit,
// measured body, sanitizing), reshaped for per-location artwork.
//
// Field by field, and where obg-mail-api/lib/leads.py reads each one (shared templates
// lead-client.html / lead-customer.html, no custom template needed):
//   shop_id           load_shop(), picks shops/backstage.json
//   name              subject line + both emails          -> plain (no escaping, see sanitize.js)
//   email             customer auto reply To, shop email Reply-To
//   phone             shop email Phone row; the lead needs email OR phone
//   project           shop email "Details" AND the customer's "Project" row -> every answer, escaped HTML
//   quantity          subject "(N pieces)", both emails   -> digits only
//   decoration_method shop email "Service / Method"      -> always "Screen printing"
//   artwork           shop email "Artwork" only           -> what arrived as attachment and link, and
//                                                            what did NOT, by filename and location
//   artwork_urls      Drive mirror, only if the shop file ever gets a drive_folder_id
//   attachments       real attachments on the shop email  -> [{name, type, data(base64)}]
//   source            shop email footer "(...)"           -> page label, page address, ad click id
//   company           CRM forward only (when crm_lead_url is set); also printed inside `project`
//   website           lib/spam.py honeypot                -> empty for a person
//   elapsed_ms        lib/spam.py fill time               -> how long the form was open
import { LEAD_ENDPOINT, SHOP_ID } from '../config';
import { esc, plain, cap, freeText, stripControl } from './sanitize';
import { answers, quantityNumber, allFiles, allFailures, placementLead } from './flow';
import { isUploadUrl } from './uploads';

// Vercel rejects a request body over 4.5MB with a 413 BEFORE the handler runs, so measure
// the real encoded body rather than the raw file size and budget under it.
export const MAX_BODY_BYTES = 3.8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30000;
const RETRIES = 2;

const list = (items, max = 120) => items.map((item) => esc(cap(item, max))).join(', ');

/** A typed answer keeps its line breaks. Each line is capped and escaped on its own. */
const valueHtml = (value) => {
  const lines = String(value ?? '').slice(0, 4000).split(/\r?\n/).map((line) => freeText(line, 2000)).filter(Boolean);
  return lines.length ? lines.join('<br>') : 'None';
};

/** Every answer, one row each. Also prints in the customer's own confirmation email. */
const projectNote = (form) => answers(form)
  .map(([label, value]) => `<strong>${esc(label)}:</strong> ${valueHtml(value)}`)
  .join('<br>');

// White tag with ink on it. Backstage's email card is dark (#262626), where a plain red
// warning would be close to invisible. This reads on any ground.
const FLAG = '<strong style="background:#FFFFFF;color:#0A0A0A;padding:1px 6px;">ARTWORK NOT ATTACHED.</strong>';
const link = (file) => `<a href="${esc(file.url)}" style="color:inherit;font-weight:700;">${esc(cap(file.name, 120))}</a>`;

/**
 * Shop only. Every file the customer picked is accounted for, location by location:
 * attached, linked, or lost with its name printed so the shop can chase it.
 */
const artworkNote = (form, delivered) => {
  const lines = [];
  for (const loc of form.locations) {
    const where = esc(placementLead(loc.name));
    const attached = delivered ? loc.files.filter((f) => f.data) : [];
    const linked = loc.files.filter((f) => isUploadUrl(f.url));
    const lost = loc.files.filter((f) => !isUploadUrl(f.url) && !(delivered && f.data));
    const parts = [];
    if (attached.length) parts.push(`attached to this email: ${list(attached.map((f) => f.name))}`);
    if (linked.length) parts.push(`download: ${linked.map(link).join(', ')}`);
    if (lost.length) parts.push(`${FLAG} The customer uploaded ${list(lost.map((f) => f.name))} but it could not be delivered with this email. Reply and ask them to send it directly.`);
    if (loc.artFailures.length) {
      const failed = loc.artFailures.map((f) => `${esc(cap(f.name, 120))} (${esc(cap(f.reason, 120))})`).join(', ');
      parts.push(`${FLAG} The customer tried to add ${failed}. Reply and ask them to send it directly.`);
    }
    if (!loc.files.length && !loc.artFailures.length) {
      parts.push(loc.description.trim() ? 'no file, described in Details' : 'no file yet');
    }
    lines.push(`<strong>${where}:</strong> ${parts.join(' ')}`);
  }
  if (form.artReady === 'no') lines.unshift('Customer said their artwork is NOT ready and may need design help.');
  return lines.length ? lines.join('<br>') : 'None provided';
};

/** Shop only. Where the lead came from. Says so when the browser gave us nothing. */
const sourceNote = (ctx) => {
  const parts = [cap(plain(ctx.source), 80) || 'live pricing form'];
  parts.push(`page: ${cap(plain(ctx.page), 300) || 'not reported by the browser'}`);
  if (ctx.gclid) parts.push(`gclid: ${cap(plain(ctx.gclid), 200)}`);
  return esc(parts.join(' | '));
};

const safeFileName = (name) => cap(stripControl(name).replace(/[\\/<>"]/g, '_'), 120) || 'artwork';
const safeFileType = (type) => (/^[\w.+-]+\/[\w.+-]+$/.test(String(type || '')) ? type : 'application/octet-stream');

/**
 * THE payload builder. The form ships this and scripts/lead-contract-test.mjs imports
 * this same file, so the test can never drift from what customers send.
 *
 * `delivered` says whether the attachment bytes ride along in THIS body. When they do
 * not, the body carries no attachments at all (that is what makes the fallback smaller)
 * and the artwork row flags every file that then has no link either.
 *
 * `meta` is { website, elapsedMs }: the two inputs the mail service's spam screen reads.
 */
export const buildBody = (form, ctx, delivered, meta = {}) => {
  const files = allFiles(form);
  return {
    shop_id: SHOP_ID,
    name: cap(plain(form.name), 120),
    email: cap(plain(form.email), 200),
    phone: cap(plain(form.phone), 60),
    company: cap(plain(form.company), 200),
    project: projectNote(form),
    quantity: String(quantityNumber(form)),
    decoration_method: 'Screen printing',
    artwork: artworkNote(form, delivered),
    artwork_urls: files.filter((f) => isUploadUrl(f.url)).map((f) => ({ name: safeFileName(f.name), url: f.url })),
    source: sourceNote(ctx),
    // [{ name, type, data(base64) }] - `size` and `url` are local only, stripped here.
    attachments: delivered
      ? files.filter((f) => f.data).map((f) => ({ name: safeFileName(f.name), type: safeFileType(f.type), data: f.data }))
      : [],
    website: cap(plain(meta.website), 200),
    // Left out entirely when it is not a real measurement.
    elapsed_ms: Number.isFinite(meta.elapsedMs) ? Math.max(0, Math.round(meta.elapsedMs)) : undefined,
  };
};

export const bodyBytes = (body) => new Blob([JSON.stringify(body)]).size;

const postOnce = async (body) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`Lead send failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    // A 200 that says ok:false is still a failure.
    const json = await res.json().catch(() => ({}));
    if (json && json.ok === false) {
      const err = new Error(`Lead send refused: ${json.error || 'ok false'}`);
      err.status = 422;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Retries a body on transport/5xx failure only. A 4xx is deterministic for that body
 * (a 413 is too big every time), so it stops immediately and lets the caller degrade.
 */
const postWithRetry = async (body) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await postOnce(body);
    } catch (err) {
      lastError = err;
      if (err.status && err.status >= 400 && err.status < 500) throw err;
      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }
  throw lastError;
};

/**
 * Degrade ladder: full payload (attachments and links) -> lead with links only, with
 * any file that then has neither flagged by filename. The customer's name and number
 * are worth more than their logo.
 *
 * Resolves { attachmentsDelivered, undelivered } where `undelivered` names every file
 * that reached the shop in no form at all. Rejects only when the lead itself could not
 * be delivered, and then the form stays on screen (App.jsx).
 */
export const sendQuoteRequest = async (form, ctx, meta) => {
  const files = allFiles(form);
  const failedNames = allFailures(form).map((f) => f.name);
  const noLink = files.filter((f) => !isUploadUrl(f.url));

  if (files.some((f) => f.data)) {
    const full = buildBody(form, ctx, true, meta);
    if (bodyBytes(full) <= MAX_BODY_BYTES) {
      try {
        await postWithRetry(full);
        return {
          attachmentsDelivered: true,
          undelivered: [...noLink.filter((f) => !f.data).map((f) => f.name), ...failedNames],
        };
      } catch (err) {
        console.error('Lead send with attachments failed, sending the lead without them:', err);
      }
    } else {
      console.warn('Attachment payload is over the mail service ceiling, sending the lead without it.');
    }
  }

  await postWithRetry(buildBody(form, ctx, false, meta));
  return { attachmentsDelivered: false, undelivered: [...noLink.map((f) => f.name), ...failedNames] };
};
