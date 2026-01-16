import { ref, computed, watch } from '../reactive.js';

console.log("=== Testing watch() function ===\n");

// Test 1: Watch a ref
console.log("Test 1: Watching a ref");
const count = ref(0);
const logs = [];

watch(count, (newVal, oldVal) => {
    const msg = `count changed from ${oldVal} to ${newVal}`;
    console.log("  " + msg);
    logs.push(msg);
});

console.log("  Initial value:", count.value);
count.value = 1;
count.value = 2;
count.value = 3;

console.log("\n");

// Test 2: Watch a computed
console.log("Test 2: Watching a computed");
const num = ref(5);
const doubled = computed(() => num.value * 2);

watch(doubled, (newVal, oldVal) => {
    console.log(`  doubled changed from ${oldVal} to ${newVal}`);
});

console.log("  Initial doubled value:", doubled.value);
num.value = 10;
num.value = 15;

console.log("\n");

// Test 3: Watch with object values (refs containing objects)
console.log("Test 3: Watching a ref with object value");
const user = ref({ name: "Alice", age: 25 });

watch(user, (newVal, oldVal) => {
    console.log(`  user changed from`, oldVal, `to`, newVal);
});

console.log("  Initial user:", user.value);
user.value = { name: "Bob", age: 30 };

console.log("\n");

// Test 4: Watch with arrays
console.log("Test 4: Watching a ref with array value");
const items = ref([1, 2, 3]);

watch(items, (newVal, oldVal) => {
    console.log(`  items changed from [${oldVal}] to [${newVal}]`);
});

console.log("  Initial items:", items.value);
items.value.push(4); // array mutation
items.value = [5, 6, 7]; // array replacement

console.log("\n=== All tests completed ===");
console.log(`Total watch callbacks fired: ${logs.length}`);
