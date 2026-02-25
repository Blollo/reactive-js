import { ref, onScopeDispose, } from "../../core/reactive.js";

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
// snap detection uses two listeners for reliability:
//   1. scrollend  → fires once the scroll has fully stopped (primary)
//   2. scroll     → debounced fallback in case scrollend doesn't fire
//                   (shadow DOM quirks, older browsers, fast gestures)
//
// this dual approach ensures swipe-to-snap is always detected regardless
// of browser or gesture pattern.
//

export function useSnapScroll (options = {}) {
    const {
        onSnap = null,
    } = options;

    const activeIndex = ref(0);

    let _container     = null;
    let _scrollTimer   = null;
    let _suppressUntil = 0;         // timestamp — suppress expires automatically
    let _cleanups      = [];

    // Snap Detection
    function isSuppressed () {
        if (_suppressUntil === 0) {
            return false;
        }

        // auto-expire the suppression so it can never get stuck
        if (Date.now() >= _suppressUntil) {
            _suppressUntil = 0;

            return false;
        }

        return true;
    }

    function detectSnap () {
        if (!_container || isSuppressed()) {
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

        // always listen to debounced scroll as the reliable fallback —
        // covers all browsers and catches gestures that scrollend misses
        const onScroll = () => {
            clearTimeout(_scrollTimer);
            _scrollTimer = setTimeout(detectSnap, 120);
        };

        _container.addEventListener("scroll", onScroll, { passive: true });
        _cleanups.push(() => {
            _container.removeEventListener("scroll", onScroll);
            clearTimeout(_scrollTimer);
        });

        // if scrollend is available, also listen to it for faster detection
        if ("onscrollend" in window) {
            const onScrollEnd = () => detectSnap();

            _container.addEventListener("scrollend", onScrollEnd);
            _cleanups.push(() => _container.removeEventListener("scrollend", onScrollEnd));
        }
    }

    function destroy () {
        for (const cleanup of _cleanups) {
            cleanup();
        }

        _cleanups      = [];
        _container     = null;
        _suppressUntil = 0;
    }

    // Programmatic Navigation
    function scrollToIndex (index, { behavior = "smooth" } = {}) {
        if (!_container) {
            return;
        }

        const childWidth = _container.offsetWidth;

        // suppress snap detection briefly so the programmatic scroll
        // doesn't create a feedback loop (segment → view → segment).
        // the time-based approach auto-expires even if scrollend never
        // fires, preventing the suppress from getting stuck.
        activeIndex.value = index;

        if (behavior === "instant") {
            // no animation — suppress for just one frame
            _suppressUntil = Date.now() + 50;
        }
        else {
            // smooth animation — suppress long enough for it to settle
            _suppressUntil = Date.now() + 500;
        }

        _container.scrollTo({
            left:     index * childWidth,
            behavior: behavior,
        });

        // clear suppress as soon as the programmatic scroll finishes
        if (behavior !== "instant" && "onscrollend" in window) {
            _container.addEventListener("scrollend", () => {
                _suppressUntil = 0;
            }, { once: true });
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
