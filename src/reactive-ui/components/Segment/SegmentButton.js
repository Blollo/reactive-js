import { ReactiveComponent } from "../../ReactiveComponent.js";

class SegmentButton extends ReactiveComponent {
    static props = {
        value:     String,
        contentId: String,
    };

    // Style
    style () {
        return /*html*/`
        <style>
            * {
                box-sizing: border-box;
            }

            :host {
                --color: var(--text-color, #333);
                --color-checked: var(--main-color, #007AFF);
                --background: transparent;
                --background-checked: var(--card-bg, #FFFFFF);
                --indicator-color: var(--main-color, #007AFF);

                --corner-shape: squircle;
                --border-radius: 7px;

                --transition: var(--slow-to-fast, cubic-bezier(0.85, 0.26, 0.55, 1.00));

                @supports (corner-shape: squircle) {
                    --border-radius: 25px;
                }

                display: inline-flex;
                flex: 1 1 0%;
                min-width: 0;
            }

            button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;

                width: 100%;
                min-height: 32px;
                padding: 4px 12px;
                margin: 3px;

                border: none;
                cursor: pointer;

                corner-shape: var(--corner-shape);
                border-radius: var(--border-radius);

                background: var(--background);
                color: var(--color);

                font: inherit;
                font-size: 13px;
                font-weight: 500;
                white-space: nowrap;

                transition:
                    background 200ms var(--transition),
                    color 200ms var(--transition);

                &:focus-visible {
                    outline: 2px solid var(--indicator-color);
                    outline-offset: -2px;
                }
            }

            :host(.active) button {
                background: var(--background-checked);
                color: var(--color-checked);
            }

            :host([disabled]) {
                opacity: 0.4;
                pointer-events: none;
            }
        </style>`;
    }

    // Template
    template () {
        return /*html*/`
        <button
            role="radio"
            tabindex="-1"
            part="native">
            <slot></slot>
        </button>`;
    }

    // Setup
    setup () {
        return {};
    }

    // Lifecycle
    onMounted () {
        this.setAttribute("aria-checked", "false");
    }
}

customElements.define("hs-segment-button", SegmentButton);
