// npm run test:lead              DRY RUN (default). Builds the lead with the SHIPPED payload
//                                builder and prints it. Sends nothing.
// npm run test:lead -- --live    Posts that same payload to the LIVE obg-mail-api send_lead,
//                                rerouted to OBG's inbox. Exit 1 on anything but 200 + ok:true.
//
// Per the lead-path-test skill (R1): the body is built by the real
// src/utils/emailService.js (loaded through Vite in production mode, so LEAD_ENDPOINT is the
// production URL the bundle ships, not the dev mock), never a hand-written copy.
//
// DO NOT run --live until shops/backstage.json is deployed in obg-mail-api. Before that the
// service answers 500 "No shop registered with id 'backstage'" and its rescue path emails
// OBG a "LEAD REFUSED BY MAIL API" alert for the test.
//
// Reroute: the `shop` block below overrides the registry recipients (lib/leads.py merges
// payload.shop over the shop file), so Cody never gets a test. If OBG_CANARY_KEY is set in
// the environment the X-OBG-Canary header is sent too (canary mode, lead-path-test skill),
// which also forces the sender to "OBG Canary Test".
import { createServer } from 'vite';

const OBG_INBOX = 'olivebranchgrowth@gmail.com';
const LIVE = process.argv.includes('--live');
const root = new URL('..', import.meta.url).pathname;

// Load the shipped modules exactly as the production bundle sees them.
const vite = await createServer({
  root,
  mode: 'production',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  // No dependency pre-bundling: this only loads a few source files, and the scanner
  // otherwise races the close() below and prints a wall of noise.
  optimizeDeps: { noDiscovery: true, include: [] },
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' },
});
let exitCode = 0;
try {
  const svc = await vite.ssrLoadModule('/src/utils/emailService.js');
  const cfg = await vite.ssrLoadModule('/src/config.js');
  const flow = await vite.ssrLoadModule('/src/utils/flow.js');
  const garments = (await vite.ssrLoadModule('/src/data/garments.json')).default;

  const stamp = `OBG CONTRACT TEST ${new Date().toISOString()}`;
  const tee = garments.tshirts.find((g) => g.styleName === '3600') || garments.tshirts[0];
  const front = { ...flow.newLocation('Front Chest'), colors: 2, description: 'Band logo, white and red.',
    // A tiny real PNG (1x1) so the attachment path is exercised.
    files: [{ name: 'test-logo.png', type: 'image/png', size: 68, url: null,
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }],
    artFailures: [] };
  const back = { ...flow.newLocation('Full Back'), colors: 1, description: 'Tour dates list.' };
  const sleeves = { ...flow.newLocation('Sleeves'), colors: 1, artFailures: [{ name: 'huge-sleeve-art.psd', reason: '48.0MB, too large to send with this form' }] };
  const form = {
    ...flow.EMPTY_FORM,
    garmentType: 'tshirts', garment: tee, color: tee.colors.find((c) => /black/i.test(c.name)) || tee.colors[0],
    artReady: 'yes', locations: [front, back, sleeves], quantity: '48',
    name: stamp, email: OBG_INBOX, phone: '(307) 555-0100',
    company: 'Olive Branch Growth (internal test, ignore)', address: '123 Test St, Rock Springs, WY 82901',
  };
  const ctx = { source: 'live-pricing', page: 'https://backstagescreenprinting.com/live-pricing', gclid: '' };
  const meta = { website: '', elapsedMs: 95000 };

  // ---- contract checks on the shipped builder (these run in dry run too)
  const body = svc.buildBody(form, ctx, true, meta);
  const problems = [];
  if (cfg.LEAD_ENDPOINT !== 'https://obg-mail-api.vercel.app/api/send_lead') problems.push(`endpoint is ${cfg.LEAD_ENDPOINT}, expected the production send_lead`);
  if (body.shop_id !== 'backstage') problems.push(`shop_id is ${body.shop_id}`);
  if ('customer' in body || 'quote' in body) problems.push('nested calculator shape found; send_lead wants FLAT');
  for (const k of ['name', 'email', 'phone', 'project', 'quantity', 'artwork', 'decoration_method', 'source']) {
    if (!String(body[k] ?? '').trim()) problems.push(`empty ${k}`);
  }
  if (!/^\d+$/.test(body.quantity)) problems.push(`quantity not digits: ${body.quantity}`);
  if (!Array.isArray(body.attachments) || body.attachments.length !== 1) problems.push('attachment did not ride along');
  if (body.website !== '') problems.push('honeypot not empty');
  const fallback = svc.buildBody(form, ctx, false, meta);
  if (fallback.attachments.length) problems.push('fallback body still carries attachment bytes');
  if (!/ARTWORK NOT ATTACHED/.test(fallback.artwork)) problems.push('fallback does not flag the file it dropped');

  const shown = { ...body, attachments: body.attachments.map((a) => ({ name: a.name, type: a.type, base64_chars: a.data.length })) };
  console.log(`endpoint: ${cfg.LEAD_ENDPOINT}`);
  console.log(`body bytes: ${svc.bodyBytes(body)}`);
  console.log(JSON.stringify(shown, null, 2));

  if (problems.length) {
    console.error(`\nFAIL contract: ${problems.join('; ')}`);
    exitCode = 1;
  } else if (!LIVE) {
    console.log('\nDRY RUN PASS: payload built by the shipped emailService.js, flat, send_lead, every key present. Nothing was sent.');
    console.log('Add -- --live to post it (only after shops/backstage.json is deployed).');
  } else {
    // ---- live: same sender the form ships, request rerouted to OBG.
    const realFetch = globalThis.fetch;
    let captured = null;
    globalThis.fetch = async (url, init) => {
      const sent = JSON.parse(init.body);
      captured = { url, attachments: (sent.attachments || []).length };
      const rerouted = { ...sent, shop: { shop_email: OBG_INBOX, shop_owner_email: OBG_INBOX } };
      const headers = { ...init.headers };
      if (process.env.OBG_CANARY_KEY) headers['X-OBG-Canary'] = process.env.OBG_CANARY_KEY;
      return realFetch(url, { ...init, headers, body: JSON.stringify(rerouted) });
    };
    try {
      const res = await svc.sendQuoteRequest(form, ctx, meta);
      console.log(`\nPASS ${captured?.url} ${JSON.stringify(res)}`);
      console.log(`Now search Gmail Sent for "${stamp}" and find BOTH the shop notification and the customer auto reply.`);
    } catch (err) {
      console.error(`\nFAIL ${captured?.url} ${err.message}`);
      exitCode = 1;
    } finally {
      globalThis.fetch = realFetch;
    }
  }
} finally {
  await vite.close();
}
process.exit(exitCode);
