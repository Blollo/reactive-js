import { ref, computed, effect } from '../reactive.js';

console.log("=== Testing evalInScope with computed values ===\n");

// Recreate evalInScope logic
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

    const keys = [];
    const values = [];

    for (const varName of potentialVars) {
        if (varName in store) {
            keys.push(varName);
            // unwrapRef logic
            const val = store[varName];
            values.push(val && typeof val === 'object' && 'value' in val ? val.value : val);
        }
    }

    console.log(`  Expression: "${expr}"`);
    console.log(`  Variables found: ${keys.join(', ')}`);
    console.log(`  Values: [${values.map(v => JSON.stringify(v)).join(', ')}]`);

    const fn = new Function(...keys, `return (${expr});`);
    return fn(...values);
}

// Test 1: Simple computed in expression
console.log("Test 1: Computed value in comparison");
const users = ref([
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 }
]);

const aliceName = computed(() => users.value[0].name);
const bobName = computed(() => users.value[1].name);

const store = { aliceName, bobName, users };

const result1 = testEvalInScope("aliceName === 'Alice'", store);
console.log(`  Result: ${result1}\n`);

// Test 2: Multiple computed in AND expression (like in the HTML)
console.log("Test 2: AND expression with two computed values");
const result2 = testEvalInScope("aliceName === 'Alice' && bobName === 'Bob'", store);
console.log(`  Result: ${result2}\n`);

// Test 3: Test reactivity through effect
console.log("Test 3: Effect tracking computed through evalInScope");
let effectRuns = 0;

effect(() => {
    effectRuns++;
    const result = testEvalInScope("aliceName === 'Alice' && bobName === 'Bob'", store);
    console.log(`  Effect run #${effectRuns}: result = ${result}`);
});

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Changing users...");
users.value = [
    { name: 'Charlie', age: 35 },
    { name: 'Diana', age: 28 }
];

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Total effect runs: ${effectRuns} (expected 2)\n`);

console.log("=== Tests completed ===");
