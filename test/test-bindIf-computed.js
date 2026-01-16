import { ref, computed, effect } from '../reactive.js';

console.log("=== Testing bindIf-style logic with computed ===\n");

// Simulate evalInScope
function evalInScope(expr, store) {
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

    const keys = [];
    const values = [];

    for (const varName of potentialVars) {
        if (varName in store) {
            keys.push(varName);
            const val = store[varName];
            // unwrapRef
            values.push(val && typeof val === 'object' && 'value' in val ? val.value : val);
        }
    }

    const fn = new Function(...keys, `return (${expr});`);
    return fn(...values);
}

// Simulate bindIf behavior
function simulateBindIf(expr, store) {
    let isInserted = false;
    let effectRuns = 0;

    const eff = effect(() => {
        effectRuns++;
        const show = !!evalInScope(expr, store);

        console.log(`  Effect run #${effectRuns}: expr="${expr}" → show=${show}, isInserted=${isInserted}`);

        if (show && !isInserted) {
            console.log(`    → INSERT element`);
            isInserted = true;
        }
        else if (!show && isInserted) {
            console.log(`    → REMOVE element`);
            isInserted = false;
        }
    });

    return { effectRuns: () => effectRuns, isInserted: () => isInserted };
}

// Test: Exact scenario from HTML
console.log("Test: Computed values in AND expression");
const users = ref([
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 },
    { name: 'Charlie', age: 35 }
]);

const aliceName = computed(() => {
    const name = users.value[0].name;
    console.log(`  [computed] aliceName evaluated: "${name}"`);
    return name;
});

const bobName = computed(() => {
    const name = users.value[1].name;
    console.log(`  [computed] bobName evaluated: "${name}"`);
    return name;
});

const store = { aliceName, bobName, users };

console.log("\n--- Initial Setup ---");
const sim = simulateBindIf("aliceName === 'Alice' && bobName === 'Bob'", store);

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`\nInitial state: effectRuns=${sim.effectRuns()}, isInserted=${sim.isInserted()}`);
console.log("Expected: effectRuns=1, isInserted=true\n");

console.log("--- Changing Users ---");
console.log("Setting users to [ASD, QWE, 123]...");

users.value = [
    { name: 'ASD', age: 25 },
    { name: 'QWE', age: 30 },
    { name: '123', age: 35 }
];

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`\nAfter change: effectRuns=${sim.effectRuns()}, isInserted=${sim.isInserted()}`);
console.log("Expected: effectRuns=2, isInserted=false\n");

console.log("=== Test completed ===");
