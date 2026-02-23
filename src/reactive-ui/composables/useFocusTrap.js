import { ref, onScopeDispose, } from "../../core/reactive.js";

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
    "[contenteditable]:not([contenteditable='false'])"
].join(", ");

export function useFocusTrap (container, options = {}) {
    const {
        autoActivate = false,
        guardFocus   = true,
        onEscape     = null,
        initialFocus = null,
    } = options;

    const active = ref(false);
    let previouslyFocused = null;

    // Focus Guard
    /*
    ~  when guardFocus is enabled, elements inside the container are marked
    ~  `inert` while the trap is inactive, preventing any focus via Tab,
    ~  click, or assistive technology.
    ~
    ~  the native `inert` attribute propagates to all descendants
    ~  automatically, so dynamically inserted children inside an already-
    ~  inert parent are covered for free.
    ~
    ~  however, when the container is a ShadowRoot (not an Element), we
    ~  can't set `inert` on it directly — we apply it to each direct child
    ~  element instead. a MutationObserver watches for new direct children
    ~  added while the guard is active and marks them `inert` too.
    */

    let guardObserver = null;

    function getGuardTargets () {
        // ShadowRoot is not an Element — apply to each direct child element
        if (container instanceof ShadowRoot) {
            return Array.from(container.children);
        }

        return [container];
    }

    function applyGuard () {
        if (!guardFocus) {
            return;
        }

        for (const el of getGuardTargets()) {
            el.inert = true;
        }
    }

    function removeGuard () {
        if (!guardFocus) {
            return;
        }

        for (const el of getGuardTargets()) {
            el.inert = false;
        }
    }

    function startGuardObserver () {
        if (!guardFocus || guardObserver) {
            return;
        }

        // only needed when the container is a ShadowRoot, because new
        // direct children won't inherit `inert` from a non-Element root.
        // for regular Element containers, `inert` propagates natively.
        if (!(container instanceof ShadowRoot)) {
            return;
        }

        guardObserver = new MutationObserver((mutations) => {
            // if the trap has been activated in the meantime, skip
            if (active.value) {
                return;
            }

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        node.inert = true;
                    }
                }
            }
        });

        guardObserver.observe(container, { childList: true });
    }

    function stopGuardObserver () {
        if (guardObserver) {
            guardObserver.disconnect();
            guardObserver = null;
        }
    }

    // apply the initial guard when the trap starts inactive
    if (guardFocus && !autoActivate) {
        applyGuard();
        startGuardObserver();
    }

    // Keyboard Handler

    function handleKeydown (e) {
        if (
            e.key === "Escape"
            && typeof onEscape === "function"
        ) {
            e.preventDefault();
            onEscape(e);

            return;
        }

        if (e.key !== "Tab") {
            return;
        }

        const focusable = getFocusableElements(container);

        if (focusable.length === 0) {
            e.preventDefault();

            return;
        }

        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        // activeElement lives on the shadow root for elements inside shadow DOM,
        // falling back to document.activeElement for light DOM containers
        const current = getDeepActiveElement();

        if (e.shiftKey) {
            // shift + tab on first element → wrap to last
            if (current === first || !focusable.includes(current)) {
                e.preventDefault();
                last.focus();
            }
        }
        else {
            // tab on last element → wrap to first
            if (current === last || !focusable.includes(current)) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    // Activate / Deactivate

    function activate () {
        if (active.value) {
            return;
        }

        // save the element that had focus before the trap so we can restore it
        previouslyFocused = document.activeElement;

        // lift the focus guard before attaching the trap
        stopGuardObserver();
        removeGuard();

        container.addEventListener("keydown", handleKeydown);
        active.value = true;

        // move focus into the container
        if (initialFocus) {
            const target = typeof initialFocus === "string"
                ? container.querySelector(initialFocus)
                : initialFocus;

            if (target) {
                target.focus();

                return;
            }
        }

        // fall back to first focusable element
        afterPaint(() => {
            const focusable = getFocusableElements(container);

            // Focus is applied when the element is actually focusable in the rendered tree
            if (focusable.length > 0) {
                focusable[0].focus();
            }
        });
    }

    function deactivate () {
        if (!active.value) {
            return;
        }

        container.removeEventListener("keydown", handleKeydown);
        active.value = false;

        // re-apply the focus guard now that the trap is inactive
        applyGuard();
        startGuardObserver();

        // restore focus to the element that was focused before the trap
        if (
            previouslyFocused &&
            typeof previouslyFocused.focus === "function"
        ) {
            previouslyFocused.focus();
        }

        previouslyFocused = null;
    }

    // Automatic lifecycle

    if (autoActivate) {
        activate();
    }

    // register cleanup with the active effect scope so unmounting the
    // component (or stopping the scope) tears the trap down automatically
    onScopeDispose(() => {
        deactivate();
        stopGuardObserver();
    });

    return {
        active,

        activate,
        deactivate
    };
}
// Helpers
function getFocusableElements (container) {
    const focusable = [];

    const walk = (node) => {
        if (!node) {
            return;
        }

        // If it's an element and matches selector
        if (
            node.nodeType === Node.ELEMENT_NODE
            && node.matches?.(FOCUSABLE_SELECTOR)
            && !node.closest("[hidden]")
            && node.offsetParent !== null
        ) {
            focusable.push(node);
        }

        // Walk shodow if present
        if (node.shadowRoot) {
            walk(node.shadowRoot);
        }

        // If node is a slot → inspect assigned elements
        if (node.tagName === "SLOT") {
            const assigned = node.assignedElements({ flatten: true });

            if (assigned.length > 0) {
                for (const el of assigned) {
                    walk(el);
                }
            }

            return;
        }

        // Traverse children
        const children = node.children;

        if (children && children.length) {
            for (const child of children) {
                walk(child);
            }
        }
    };

    walk(container);

    return focusable;
}

function getDeepActiveElement(root = document) {
    let active = root.activeElement;

    while (active?.shadowRoot?.activeElement) {
        active = active.shadowRoot.activeElement;
    }

    return active;
}

function afterPaint(callback) {
    // waits until the next frame
    requestAnimationFrame(() => {
        // waits until layout + style + potential transitions settle
        requestAnimationFrame(callback);
    });
}
