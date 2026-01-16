
//  ____                 _   _                                 
// |  _ \ ___  __ _  ___| |_(_)_   _____  __   ____ _ _ __ ___ 
// | |_) / _ \/ _` |/ __| __| \ \ / / _ \ \ \ / / _` | '__/ __|
// |  _ <  __/ (_| | (__| |_| |\ V /  __/  \ V / (_| | |  \__ \
// |_| \_\___|\__,_|\___|\__|_| \_/ \___|   \_/ \__,_|_|  |___/
//                                                             


const debug = false;

let activeEffect = null;
let effectStack = [];

const arrayPrototype = Array.prototype;
const arrayMutatorMethods = [
    "push", 
    "pop", 
    "shift", 
    "unshift", 
    "splice", 
    "sort", 
    "reverse"
];

// create a patched array prototype where mutator methods call trigger()
const patchedArrayMethods = Object.create(arrayPrototype);

arrayMutatorMethods.forEach(methodName => {
    const originalMethod = arrayPrototype[methodName];

    // override the method
    patchedArrayMethods[methodName] = function(...args) {
        // call the original array method to mutate the data
        const result = originalMethod.apply(this, args);

        // get the subscribers associated with this array (stored internally)
        const subs = this.__v_subs; 

        // manually trigger the side effects
        if (subs) {
            trigger(subs);
        }

        return result;
    };
});

/* <reactivity-helpers> */
function cleanup(effect) {
    if (!effect.deps) {
        return;
    }
    
    for (let dep of effect.deps) {
        dep.delete(effect);
    }
    
    effect.deps.length = 0;
}
function track(subscribers) {
    if (!activeEffect) {
        return;
    }
    
    if (!subscribers.has(activeEffect)) {
        subscribers.add(activeEffect);
        activeEffect.deps.push(subscribers);

        if (debug) console.debug("tracked effect", (activeEffect.name || "<anonymous>"), "-> subs:", subscribers.size);
    }
}
function trigger(subscribers) {
    if (!subscribers) {
        return;
    }

    const toRun = Array.from(subscribers);
    
    if (debug) console.debug("trigger subscribers:", toRun.length);

    toRun.forEach(fn => fn());
}
/* </reactivity-helpers> */

export function effect(fn) {
    const wrapped = function wrappedEffect() {
        cleanup(wrappedEffect);
        effectStack.push(wrappedEffect);
        activeEffect = wrappedEffect;

        try {
            return fn();
        }
        finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    };

    wrapped.deps = [];
    wrapped();

    return wrapped;
}
export function ref(initialValue) {
    const subs = new Set();

    // Check if the initial value is a plain array
    const isArray = Array.isArray(initialValue);
    
    // If it's an array, attach the subscriber set and the patched prototype
    if (isArray) {
        // Attach subs reference to the array itself for mutator methods to access
        // Use Object.defineProperty to make it non-enumerable
        Object.defineProperty(initialValue, "__v_subs", {
            value: subs,
            enumerable: false,
            writable: true
        });
        
        // Change the array's prototype to use our patched methods
        Object.setPrototypeOf(initialValue, patchedArrayMethods);
    }

    const data = { value: initialValue };

    return new Proxy(data, {
        get(target, prop) {
            if (prop === "value") {
                track(subs);

                return target[prop];
            }
        },
        set(target, prop, newVal) {
            if (prop !== "value") {
                return false;
            }

            // const oldVal = target[prop];
            target[prop] = newVal;

            // if it's a completely new array, patch it.
            if (Array.isArray(newVal) && !newVal.__v_subs) {
                Object.defineProperty(newVal, '__v_subs', {
                    value: subs, // Reuse the existing subs set
                    enumerable: false,
                    writable: true
                });
                Object.setPrototypeOf(newVal, patchedArrayMethods);
            }

            // if the new value is NOT the array, it's an explicit assignment, so trigger normally.

            // if the value IS the array, this trigger is redundant if mutation methods are used,
            // but necessary for replacement like `arrayRef.value = newArray`.
            trigger(subs);

            return true;
        }
    });
}
export function computed(getter) {
    const result = ref();
    
    effect(() => {
        result.value = getter();
    });

    return result;
}

