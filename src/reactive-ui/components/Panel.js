import { ReactiveComponent } from "../ReactiveComponent.js";
import { ref, computed, watch, } from "../../core/reactive.js";
import { useFocusTrap, } from "../Composables/useFocusTrap.js";
import { useScrollLock, } from "../Composables/useScrollLock.js";

class Panel extends ReactiveComponent {
    static props = {
        isOpen: ref(Boolean),
        staticBackdrop: Boolean,
    };

    style () {
        return /*html*/`
        <style>
            * {
                box-sizing: border-box;
            }

            :host {
                /* variables */
                --z-index: 1030;

                --height: 100dvh;
                --width: 500px;
                --max-width: 95dvw;

                --background: var(--card-bg, #FFFFFF);
                
                --transition: var(--slow-to-fast, cubic-bezier(0.85, 0.26, 0.55, 1.00));
            }

            .hs-panel__wrapper {
                position: fixed;
                inset: 0;
                z-index: var(--z-index, 1000);
                pointer-events: none;

                &.open {
                    pointer-events: auto;
                }

                &.open .hs-panel__backdrop {
                    opacity: 1;
                }

                &.open .panel {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            .hs-panel__backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, .45);

                opacity: 0;
                transition: 
                    opacity 200ms var(--transition, ease-in-out),
                    backdrop-filter 200ms var(--transition, ease-in-out);

                backdrop-filter: blur(3px);
            }

            .panel {
                position: absolute;
                right: 0;
                top: 0;
                z-index: 10000;

                height: var(--height);
                width: var(--width);
                max-width: var(--max-width);
                overflow: auto;

                background: var(--background);

                /* closed state */
                transform: translateX(100%);
                opacity: 0.87;

                transition:
                    opacity   250ms var(--transition),
                    transform 250ms var(--transition);
            }

            .panel:focus-visible {
                outline: none;

                box-shadow: 0 0 0 5px 
                    color-mix(in srgb, var(--main-color) 60%, transparent);
            }
        </style>`;
    }

    template () {
        return /*html*/`
        <!-- Wrapper -->
        <div 
            ref="panelWrapper"
            class="hs-panel__wrapper"
            [class]="panelWrapperModifier">
            <!-- Backdrop -->
            <div 
                class="hs-panel__backdrop" 
                tabindex="-1" 
                part="backdrop"
                @click="onBackdropClick">
            </div>

            <!-- Panel -->
            <div 
                ref="panel"
                class="panel"
                role="dialog" 
                aria-modal="true"
                tabindex="-1">
                <slot></slot>
            </div>
        </div>`;
    }

    setup () {
        // Props
        const isOpen = this.props.isOpen;
        const staticBackdrop = this.props.staticBackdrop ?? false;

        // Refs
        const panel = ref();
        const panelWrapper = ref();

        // Computed
        const panelWrapperModifier = computed(() => ({
            "open": isOpen.value,
        }));

        // Methods
        const onClosePanel = () => {
            isOpen.value = false;
            this.emit("update:is-open", false);
        };

        const onBackdropClick = () => {
            if (staticBackdrop) {
                return;
            }

            onClosePanel();
        };

        // Focus Trap Composable
        const trap = useFocusTrap(this.shadowRoot, {
            onEscape: onClosePanel,
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

        return {
            panelWrapper,
            panel,
            isOpen,

            panelWrapperModifier,

            onBackdropClick,
        };
    }
}

customElements.define("hs-panel", Panel);
