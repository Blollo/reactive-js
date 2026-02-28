import { ref, onScopeDispose, } from "../../core/reactive.js";
import { useFocusGuard } from "./useFocusGuard.js";

const FOCUSABLE_SELECTOR = [
    "a[href]:not([tabindex='-1'])",
    "button:not([disabled]):not([tabindex='-1'])",
    "input:not([disabled]):not([type='hidden']):not([tabindex='-1'])",
    "select:not([disabled]):not([tabindex='-1'])",
    "textarea:not([disabled]):not([tabindex='-1'])",
    "[tabindex]:not([tabindex='-1'])",
    "[contenteditable]:not([contenteditable='false']):not([tabindex='-1'])"
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

    const guard = useFocusGuard(container);

    // apply the initial guard when the trap starts inactive
    if (guardFocus && !autoActivate) {
        guard.apply();
        guard.startObserver();
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
        if (guardFocus) {
            guard.stopObserver();
            guard.remove();
        }

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
        if (guardFocus) {
            guard.apply();
            guard.startObserver();
        }

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
    });

    return {
        active,

        activate,
        deactivate
    };
}

// Helpers
function getFocusableElements (container) {
    const focusable = new Set();

    const walk = (node) => {
        if (!node) {
            return;
        }

        // If it's an element and matches selector (and its acually focusable)
        if (
            node.nodeType === Node.ELEMENT_NODE
            && node.matches?.(FOCUSABLE_SELECTOR)
            && !node.closest("[hidden]")
        ) {
            const isHidden = isHiddenNode(node);
            const hasSize = node.getClientRects().length > 0;

            if (!isHidden && hasSize) {
                focusable.add(node);
            }
        }

        // Walk shadow if present
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

    return Array.from(focusable);
}

// Helpers
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

function isHiddenNode (node) {
    const style = getComputedStyle(node);

    return (
        style.display === "none"
        || style.visibility === "hidden"
        || style.visibility === "collapse"
    );
}