//
//  ____   ___  __  __   ____  _           _ _             
// |  _ \ / _ \|  \/  | | __ )(_)_ __   __| (_)_ __   __ _ 
// | | | | | | | |\/| | |  _ \| | '_ \ / _` | | '_ \ / _` |
// | |_| | |_| | |  | | | |_) | | | | | (_| | | | | | (_| |
// |____/ \___/|_|  |_| |____/|_|_| |_|\__,_|_|_| |_|\__, |
//                                                   |___/ 
//

const scanned = new WeakSet();
const directives = {
    "ref":           bindElementRef,
    "[ref]":         bindElementRef,

    "data-text": 	 bindText,
    "[text]": 	     bindText,

    "data-model": 	 bindModel,
    "[model]": 	     bindModel,

    "data-if": 		 bindIf,
    "[if]": 		 bindIf,

    "data-show": 	 bindShow,
    "[show]": 	     bindShow,

    "data-disabled": bindDisabled,
    "[disabled]":    bindDisabled,

    "data-class":    bindClass,
    "[class]":       bindClass,

    "data-html":     bindHTML,
    "[html]":        bindHTML,
};

export function scanBindings(root = document, store = window) {
    // bind data-for directive first, to handle scoped loop variables
    root.querySelectorAll("[data-for]").forEach(el => {
        if (scanned.has(el)) {
            return;
        }
        scanned.add(el);

        bindFor(el, store);
    });

    // bind all other directives
    root.querySelectorAll("*").forEach(el => {
        // if already scanned skip this element
        if (scanned.has(el)) {
            return;
        }

        // add to scanned elements
        scanned.add(el);

        // bind dynamic attributes
        for (const attr of el.attributes) {
            const { name, value } = attr;

            if (name.startsWith("data-attr-") || name.startsWith(":")) {
                const realAttr = name.startsWith("data-attr-")
                    ? name.replace("data-attr-", "")
                    : name.replace(":", "");
                    
                el.removeAttribute(name);
                bindDynamicAttribute(el, realAttr, value, store);
            }
        }
        
        // bind standard directives
        for (const [attr, fn] of Object.entries(directives)) {
            if (el.hasAttribute(attr)) {
                fn(el, el.getAttribute(attr), store);
            }
        }

        // bind event listeners
        bindEventListeners(el, store);

        // bind curly bracket interpolations
        // exclude script/style tag because we dont need interpolation there
        // and also css and js syntax break the interpolation parsing
        if (
            !el.hasAttribute("data-for")
            && el.tagName !== "SCRIPT"
            && el.tagName !== "STYLE"
        ) {
            processCurlyInterpolations(el, store);
        }
    });
}


