//  ____                 _   _                                 
// |  _ \ ___  __ _  ___| |_(_)_   _____  __   ____ _ _ __ ___ 
// | |_) / _ \/ _` |/ __| __| \ \ / / _ \ \ \ / / _` | '__/ __|
// |  _ <  __/ (_| | (__| |_| |\ V /  __/  \ V / (_| | |  \__ \
// |_| \_\___|\__,_|\___|\__|_| \_/ \___|   \_/ \__,_|_|  |___/


let activeEffect = null;
let effectStack = [];

const arrayPrototype = Array.prototype;
const arrayMutatorMethods = ["push","pop","shift","unshift","splice","sort","reverse"];
const patchedArrayMethods = Object.create(arrayPrototype);

arrayMutatorMethods.forEach(methodName => {
    const originalMethod = arrayPrototype[methodName];
    patchedArrayMethods[methodName] = function(...args) {
        const result = originalMethod.apply(this, args);
        if (this.__v_subs) trigger(this.__v_subs);
        return result;
    };
});

/* <reactivity-helpers> */
const effectQueue = new Set();
let isFlushing = false;
let isFlushPending = false;

function cleanup(effect) {
    if (!effect.deps) {
        return;
    }
    for (const dep of effect.deps) {
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
    }
}

function queueEffect(effect) {
    if (!effectQueue.has(effect)) {
        effectQueue.add(effect);
        if (!isFlushing && !isFlushPending) {
            isFlushPending = true;
            queueMicrotask(flushEffectQueue);
        }
    }
}

function flushEffectQueue() {
    isFlushPending = false;
    isFlushing = true;
    try {
        const effects = Array.from(effectQueue);
        effectQueue.clear();
        for (const fn of effects) {
            if (!fn.stopped) fn();
        }
    }
    finally {
        isFlushing = false;
        if (effectQueue.size > 0) {
            flushEffectQueue();
        }
    }
}

function trigger(subscribers) {
    if (!subscribers) {
        return;
    }
    const toRun = Array.from(subscribers);

    for (const fn of toRun) {
        if (fn.stopped) {
            continue;
        }
        if (fn.sync) {
            fn();
        }
        else {
            queueEffect(fn);
        }
    }
}
/* </reactivity-helpers> */

// ─── EFFECT SCOPE ─────────────────────────────────────────────────────────────
//
// ROOT CAUSE of the detached-node explosion: there was no way to bulk-stop all
// effects that belong to a subtree (a loop iteration, a conditional branch, etc.).
// When bindFor re-rendered, old clone effects kept running and holding strong
// references to the detached DOM nodes → GC could never collect them.
//
// FIX: An EffectScope is a lightweight owner that collects every effect created
// inside it.  Calling scope.stop() stops them all in one shot.  Scopes can be
// nested: a child scope is automatically stopped when its parent is stopped.
//
class EffectScope {
    constructor(parent = null) {
        this.effects  = [];   // effects created directly in this scope
        this.children = [];   // child scopes
        this.stopped  = false;
        if (parent) parent.children.push(this);
    }
    add(eff) {
        this.effects.push(eff);
    }
    stop() {
        if (this.stopped) return;
        this.stopped = true;
        for (const eff  of this.effects)  eff.stop();
        for (const child of this.children) child.stop();
        this.effects  = [];
        this.children = [];
    }
}

// The currently active scope — any effect() call registers itself here.
let activeScope = null;

export function effectScope(parent) {
    return new EffectScope(parent ?? activeScope);
}

// Run fn inside a scope; all effects created during fn are owned by that scope.
function runInScope(scope, fn) {
    const prev = activeScope;
    activeScope = scope;
    try { return fn(); }
    finally { activeScope = prev; }
}
// ──────────────────────────────────────────────────────────────────────────────

