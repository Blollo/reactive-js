import { ref, computed, effect } from '../reactive.js';

console.log("=== Testing computed triggers ===\n");

// Test 1: Basic computed triggering
console.log("Test 1: Computed value changes trigger effects");
const count = ref(1);
const doubled = computed(() => count.value * 2);
let effectRuns = 0;

effect(() => {
    effectRuns++;
    console.log(`  Effect run #${effectRuns}: doubled = ${doubled.value}`);
});

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Changing count to 5...");
count.value = 5;

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Total runs: ${effectRuns} (expected 2)\n`);

// Test 2: Computed in conditional expression
console.log("Test 2: Computed in boolean expression");
const name = ref("Alice");
const isAlice = computed(() => name.value === "Alice");
let conditionRuns = 0;

effect(() => {
    conditionRuns++;
    const result = isAlice.value;
    console.log(`  Effect run #${conditionRuns}: isAlice = ${result}`);
});

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Changing name to 'Bob'...");
name.value = "Bob";

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Changing name back to 'Alice'...");
name.value = "Alice";

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Total runs: ${conditionRuns} (expected 3)\n`);

// Test 3: Multiple computed values in expression
console.log("Test 3: Multiple computed in AND expression");
const users = ref([
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 }
]);

const aliceName = computed(() => users.value[0].name);
const bobName = computed(() => users.value[1].name);
let multiComputedRuns = 0;

effect(() => {
    multiComputedRuns++;
    const result = aliceName.value === 'Alice' && bobName.value === 'Bob';
    console.log(`  Effect run #${multiComputedRuns}: aliceName=${aliceName.value}, bobName=${bobName.value}, result=${result}`);
});

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Changing users array...");
users.value = [
    { name: 'Charlie', age: 35 },
    { name: 'Diana', age: 28 }
];

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Total runs: ${multiComputedRuns} (expected 2)\n`);

console.log("=== All tests completed ===");