/* <binding-helpers> */
function unwrapRef (v) {
    if (
        v 
        && typeof v === "object" 
        && "value" in v
    ) {
        return v.value;
    }

    return v;
}
function evalInScope (expr, store) {
    expr = (expr || "").trim();
    if (!expr) {
        return undefined;
    }

    try {
        const scope = new Proxy(Object.create(null), {
            get(_, key) {
                if (key === Symbol.unscopables) {
                    return undefined;
                }

                return unwrapRef(store[key]);
            },
            has(_, key) {
                return key in store;
            }
        });

        // build function only for non-empty expr
        const fn = new Function("scope", `with(scope) { return (${expr}); }`);
        return fn(scope);
    } 
    catch (e) {
        console.error("evalInScope error:", expr, e);
        return undefined;
    }
}
function isInsideNestedFor (node, topRoot) {
    let el = node.parentElement;

    while (el && el !== topRoot) {
        if (el.hasAttribute && el.hasAttribute("data-for")) {
            return true
        }

        el = el.parentElement;
    }

    return false;
}
function isInsideIgnoredTag (node, root) {
    let currentNode = node;
    // Walk up the DOM tree from the text node
    while (currentNode && currentNode !== root) {
        // Check if the current node is an Element node and one of the ignored tag names
        if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const tagName = currentNode.tagName.toUpperCase();

            if (
                tagName === 'SCRIPT' 
                || tagName === 'STYLE'
            ) {
                return true;
            }
        }
        currentNode = currentNode.parentNode;
    }
    return false;
}
function processCurlyInterpolations (root, scope) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];

    let node;
    while ((node = walker.nextNode())) {
        // Skip nested data-for so inner pass handles its own scopes
        if (
            isInsideNestedFor(node, root)
            || isInsideIgnoredTag(node, root)
        ) {
            continue;
        }

        // match { expr }
        if (/\{[^}]+\}/.test(node.textContent)) {
            textNodes.push(node);
        }
    }

    textNodes.forEach(node => bindCurlyInterpolations(node, scope));
}
function setDeep (store, expr, value) {
    if (!expr || !expr.trim()) {
        return;
    }

    const parts = expr.split(".");
    if (parts.length === 0) {
        return;
    }

    const baseKey = parts[0];
    let base = store[baseKey];

    // Base could be a ref or a plain value
    let baseIsRef = base && typeof base === "object" && "value" in base;

    // If single-level key, set directly
    if (parts.length === 1) {
        if (baseIsRef) {
            base.value = value;
        } 
        else {
            store[baseKey] = value;
        }
        return;
    }

    // If multi-level (like user.name)
    // make sure base is an object, otherwise replace it
    let obj = baseIsRef ? base.value : base;

    if (obj == null || typeof obj !== "object") {
        obj = {};

        if (baseIsRef) {
            base.value = obj;
        } 
        else {
            store[baseKey] = obj;
        }
    }

    for (let i = 1; i < parts.length - 1; i++) {
        const k = parts[i];
        
        if (!(k in obj) || obj[k] == null || typeof obj[k] !== "object") {
            obj[k] = {};
        }

        obj = obj[k];
    }

    const last = parts[parts.length - 1];
    const target = obj[last];

    if (target && typeof target === "object" && "value" in target) {
        target.value = value;
    } 
    else {
        obj[last] = value;
    }

    if (baseIsRef) {
        base.value = base.value; // trigger reactive update
    }
}
/* </binding-helpers> */


