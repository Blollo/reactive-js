import { ref, effect } from '../reactive.js';

console.log("=== Testing [if] binding updates with debug ===\n");

// Simulate what happens with [if] directive
console.log("Test 1: Simple boolean toggle");
const isVisible = ref(false);
let renderCount = 0;

const ifEffect = effect(() => {
    const show = isVisible.value;
    renderCount++;
    console.log(`  [if] effect running (run #${renderCount}): show = ${show}`);
});

console.log("\nInitial state set up, renderCount:", renderCount);

console.log("\nChanging isVisible to true...");
isVisible.value = true;

// Wait for microtask to complete
await new Promise(resolve => setTimeout(resolve, 10));

console.log("After microtask, renderCount:", renderCount);
console.log("Expected renderCount: 2 (initial + update)\n");

// Test 2: Multiple rapid changes
console.log("Test 2: Multiple rapid changes (should batch)");
const flag = ref(false);
let batchRenderCount = 0;

effect(() => {
    const value = flag.value;
    batchRenderCount++;
    console.log(`  Batch effect running (run #${batchRenderCount}): value = ${value}`);
});

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\nMaking 3 rapid changes...");
const initialCount = batchRenderCount;
flag.value = true;
flag.value = false;
flag.value = true;

await new Promise(resolve => setTimeout(resolve, 10));

const additionalRuns = batchRenderCount - initialCount;
console.log(`Effect ran ${additionalRuns} additional time(s) (expected 1 due to batching)\n`);

// Test 3: Effect with cleanup
console.log("Test 3: Effect re-runs and cleanup");
const data = ref(1);
let cleanupCount = 0;

effect(() => {
    const val = data.value;
    cleanupCount++;
    console.log(`  Effect with data=${val}, run #${cleanupCount}`);
});

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\nUpdating data multiple times...");
data.value = 2;
await new Promise(resolve => setTimeout(resolve, 10));

data.value = 3;
await new Promise(resolve => setTimeout(resolve, 10));

console.log(`Total effect runs: ${cleanupCount} (expected 3: initial + 2 updates)\n`);

console.log("=== Debug tests completed ===");
