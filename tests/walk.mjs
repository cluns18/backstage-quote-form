// npm run check   (after npm run build)
//
// Walks the BUILT form (vite preview on 127.0.0.1:4391) in headless Chromium at 390 and
// 1440 wide, with the mail service and the file bucket intercepted at the network layer,
// so nothing is ever sent or stored. The garment catalog (a public read-only view) is
// read for real.
//
// Proves, on the shipped bundle:
//   - every step renders and the walk reaches the contact step
//   - a phone number typed as the quantity is stopped (quantity/phone defect)
//   - a failed send (500) keeps the customer on the form with Try Again and the phone
//     number, and fires NO submission postMessage
//   - Enter in a field plus a click on the button sends ONE lead (double-send defect)
//   - a successful send reaches the thank you and fires the submission postMessage once
//   - a refused bucket upload still attaches the file and says so honestly
//   - at 390x604 the way forward on each step is inside the fold (reported, not fatal on
//     the garment step, whose cards are the way forward)
// Screenshots go to SHOTS (default: ./tests/shots, git ignored).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/homebrew/lib/node_modules/playwright/index.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS || `${ROOT}tests/shots`;
mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:4391/';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const server = spawn('npx', ['vite', 'preview'], { cwd: ROOT, stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview did not start')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes('4391')) { clearTimeout(t); resolve(); } });
});

