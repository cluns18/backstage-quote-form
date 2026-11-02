// Live S&S catalog, read from the shared OBG garment database (the same
// Supabase project that powers the design lab) through the `calculator_catalog`
// view. The view only exposes styles that are in stock, priced, and have at
// least one photographed colorway, and it rolls the colorways up as jsonb so a
// page of results is a single request.
//
// Backstage's own twelve styles (src/data/garments.json, a snapshot of this same
// view written by scripts/snapshot-garments.mjs) stay as the shortlist the customer
// sees first. This is the "browse everything else" path behind it.
//
// Local Threads prices off this view. Backstage shows no price, so the cost, the
// price tier and the underbase guess are not read here at all.

// The Supabase client is only fetched when the garment step asks the catalog for
// something, so the first screen does not wait on it.
export const catalogEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const client = () => import('../lib/supabase').then((m) => m.supabase);

// The funnel uses plural ids; the catalog stores the singular S&S category.
// Backstage's old calculator asked T-Shirt, Long Sleeve or Hoodie, so those three.
const TYPE_MAP = {
    tshirts: 'tshirt',
    longsleeves: 'longsleeve',
    hoodies: 'hoodie',
};

export const PAGE_SIZE = 12;

// S&S serves a thumbnail by default; `_fl` is the 1000x1250 variant.
function large(url) {
    return url ? url.replace(/_fm\.(jpg|jpeg|png)$/i, '_fl.$1') : url;
}

// Shape a catalog row like the snapshot rows in src/data/garments.json, so every
// step and the lead email treat both sources identically.
function mapRow(row) {
    const colors = (row.colors || []).map((c) => ({
        name: c.name,
        hex: c.hex,
        image: c.swatch || c.image,
        previewImage: c.image,
    }));

    const label = `${row.brand} ${row.style_name}`.trim();

    return {
        id: row.slug || String(row.id),
        label,
        name: label,
        brand: row.brand,
        styleName: row.style_name,
        // S&S's own product name ("Unisex Heavy Cotton T-Shirt") and a one-line
        // spec ("5.3 oz · 100% U.S. cotton"). Both can be null on the handful of
        // styles S&S no longer publishes, so every use site has to tolerate that.
        title: row.title || null,
        blurb: row.blurb || null,
        // S&S's style number, printed in the lead email so the shop can order the
        // exact blank. The style name ("3001CVC") is the mill's number.
        styleNumber: row.style_number || null,
        stockImage: large(row.image_url) || colors[0]?.previewImage || null,
        colors,
        popularity: Number(row.popularity_qty || 0),
        fromCatalog: true,
    };
}

const SELECT = 'id, slug, brand, style_name, style_number, image_url, popularity_qty, colors, title, blurb';

/**
 * Page through the catalog for one garment type.
 *
 * Sorted by popularity, measured as the number of units S&S currently stocks
 * across every SKU of the style. They stock deep on what sells, so this floats
 * the blanks people actually order (Gildan 5000, Comfort Colors 1717) above the
 * long tail. The id breaks ties so the order is stable across pages.
 */
// Supabase hands back the occasional 503 when a project wakes up. Retry once
// before giving up, because a single blip on the count call is enough to hide
// the browse-all entry point completely and the customer never learns the rest
// of the catalog is there.
async function withRetry(run) {
    const first = await run();
    if (!first.error) return first;
    await new Promise((r) => setTimeout(r, 600));
    return run();
}

export async function searchCatalog({ garmentTypeId, search = '', page = 0, pageSize = PAGE_SIZE }) {
    const garmentType = TYPE_MAP[garmentTypeId];
    if (!catalogEnabled || !garmentType) return { garments: [], total: 0 };

    const from = page * pageSize;
    const term = search.trim();
    // PostgREST reads these characters as filter syntax, so drop them.
    const safe = term.replace(/[%,()]/g, ' ').trim();

    const supabase = await client();
    const { data, error, count } = await withRetry(() => {
        let query = supabase
            .from('calculator_catalog')
            .select(SELECT, { count: 'exact' })
            .eq('garment_type', garmentType);

        if (safe) query = query.or(`brand.ilike.%${safe}%,style_name.ilike.%${safe}%`);

        return query
            .order('popularity_qty', { ascending: false })
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1);
    });

    if (error) throw new Error(error.message);

    return { garments: (data || []).map(mapRow), total: count || 0 };
}

/** Total number of styles available for a garment type, for the browse-all prompt. */
export async function countCatalog(garmentTypeId) {
    const garmentType = TYPE_MAP[garmentTypeId];
    if (!catalogEnabled || !garmentType) return 0;

    const supabase = await client();
    const { count, error } = await withRetry(() => supabase
        .from('calculator_catalog')
        .select('id', { count: 'exact', head: true })
        .eq('garment_type', garmentType));

    if (error) return 0;
    return count || 0;
}
