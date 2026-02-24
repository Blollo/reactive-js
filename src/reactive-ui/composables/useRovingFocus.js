import { ref, onScopeDispose, } from "../../core/reactive.js";

// ── composable ────────────────────────────────────────────────────────────
//
// implements the roving tabindex pattern for keyboard-navigable groups
// (segments, radio groups, toolbars, tab lists…).
//
// only the currently focused item has tabindex="0" — all siblings sit at
// tabindex="-1". arrow keys cycle through items. Home and End jump to
// the first and last item respectively.
//
// the composable owns the keydown listener on the container and exposes
// a reactive `focusedIndex`. the caller decides what to do when the
// index changes (select, scroll, etc.) by watching it.
//

export function useRovingFocus (container, options = {}) {
    const {
        selector,
        orientation   = "both",         // "horizontal" | "vertical" | "both"
        loop          = true,
        selectOnFocus = false,
    } = options;

    const focusedIndex = ref(-1);

    // ── helpers ───────────────────────────────────────────────────────────

    function getItems () {
        return [...container.querySelectorAll(selector)];
    }

    function focusAt (index, { select = selectOnFocus } = {}) {
        const items = getItems();

        if (index < 0 || index >= items.length) {
            return;
        }

        // update tabindex across all items
        items.forEach((item, i) => {
            const inner = item.shadowRoot?.querySelector("button");
            const target = inner || item;

            target.setAttribute("tabindex", i === index ? "0" : "-1");
        });

        // move focus
        const active = items[index];
        const focusTarget = active.shadowRoot?.querySelector("button") || active;
        focusTarget.focus();

        // update index — if selectOnFocus is on, the caller's watcher
        // will pick this up and treat it as a selection
        if (select) {
            focusedIndex.value = index;
        }
    }

    // ── navigation ────────────────────────────────────────────────────────

    function navigate (direction) {
        const items = getItems();

        if (!items.length) {
            return;
        }

        // find the currently focused item by checking document.activeElement
        let current = focusedIndex.value;

        if (current < 0 || current >= items.length) {
            current = 0;
        }

        let next;

        if (direction === "next") {
            next = loop
                ? (current + 1) % items.length
                : Math.min(current + 1, items.length - 1);
        }
        else if (direction === "prev") {
            next = loop
                ? (current - 1 + items.length) % items.length
                : Math.max(current - 1, 0);
        }
        else if (direction === "first") {
            next = 0;
        }
        else if (direction === "last") {
            next = items.length - 1;
        }

        if (next !== undefined) {
            focusAt(next);
        }
    }

    // ── keyboard handler ──────────────────────────────────────────────────

    function handleKeydown (e) {
        const isNext = (orientation !== "vertical"   && e.key === "ArrowRight")
            || (orientation !== "horizontal" && e.key === "ArrowDown");

        const isPrev = (orientation !== "vertical"   && e.key === "ArrowLeft")
            || (orientation !== "horizontal" && e.key === "ArrowUp");

        const isHome  = e.key === "Home";
        const isEnd   = e.key === "End";

        // Space / Enter → select without selectOnFocus
        const isSelect = e.key === " " || e.key === "Enter";

        if (!isNext && !isPrev && !isHome && !isEnd && !isSelect) {
            return;
        }

        e.preventDefault();

        if (isNext)        navigate("next");
        else if (isPrev)   navigate("prev");
        else if (isHome)   navigate("first");
        else if (isEnd)    navigate("last");
        else if (isSelect) {
            // explicitly select whichever item is focused
            const items = getItems();
            const idx = items.findIndex(item => {
                const focusTarget = item.shadowRoot?.querySelector("button") || item;

                return focusTarget === document.activeElement
                    || item === document.activeElement;
            });

            if (idx !== -1) {
                focusedIndex.value = idx;
            }
        }
    }

    container.addEventListener("keydown", handleKeydown);

    // ── cleanup ───────────────────────────────────────────────────────────

    onScopeDispose(() => {
        container.removeEventListener("keydown", handleKeydown);
    });

    return {
        focusedIndex,

        getItems,
        focusAt,
        navigate,
    };
}
