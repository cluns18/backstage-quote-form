/**
 * Keep the embedding page's iframe the same height as the form.
 *
 * Carried over from the Local Threads calculator (cluns18/local-threads-calculator
 * PR #12). A frame cannot resize itself, so the height goes over postMessage and the
 * parent applies it (EMBED-SNIPPET.html in this repo is the parent side).
 *
 * Two things have to happen together or the number is wrong:
 *  - `.slide-container` has `min-height: 100vh` on its own page. Inside a frame, 100vh
 *    is the frame's own height, so measuring would hand back whatever height the parent
 *    already set. The `is-embedded` class drops it.
 *  - We measure the card (`.slide-page`), never the container, so the number moves in
 *    both directions.
 *
 * Posted as the house `obgform_height` message (type AND event, older bridges switch on
 * `event`), so the same parent snippet works for this form and the other OBG forms.
 */

const MESSAGE_TYPE = 'obgform_height';

export function isEmbedded() {
    try {
        return window.self !== window.top;
    } catch {
        // Cross-origin access to window.top throws, which only happens when we
        // are in fact framed.
        return true;
    }
}

export function initEmbedHeight() {
    if (typeof window === 'undefined' || !isEmbedded()) return;

    document.documentElement.classList.add('is-embedded');

    const root = document.querySelector('.slide-container') || document.body;
    let last = 0;

    // Measure the card, never the container. The container can end up as tall as
    // the frame, so measuring it makes the number self-fulfilling: it would grow
    // to fit a tall slide and then never shrink back, because the height it
    // reports is the height the parent just gave it. The card's height is purely
    // content driven, so it moves in both directions.
    const measure = () => {
        const card = document.querySelector('.slide-page');
        return card ? Math.ceil(card.getBoundingClientRect().height) : 0;
    };

    const post = () => {
        const height = measure();
        // Sub-pixel churn during transitions would otherwise post on every frame.
        if (!height || Math.abs(height - last) < 2) return;
        last = height;
        window.parent.postMessage({ type: MESSAGE_TYPE, event: MESSAGE_TYPE, height }, '*');
    };

    if (typeof ResizeObserver === 'function') {
        // Observing the container rather than the card, because React swaps the
        // card element between the loading, error and main branches and an
        // observer bound to a detached node goes quiet.
        const ro = new ResizeObserver(post);
        ro.observe(root);
        const card = document.querySelector('.slide-page');
        if (card) ro.observe(card);
        // Rebind when the card is replaced, otherwise the only signal left is
        // the container, which does not change when the card shrinks.
        new MutationObserver(() => {
            const next = document.querySelector('.slide-page');
            if (next) ro.observe(next);
            post();
        }).observe(root, { childList: true, subtree: true });
    } else {
        window.addEventListener('resize', post);
    }

    // Web fonts and the garment photos both land after first paint and both
    // change the card's height.
    window.addEventListener('load', post);
    if (document.fonts?.ready) document.fonts.ready.then(post);

    post();
}