/* <binding-functions> */
function bindFor (el, store) {
    const parent = el.parentNode;
    const comment = document.createComment("v-for placeholder");
    parent.replaceChild(comment, el); // remove template

    const expr = el.getAttribute("data-for");
    // match: (item, index) of items
    // match: item of items
    const match = expr.match(/\(?\s*(\w+)(?:\s*,\s*(\w+))?\s*\)?\s+of\s+(.+)/);
    if (!match) {
        console.error("Invalid data-for expression:", expr);
        return;
    }
    const [, loopVar, indexVar, arrayExpr] = match;

    let children = [];

    effect(() => {
        // IMPORTANT: use the `store` param so when this bindFor is called inside a clone
        // it will evaluate arrayExpr against the scoped store.
        const arr = evalInScope(arrayExpr, store) || [];

        // remove previous clones
        children.forEach(node => node.remove());
        children = [];

        arr.forEach((item, index) => {
            const clone = el.cloneNode(true);
            clone.removeAttribute("data-for");

            // scoped store — keep parent store as separate reference (no prototype chain confusion)
            // we'll pass `scoped` to scanBindings so inner bindFor will receive it as `store`
            const scoped = Object.create(store);
            // copy parent's top-level keys access via a special reference used by evalInScope:
            // we will pass an object that the evalInScope() function will treat as `store`.
            // To keep things simple, we keep `parentStore` reference and let evalInScope use it,
            // so here we attach a __parentStore reference used below in evalInScope if needed.
            // (Alternatively you can create scoped fallback in evalInScope itself.)
            // but simplest: storeParent reference accessible from closure:
            // We'll build a minimal wrapper used only for nested bindFor evaluation:
            const parentStore = store;

            // Put loop vars into scoped
            scoped[loopVar] = item;
            if (indexVar) {
                scoped[indexVar] = index;
            }

            processCurlyInterpolations(clone, scoped);

            // Remove scanned marks for nested data-for elements to allow nested loops to be scanned again
            clone.querySelectorAll("[data-for]").forEach(n => scanned.delete(n));
            scanned.delete(clone);

            // Create scoped store for the children of the outer loop
            const scopedForBindings = new Proxy(scoped, {
                get(target, key) {
                    if (key === Symbol.unscopables) {
                        return undefined;
                    }
                    if (key in target) {
                        return target[key];
                    }

                    return unwrapRef(parentStore[key]);
                },
                has(_, key) {
                    return (key in scoped) || (key in parentStore);
                }
            });

            // Re-scan the children of the clone with new scoped store
            scanBindings(clone, scopedForBindings);

            parent.insertBefore(clone, comment);
            children.push(clone);
        });
    });
}
function bindElementRef (el, name, store) {
    if (!name) {
        return;
    }

    if (!store[name]) {
        store[name] = ref(null);
    }
    
    store[name].value = el;
}
function bindText (el, expr, store) {
    effect(() => {
        const result = evalInScope(expr, store);
        el.textContent = result == null ? "" : result;
    });
}
function bindHTML (el, expr, store) {
    effect(() => {
        const result = evalInScope(expr, store);
        el.innerHTML = result == null ? "" : result;
    });
}
function bindModel (el, expr, store) {
    if (el.type === "checkbox" || el.tagName === "HS-TOGGLE") {
        // When store changes -> update component
        effect(() => {
            const val = evalInScope(expr, store);
            el.checked = !!val;
        });

        // When component changes -> update store
        el.addEventListener("change", e => {
            setDeep(store, expr, e.target.checked);
        });
    }
    else if (el.type === "radio") {
        effect(() => {
            const val = evalInScope(expr, store);
            el.checked = val === el.value;
        });

        el.addEventListener("change", e => {
            if (e.target.checked) {
                setDeep(store, expr, el.value);
            }
        });
    }
    else if (el.tagName === "HS-SEGMENT" || el.tagName === "HS-SELECT") {
        effect(() => {
            const val = evalInScope(expr, store);
            if (el.value !== val) el.value = val;
        });

        el.addEventListener("change", () => {
            setDeep(store, expr, el.value);
        });
    }
    else {
        effect(() => {
            const val = evalInScope(expr, store);
            el.value = val ?? "";
        });

        el.addEventListener("input", e => {
            setDeep(store, expr, e.target.value);
        });
    }
}
function bindIf (el, expr, store) {
    if (debug) console.log("bind-if");

    const parent = el.parentNode;
    const comment = document.createComment("v-if placeholder");
    parent.replaceChild(comment, el);
    let isInserted = false;

    effect(() => {
        if (debug) console.log("expr:", expr, "→", evalInScope(expr, store));

        const show = !!evalInScope(expr, store);
        
        if (debug) console.log("show:", expr, show)

        if (show && !isInserted) {
            parent.insertBefore(el, comment);
            isInserted = true;
        } 
        else if (!show && isInserted) {
            if (el.parentNode) {
                parent.replaceChild(comment, el)
            }
            isInserted = false;
        }
    });
}
function bindShow (el, expr, store) {
    const originalDisplay = getComputedStyle(el).display || "";

    effect(() => {
        const visible = !!evalInScope(expr, store);

        if (visible) {
            el.style.setProperty("display", originalDisplay, "");
        } 
        else {
            el.style.setProperty("display", "none", "important");
        }
    });
}
function bindDisabled (el, expr, store) {
    effect(() => {
        el.disabled = !!evalInScope(expr, store);
    });
}
function bindClass (el, expr, store) {
    const staticClasses = new Set(el.className.split(/\s+/).filter(Boolean));

    effect(() => {
        el.className = [...staticClasses].join(" ");
        const value = evalInScope(expr, store);

        if (typeof value === "string") {
            if (value.trim()) el.classList.add(...value.split(/\s+/));
        } 
        else if (Array.isArray(value)) {
            el.classList.add(...value);
        } 
        else if (value && typeof value === "object") {
            Object.entries(value).forEach(([cls, active]) => {
                if (active) {
                    el.classList.add(...cls.split(/\s+/));
                }
            });
        }
    });
}
function bindDynamicAttribute (el, attrName, expr, store) {
    // When store changes -> update component
    effect(() => {
        const value = evalInScope(expr, store);

        if (value === null) {
            el.removeAttribute(attrName);
        } 
        else {
            el.setAttribute(attrName, value);
        }
    });
}
function bindCurlyInterpolations (node, scope) {
    const original = node.textContent;

    // Find all { expr } occurrences
    const matches = [...original.matchAll(/\{([^}]+)\}/g)];
    if (matches.length === 0) {
        return;
    }

    // Split into static + dynamic parts
    const parts = [];
    let lastIndex = 0;

    for (const match of matches) {
        const [full, expr] = match;
        const idx = match.index;

        if (idx > lastIndex) {
            parts.push({ type: "static", value: original.slice(lastIndex, idx) });
        }

        parts.push({ type: "expr", expr: expr.trim() });
        lastIndex = idx + full.length;
    }

    if (lastIndex < original.length) {
        parts.push({ type: "static", value: original.slice(lastIndex) });
    }

    // Turn the whole text node into a sequence of child text nodes
    node.textContent = "";
    const nodes = parts.map(p => {
        const n = document.createTextNode(p.type === "static" ? p.value : "");

        node.parentNode.insertBefore(n, node);

        return { p, n };
    });
    // remove original template node
    node.remove();

    // Create one effect per expr-part
    nodes.forEach(({ p, n }) => {
        if (p.type !== "expr") {
            return;
        }

        effect(() => {
            const v = evalInScope(p.expr, scope);
            n.textContent = v == null ? "" : String(v);
        });
    });
}
function bindEventListeners (el, store) {
    for (const attr of el.attributes) {
        const { name, value } = attr;
        
        if (name.startsWith("data-on") || name.startsWith("@")) {
            const eventName = name.startsWith("data-on")
                ? name.replace("data-on", "").toLowerCase()
                : name.replace("@", "");

            const match = value.match(/^(\w+)(?:\((.*)\))?$/);
            if (!match) {
                continue;
            }

            const [, fnName, argsStr] = match;
            
            const fn = store[fnName];
            if (typeof fn !== "function") {
                continue;
            }

            el.addEventListener(eventName, e => {
                let args = [];

                if (argsStr) {
                    args = argsStr.split(",").map(arg => {
                        arg = arg.trim();

                        // check for string
                        if (
                            (arg.startsWith("'") && arg.endsWith("'"))
                            || (arg.startsWith('"') && arg.endsWith('"'))
                        ) {
                            return arg.slice(1, -1); // remove quotes
                        }

                        // check for stored variables/refs
                        if (arg in store) {
                            return unwrapRef(store[arg]);
                        }

                        // check for numbers
                        if (!isNaN(arg) && arg.trim() !== "") {
                            return Number(arg);
                        }
                        
                        // return as it is
                        return arg;
                    });
                }
                
                // execute function with args and pass event as last arg
                fn(...args, e);
            });
        }
    }
}
/* </binding-functions> */


//  _____                 _       
// | ____|_   _____ _ __ | |_ ___ 
// |  _| \ \ / / _ \ '_ \| __/ __|
// | |___ \ V /  __/ | | | |_\__ \
// |_____| \_/ \___|_| |_|\__|___/
//                                

const events = {};

/* <events> */
export function on(eventName, handler) {
    (events[eventName] ||= []).push(handler);
}
export function emit(eventName, ...values) {
    (events[eventName] || []).forEach(fn => fn(...values));
}
export function defineEmits(allowedEvents) {
    return (eventName, ...values) => {
        if (!allowedEvents.includes(eventName)) {
            console.warn(`[emit] Event "${eventName}" is not declared in defineEmits`);
            return;
        }
        emit(eventName, ...values);
    };
}
/* </events> */