export function effect(fn, options = {}) {
    const wrapped = function wrappedEffect() {
        if (wrapped.stopped) return;
        cleanup(wrappedEffect);
        effectStack.push(wrappedEffect);
        activeEffect = wrappedEffect;
        try {
            return fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    };

    wrapped.deps    = [];
    wrapped.stopped = false;
    wrapped.sync    = options.sync || false;

    wrapped.stop = function() {
        if (!wrapped.stopped) {
            cleanup(wrapped);
            effectQueue.delete(wrapped);
            wrapped.stopped = true;
        }
    };

    // Register with the active scope so it can be bulk-stopped later.
    if (activeScope && !activeScope.stopped) {
        activeScope.add(wrapped);
    }

    wrapped();
    return wrapped;
}

function createArrayProxy(arr, subs) {
    Object.defineProperty(arr, "__v_subs", { value: subs, enumerable: false, writable: true });
    Object.setPrototypeOf(arr, patchedArrayMethods);
    return new Proxy(arr, {
        set(target, prop, value) {
            const index = Number(prop);
            if (!isNaN(index) && index >= 0) { target[prop] = value; trigger(subs); return true; }
            target[prop] = value;
            return true;
        }
    });
}

export function ref(initialValue) {
    const subs = new Set();
    if (Array.isArray(initialValue)) initialValue = createArrayProxy(initialValue, subs);
    const data = { value: initialValue };
    return new Proxy(data, {
        get(target, prop) {
            if (prop === "value") { track(subs); return target[prop]; }
        },
        set(target, prop, newVal) {
            if (prop !== "value") return false;
            if (Array.isArray(newVal) && !newVal.__v_subs) newVal = createArrayProxy(newVal, subs);
            target[prop] = newVal;
            trigger(subs);
            return true;
        }
    });
}

const reactiveMap = new WeakMap();

export function reactive(target) {
    if (!target || typeof target !== "object") {
        console.warn("reactive() expects an object");
        return target;
    }
    if (reactiveMap.has(target)) return reactiveMap.get(target);

    const subsMap = new Map();
    const getSubs = (prop) => {
        if (!subsMap.has(prop)) subsMap.set(prop, new Set());
        return subsMap.get(prop);
    };

    const proxy = new Proxy(target, {
        get(target, prop) {
            if (prop === "__v_isReactive") return true;
            track(getSubs(prop));
            const value = target[prop];
            if (value && typeof value === "object") return reactive(value);
            return value;
        },
        set(target, prop, newVal) {
            if (target[prop] === newVal) return true;
            target[prop] = newVal;
            trigger(getSubs(prop));
            return true;
        }
    });

    reactiveMap.set(target, proxy);
    return proxy;
}

export function computed(getter) {
    const result = ref();
    effect(() => { result.value = getter(); }, { sync: true });
    return result;
}

export function watch(source, callback, options = {}) {
    let oldValue;
    let initialized = false;

    const deepClone = (val) => {
        if (val === null || typeof val !== "object") return val;
        if (Array.isArray(val)) return val.map(deepClone);
        const cloned = {};
        for (const key in val) {
            if (Object.prototype.hasOwnProperty.call(val, key)) cloned[key] = deepClone(val[key]);
        }
        return cloned;
    };

    const watchEffect = effect(() => {
        let newValue;
        if (typeof source === "function") {
            newValue = source();
        } else if (source && typeof source === "object" && "value" in source) {
            newValue = source.value;
        } else if (source && typeof source === "object" && source.__v_isReactive) {
            newValue = options.deep ? JSON.parse(JSON.stringify(source)) : source;
        } else {
            newValue = source;
        }

        if (initialized || options.immediate) {
            const prev = activeEffect;
            activeEffect = null;
            callback(newValue, oldValue);
            activeEffect = prev;
        }

        oldValue = deepClone(newValue);
        initialized = true;
    }, { sync: false });

    // FIX: Release deep-clone snapshot on stop so the object graph can be GC'd.
    const originalStop = watchEffect.stop.bind(watchEffect);
    watchEffect.stop = function() {
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
//                                                    |___/

const scanned = new WeakSet();

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

// FIX: Bounded LRU cache for compiled expressions (was an unbounded Map).
const MAX_FN_CACHE = 500;
const fnCache = new Map();

function fnCacheGet(key) {
    if (!fnCache.has(key)) return undefined;
    const fn = fnCache.get(key);
    fnCache.delete(key);   // move to end = most-recently-used
    fnCache.set(key, fn);
    return fn;
}

function fnCacheSet(key, fn) {
    if (fnCache.has(key)) { fnCache.delete(key); }
    else if (fnCache.size >= MAX_FN_CACHE) { fnCache.delete(fnCache.keys().next().value); }
    fnCache.set(key, fn);
}

export function scanBindings(root = document, store = window) {
    // data-for first so scoped loop variables are available to child directives
    root.querySelectorAll("[data-for]").forEach(el => {
        if (scanned.has(el)) return;
        scanned.add(el);
        bindFor(el, store);
    });

    root.querySelectorAll("*").forEach(el => {
        if (scanned.has(el)) return;
        scanned.add(el);

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

        for (const [attr, fn] of Object.entries(directives)) {
            if (el.hasAttribute(attr)) fn(el, el.getAttribute(attr), store);
        }

        bindEventListeners(el, store);

        if (!el.hasAttribute("data-for") && el.tagName !== "SCRIPT" && el.tagName !== "STYLE") {
            processCurlyInterpolations(el, store);
        }
    });
}

/* <binding-helpers> */
function unwrapRef(v) {
    return (v && typeof v === "object" && "value" in v) ? v.value : v;
}

function evalInScope(expr, store) {
    expr = (expr || "").trim();
    if (!expr) return undefined;

    try {
        const keywords = new Set([
            'await','break','case','catch','class','const','continue','debugger','default',
            'delete','do','else','export','extends','finally','for','function','if','import',
            'in','instanceof','let','new','return','static','super','switch','this','throw',
            'try','typeof','var','void','while','with','yield',
            'true','false','null','undefined','NaN','Infinity'
        ]);

        const potentialVars = new Set();
        for (const [, varName] of expr.matchAll(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g)) {
            if (!keywords.has(varName)) potentialVars.add(varName);
        }

        const keys = [];
        for (const varName of potentialVars) {
            if (varName in store) keys.push(varName);
        }

        const cacheKey = keys.join(',') + ':' + expr;
        let fn = fnCacheGet(cacheKey);
        if (!fn) {
            fn = new Function(...keys, `return (${expr});`);
            fnCacheSet(cacheKey, fn);
        }

        const values = keys.map(key => {
            const val = store[key];
            return (val && typeof val === "object" && "value" in val) ? val.value : val;
        });

        return fn(...values);
    } catch(e) {
        console.error("evalInScope error:", expr, e);
        return undefined;
    }
}

function isInsideNestedFor(node, topRoot) {
    let el = node.parentElement;
    while (el && el !== topRoot) {
        if (el.hasAttribute && el.hasAttribute("data-for")) return true;
        el = el.parentElement;
    }
    return false;
}

function isInsideIgnoredTag(node, root) {
    let cur = node;
    while (cur && cur !== root) {
        if (cur.nodeType === Node.ELEMENT_NODE) {
            const tag = cur.tagName.toUpperCase();
            if (tag === "SCRIPT" || tag === "STYLE") return true;
        }
        cur = cur.parentNode;
    }
    return false;
}

function processCurlyInterpolations(root, scope) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
        if (isInsideNestedFor(node, root) || isInsideIgnoredTag(node, root)) continue;
        if (/\{[^}]+\}/.test(node.textContent)) textNodes.push(node);
    }
    textNodes.forEach(n => bindCurlyInterpolations(n, scope));
}

