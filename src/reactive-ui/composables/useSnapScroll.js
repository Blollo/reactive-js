import { ref, onScopeDispose, } from "../../core/reactive.js";

// ── composable ────────────────────────────────────────────────────────────
//
// wraps a native CSS scroll-snap container to provide reactive swipe
// tracking and programmatic navigation. the heavy lifting (momentum,
// rubber-banding, snap points) is handled entirely by the browser —
// this composable only observes the result and exposes it as a ref.
//
// uses a deferred init pattern: create in setup() (so onScopeDispose
// registers correctly), then call init() in onMounted() once the DOM
// element actually exists.
//

export function useSnapScroll (options = {}) {
    const {
        onSnap = null,
    } = options;

    const activeIndex = ref(0);

    let _container    = null;
    let _scrollTimer  = null;
    let _suppressSnap = false;
    let _cleanups     = [];

    // Snap Detection
    function detectSnap () {
        if (!_container || _suppressSnap) {
            return;
        }

        const scrollLeft = _container.scrollLeft;
        const childWidth = _container.offsetWidth;

        if (childWidth === 0) {
            return;
        }

        const index = Math.round(scrollLeft / childWidth);

        if (index !== activeIndex.value) {
            activeIndex.value = index;
            onSnap?.(index);
        }
    }

    // Init / Destroy
    function init (container) {
        _container = container;

        // prefer scrollend for accuracy, fall back to debounced scroll
        if ("onscrollend" in window) {
            const handler = () => detectSnap();

            _container.addEventListener("scrollend", handler);
            _cleanups.push(() => _container.removeEventListener("scrollend", handler));
        }
        else {
            const handler = () => {
                clearTimeout(_scrollTimer);
                _scrollTimer = setTimeout(detectSnap, 100);
            };

            _container.addEventListener("scroll", handler);
            _cleanups.push(() => {
                _container.removeEventListener("scroll", handler);
                clearTimeout(_scrollTimer);
            });
        }
    }

    function destroy () {
        for (const cleanup of _cleanups) {
            cleanup();
        }

        _cleanups   = [];
        _container  = null;
    }

    // Navigation
    function scrollToIndex (index, { behavior = "smooth" } = {}) {
        if (!_container) {
            return;
        }

        const childWidth = _container.offsetWidth;

        // suppress the snap callback for programmatic scrolls — the caller
        // already knows which index it's scrolling to, and we don't want to
        // create a feedback loop when segment → view → segment.
        _suppressSnap = true;
        activeIndex.value = index;

        _container.scrollTo({
            left:     index * childWidth,
            behavior: behavior,
        });

        // re-enable snap detection after the scroll settles
        const restore = () => {
            _suppressSnap = false;
        };

        if (behavior === "instant") {
            restore();
        }
        else {
            // use scrollend if available, otherwise a generous timeout
            if ("onscrollend" in window) {
                _container.addEventListener("scrollend", restore, { once: true });
            }
            else {
                setTimeout(restore, 350);
            }
        }
    }

    // Cleanup
    onScopeDispose(() => destroy());

    return {
        activeIndex,

        init,
        destroy,
        scrollToIndex,
    };
}
