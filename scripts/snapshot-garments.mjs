// node scripts/snapshot-garments.mjs
//
// Writes src/data/garments.json: Backstage's own garment list (the twelve styles on
// the ConvertCalculator it replaces, see ~/Projects/convertcalc-export/backstage-spec.md),
// with every colorway, photo and spec line pulled from the shared OBG catalog
// (Supabase view `calculator_catalog`, the same one the "explore all" browser reads).
//
// Why a snapshot and not a live query: these twelve are the cards a customer sees
// first. They must render even when the catalog is slow or down, the way Local
// Threads' hand-built src/garments/ modules do. Re-run this to refresh colors.
//
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from .env.local (the
// publishable key is the client-safe one that ships in the bundle anyway).
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing from .env.local');

// Order, labels and taglines exactly as the old calculator listed them.
// `label` is the old option text, kept word for word so Cody recognises the lead.
const LIST = {
  tshirts: [
    { brand: 'Gildan', style: '5000', label: 'Gildan 5000', tag: 'Economy' },
    { brand: 'Gildan', style: '64000', label: 'Gildan Softstyle 64000', tag: 'Most Comfortable' },
    { brand: 'Next Level', style: '3600', label: 'Next Level 3600', tag: 'Most Popular' },
    { brand: 'Next Level', style: '6210', label: 'Next Level 6210', tag: 'Quality For Price' },
    { brand: 'BELLA + CANVAS', style: '3001', label: 'Bella Canvas 3001', tag: 'Premium Quality' },
  ],
  longsleeves: [
    { brand: 'Gildan', style: '64400', label: 'Gildan G6440', tag: 'Most Popular' },
    { brand: 'Next Level', style: '6411', label: 'Next Level 6411', tag: 'Soft and Smooth Fabric' },
    { brand: 'BELLA + CANVAS', style: '3501', label: 'Bella Canvas 3501', tag: 'Quality for Price' },
    { brand: 'Comfort Colors', style: '6014', label: 'Comfort Colors C6014', tag: 'Most Comfortable' },
  ],
  hoodies: [
    { brand: 'Gildan', style: '18500', label: 'Gildan G18500', tag: 'Best Value & Most Popular' },
    { brand: 'BELLA + CANVAS', style: '3719', label: 'Bella Canvas 3719', tag: 'Lighter Fit' },
    { brand: 'Independent Trading Co.', style: 'IND4000', label: 'Independent IND4000', tag: 'Thick & Warm' },
  ],
};

const SELECT = 'id,slug,brand,style_name,style_number,garment_type,base_cost,image_url,popularity_qty,colors,title,blurb';
const large = (u) => (u ? u.replace(/_fm\.(jpg|jpeg|png)$/i, '_fl.$1') : u);

const fetchStyle = async ({ brand, style }) => {
  const q = `${URL_}/rest/v1/calculator_catalog?select=${SELECT}&style_name=eq.${encodeURIComponent(style)}&brand=eq.${encodeURIComponent(brand)}`;
  const res = await fetch(q, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`${brand} ${style}: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
};

const out = {};
const report = [];
for (const [type, list] of Object.entries(LIST)) {
  out[type] = [];
  for (const item of list) {
    const row = await fetchStyle(item);
    if (!row) { report.push(`MISSING ${item.label} (${item.brand} ${item.style})`); continue; }
    const colors = (row.colors || []).map((c) => ({ name: c.name, hex: c.hex || null, image: c.swatch || c.image || null, previewImage: c.image || null }));
    out[type].push({
      id: row.slug || String(row.id),
      label: item.label,
      tag: item.tag,
      brand: row.brand,
      styleName: row.style_name,
      styleNumber: row.style_number,
      title: row.title || null,
      blurb: row.blurb || null,
      stockImage: large(row.image_url) || colors[0]?.previewImage || null,
      colors,
      fromCatalog: false,
    });
    report.push(`${item.label}: ${row.brand} ${row.style_name} (S&S ${row.style_number}), ${colors.length} colors`);
  }
}

writeFileSync(new URL('../src/data/garments.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(report.join('\n'));
