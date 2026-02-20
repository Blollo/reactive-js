import { ref, onScopeDispose, } from "../../core/reactive.js";

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "hs-button",
    "hs-segment",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
    "[contenteditable]:not([contenteditable='false'])"
].join(", ");

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

        // If node is a slot → inspect assigned elements
        if (node.tagName === "SLOT") {
            const assigned = node.assignedElements({ flatten: true });

            if (assigned.length > 0) {
                for (const el of assigned) {
                    walk(el);
                }

                return;
            }
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

export function useFocusTrap (container, options = {}) {
    const {
        autoActivate = false,
        onEscape     = null,
        initialFocus = null,
    } = options;

    const active = ref(false);
    let previouslyFocused = null;

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
        const current = container.activeElement ?? document.activeElement;

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
        const focusable = getFocusableElements(container);

        if (focusable.length > 0) {
            focusable[0].focus();
        }
    }

    function deactivate () {
        if (!active.value) {
            return;
        }

        const focusable = getFocusableElements(container);

        container.removeEventListener("keydown", handleKeydown);
        active.value = false;

        // restore focus to the element that was focused before the trap
        if (
            previouslyFocused &&
            typeof previouslyFocused.focus === "function"
        ) {
            previouslyFocused.focus();
        }

        previouslyFocused = null;
    }

    // Automatic Lifecycle

    if (autoActivate) {
        activate();
    }

    // register cleanup with the active effect scope so unmounting the
    // component (or stopping the scope) tears the trap down automatically
    onScopeDispose(() => deactivate());

    return {
        active,

        activate,
        deactivate
    };
}
