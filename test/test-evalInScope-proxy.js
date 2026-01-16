import { ref } from '../reactive.js';

console.log("=== Testing evalInScope with Proxy stores ===\n");

// Simulate the evalInScope function behavior
function testEvalInScope(expr, store) {
    const keywords = new Set([
        'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
        'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
        'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
        'let', 'new', 'return', 'static', 'super', 'switch', 'this', 'throw',
        'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
        'true', 'false', 'null', 'undefined', 'NaN', 'Infinity'
    ]);

    const varPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    const matches = expr.matchAll(varPattern);
    const potentialVars = new Set();

    for (const match of matches) {
        const varName = match[1];
        if (!keywords.has(varName)) {
            potentialVars.add(varName);
        }
    }

    console.log(`  Expression: "${expr}"`);
    console.log(`  Potential vars found: ${Array.from(potentialVars).join(', ')}`);

    const keys = [];
    const values = [];

    for (const varName of potentialVars) {
        if (varName in store) {
            console.log(`    ✓ Found "${varName}" in store`);
            keys.push(varName);
            const val = store[varName];
            values.push(val && typeof val === 'object' && 'value' in val ? val.value : val);
        } else {
            console.log(`    ✗ "${varName}" not in store`);
        }
    }

    const fn = new Function(...keys, `return (${expr});`);
    return fn(...values);
}

// Test 1: Simple parent store
console.log("Test 1: Simple parent store");
const parentStore = {
    count: ref(5),
    doubleFn: (x) => x * 2
};

const result1 = testEvalInScope('doubleFn(count)', parentStore);
console.log(`  Result: ${result1} (expected 10)\n`);

// Test 2: Scoped proxy store (simulating data-for)
console.log("Test 2: Scoped proxy store (simulating data-for)");
const scoped = {
    item: 'Apple',
    index: 0
};

const scopedProxy = new Proxy(scoped, {
    get(target, key) {
        if (key === Symbol.unscopables) return undefined;
        if (key in target) return target[key];
        return parentStore[key];
    },
    has(_, key) {
        return (key in scoped) || (key in parentStore);
    }
});

const result2 = testEvalInScope('item + " " + index', scopedProxy);
console.log(`  Result: "${result2}" (expected "Apple 0")\n`);

// Test 3: Method call with scoped variable
console.log("Test 3: Method call with scoped variable in proxy store");
const parentStore2 = {
    double: (x) => x * 2,
    items: ref([1, 2, 3])
};

const scoped2 = {
    value: 10
};

const scopedProxy2 = new Proxy(scoped2, {
    get(target, key) {
        if (key === Symbol.unscopables) return undefined;
        if (key in target) return target[key];
        return parentStore2[key];
    },
    has(_, key) {
        return (key in scoped2) || (key in parentStore2);
    }
});

const result3 = testEvalInScope('double(value)', scopedProxy2);
console.log(`  Result: ${result3} (expected 20)\n`);

// Test 4: Complex expression
console.log("Test 4: Complex expression with multiple variables");
const result4 = testEvalInScope('double(value) + items.length', scopedProxy2);
console.log(`  Result: ${result4} (expected 23)\n`);

console.log("=== All tests completed ===");