function setDeep(store, expr, value) {
    if (!expr || !expr.trim()) return;
    const parts = expr.split(".");
    if (!parts.length) return;

    const baseKey  = parts[0];
    let   base     = store[baseKey];
    const baseIsRef = base && typeof base === "object" && "value" in base;

    if (parts.length === 1) {
        if (baseIsRef) base.value = value;
        else store[baseKey] = value;
        return;
    }

    let obj = baseIsRef ? base.value : base;
    if (obj == null || typeof obj !== "object") {
        obj = {};
        if (baseIsRef) base.value = obj;
        else store[baseKey] = obj;
    }

    for (let i = 1; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!(k in obj) || obj[k] == null || typeof obj[k] !== "object") obj[k] = {};
        obj = obj[k];
    }

    const last   = parts[parts.length - 1];
    const target = obj[last];
    if (target && typeof target === "object" && "value" in target) target.value = value;
    else obj[last] = value;

    if (baseIsRef) base.value = base.value; // trigger reactive update
}
/* </binding-helpers> */

/* <binding-functions> */

// ─── bindFor ─────────────────────────────────────────────────────────────────
// THE MAIN LEAK: every re-render spawned hundreds of effects (text, model,
// class, attr, interpolation…) that were never stopped. Those effects held
// strong references to their detached clone nodes → GC could never reclaim them.
//
// FIX: Each iteration gets its own EffectScope. On re-render we call
// iterationScope.stop() which stops every effect that was created while
// scanning that clone, no matter how deeply nested.
// ─────────────────────────────────────────────────────────────────────────────
function bindFor(el, store) {
    const parent  = el.parentNode;
    const comment = document.createComment("v-for placeholder");
    parent.replaceChild(comment, el);

    const expr  = el.getAttribute("data-for");
    const match = expr.match(/\(?\s*(\w+)(?:\s*,\s*(\w+))?\s*\)?\s+of\s+(.+)/);
    if (!match) { console.error("Invalid data-for expression:", expr); return; }

    const [, loopVar, indexVar, arrayExpr] = match;

    let children       = [];   // DOM clones currently in the document
    let iterationScopes = [];  // one EffectScope per clone, in the same order

    // The outer effect that watches the array itself lives in whatever scope
    // was active when bindFor was called — that's correct and unchanged.
    effect(() => {
        const arr = evalInScope(arrayExpr, store) || [];

        // ── Teardown previous iteration ───────────────────────────────────
        // Stop every reactive effect that was created for the old clones.
        // This unsubscribes them from all deps → their closure-captured DOM
        // nodes become unreachable → GC can collect them.
        for (const scope of iterationScopes) scope.stop();
        iterationScopes = [];

        for (const node of children) node.remove();
        children = [];
        // ──────────────────────────────────────────────────────────────────

        arr.forEach((item, index) => {
            const clone = el.cloneNode(true);
            clone.removeAttribute("data-for");

            const parentStore = store;
            const scoped      = Object.create(store);
            scoped[loopVar]   = item;
            if (indexVar) scoped[indexVar] = index;

            const scopedForBindings = new Proxy(scoped, {
                get(target, key) {
                    if (key === Symbol.unscopables) return undefined;
                    if (key in target) return target[key];
                    return unwrapRef(parentStore[key]);
                },
                has(_, key) { return (key in scoped) || (key in parentStore); }
            });

            // Create a child scope owned by the current activeScope (if any).
            // ALL effects created inside scanBindings for this clone — including
            // deeply nested ones (interpolations, model listeners, nested for…)
            // — are automatically registered in this scope because effect()
            // checks activeScope on every call.
            const iterScope = new EffectScope(activeScope);
            iterationScopes.push(iterScope);

            clone.querySelectorAll("[data-for]").forEach(n => scanned.delete(n));
            scanned.delete(clone);

            runInScope(iterScope, () => {
                processCurlyInterpolations(clone, scopedForBindings);
                scanBindings(clone, scopedForBindings);
            });

            parent.insertBefore(clone, comment);
            children.push(clone);
        });
    });
}

