import { ref, onScopeDispose, } from "../../core/reactive.js";

// ── shared lock registry ──────────────────────────────────────────────────
//
// multiple components can lock scrolling simultaneously (e.g. a Panel opens
// a nested dialog). the page only unlocks when every consumer has released.
//
// the registry is keyed by the target element so that independent scroll
// containers each maintain their own reference count.
//

// Map<Element, { count: number, original: { overflow: string, paddingRight: string } }>
const lockRegistry = new Map();

function acquireLock (target) {
    if (lockRegistry.has(target)) {
        lockRegistry.get(target).count++;

        return;
    }

    // snapshot the inline styles we're about to override so they can be
    // restored exactly when the last consumer releases the lock
    const original = {
        overflow:     target.style.overflow,
        paddingRight: target.style.paddingRight,
    };

    lockRegistry.set(target, { count: 1, original });

    // measure scrollbar width before hiding the overflow — the difference
    // between the viewport and the client width is the scrollbar gutter
    const scrollbarWidth = target === document.documentElement
        ? window.innerWidth - document.documentElement.clientWidth
        : target.offsetWidth - target.clientWidth;

    target.style.overflow = "hidden";

    // compensate for the removed scrollbar so content doesn't shift
    if (scrollbarWidth > 0) {
        const existing = parseFloat(getComputedStyle(target).paddingRight) || 0;
        target.style.paddingRight = `${existing + scrollbarWidth}px`;
    }
}

function releaseLock (target) {
    const entry = lockRegistry.get(target);

    if (!entry) {
        return;
    }

    entry.count--;

    if (entry.count > 0) {
        return;
    }

    // last consumer released — restore the original inline styles
    target.style.overflow     = entry.original.overflow;
    target.style.paddingRight = entry.original.paddingRight;

    lockRegistry.delete(target);
}

// ── composable ────────────────────────────────────────────────────────────

export function useScrollLock (options = {}) {
    const {
        target       = document.documentElement,
        autoLock     = false,
    } = options;

    const locked = ref(false);

    function lock () {
        if (locked.value) {
            return;
        }

        acquireLock(target);
        locked.value = true;
    }

    function unlock () {
        if (!locked.value) {
            return;
        }

        releaseLock(target);
        locked.value = false;
    }

    // ── automatic lifecycle ───────────────────────────────────────────────

    if (autoLock) {
        lock();
    }

    // register cleanup with the active effect scope so unmounting the
    // component (or stopping the scope) releases the lock automatically
    onScopeDispose(() => {
        unlock();
    });

    return {
        locked,

        lock,
        unlock,
    };
}
