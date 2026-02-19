import { scanBindings, effectScope, runInScope } from "../core/reactive.js";

export class ReactiveComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._mounted = false;
        this._scope   = null;
    }

    // Override this in subclasses
    setup() {
        return {};
    }

    // Override this in subclasses
    template() {
        return "";
    }

    // Override this in subclasses
    style() {
        return "";
    }

    connectedCallback() {
        if (!this._mounted) {
            this.store = this.setup();

            this.shadowRoot.innerHTML = this.style();
            this.shadowRoot.innerHTML += this.template();

            // create a scope that owns every effect and listener created during
            // the scan — stopped in disconnectedCallback to prevent memory leaks
            this._scope = effectScope();

            runInScope(this._scope, () => {
                scanBindings(this.shadowRoot, this.store);
            });

            this._mounted = true;
            this.onMounted?.();
        }
    }

    disconnectedCallback() {
        if (this._scope) {
            this._scope.stop();
            this._scope   = null;
            this._mounted = false;
        }

        this.onUnmounted?.();
    }

    emit(eventName, detail) {
        this.dispatchEvent(new CustomEvent(eventName, {
            detail,
            bubbles: true,
            composed: true
        }));
    }
}
