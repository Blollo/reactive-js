//  ____                 _   _                                 
// |  _ \ ___  __ _  ___| |_(_)_   _____  __   ____ _ _ __ ___ 
// | |_) / _ \/ _` |/ __| __| \ \ / / _ \ \ \ / / _` | '__/ __|
// |  _ <  __/ (_| | (__| |_| |\ V /  __/  \ V / (_| | |  \__ \
// |_| \_\___|\__,_|\___|\__|_| \_/ \___|   \_/ \__,_|_|  |___/
//


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
    patchedArrayMethods[methodName] = function (...args) {
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
const effectQueue = new Set();
let isFlushing = false;
let isFlushPending = false;

function cleanup (effect) {
    if (!effect.deps) {
        return;
    }

    for (let dep of effect.deps) {
        dep.delete(effect);
    }

    effect.deps.length = 0;
}
function track (subscribers) {
    if (!activeEffect) {
        return;
    }

    if (!subscribers.has(activeEffect)) {
        subscribers.add(activeEffect);
        activeEffect.deps.push(subscribers);
    }
}
function queueEffect (effect) {
    if (!effectQueue.has(effect)) {
        effectQueue.add(effect);

        if (!isFlushing && !isFlushPending) {
            isFlushPending = true;
            queueMicrotask(flushEffectQueue);
        }
    }
}
const MAX_FLUSH_ITERATIONS = 100;

function flushEffectQueue () {
    isFlushPending = false;
    isFlushing = true;

    let iterations = 0;

    try {
        while (effectQueue.size > 0) {
            if (++iterations > MAX_FLUSH_ITERATIONS) {
                effectQueue.clear();
                throw new Error(
                    `[reactive] Possible infinite reactive loop detected: ` +
                    `effect queue was still non-empty after ${MAX_FLUSH_ITERATIONS} flush iterations.`
                );
            }

            const effects = Array.from(effectQueue);
            effectQueue.clear();

            for (const fn of effects) {
                if (!fn.stopped) {
                    fn();
                }
            }
        }
    }
    finally {
        isFlushing = false;
    }
}
function trigger (subscribers) {
    if (!subscribers) {
        return;
    }

    const toRun = Array.from(subscribers);

    // separate sync and async effects
    const syncEffects = [];
    const asyncEffects = [];

    toRun.forEach(fn => {
        if (fn.sync) {
            syncEffects.push(fn);
        }
        else {
            asyncEffects.push(fn);
        }
    });

    // run sync effects immediately
    syncEffects.forEach(fn => {
        if (!fn.stopped) {
            fn();
        }
    });

    // queue async effects for batching
    asyncEffects.forEach(fn => queueEffect(fn));
}
/* </reactivity-helpers> */


// ── effect scope ──────────────────────────────────────────────────────────────
//
// an EffectScope is an owner that collects every effect created inside it.
// calling scope.stop() stops them all in one shot, including child scopes.
// this is the mechanism that prevents detached dom nodes from being kept alive
// by effects that belong to removed loop iterations or hidden conditional branches.
//

class EffectScope {
    constructor (parent = null) {
        this.effects  = [];
        this.children = [];
        this.stopped  = false;

        if (parent) {
            parent.children.push(this);
        }
    }

    add (eff) {
        this.effects.push(eff);
    }

    stop () {
        if (this.stopped) {
            return;
        }

        this.stopped = true;

        for (let eff of this.effects) {
            eff.stop();
        }

        for (let child of this.children) {
            child.stop();
        }

        this.effects  = [];
        this.children = [];
    }
}

// the currently active scope — every effect() call registers itself here
let activeScope = null;

export function effectScope (parent) {
    return new EffectScope(parent ?? activeScope);
}
export function runInScope (scope, fn) {
    const prev = activeScope;
    activeScope = scope;

    try {
        return fn();
    }
    finally {
        activeScope = prev;
    }
}

// register a cleanup callback with the currently active scope.
// when the scope is stopped the callback is invoked automatically.
// this lets composable helpers hook into the teardown lifecycle without
// coupling to ReactiveComponent internals.
export function onScopeDispose (fn) {
    if (activeScope && !activeScope.stopped) {
        activeScope.add({ stop: fn });
    }
}

// ─────────────────────────────────────────────────────────────────────────────

export function effect (fn, options = {}) {
    const wrapped = function wrappedEffect () {
        // don't run if stopped
        if (wrapped.stopped) {
            return;
        }

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

    wrapped.deps    = [];
    wrapped.stopped = false;
    wrapped.sync    = options.sync || false;

    // add a stop method to clean up and prevent future runs
    wrapped.stop = function () {
        if (!wrapped.stopped) {
            cleanup(wrapped);
            // remove from queue immediately so stopped effects don't linger until next flush
            effectQueue.delete(wrapped);
            wrapped.stopped = true;
        }
    };

    // register with the active scope so it can be bulk-stopped later
    if (activeScope && !activeScope.stopped) {
        activeScope.add(wrapped);
    }

    wrapped();

    return wrapped;
}
function createArrayProxy (arr, subs) {
    // attach subs reference and patched methods
    Object.defineProperty(arr, "__v_subs", {
        value: subs,
        enumerable: false,
        writable: true
    });
    Object.setPrototypeOf(arr, patchedArrayMethods);

    // wrap in proxy to intercept index assignments
    return new Proxy(arr, {
        set (target, prop, value) {
            // check if it's a numeric index
            const index = Number(prop);

            if (!isNaN(index) && index >= 0) {
                target[prop] = value;
                trigger(subs);

                return true;
            }

            // for other properties, set normally
            target[prop] = value;

            return true;
        }
    });
}

export function ref (initialValue) {
    const subs = new Set();

    // if it's an array, wrap it in a proxy
    if (Array.isArray(initialValue)) {
        initialValue = createArrayProxy(initialValue, subs);
    }

    const data = { value: initialValue };

    return new Proxy(data, {
        get (target, prop, receiver) {
            if (prop === "value") {
                track(subs);

                return target[prop];
            }

            // fall through for all other properties (Symbol.toPrimitive,
            // Symbol.toStringTag, toJSON, etc.) so the ref behaves like
            // a normal object for inspection, serialisation, and duck-typing
            return Reflect.get(target, prop, receiver);
        },
        set (target, prop, newVal) {
            if (prop !== "value") {
                return false;
            }

            // if it's a new array, wrap it in a proxy
            if (Array.isArray(newVal) && !newVal.__v_subs) {
                newVal = createArrayProxy(newVal, subs);
            }

            // skip trigger if the value hasn't changed.
            // arrays are exempt: their mutations go through the patched prototype
            // and trigger directly, so identity equality would wrongly suppress them.
            if (!Array.isArray(newVal) && target[prop] === newVal) {
                return true;
            }

            target[prop] = newVal;
            trigger(subs);

            return true;
        }
    });
}

// weakmap to cache reactive proxies
const reactiveMap = new WeakMap();

export function reactive (target) {
    if (!target || typeof target !== "object") {
        console.warn("reactive() expects an object");

        return target;
    }

    // return existing proxy if already reactive
    if (reactiveMap.has(target)) {
        return reactiveMap.get(target);
    }

    // map to store subscribers for each property
    const subsMap = new Map();

    const getSubscribers = (prop) => {
        if (!subsMap.has(prop)) {
            subsMap.set(prop, new Set());
        }

        return subsMap.get(prop);
    };

    const handler = {
        get (target, prop) {
            // don't intercept internal properties
            if (prop === "__v_isReactive") {
                return true;
            }

            track(getSubscribers(prop));

            const value = target[prop];

            if (value && typeof value === "object") {
                // arrays need the patched prototype + index-assignment proxy so
                // that mutator methods (push, pop, splice…) call trigger().
                // reactive() alone cannot intercept those because they bypass the
                // proxy's set trap and operate directly on the raw target.
                if (Array.isArray(value)) {
                    // reuse the per-property subscriber set so reads and mutations
                    // share the same set of dependents
                    if (!value.__v_subs) {
                        // store the proxy back on the raw target so the index-assignment
                        // interception is preserved on subsequent reads
                        target[prop] = createArrayProxy(value, getSubscribers(prop));
                    }

                    return target[prop];
                }

                // recursively make nested plain objects reactive
                return reactive(value);
            }

            return value;
        },
        set (target, prop, newVal) {
            const oldVal = target[prop];

            if (oldVal === newVal) {
                return true;
            }

            target[prop] = newVal;
            trigger(getSubscribers(prop));

            return true;
        }
    };

    const proxy = new Proxy(target, handler);
    reactiveMap.set(target, proxy);

    return proxy;
}
export function computed (getter) {
    const subs = new Set();
    let cached;
    let dirty = true;

    // the notifier is a lightweight pseudo-effect whose only job is to
    // subscribe to the getter's reactive dependencies. when any dependency
    // changes, it marks the computed as dirty and notifies the computed's
    // own subscribers (which will re-read .value and get the fresh result).
    const notifier = function computedNotifier () {
        if (notifier.stopped) {
            return;
        }

        // a dependency changed — mark dirty and notify readers
        if (!dirty) {
            dirty = true;
            trigger(subs);
        }
    };

    notifier.deps    = [];
    notifier.stopped = false;
    notifier.sync    = true; // invalidation is synchronous

    notifier.stop = function () {
        if (!notifier.stopped) {
            cleanup(notifier);
            effectQueue.delete(notifier);
            notifier.stopped = true;
        }
    };

    // register with the active scope so it can be bulk-stopped later
    if (activeScope && !activeScope.stopped) {
        activeScope.add(notifier);
    }

    // run the getter, re-track dependencies, and cache the result
    function recompute () {
        cleanup(notifier);
        effectStack.push(notifier);
        activeEffect = notifier;

        try {
            cached = getter();
        }
        finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }

        dirty = false;
    }

    // initial run to discover dependencies
    recompute();

    return new Proxy({ value: cached }, {
        get (target, prop, receiver) {
            if (prop === "value") {
                if (dirty && !notifier.stopped) {
                    recompute();
                }

                track(subs);

                return cached;
            }

            return Reflect.get(target, prop, receiver);
        },
        set () {
            // computed refs are read-only
            return false;
        }
    });
}
export function watch (source, callback, options = {}) {
    let oldValue;
    let initialized = false;

    const deepClone = (val, seen = new WeakSet()) => {
        if (val === null || typeof val !== "object") {
            return val;
        }

        // guard against circular references
        if (seen.has(val)) {
            return undefined;
        }

        seen.add(val);

        if (val instanceof Date) {
            return new Date(val.getTime());
        }

        if (Array.isArray(val)) {
            return val.map(item => deepClone(item, seen));
        }

        const cloned = {};

        for (const key in val) {
            if (Object.prototype.hasOwnProperty.call(val, key)) {
                cloned[key] = deepClone(val[key], seen);
            }
        }

        return cloned;
    };

    const watchEffect = effect(() => {
        let newValue;

        // if source is a function (getter), call it to track dependencies
        if (typeof source === "function") {
            newValue = source();
        }
        // if source is a ref/computed, access .value to track it
        else if (source && typeof source === "object" && "value" in source) {
            newValue = source.value;
        }
        // if source is a reactive object, track it (deep watch if options.deep)
        else if (source && typeof source === "object" && source.__v_isReactive) {
            if (options.deep) {
                // deep access to track all nested properties — deepClone
                // traverses every key through the reactive proxy, triggering
                // track() for each, and returns a plain snapshot
                newValue = deepClone(source);
            }
            else {
                newValue = source;
            }
        }
        // otherwise use the source directly
        else {
            newValue = source;
        }

        if (initialized || options.immediate) {
            // run the callback without tracking to prevent the watcher from
            // accidentally subscribing to reactive reads made inside the callback.
            // we push a null sentinel onto the effectStack so that if a nested
            // sync effect() runs inside the callback and then pops the stack, it
            // restores activeEffect to null (our sentinel) rather than back to
            // the watchEffect — which would re-enable accidental tracking for
            // any reads that follow the nested effect call.
            effectStack.push(null);
            activeEffect = null;

            try {
                callback(newValue, oldValue);
            }
            finally {
                effectStack.pop();
                activeEffect = effectStack[effectStack.length - 1] || null;
            }
        }

        oldValue = deepClone(newValue);
        initialized = true;
    }, { sync: false }); // watch callbacks are async to prevent infinite loops

    // extend stop() to release the deep-clone snapshot so the watched object
    // graph can be garbage collected after the watcher is torn down
    const originalStop = watchEffect.stop.bind(watchEffect);

    watchEffect.stop = function () {
        originalStop();
        oldValue = undefined;
    };

    return watchEffect;
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

// kebab-case  →  camelCase   (my-prop → myProp)
// used by bindDynamicModel to look up the declared prop on the child component
function kebabToCamel (str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const directives = {
    "ref":           bindElementRef,
    "[ref]":         bindElementRef,

    "data-text":     bindText,
    "[text]":        bindText,

    "data-model":    bindModel,
    "[model]":       bindModel,

    "data-if":       bindIf,
    "[if]":          bindIf,

    "data-show":     bindShow,
    "[show]":        bindShow,

    "data-disabled": bindDisabled,
    "[disabled]":    bindDisabled,

    "data-class":    bindClass,
    "[class]":       bindClass,

    "data-html":     bindHTML,
    "[html]":        bindHTML,
};

// bounded lru cache for compiled expression functions
// using a plain Map is sufficient because Map preserves insertion order,
// letting us evict the least-recently-used entry when the cap is reached
const MAX_FN_CACHE_SIZE = 500;
const fnCache = new Map();

function fnCacheGet (key) {
    if (!fnCache.has(key)) {
        return undefined;
    }

    // move to end to mark as most-recently-used
    const fn = fnCache.get(key);
    fnCache.delete(key);
    fnCache.set(key, fn);

    return fn;
}
function fnCacheSet (key, fn) {
    if (fnCache.has(key)) {
        fnCache.delete(key);
    }
    else if (fnCache.size >= MAX_FN_CACHE_SIZE) {
        // evict the least-recently-used entry (first key in insertion order)
        fnCache.delete(fnCache.keys().next().value);
    }

    fnCache.set(key, fn);
}

export function scanBindings (root = document, store = window) {
    // bind data-for directive first, to handle scoped loop variables
    root.querySelectorAll("[data-for]").forEach(el => {
        if (
            scanned.has(el)
            || isInsideNestedFor(el, root)
        ) {
            return;
        }

        scanned.add(el);
        bindFor(el, store);
    });

    // bind all other directives
    root.querySelectorAll("*").forEach(el => {
        // if already scanned, skip this element
        if (scanned.has(el)) {
            return;
        }

        scanned.add(el);

        // bind dynamic attributes and bind: two-way bindings
        // snapshot the live NamedNodeMap before iterating because
        // removeAttribute() inside the loop would shift indices
        processElementBindings(el, store);

        // bind curly bracket interpolations
        // exclude script/style tags because css and js syntax break the interpolation parsing
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

// module-level constant — allocated once rather than inside every evalInScope call
const KEYWORDS = new Set([
    "await", "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "export", "extends",
    "finally", "for", "function", "if", "import", "in", "instanceof",
    "let", "new", "return", "static", "super", "switch", "this", "throw",
    "try", "typeof", "var", "void", "while", "with", "yield",
    "true", "false", "null", "undefined", "NaN", "Infinity"
]);

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
        // extract potential root-level variable names from the expression.
        // the pattern alternation consumes string literals (single, double, and
        // template quotes) so identifiers inside them are never captured.
        // the negative lookbehind (?<!\.) ensures property-access tails like
        // the "name" in "user.name" are skipped — only the root "user" is captured.
        const varPattern = /(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(?<!\.)(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)/g;
        const potentialVars = new Set();
        let match;

        while ((match = varPattern.exec(expr)) !== null) {
            const varName = match[1];

            // match[1] is undefined when the alternation matched a string literal
            if (varName && !KEYWORDS.has(varName)) {
                potentialVars.add(varName);
            }
        }

        // build list of keys that exist in store
        const keys = [];

        for (const varName of potentialVars) {
            if (varName in store) {
                keys.push(varName);
            }
        }

        // get or create cached compiled function
        const cacheKey = keys.join(",") + ":" + expr;
        let fn = fnCacheGet(cacheKey);

        if (!fn) {
            fn = new Function(...keys, `return (${expr});`);
            fnCacheSet(cacheKey, fn);
        }

        // build values array — unwrap refs while tracking is active
        // this allows effects to track dependencies through evalInScope
        const values = keys.map(key => {
            const val = store[key];

            return (val && typeof val === "object" && "value" in val) ? val.value : val;
        });

        return fn(...values);
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
            return true;
        }

        el = el.parentElement;
    }

    return false;
}
function isInsideIgnoredTag (node, root) {
    let currentNode = node;

    // walk up the dom tree from the text node
    while (currentNode && currentNode !== root) {
        // check if the current node is one of the ignored tag names
        if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const tagName = currentNode.tagName.toUpperCase();

            if (tagName === "SCRIPT" || tagName === "STYLE") {
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
        // skip nested data-for so inner pass handles its own scopes
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

    // base could be a ref or a plain value
    let baseIsRef = base && typeof base === "object" && "value" in base;

    // if single-level key, set directly
    if (parts.length === 1) {
        if (baseIsRef) {
            base.value = value;
        }
        else {
            store[baseKey] = value;
        }

        return;
    }

    // if multi-level (like user.name), make sure base is an object
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
function processElementBindings (el, store) {
    // dynamic attributes and model: bindings
    // snapshot the attributes array because removeAttribute shifts indices
    for (const attr of Array.from(el.attributes)) {
        const { name, value } = attr;

        if (name.startsWith("model:")) {
            const propAttr = name.slice("model:".length);
            el.removeAttribute(name);
            bindDynamicModel(el, propAttr, value, store);
        }
        else if (name.startsWith("data-attr-") || name.startsWith(":")) {
            const realAttr = name.startsWith("data-attr-")
                ? name.replace("data-attr-", "")
                : name.replace(":", "");

            el.removeAttribute(name);
            bindDynamicAttribute(el, realAttr, value, store);
        }
    }

    // standard directives (ref, [text], [model], [if], [show], [disabled], [class], [html])
    for (const [attr, fn] of Object.entries(directives)) {
        if (el.hasAttribute(attr)) {
            fn(el, el.getAttribute(attr), store);
        }
    }

    // event listeners (@click, data-onclick, etc.)
    bindEventListeners(el, store);
}
function bindFor (el, store) {
    const parent = el.parentNode;
    const comment = document.createComment("v-for placeholder");
    parent.replaceChild(comment, el); // remove template

    const expr    = el.getAttribute("data-for");
    const keyExpr = el.getAttribute(":key") || null;

    // consume :key from the template so it isn't processed as a dynamic
    // attribute binding by scanBindings when each clone is scanned
    if (keyExpr) {
        el.removeAttribute(":key");
    }

    // match: (item, index) of items
    // match: item of items
    const match = expr.match(/\(?\s*(\w+)(?:\s*,\s*(\w+))?\s*\)?\s+of\s+(.+)/);

    if (!match) {
        console.error("Invalid data-for expression:", expr);

        return;
    }

    const [, loopVar, indexVar, arrayExpr] = match;

    if (keyExpr) {
        bindForKeyed(el, store, parent, comment, loopVar, indexVar, arrayExpr, keyExpr);
    }
    else {
        bindForUnkeyed(el, store, parent, comment, loopVar, indexVar, arrayExpr);
    }
}

// ── unkeyed: full teardown + rebuild on every change (original behaviour) ────

function bindForUnkeyed (el, store, parent, comment, loopVar, indexVar, arrayExpr) {
    let children        = [];
    let iterationScopes = [];

    effect(() => {
        const arr = evalInScope(arrayExpr, store) || [];

        // stop all effects owned by the previous iteration scopes before removing
        // clones so detached nodes can be garbage collected
        for (const scope of iterationScopes) {
            scope.stop();
        }

        iterationScopes = [];

        // remove previous clones
        children.forEach(node => node.remove());
        children = [];

        arr.forEach((item, index) => {
            const { node, scope } = createIteration(
                el, store, parent, loopVar, indexVar, item, index
            );

            iterationScopes.push(scope);
            parent.insertBefore(node, comment);
            children.push(node);
        });
    });
}

// ── keyed: diff old rows against new array, reuse/move/add/remove as needed ──

function bindForKeyed (el, store, parent, comment, loopVar, indexVar, arrayExpr, keyExpr) {
    // Map<key, { node, scope, itemRef, indexRef }>
    // itemRef and indexRef are refs stored on the scoped store so that
    // in-place updates to moved/retained rows automatically re-trigger
    // the effects that were bound inside those rows during the initial scan
    let rowsByKey = new Map();

    effect(() => {
        const arr    = evalInScope(arrayExpr, store) || [];
        const oldMap = rowsByKey;

        rowsByKey = new Map();

        // cursor tracks the insertion point as we walk arr in reverse.
        // each node is inserted immediately before the cursor, so processing
        // right-to-left places nodes in correct forward DOM order.
        let cursor = comment;

        for (let i = arr.length - 1; i >= 0; i--) {
            const item  = arr[i];
            const index = i;

            // evaluate the key expression against a minimal scoped context so
            // we can look the item up in the old map without a full DOM clone
            const keyScope    = Object.create(store);
            keyScope[loopVar]  = item;

            if (indexVar) {
                keyScope[indexVar] = index;
            }

            const key = evalInScope(keyExpr, keyScope);

            // guard: if we've already seen this key in the current render pass,
            // the user has duplicate keys. clean up the earlier duplicate to
            // prevent orphaned DOM nodes and leaked scopes.
            if (rowsByKey.has(key)) {
                console.warn(
                    `[data-for] Duplicate :key "${key}" at index ${index}. ` +
                    `Each key must be unique — duplicates cause unexpected behaviour.`
                );

                const dup = rowsByKey.get(key);
                dup.scope.stop();
                dup.node.remove();
                rowsByKey.delete(key);
            }

            if (oldMap.has(key)) {
                // ── reuse existing row ────────────────────────────────────────
                const row = oldMap.get(key);
                oldMap.delete(key);

                // update the reactive refs that the row's effects depend on so
                // any bindings that reference loopVar or indexVar re-render in place
                row.itemRef.value = item;

                if (indexVar) {
                    row.indexRef.value = index;
                }

                // move to the correct position if it isn't already there
                if (row.node.nextSibling !== cursor) {
                    parent.insertBefore(row.node, cursor);
                }

                cursor = row.node;
                rowsByKey.set(key, row);
            }
            else {
                // ── new row ───────────────────────────────────────────────────
                // wrap loopVar and indexVar as refs so future updates to this
                // row (if it gets reused after a subsequent re-render) can be
                // pushed reactively without re-scanning the node
                const itemRef  = ref(item);
                const indexRef = ref(index);

                const { node, scope } = createIteration(
                    el, store, parent, loopVar, indexVar, itemRef, indexRef
                );

                parent.insertBefore(node, cursor);
                cursor = node;
                rowsByKey.set(key, { node, scope, itemRef, indexRef });
            }
        }

        // ── remove rows that are no longer in the array ───────────────────────
        for (const { node, scope } of oldMap.values()) {
            scope.stop();
            node.remove();
        }
    });
}

// ── shared helper: clone the template, build the scoped store, scan bindings ─

function createIteration (el, store, parent, loopVar, indexVar, item, index) {
    const clone = el.cloneNode(true);
    clone.removeAttribute("data-for");

    const parentStore = store;

    // scoped store — own properties shadow the parent store
    // item and index may be plain values (unkeyed path) or refs (keyed path);
    // either way evalInScope unwraps refs automatically, so templates are written
    // the same way regardless of which path created the row
    const scoped = Object.create(store);
    scoped[loopVar] = item;

    if (indexVar) {
        scoped[indexVar] = index;
    }

    // proxy so that store keys not overridden by the loop scope are still
    // accessible and parent refs are unwrapped on the way out
    const scopedForBindings = new Proxy(scoped, {
        get (target, key) {
            if (key === Symbol.unscopables) {
                return undefined;
            }

            if (key in target) {
                return target[key];
            }

            return unwrapRef(parentStore[key]);
        },
        has (_, key) {
            return (key in scoped) || (key in parentStore);
        }
    });

    // give the iteration its own scope so all its effects can be stopped
    // together when the row is removed or the list is torn down
    const iterScope = new EffectScope(activeScope);

    // clear scanned marks on the clone so nested data-for elements are
    // picked up fresh by the scanBindings call below
    clone.querySelectorAll("[data-for]").forEach(n => scanned.delete(n));
    scanned.delete(clone);

    runInScope(iterScope, () => {
        processCurlyInterpolations(clone, scopedForBindings);
        processElementBindings(clone, scopedForBindings);
        scanBindings(clone, scopedForBindings);
    });

    scanned.add(clone);

    return { node: clone, scope: iterScope };
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
    // ⚠️  XSS WARNING: innerHTML is set directly from the store expression with no
    // sanitization. Only bind trusted, developer-controlled strings here — never
    // render raw user input with [html]. Use [text] / curly interpolation instead,
    // which sets textContent and is always safe.
    effect(() => {
        const result = evalInScope(expr, store);
        el.innerHTML = result == null ? "" : result;
    });
}
function bindModel (el, expr, store) {
    if (el.type === "checkbox" || el.tagName === "HS-TOGGLE") {
        // when store changes -> update component
        effect(() => {
            const val = evalInScope(expr, store);
            el.checked = !!val;
        });

        // when component changes -> update store
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

            if (el.value !== val) {
                el.value = val;
            }
        });

        el.addEventListener("change", () => {
            setDeep(store, expr, el.value);
        });
    }
    else if (el.tagName === "SELECT") {
        effect(() => {
            const val = evalInScope(expr, store);

            if (el.value !== String(val ?? "")) {
                el.value = val ?? "";
            }
        });

        el.addEventListener("change", () => {
            setDeep(store, expr, el.value);
        });
    }
    else {
        const isNumeric = el.type === "number" || el.type === "range";

        effect(() => {
            const val = evalInScope(expr, store);
            el.value = val ?? "";
        });

        el.addEventListener("input", e => {
            const raw = e.target.value;

            // coerce to number for numeric inputs so the store stays the right type
            if (isNumeric) {
                setDeep(store, expr, raw === "" ? "" : Number(raw));
            }
            else {
                setDeep(store, expr, raw);
            }
        });
    }
}
function bindIf (el, expr, store) {
    const parent = el.parentNode;
    const comment = document.createComment("v-if placeholder");
    parent.replaceChild(comment, el);

    let isInserted = false;
    let innerScope = null;

    // remove el and all its descendants from the scanned set so that the next
    // show re-scans everything into a fresh scope. called on hide so that
    // stopped effects aren't left dangling with a stale scanned mark.
    function unmarkScanned (root) {
        scanned.delete(root);
        root.querySelectorAll("*").forEach(child => scanned.delete(child));
    }

    effect(() => {
        const show = !!evalInScope(expr, store);

        if (show && !isInserted) {
            // always scan into a fresh scope — unmarkScanned() on hide ensures
            // scanned.has(el) is false here whenever the element was previously hidden
            innerScope = new EffectScope(activeScope);

            runInScope(innerScope, () => {
                scanBindings(el, store);
            });

            parent.insertBefore(el, comment);
            isInserted = true;
        }
        else if (!show && isInserted) {
            // stop every effect that belongs to the hidden subtree
            if (innerScope) {
                innerScope.stop();
                innerScope = null;
            }

            // clear scanned marks so the next show re-scans from scratch
            unmarkScanned(el);

            if (el.parentNode) {
                parent.replaceChild(comment, el);
            }

            isInserted = false;
        }
    });
}
function bindShow (el, expr, store) {
    // capture the element's own inline display value (if any) so we can
    // restore it when showing. avoids getComputedStyle which may return
    // "" or "none" before first layout or inside a hidden parent.
    // restoring "" removes the inline override and lets CSS take over.
    const inlineDisplay = el.style.display;

    effect(() => {
        const visible = !!evalInScope(expr, store);

        if (visible) {
            el.style.display = inlineDisplay;
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
            if (value.trim()) {
                el.classList.add(...value.split(/\s+/));
            }
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
    // when store changes -> update attribute
    effect(() => {
        const value = evalInScope(expr, store);

        // null, undefined, and false all mean "remove the attribute".
        // this is critical for boolean HTML attributes (hidden, disabled, readonly…)
        // where setAttribute("disabled", false) produces disabled="false" — still truthy.
        if (value === null || value === undefined || value === false) {
            el.removeAttribute(attrName);
        }
        else {
            // true → set the attribute with an empty value (boolean attribute convention)
            el.setAttribute(attrName, value === true ? "" : value);
        }
    });
}
function bindDynamicModel (el, propAttr, expr, store) {
    // propAttr is the kebab-case prop name as written in the attribute,
    // e.g. "my-prop" from bind:my-prop="reactiveVar"
    const camelKey = kebabToCamel(propAttr);

    // verify the target element is a ReactiveComponent that declares this prop
    // as reactive. scheduled as a microtask so the custom element has had time
    // to upgrade (connectedCallback) before we inspect static props.
    const assertReactiveProp = () => {
        const propsDef = el.constructor?.props;

        if (!propsDef || !(camelKey in propsDef)) {
            throw new Error(`model: "${propAttr}" is not declared in the target component's static props.`);
        }

        const declaration = propsDef[camelKey];
        const isReactive  = (
            declaration !== null
            && typeof declaration === "object"
            && "value" in declaration
            && typeof declaration.value === "function"
        );

        if (!isReactive) {
            throw new Error(`model: "${propAttr}" must be declared as a reactive prop (use ref() marker) to support two-way binding.`);
        }
    };

    // early validation — fires after upgrade instead of waiting for the first emit
    queueMicrotask(assertReactiveProp);

    // ── parent → child ────────────────────────────────────────────────────────
    // whenever the parent store expression changes, push the new value down
    // by setting the attribute on the child element. the child's
    // attributeChangedCallback will pick it up and update its internal ref.
    effect(() => {
        const value = evalInScope(expr, store);

        // serialise Arrays/Objects so they survive the attribute round-trip
        const serialised = (value !== null && typeof value === "object")
            ? JSON.stringify(value)
            : String(value ?? "");

        el.setAttribute(propAttr, serialised);
    });

    // ── child → parent ────────────────────────────────────────────────────────
    // listen for the update:<prop> custom event the child is expected to emit
    // when it mutates the prop internally, then write the new value back into
    // the parent store ref.
    el.addEventListener(`update:${propAttr}`, e => {
        const varName = expr.trim();
        const target  = store[varName];

        if (target && typeof target === "object" && "value" in target) {
            // parent store variable is a ref — update it directly
            target.value = e.detail;
        }
        else {
            // fall back to setDeep for dotted paths (e.g. "user.count")
            setDeep(store, varName, e.detail);
        }
    });
}
function bindCurlyInterpolations (node, scope) {
    const original = node.textContent;

    // find all { expr } occurrences
    const matches = [...original.matchAll(/\{([^}]+)\}/g)];

    if (matches.length === 0) {
        return;
    }

    // split into static + dynamic parts
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

    // turn the whole text node into a sequence of child text nodes
    node.textContent = "";
    const parentEl = node.parentNode;
    const nodes = parts.map(p => {
        const n = document.createTextNode(p.type === "static" ? p.value : "");

        parentEl.insertBefore(n, node);

        return { p, n };
    });

    // remove original template node
    node.remove();

    // create one effect per expr-part
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
    for (const attr of Array.from(el.attributes)) {
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

                if (argsStr?.trim()) {
                    args = argsStr.split(",").map(arg => {
                        arg = arg.trim();

                        // check for string literal
                        if (
                            (arg.startsWith("'") && arg.endsWith("'"))
                            || (arg.startsWith('"') && arg.endsWith('"'))
                        ) {
                            return arg.slice(1, -1); // remove quotes
                        }

                        // check for stored variables / refs
                        if (arg in store) {
                            return unwrapRef(store[arg]);
                        }

                        // check for numbers
                        if (!isNaN(arg) && arg.trim() !== "") {
                            return Number(arg);
                        }

                        // return as-is
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
export function on (eventName, handler) {
    (events[eventName] ||= []).push(handler);
}
export function off (eventName, handler) {
    if (!events[eventName]) {
        return;
    }

    events[eventName] = events[eventName].filter(fn => fn !== handler);

    if (events[eventName].length === 0) {
        delete events[eventName];
    }
}
export function emit (eventName, ...values) {
    (events[eventName] || []).forEach(fn => fn(...values));
}
export function defineEmits (allowedEvents) {
    return (eventName, ...values) => {
        if (!allowedEvents.includes(eventName)) {
            console.warn(`[emit] Event "${eventName}" is not declared in defineEmits`);

            return;
        }

        emit(eventName, ...values);
    };
}
/* </events> */