const failures = [];
const notes = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const browser = await chromium.launch();
try {
  for (const [label, width, height] of [['390', 390, 844], ['1440', 1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const posts = [];
    let mailStatus = 500;
    await page.route('**/api/send_lead', async (route) => {
      if (route.request().method() !== 'POST') return route.fulfill({ status: 204 });
      posts.push(JSON.parse(route.request().postData() || '{}'));
      await new Promise((r) => setTimeout(r, 300));
      return route.fulfill({ status: mailStatus, contentType: 'application/json', body: JSON.stringify(mailStatus === 200 ? { ok: true } : { ok: false, error: 'test failure' }) });
    });
    // The bucket refuses every upload (a 403, the way a rules denial answers), so the
    // attachment path has to carry the file. An aborted connection would also work, but
    // the Firebase client retries that for the full 60 second upload timeout.
    await page.route('**/firebasestorage.googleapis.com/**', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":{"code":403,"message":"Permission denied."}}' }));
    await page.addInitScript(() => {
      window.__msgs = [];
      const orig = window.parent.postMessage.bind(window.parent);
      window.parent.postMessage = (m, o) => { window.__msgs.push(m); return orig(m, o); };
    });

    const shot = async (name) => page.screenshot({ path: `${SHOTS}/${label}-${name}.png`, fullPage: true });
    const fold = async (step, selector) => {
      if (width !== 390) return;
      const box = await page.locator(selector).first().boundingBox();
      const bottom = box ? Math.round(box.y + box.height) : -1;
      notes.push(`390: ${step} way forward bottom at ${bottom}px ${bottom > 0 && bottom <= 604 ? '(inside 604)' : '(BELOW 604)'}`);
    };

    await page.goto(BASE);
    await page.waitForSelector('[data-type="tshirts"]');
    await fold('garment type', '[data-type="hoodies"]');
    await shot('1-garment-type');
    await page.click('[data-type="tshirts"]');

    await page.waitForSelector('[data-pick-grid] .pick-card');
    await page.waitForTimeout(1500); // catalog count arrives
    const explore = await page.locator('[data-explore]').count();
    notes.push(`${label}: explore-all button ${explore ? await page.locator('[data-explore]').innerText() : 'NOT SHOWN'}`);
    await fold('garment (last card)', '[data-pick-grid] .pick-card >> nth=-1');
    await shot('2-garment');
    if (explore) {
      await page.click('[data-explore]');
      await page.waitForSelector('[data-catalog-grid] .pick-card', { timeout: 15000 }).catch(() => {});
      await page.fill('[data-catalog-search]', 'Comfort Colors');
      await page.waitForTimeout(1500);
      const n = await page.locator('[data-catalog-grid] .pick-card').count();
      notes.push(`${label}: catalog search "Comfort Colors" returned ${n} cards`);
      check(n > 0, `${label}: catalog search returned nothing`);
      await shot('2b-catalog');
      await page.click('.slide-nav .btn-back');
    }
    await page.click('.pick-card:has-text("Next Level 3600")');

    await page.waitForSelector('[data-color]');
    const black = page.locator('[data-color="Black"]');
    if (await black.count()) await black.click();
    await page.waitForTimeout(1000); // the new photo loads from S&S
    await fold('color', '[data-next]');
    await shot('3-color');
    await page.click('[data-next]');

    await page.waitForSelector('[data-art-ready]');
    await shot('4-art-ready');
    await page.click('[data-art-ready="yes"]');

    await page.waitForSelector('[data-panel]');
    await page.setInputFiles('[data-file-input]', { name: 'band-logo.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('[data-attached="band-logo.png"]', { timeout: 30000 });
    const linked = await page.getAttribute('[data-attached="band-logo.png"]', 'data-linked');
    check(linked === 'no', `${label}: refused upload should leave the file attachment-only`);
    await page.click('[data-panel] .loc-step[aria-label="More ink colors"]');
    await fold('print locations, front with a file', '[data-next]');
    await shot('5a-locations-file');
    await page.click('[data-placement="Full Back"]');
    await page.fill('[data-panel="Full Back"] [data-desc]', 'Tour dates on the back.');
    await fold('print locations', '[data-next]');
    await shot('5-locations');
    await page.click('[data-next]');

    await page.waitForSelector('[data-qty]');
    await page.fill('[data-qty]', '3075550100');
    await page.click('[data-next]');
    const phoneErr = await page.locator('.form-error').innerText().catch(() => '');
    check(/phone number/i.test(phoneErr), `${label}: phone number as quantity was not stopped (${phoneErr})`);
    await page.fill('[data-qty]', '48');
    await fold('quantity', '[data-next]');
    await shot('6-quantity');
    await page.click('[data-next]');

    await page.waitForSelector('#f-name');
    await page.fill('#f-name', 'Walk Test');
    await page.fill('#f-email', 'olivebranchgrowth@gmail.com');
    await page.fill('#f-company', 'Test Co');
    await page.fill('#f-phone', '3075550100');
    await page.fill('#f-address', '1 Test St, Rock Springs, WY');
    await fold('contact', '[data-send]');
    await shot('7-contact');

    // Failed send: stays on the form, no thank you, no conversion.
    await page.click('[data-send]');
    await page.waitForSelector('[data-send-failed]', { timeout: 30000 });
    check(await page.locator('[data-success]').count() === 0, `${label}: thank you shown after a failed send`);
    const failMsgs = await page.evaluate(() => window.__msgs.filter((m) => m && m.event === 'obgform_submission').length);
    check(failMsgs === 0, `${label}: submission message fired on a failed send`);
    check(await page.inputValue('#f-name') === 'Walk Test', `${label}: answers lost after failed send`);
    await fold('contact after failed send', '[data-send]');
    await shot('7b-send-failed');
    const failedPosts = posts.length;
    notes.push(`${label}: failed send made ${failedPosts} POSTs (attachment body, then fallback, with retries)`);

    // Success, fired twice in one tick (Enter + click): exactly one lead.
    mailStatus = 200;
    posts.length = 0;
    // Both in the same tick, before React can re-render the button disabled. This is
    // the Express race: only a synchronous lock stops the second one.
    await page.evaluate(() => {
      const phone = document.querySelector('#f-phone');
      phone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      document.querySelector('[data-send]').click();
      document.querySelector('[data-send]').click();
    });
    await page.waitForSelector('[data-success]', { timeout: 30000 });
    await page.waitForTimeout(800);
    check(posts.length === 1, `${label}: ${posts.length} lead POSTs on Enter + two clicks in one tick, expected 1`);
    const okMsgs = await page.evaluate(() => window.__msgs.filter((m) => m && m.event === 'obgform_submission'));
    check(okMsgs.length === 1, `${label}: ${okMsgs.length} submission messages, expected 1`);
    const heights = await page.evaluate(() => window.__msgs.filter((m) => m && m.type === 'obgform_height').length);
    notes.push(`${label}: obgform_height messages seen: ${heights} (0 is expected unframed; embedHeight only posts inside an iframe)`);
    const body = posts[0] || {};
    check(body.shop_id === 'backstage' && body.quantity === '48', `${label}: payload shop_id/quantity wrong`);
    check(Array.isArray(body.attachments) && body.attachments.length === 1, `${label}: artwork did not ride as an attachment`);
    check(/Next Level 3600/.test(body.project) && /Full Back: 1 ink color/.test(body.project) && /Front Chest: 2 ink colors/.test(body.project), `${label}: project rows missing picks`);
    check(okMsgs[0] && !JSON.stringify(okMsgs[0]).includes('olivebranchgrowth'), `${label}: personal data in postMessage`);
    await shot('8-thanks');
    await page.close();
  }

  // Inside an iframe: the form must report its height to the parent.
  const host = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await host.setContent(`<iframe id="f" src="${BASE}" style="width:100%;height:900px;border:0"></iframe>
    <script>window.h=[];addEventListener('message',e=>{if(e.data&&e.data.type==='obgform_height')h.push(e.data.height)})</script>`);
  await host.waitForTimeout(3000);
  const hs = await host.evaluate(() => window.h);
  notes.push(`framed at 390: heights reported ${JSON.stringify(hs.slice(-3))}`);
  check(hs.length > 0 && hs[hs.length - 1] > 200 && hs[hs.length - 1] < 900, 'framed: no sensible obgform_height reported');
} finally {
  await browser.close();
  server.kill();
}

console.log(notes.join('\n'));
if (failures.length) {
  console.error(`\nFAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nPASS. Screenshots in ${SHOTS}`);
