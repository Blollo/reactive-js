import { ref, effect } from '../reactive.js';

console.log("=== Testing array index assignment reactivity ===\n");

// Test 1: Index assignment triggers effect
console.log("Test 1: Array index assignment should trigger effects");
const arr = ref([1, 2, 3]);
let effectCount = 0;

effect(() => {
    console.log(`  Array: [${arr.value}]`);
    effectCount++;
});

console.log("  Setting arr.value[0] = 99");
arr.value[0] = 99;

console.log("  Setting arr.value[2] = 77");
arr.value[2] = 77;

console.log(`  Effect ran ${effectCount} times (expected 3: initial + 2 changes)\n`);

// Test 2: Array methods still work
console.log("Test 2: Array methods should still work");
const list = ref([10, 20]);
let runCount = 0;

effect(() => {
    console.log(`  List length: ${list.value.length}, first: ${list.value[0]}`);
    runCount++;
});

console.log("  Pushing 30...");
list.value.push(30);

console.log("  Popping...");
list.value.pop();

console.log(`  Effect ran ${runCount} times\n`);

// Test 3: Combined index and method operations
console.log("Test 3: Mix of index assignments and method calls");
const nums = ref([1, 2, 3]);
const sum = ref(0);

effect(() => {
    sum.value = nums.value.reduce((a, b) => a + b, 0);
    console.log(`  Sum: ${sum.value}`);
});

nums.value[1] = 10; // Change 2 to 10
nums.value.push(4);
nums.value[0] = 5;  // Change 1 to 5

console.log("\n=== All tests completed ===");
