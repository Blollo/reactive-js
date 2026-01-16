import { ref, watch } from '../reactive.js';

console.log("=== Testing watch() fixes ===\n");

// Test 1: Object reference problem fix
console.log("Test 1: Old value should be preserved (not same reference)");
const obj = ref({ count: 1 });

watch(obj, (newVal, oldVal) => {
    console.log("  oldVal:", oldVal);
    console.log("  newVal:", newVal);
    console.log("  Same reference?", oldVal === newVal);
});

obj.value = { count: 2 };

console.log("\n");

// Test 2: Nested object changes
console.log("Test 2: Nested object value changes");
const user = ref({ name: "Alice", stats: { score: 10 } });

watch(user, (newVal, oldVal) => {
    console.log("  old stats:", oldVal.stats);
    console.log("  new stats:", newVal.stats);
});

user.value = { name: "Alice", stats: { score: 20 } };

console.log("\n");

// Test 3: immediate option
console.log("Test 3: Immediate option should fire on initialization");
const count = ref(5);

watch(count, (newVal, oldVal) => {
    console.log(`  Callback fired: oldVal=${oldVal}, newVal=${newVal}`);
}, { immediate: true });

count.value = 10;

console.log("\n=== Tests completed ===");