// ─── bindIf ──────────────────────────────────────────────────────────────────
// Same problem as bindFor: when the element was removed from the DOM its
// inner effects kept running and prevented GC of the detached subtree.
//
// FIX: Track an EffectScope for the visible subtree; stop it on hide.
// ─────────────────────────────────────────────────────────────────────────────
function bindIf(el, store) {
    const parent  = el.parentNode;
    const comment = document.createComment("v-if placeholder");
    parent.replaceChild(comment, el);

    let isInserted  = false;
    let innerScope  = null;   // scope that owns all effects inside el

    effect(() => {
        const show = !!evalInScope(el.getAttribute("data-if") || el.getAttribute("[if]"), store);

        if (show && !isInserted) {
            // Scan the element (if not yet scanned) inside a fresh scope.
            if (!scanned.has(el)) {
                innerScope = new EffectScope(activeScope);
                runInScope(innerScope, () => scanBindings(el, store));
            }
            parent.insertBefore(el, comment);
            isInserted = true;
        } else if (!show && isInserted) {
            // Stop every effect that belongs to the hidden subtree.
            if (innerScope) { innerScope.stop(); innerScope = null; }
            if (el.parentNode) parent.replaceChild(comment, el);
            isInserted = false;
        }
    });
}

// bindIf is special: it reads the attribute value itself (needed for the scope
// logic above), so we keep a thin wrapper that matches the directives table signature.
function _bindIf(el, _expr, store) { bindIf(el, store); }

// Patch directives table to use wrapper
directives["data-if"] = _bindIf;
directives["[if]"]    = _bindIf;

function bindElementRef(el, name, store) {
    if (!name) return;
    if (!store[name]) store[name] = ref(null);
    store[name].value = el;
}

function bindText(el, expr, store) {
    effect(() => {
        const result = evalInScope(expr, store);
        el.textContent = result == null ? "" : result;
    });
}

function bindHTML(el, expr, store) {
    effect(() => {
        const result = evalInScope(expr, store);
        el.innerHTML = result == null ? "" : result;
    });
}

function bindModel(el, expr, store) {
    if (el.type === "checkbox" || el.tagName === "HS-TOGGLE") {
        effect(() => { el.checked = !!evalInScope(expr, store); });
        el.addEventListener("change", e => setDeep(store, expr, e.target.checked));
    } else if (el.type === "radio") {
        effect(() => { el.checked = evalInScope(expr, store) === el.value; });
        el.addEventListener("change", e => { if (e.target.checked) setDeep(store, expr, el.value); });
    } else if (el.tagName === "HS-SEGMENT" || el.tagName === "HS-SELECT") {
        effect(() => { const v = evalInScope(expr, store); if (el.value !== v) el.value = v; });
        el.addEventListener("change", () => setDeep(store, expr, el.value));
    } else {
        effect(() => { el.value = evalInScope(expr, store) ?? ""; });
        el.addEventListener("input", e => setDeep(store, expr, e.target.value));
    }
}

