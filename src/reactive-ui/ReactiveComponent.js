import { ref, scanBindings, effectScope, runInScope, } from "../core/reactive.js";

export class ReactiveComponent extends HTMLElement {
    constructor () {
        super();
        this.attachShadow({ mode: "open" });
        this._mounted = false;
        this._scope   = effectScope();
        this.props    = {};
    }

    // override this in subclasses
    setup () {
        return {};
    }

    // override this in subclasses
    template () {
        return "";
    }

    // override this in subclasses
    style () {
        return "";
    }

    // ── props ─────────────────────────────────────────────────────────────────

    // derived automatically from static props so the browser calls
    // attributeChangedCallback for every declared prop attribute.
    // keys are camelCase in static props, but HTML attributes are always
    // lowercase/kebab, so we convert here.
    static get observedAttributes () {
        const propsDef = this.props;

        if (!propsDef) {
            return [];
        }

        return Object.keys(propsDef).map(toKebab);
    }

    _buildProps () {
        const propsDef = this.constructor.props;

        if (!propsDef) {
            return;
        }

        for (const [camelKey, declaration] of Object.entries(propsDef)) {
            const isReactive = isReactivePropMarker(declaration);
            const type       = isReactive ? declaration.value : declaration;
            const rawValue   = this.getAttribute(toKebab(camelKey));
            const coerced    = coerceProp(rawValue, type);

            if (isReactive) {
                this.props[camelKey] = ref(coerced);
            }
            else {
                this.props[camelKey] = coerced;
            }
        }
    }

    attributeChangedCallback (name, oldValue, newValue) {
        // name arrives in kebab-case from the browser — convert to camelCase
        // to look it up in static props
        const camelKey = toCamel(name);
        const propsDef = this.constructor.props;

        if (!propsDef || !(camelKey in propsDef)) {
            throw new Error(`ReactiveComponent: attribute "${name}" is not declared in static props.`);
        }

        // only act after mount — _buildProps handles initial values
        if (!this._mounted) {
            return;
        }

        const declaration = propsDef[camelKey];
        const isReactive  = isReactivePropMarker(declaration);
        const type        = isReactive ? declaration.value : declaration;
        const coerced     = coerceProp(newValue, type);

        if (isReactive) {
            // update the existing ref so any bound DOM reacts automatically
            this.props[camelKey].value = coerced;
        }
        else {
            // non-reactive prop: just update the plain value, no DOM reaction
            this.props[camelKey] = coerced;
        }
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    connectedCallback () {
        if (!this._mounted) {
            this._buildProps();

            runInScope(this._scope, () => {
                this.store = this.setup();

                this.shadowRoot.innerHTML = this.style() + this.template();

                scanBindings(this.shadowRoot, this.store);
            });

            this._mounted = true;
            this.onMounted?.();
        }
    }

    disconnectedCallback () {
        this.onUnmounted?.();
        this._scope.stop();
        this._mounted = false;
    }

    // ── events ────────────────────────────────────────────────────────────────

    emit (eventName, detail) {
        this.dispatchEvent(new CustomEvent(eventName, {
            detail,
            bubbles:  true,
            composed: true
        }));
    }
}

// sentinel used to detect reactive prop declarations: { count: ref(Number) }
// ref(Number) calls ref() with a constructor function as the initial value.
// we detect it by checking if the declaration is a ref-like object whose
// .value is a constructor function (String, Number, Boolean, Array, Object).
function isReactivePropMarker (val) {
    return (
        val !== null
        && typeof val === "object"
        && "value" in val
        && typeof val.value === "function"
    );
}

// camelCase  →  kebab-case   (myProp → my-prop)
function toKebab (str) {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

// kebab-case  →  camelCase   (my-prop → myProp)
function toCamel (str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// coerce a raw attribute string to the declared type
function coerceProp (raw, type) {
    if (raw === null || raw === undefined) {
        return undefined;
    }

    switch (type) {
        case Boolean:
            // presence of the attribute means true; "false" string means false
            return raw !== "false";

        case Number:
            return Number(raw);

        case Array:
        case Object:
            try {
                return JSON.parse(raw);
            }
            catch {
                console.error(`ReactiveComponent: could not parse prop as ${type === Array ? "Array" : "Object"}:`, raw);
                return type === Array ? [] : {};
            }

        case String:
        default:
            return raw;
    }
}
