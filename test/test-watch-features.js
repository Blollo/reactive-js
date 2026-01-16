import { ref, reactive, watch } from '../reactive.js';

console.log("=== Testing watch() features ===\n");

// Test 1: immediate option
console.log("Test 1: immediate option should fire callback on initialization");
const count = ref(5);
let callCount = 0;

watch(count, (newVal, oldVal) => {
    callCount++;
    console.log(`  Callback ${callCount}: oldVal=${oldVal}, newVal=${newVal}`);
}, { immediate: true });

await new Promise(resolve => setTimeout(resolve, 10));

count.value = 10;

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Total callbacks: ${callCount} (expected 2: immediate + change)\n`);

// Test 2: deep option with reactive object
console.log("Test 2: deep option should watch nested property changes");
const user = reactive({
    name: "Alice",
    address: {
        city: "NYC",
        zip: "10001"
    }
});

let deepWatchCount = 0;

watch(() => user, (newVal, oldVal) => {
    deepWatchCount++;
    console.log(`  Deep watch fired ${deepWatchCount}: city changed to ${newVal.address.city}`);
}, { deep: true });

await new Promise(resolve => setTimeout(resolve, 10));

console.log("  Changing nested property user.address.city...");
user.address.city = "LA";

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Deep watch count: ${deepWatchCount} (expected 1)\n`);

// Test 3: Watching a getter function
console.log("Test 3: Watching a getter function");
const state = reactive({ a: 1, b: 2 });
let getterWatchCount = 0;

watch(
    () => state.a + state.b,
    (newVal, oldVal) => {
        getterWatchCount++;
        console.log(`  Sum changed from ${oldVal} to ${newVal}`);
    }
);

await new Promise(resolve => setTimeout(resolve, 10));

state.a = 10;

await new Promise(resolve => setTimeout(resolve, 10));

state.b = 20;

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Getter watch fired ${getterWatchCount} times (expected 2)\n`);

// Test 4: Stop watching
console.log("Test 4: Stop watching");
const value = ref(0);
let stopWatchCount = 0;

const stopWatch = watch(value, (newVal) => {
    stopWatchCount++;
    console.log(`  Value: ${newVal}`);
});

await new Promise(resolve => setTimeout(resolve, 10));

value.value = 1;

await new Promise(resolve => setTimeout(resolve, 10));

console.log("  Stopping watch...");
stopWatch.stop();

value.value = 2;
value.value = 3;

await new Promise(resolve => setTimeout(resolve, 10));

console.log(`  Watch fired ${stopWatchCount} times (expected 1 - stopped before subsequent changes)\n`);

console.log("=== All watch features tested ===");
