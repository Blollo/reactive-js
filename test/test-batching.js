import { ref, effect } from '../reactive.js';

console.log("=== Testing Update Batching ===\n");

// Test 1: Multiple synchronous updates should batch
console.log("Test 1: Multiple updates in same tick should batch");
const count = ref(0);
let effectRuns = 0;

effect(() => {
    console.log(`  Effect running - count: ${count.value}`);
    effectRuns++;
});

console.log("  Making 3 synchronous updates...");
count.value = 1;
count.value = 2;
count.value = 3;

// Wait for microtask queue to flush
await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Effect ran ${effectRuns} times (expected 2: initial + 1 batched update)\n`);

// Test 2: Multiple refs with shared effect
console.log("Test 2: Multiple refs with shared effect");
const a = ref(1);
const b = ref(2);
const c = ref(3);
let runs = 0;

effect(() => {
    const sum = a.value + b.value + c.value;
    console.log(`  Sum: ${sum}`);
    runs++;
});

await new Promise(resolve => setTimeout(resolve, 10));

console.log("  Updating all three refs...");
const initialRuns = runs;
a.value = 10;
b.value = 20;
c.value = 30;

await new Promise(resolve => setTimeout(resolve, 10));

const newRuns = runs - initialRuns;
console.log(`  Effect ran ${newRuns} additional time(s) (expected 1 batched update)\n`);

// Test 3: Verify final values are correct
console.log("Test 3: Final values should be correct after batching");
const value = ref(0);
const doubled = ref(0);

effect(() => {
    doubled.value = value.value * 2;
});

await new Promise(resolve => setTimeout(resolve, 10));

value.value = 5;
value.value = 10;
value.value = 15;

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  value: ${value.value} (expected 15)`);
console.log(`  doubled: ${doubled.value} (expected 30)\n`);

console.log("=== Batching tests completed ===");
