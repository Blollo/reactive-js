import { reactive, effect, watch, computed } from '../reactive.js';

console.log("=== Testing reactive() function ===\n");

// Test 1: Basic nested property reactivity
console.log("Test 1: Nested property changes should trigger effects");
const user = reactive({
    name: "Alice",
    address: {
        city: "NYC",
        zip: "10001"
    }
});

let effectCount = 0;
effect(() => {
    console.log(`  Effect running - City: ${user.address.city}`);
    effectCount++;
});

console.log("  Changing nested property...");
user.address.city = "LA";
user.address.zip = "90001";

console.log(`  Effect ran ${effectCount} times\n`);

// Test 2: Watch reactive object
console.log("Test 2: Watch reactive object with getter");
const state = reactive({ count: 0, multiplier: 2 });

watch(
    () => state.count * state.multiplier,
    (newVal, oldVal) => {
        console.log(`  Result changed from ${oldVal} to ${newVal}`);
    }
);

state.count = 5;
state.multiplier = 3;

console.log("\n");

// Test 3: Computed with reactive
console.log("Test 3: Computed values from reactive object");
const data = reactive({ price: 100, tax: 0.1 });

const total = computed(() => {
    return data.price * (1 + data.tax);
});

console.log(`  Initial total: ${total.value}`);

data.price = 200;
console.log(`  After price change: ${total.value}`);

data.tax = 0.2;
console.log(`  After tax change: ${total.value}`);

console.log("\n");

// Test 4: Deep nesting
console.log("Test 4: Very deep nesting");
const deepObj = reactive({
    level1: {
        level2: {
            level3: {
                value: "deep"
            }
        }
    }
});

effect(() => {
    console.log(`  Deep value: ${deepObj.level1.level2.level3.value}`);
});

deepObj.level1.level2.level3.value = "very deep";

console.log("\n=== All tests completed ===");
