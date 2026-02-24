import { ReactiveComponent } from "../../ReactiveComponent.js";
import { ref, watch, } from "../../../core/reactive.js";
import { useRovingFocus, } from "../../Composables/useRovingFocus.js";

class Segment extends ReactiveComponent {
    static props = {
        value:         ref(String),
        selectOnFocus: Boolean,
    };

    // Style
    style () {
        return /*html*/`
        <style>
            * {
                box-sizing: border-box;
            }

            :host {
                --segment-bg: var(--page-bg, #ECECEC);

                --corner-shape: squircle;
                --border-radius: 9px;

                @supports (corner-shape: squircle) {
                    --border-radius: 29px;
                }
            }

            :host {
                display: inline-flex;

                width: 100%;
                overflow: auto;

                corner-shape: var(--corner-shape);
                border-radius: var(--border-radius);

                background: var(--segment-bg, #FFFFFF);

                /* remove scrollbar */
                scrollbar-width: none;

                -ms-overflow-style: none;

                &::-webkit-scrollbar,
                &::-webkit-scrollbar-button {
                    display: none;
                }
            }
        </style>`;
    }

    // Template
    template () {
        return /*html*/`<slot></slot>`;
    }

    // Setup
    setup () {
        // Props
        const value         = this.props.value;
        const selectOnFocus = this.props.selectOnFocus ?? false;

        // Roving Focus Composable
        const roving = useRovingFocus(this, {
            selector:      "hs-segment-button:not([disabled])",
            orientation:   "horizontal",
            selectOnFocus: selectOnFocus,
        });

        // Click delegation
        this.addEventListener("click", (e) => {
            const btn = e.target.closest("hs-segment-button");

            if (!btn || btn.hasAttribute("disabled")) {
                return;
            }

            value.value = btn.getAttribute("value");
        });

        // Keyboard nav → selection
        watch(roving.focusedIndex, (index) => {
            if (index < 0) {
                return;
            }

            const items = roving.getItems();
            const btn   = items[index];

            if (!btn) {
                return;
            }

            value.value = btn.getAttribute("value");
        });

        // Value change (from any source) → sync DOM + notify SegmentView
        watch(value, (newValue) => {
            this._syncActiveState(newValue);

            // tell the linked SegmentView to scroll to the right content
            const contentId = this._getContentIdForValue(newValue);

            if (contentId && this._view) {
                this._view.scrollToContent(contentId);
            }

            // keep roving index aligned so next arrow key starts correctly
            const items = roving.getItems();
            const index = items.findIndex(btn => btn.getAttribute("value") === newValue);

            if (index !== -1 && roving.focusedIndex.value !== index) {
                roving.focusAt(index, { select: false });
            }
        });

        return { value };
    }

    // Lifecycle
    onMounted () {
        // Accessibility
        this.setAttribute("role", "radiogroup");

        if (
            !this.hasAttribute("aria-label")
            && !this.hasAttribute("aria-labelledby")
        ) {
            this.setAttribute("aria-label", "Choose an option");
        }

        // Default to first button's value if none provided
        if (!this.props.value.value) {
            const firstButton = this.querySelector("hs-segment-button");

            if (firstButton) {
                this.props.value.value = firstButton.getAttribute("value");
            }
        }
        else {
            // sync initial state
            this._syncActiveState(this.props.value.value);
        }
    }

    // Public
    _registerView (view) {
        this._view = view;
    }

    // called by SegmentView when a swipe settles on a new content panel
    selectByContentId (contentId) {
        const buttons = [...this.querySelectorAll("hs-segment-button")];
        const btn = buttons.find(b => b.getAttribute("content-id") === contentId);

        if (btn) {
            this.props.value.value = btn.getAttribute("value");
        }
    }

    // Private
    _getContentIdForValue (targetValue) {
        const buttons = [...this.querySelectorAll("hs-segment-button")];
        const btn = buttons.find(b => b.getAttribute("value") === targetValue);

        return btn?.getAttribute("content-id") ?? null;
    }

    _syncActiveState (targetValue) {
        const buttons = [...this.querySelectorAll("hs-segment-button")];

        buttons.forEach(btn => {
            const isActive = btn.getAttribute("value") === targetValue;

            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-checked", String(isActive));

            const inner = btn.shadowRoot?.querySelector("button");

            if (inner) {
                inner.setAttribute("tabindex", isActive ? "0" : "-1");
            }

            if (isActive) {
                btn.scrollIntoView({
                    behavior: "smooth",
                    block:    "nearest",
                    inline:   "center",
                });
            }
        });
    }
}

customElements.define("hs-segment", Segment);
