import { ref, computed, effect } from '../reactive.js';

console.log("=== Testing Synchronous Computed Updates ===\n");

// Test 1: Computed should update synchronously
console.log("Test 1: Computed updates immediately (synchronous)");
const count = ref(1);
const doubled = computed(() => count.value * 2);

console.log(`  Initial: count=${count.value}, doubled=${doubled.value}`);

console.log("  Changing count to 5...");
count.value = 5;

console.log(`  Immediately after: count=${count.value}, doubled=${doubled.value}`);
console.log(`  Expected: doubled=10, Got: ${doubled.value}`);
console.log(`  ✓ ${doubled.value === 10 ? 'PASS' : 'FAIL'}\n`);

// Test 2: Multiple computed values
console.log("Test 2: Chain of computed values");
const a = ref(2);
const b = computed(() => a.value * 2);
const c = computed(() => b.value + 10);

console.log(`  Initial: a=${a.value}, b=${b.value}, c=${c.value}`);

a.value = 5;

console.log(`  After a=5: a=${a.value}, b=${b.value}, c=${c.value}`);
console.log(`  Expected: b=10, c=20, Got: b=${b.value}, c=${c.value}`);
console.log(`  ✓ ${b.value === 10 && c.value === 20 ? 'PASS' : 'FAIL'}\n`);

// Test 3: Computed in conditional
console.log("Test 3: Using computed immediately in conditional");
const users = ref([
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 }
]);

const aliceName = computed(() => users.value[0].name);
const bobName = computed(() => users.value[1].name);

console.log(`  Initial: alice=${aliceName.value}, bob=${bobName.value}`);

const condition1 = aliceName.value === 'Alice' && bobName.value === 'Bob';
console.log(`  Condition before change: ${condition1} (expected true)`);

users.value = [
    { name: 'Charlie', age: 35 },
    { name: 'Diana', age: 28 }
];

console.log(`  After change: alice=${aliceName.value}, bob=${bobName.value}`);
const condition2 = aliceName.value === 'Alice' && bobName.value === 'Bob';
console.log(`  Condition after change: ${condition2} (expected false)`);
console.log(`  ✓ ${!condition2 ? 'PASS' : 'FAIL'}\n`);

// Test 4: DOM effects should still batch
console.log("Test 4: DOM effects still batch (async)");
const domValue = ref(0);
let domEffectRuns = 0;

effect(() => {
    // Simulate DOM update
    const val = domValue.value;
    domEffectRuns++;
    console.log(`  DOM effect run #${domEffectRuns}: value=${val}`);
});

await new Promise(resolve => setTimeout(resolve, 10));

console.log("  Making 3 rapid changes...");
const runsBeforeChanges = domEffectRuns;
domValue.value = 1;
domValue.value = 2;
domValue.value = 3;

console.log(`  Before microtask flush: ${domEffectRuns - runsBeforeChanges} additional runs`);

await new Promise(resolve => setTimeout(resolve, 10));

const totalAdditionalRuns = domEffectRuns - runsBeforeChanges;
console.log(`  After microtask flush: ${totalAdditionalRuns} additional run(s) (expected 1 due to batching)`);
console.log(`  ✓ ${totalAdditionalRuns === 1 ? 'PASS' : 'FAIL'}\n`);

console.log("=== All tests completed ===");