function bindShow(el, expr, store) {
    const originalDisplay = getComputedStyle(el).display || "";
    effect(() => {
        const visible = !!evalInScope(expr, store);
        if (visible) el.style.setProperty("display", originalDisplay, "");
        else         el.style.setProperty("display", "none", "important");
    });
}

function bindDisabled(el, expr, store) {
    effect(() => { el.disabled = !!evalInScope(expr, store); });
}

function bindClass(el, expr, store) {
    const staticClasses = new Set(el.className.split(/\s+/).filter(Boolean));
    effect(() => {
        el.className = [...staticClasses].join(" ");
        const value = evalInScope(expr, store);
        if (typeof value === "string") {
            if (value.trim()) el.classList.add(...value.split(/\s+/));
        } else if (Array.isArray(value)) {
            el.classList.add(...value);
        } else if (value && typeof value === "object") {
            Object.entries(value).forEach(([cls, active]) => {
                if (active) el.classList.add(...cls.split(/\s+/));
            });
        }
    });
}

function bindDynamicAttribute(el, attrName, expr, store) {
    effect(() => {
        const value = evalInScope(expr, store);
        if (value === null) el.removeAttribute(attrName);
        else el.setAttribute(attrName, value);
    });
}

function bindCurlyInterpolations(node, scope) {
    const original = node.textContent;
    const matches  = [...original.matchAll(/\{([^}]+)\}/g)];
    if (!matches.length) return;

    const parts    = [];
    let lastIndex  = 0;

    for (const match of matches) {
        const [full, expr] = match;
        if (match.index > lastIndex) {
            parts.push({ type: "static", value: original.slice(lastIndex, match.index) });
        }
        parts.push({ type: "expr", expr: expr.trim() });
        lastIndex = match.index + full.length;
    }
    if (lastIndex < original.length) {
        parts.push({ type: "static", value: original.slice(lastIndex) });
    }

    node.textContent = "";
    const parentEl   = node.parentNode;
    const nodes      = parts.map(p => {
        const n = document.createTextNode(p.type === "static" ? p.value : "");
        parentEl.insertBefore(n, node);
        return { p, n };
    });
    node.remove();

    for (const { p, n } of nodes) {
        if (p.type !== "expr") continue;
        effect(() => {
            const v = evalInScope(p.expr, scope);
            n.textContent = v == null ? "" : String(v);
        });
    }
}

function bindEventListeners(el, store) {
    for (const attr of el.attributes) {
        const { name, value } = attr;
        if (!name.startsWith("data-on") && !name.startsWith("@")) continue;

        const eventName = name.startsWith("data-on")
            ? name.replace("data-on", "").toLowerCase()
            : name.replace("@", "");

        const match = value.match(/^(\w+)(?:\((.*)\))?$/);
        if (!match) continue;

        const [, fnName, argsStr] = match;
        const fn = store[fnName];
        if (typeof fn !== "function") continue;

        el.addEventListener(eventName, e => {
            let args = [];
            if (argsStr) {
                args = argsStr.split(",").map(arg => {
                    arg = arg.trim();
                    if ((arg.startsWith("'") && arg.endsWith("'")) ||
                        (arg.startsWith('"') && arg.endsWith('"'))) return arg.slice(1, -1);
                    if (arg in store) return unwrapRef(store[arg]);
                    if (!isNaN(arg) && arg.trim() !== "") return Number(arg);
                    return arg;
                });
            }
            fn(...args, e);
        });
    }
}
/* </binding-functions> */


//  _____                 _       
// | ____|_   _____ _ __ | |_ ___ 
// |  _| \ \ / / _ \ '_ \| __/ __|
// | |___ \ V /  __/ | | | |_\__ \
// |_____| \_/ \___|_| |_|\__|___/

const events = {};

/* <events> */
export function on(eventName, handler) {
    (events[eventName] ||= []).push(handler);
}

// FIX: off() lets callers deregister handlers to prevent closures (and anything
// they capture — DOM nodes, store state, etc.) from being retained forever.
export function off(eventName, handler) {
    if (!events[eventName]) return;
    events[eventName] = events[eventName].filter(fn => fn !== handler);
    if (!events[eventName].length) delete events[eventName];
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