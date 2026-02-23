import { ReactiveComponent } from "../ReactiveComponent.js";
import { ref, computed, watch, } from "../../core/reactive.js";
import { useFocusTrap, } from "../Composables/useFocusTrap.js";
import { useScrollLock, } from "../Composables/useScrollLock.js";

class Modal extends ReactiveComponent {
    static props = {
        isOpen:         ref(Boolean),
        staticBackdrop: Boolean,
        position:       String,         // "center" | undefined (bottom by default)
        size:           String,         // "small" | "large" | "xlarge" | "full"
        color:          String,         // "light"
    };

    style () {
        return /*html*/`
        <style>
            * {
                box-sizing: border-box;
            }

            :host {
                --height: revert;
                --width: 500px;

                --modal-background: var(--card-bg, #FFFFFF);
                --light-color: var(--page-bg, #f2f2f2);

                --corner-shape: squircle;
                --border-radius: 15px;

                --transition: var(--slow-to-fast, cubic-bezier(0.85, 0.26, 0.55, 1.00));
                --transition-duration: 250ms;

                --z-index: 10000;

                @supports (corner-shape: squircle) {
                    --border-radius: 29px;
                }
            }

            /* ===== Wrapper ===== */

            .hs-modal__wrapper {
                position: fixed;
                inset: 0;
                z-index: var(--z-index);

                display: flex;
                align-items: flex-end;
                justify-content: center;

                visibility: hidden;
                pointer-events: none;

                transition: visibility var(--transition-duration) var(--transition);

                &.open {
                    visibility: visible;
                    pointer-events: auto;
                }

                &.open .hs-modal__backdrop {
                    opacity: 1;
                }

                &.open .dialog {
                    transform: translateY(0) !important;
                }
            }

            /* ===== Backdrop ===== */

            .hs-modal__backdrop {
                position: absolute;
                inset: 0;

                background: rgba(0, 0, 0, 0.5);

                opacity: 0;
                transition: 
                    opacity 200ms var(--transition, ease-in-out),
                    backdrop-filter 200ms var(--transition, ease-in-out);

                backdrop-filter: blur(3px);
            }

            /* ===== Dialog ===== */

            .dialog {
                position: relative;

                display: flex;
                flex-direction: column;

                height: var(--height);
                width: var(--width);
                max-height: 90dvh;

                overflow: auto;

                corner-shape: var(--corner-shape);
                border-radius: var(--border-radius) var(--border-radius) 0 0;

                background: var(--modal-background);

                will-change: transform;
                transform: translateY(100%);
                transition:
                    transform var(--transition-duration) var(--transition),
                    height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

                /* hide scrollbar */
                scrollbar-width: none;
                -ms-overflow-style: none;

                &::-webkit-scrollbar,
                &::-webkit-scrollbar-button {
                    display: none;
                }
            }

            .dialog:focus-visible {
                outline: none;
            }

            /* ===== Position: center ===== */

            :host([position="center"]) {
                .hs-modal__wrapper {
                    align-items: center;
                }

                .dialog {
                    margin: 0 11px;
                    transform: translateY(calc(100% + calc(100dvh - 100%) / 2));
                    border-radius: var(--border-radius);
                }
            }

            /* ===== Size variants ===== */

            :host([size="small"]) {
                --width: 357px;
            }

            :host([size="large"]) {
                --width: 759px;
            }

            :host([size="xlarge"]) {
                --width: 935px;
            }

            :host([size="full"]) {
                --height: 100dvh;
                --width: 100dvw;
                --border-radius: 0;

                .hs-modal__wrapper,
                .dialog {
                    height: 100dvh !important;
                    width: 100dvw !important;
                    max-height: unset;
                }

                ::slotted(hs-modal-body) {
                    --padding: 0;
                }
            }

            /* ===== Color: light ===== */

            :host([color="light"]) {
                .dialog {
                    background: var(--light-color);
                }

                ::slotted(hs-modal-body) {
                    --background: var(--light-color);
                }
            }
        </style>`;
    }

    template () {
        return /*html*/`
        <!-- Wrapper -->
        <div
            ref="modalWrapper"
            class="hs-modal__wrapper"
            [class]="modalWrapperModifier">
            <!-- Backdrop -->
            <div
                class="hs-modal__backdrop"
                tabindex="-1"
                part="backdrop"
                @click="onBackdropClick">
            </div>

            <!-- Dialog -->
            <div
                ref="dialog"
                class="dialog"
                role="dialog"
                aria-modal="true"
                tabindex="-1">
                <slot></slot>
            </div>
        </div>`;
    }

    setup () {
        // Props
        const isOpen          = this.props.isOpen;
        const staticBackdrop  = this.props.staticBackdrop ?? false;

        // Refs
        const dialog          = ref();
        const modalWrapper    = ref();

        // Computed
        const modalWrapperModifier = computed(() => ({
            "open": isOpen.value,
        }));

        // Methods
        const onCloseModal = () => {
            isOpen.value = false;

            this.emit("update:is-open", false);
        };

        const onBackdropClick = () => {
            if (staticBackdrop) {
                return;
            }

            onCloseModal();
        };

        // Focus Trap Composable
        const trap = useFocusTrap(this.shadowRoot, {
            onEscape: onCloseModal,
        });

        // Scroll Lock Composable
        const scroll = useScrollLock();

        // Watchers
        watch(isOpen, (open) => {
            if (open) {
                scroll.lock();
                trap.activate();
            }
            else {
                trap.deactivate();
                scroll.unlock();
            }
        });

        this.addEventListener("hs-modal-close", () => {
            onCloseModal();
        });

        return {
            modalWrapper,
            dialog,
            isOpen,

            modalWrapperModifier,

            onBackdropClick,
        };
    }
}

customElements.define("hs-modal", Modal);
