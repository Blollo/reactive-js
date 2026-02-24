import { ReactiveComponent } from "../../ReactiveComponent.js";
import { ref, } from "../../../core/reactive.js";
import { useSnapScroll, } from "../../Composables/useSnapScroll.js";

class SegmentView extends ReactiveComponent {

    // Style
    style () {
        return /*html*/`
        <style>
            :host {
                --transition: var(--slow-to-fast, cubic-bezier(0.85, 0.26, 0.55, 1.00));

                display: block;
                overflow: hidden;

                transition: height 200ms var(--transition);
                will-change: height;

                interpolate-size: allow-keywords;
            }

            .scroll-container {
                display: flex;
                overflow-x: auto;
                scroll-snap-type: x mandatory;

                /* remove scrollbar */
                scrollbar-width: none;
                -ms-overflow-style: none;

                &::-webkit-scrollbar,
                &::-webkit-scrollbar-button {
                    display: none;
                }
            }

            ::slotted(hs-segment-content) {
                flex: 0 0 100%;
                scroll-snap-align: start;
                overflow: auto;
            }
        </style>`;
    }

    template () {
        return /*html*/`
        <div ref="scrollContainer" class="scroll-container">
            <slot></slot>
        </div>`;
    }

    // Setup
    setup () {
        // Refs
        const scrollContainer = ref();

        // Snap Scroll Composable (deferred init — DOM doesn't exist yet)
        const snap = useSnapScroll({
            onSnap: (index) => {
                const content = this._contents[index];

                if (!content) {
                    return;
                }

                // sync height to the newly active panel
                this._syncHeight(content);

                // notify the linked Segment
                if (this._segment) {
                    this._segment.selectByContentId(content.id);
                }
            },
        });

        // expose for lifecycle + public API
        this._snap = snap;

        return { scrollContainer };
    }

    // Lifecycle
    onMounted () {
        this._contents = [...this.querySelectorAll("hs-segment-content")];

        // init snap scroll on the actual DOM element
        const container = this.store.scrollContainer.value;
        this._snap.init(container);

        // auto-discover sibling Segment
        this._segment = this._findSegment();

        if (this._segment) {
            this._segment._registerView(this);

            // defer initial scroll so dynamic attribute bindings (e.g. :value)
            // have had time to settle — microtask effects run before rAF, so
            // by this point the Segment's value ref holds the final value
            requestAnimationFrame(() => {
                const contentId = this._segment._getContentIdForValue(
                    this._segment.props.value.value
                );

                if (contentId) {
                    this.scrollToContent(contentId, { behavior: "instant" });
                }
            });
        }

        // observe dynamic height changes on content panels
        this._resizeObserver = new ResizeObserver(() => {
            const active = this._contents[this._snap.activeIndex.value];

            if (active) {
                this._syncHeight(active);
            }
        });

        this._contents.forEach(c => this._resizeObserver.observe(c));
    }

    onUnmounted () {
        this._snap.destroy();

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
    }

    // Public
    scrollToContent (contentId, { behavior = "smooth" } = {}) {
        const index = this._contents.findIndex(c => c.id === contentId);

        if (index === -1) {
            return;
        }

        // already showing this content — skip the programmatic scroll
        // so we don't activate suppress and block the next user swipe
        if (this._snap.activeIndex.value === index) {
            return;
        }

        this._snap.scrollToIndex(index, { behavior });
        this._syncHeight(this._contents[index]);
    }

    // Private
    _syncHeight (activeContent) {
        this.style.height = `${activeContent.scrollHeight}px`;
    }

    _findSegment () {
        // walk previous siblings first (most common layout)
        let sibling = this.previousElementSibling;

        while (sibling) {
            if (sibling.matches("hs-segment")) {
                return sibling;
            }

            // check inside wrapper elements (e.g. a toolbar containing the segment)
            const nested = sibling.querySelector("hs-segment");

            if (nested) {
                return nested;
            }

            sibling = sibling.previousElementSibling;
        }

        // fall back to parent's children
        return this.parentElement?.querySelector(":scope > hs-segment") ?? null;
    }
}

customElements.define("hs-segment-view", SegmentView);
