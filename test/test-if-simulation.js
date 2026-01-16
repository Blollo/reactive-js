import { ref, effect } from '../reactive.js';

console.log("=== Simulating bindIf behavior ===\n");

// Simulate the bindIf logic
function simulateBindIf(condition, name) {
    let isInserted = false;
    let effectRuns = 0;

    const eff = effect(() => {
        effectRuns++;
        const show = !!condition.value;

        console.log(`  [${name}] Effect run #${effectRuns}: show = ${show}, isInserted = ${isInserted}`);

        if (show && !isInserted) {
            console.log(`    → Inserting element`);
            isInserted = true;
        }
        else if (!show && isInserted) {
            console.log(`    → Removing element`);
            isInserted = false;
        }
        else {
            console.log(`    → No change needed`);
        }
    });

    return { effectRuns: () => effectRuns, isInserted: () => isInserted };
}

// Test 1: Start with false, then set to true
console.log("Test 1: Initial false → true");
const flag1 = ref(false);
const sim1 = simulateBindIf(flag1, "Test1");

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Changing to true...");
flag1.value = true;

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Total runs: ${sim1.effectRuns()}, Final isInserted: ${sim1.isInserted()}\n`);

// Test 2: Start with true, then set to false
console.log("Test 2: Initial true → false");
const flag2 = ref(true);
const sim2 = simulateBindIf(flag2, "Test2");

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Changing to false...");
flag2.value = false;

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Total runs: ${sim2.effectRuns()}, Final isInserted: ${sim2.isInserted()}\n`);

// Test 3: Multiple toggles
console.log("Test 3: Multiple toggles");
const flag3 = ref(false);
const sim3 = simulateBindIf(flag3, "Test3");

await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Toggle 1: false → true");
flag3.value = true;
await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Toggle 2: true → false");
flag3.value = false;
await new Promise(resolve => setTimeout(resolve, 10));

console.log("\n  Toggle 3: false → true");
flag3.value = true;
await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Total runs: ${sim3.effectRuns()}\n`);

console.log("=== Simulation completed ===");
