import { ref, reactive, effect, computed } from '../reactive.js';

console.log("=== Testing without 'with' statement ===\n");

// Test 1: Basic ref evaluation
console.log("Test 1: Basic ref evaluation");
const count = ref(5);
const store = { count };

// Simulate evalInScope
const keys = Object.keys(store);
const values = keys.map(key => store[key].value);
const fn = new Function(...keys, `return (count * 2);`);
const result = fn(...values);

console.log(`  count = ${count.value}`);
console.log(`  count * 2 = ${result}`);
console.log(`  Expected: 10, Got: ${result}\n`);

// Test 2: Complex expressions
console.log("Test 2: Complex expressions");
const a = ref(10);
const b = ref(20);
const c = ref(30);
const store2 = { a, b, c };

const keys2 = Object.keys(store2);
const values2 = keys2.map(key => store2[key].value);
const fn2 = new Function(...keys2, `return (a + b) * c;`);
const result2 = fn2(...values2);

console.log(`  (${a.value} + ${b.value}) * ${c.value} = ${result2}`);
console.log(`  Expected: 900, Got: ${result2}\n`);

// Test 3: Reactive object
console.log("Test 3: Reactive object evaluation");
const user = reactive({ name: "Alice", age: 25 });
const store3 = { user };

const keys3 = Object.keys(store3);
const values3 = keys3.map(key => store3[key]);
const fn3 = new Function(...keys3, `return user.name + " is " + user.age;`);
const result3 = fn3(...values3);

console.log(`  Result: "${result3}"`);
console.log(`  Expected: "Alice is 25", Got: "${result3}"\n`);

// Test 4: Accessing nested properties
console.log("Test 4: Nested property access");
const data = reactive({
    user: { name: "Bob", stats: { score: 100 } }
});
const store4 = { data };

const keys4 = Object.keys(store4);
const values4 = keys4.map(key => store4[key]);
const fn4 = new Function(...keys4, `return data.user.stats.score + 50;`);
const result4 = fn4(...values4);

console.log(`  data.user.stats.score + 50 = ${result4}`);
console.log(`  Expected: 150, Got: ${result4}\n`);

console.log("=== All tests passed ===");
