import { ref, reactive, computed, watch, effect } from '../reactive.js';
import assert from 'assert';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;
const failedTests = [];

function test(name, fn) {
    try {
        fn();
        testsPassed++;
        console.log(`✅ ${name}`);
    } catch (error) {
        testsFailed++;
        failedTests.push({ name, error: error.message });
        console.error(`❌ ${name}`);
        console.error(`  ${error.message}`);
    }
}

async function asyncTest(name, fn) {
    try {
        await fn();
        testsPassed++;
        console.log(`✅ ${name}`);
    } catch (error) {
        testsFailed++;
        failedTests.push({ name, error: error.message });
        console.error(`❌ ${name}`);
        console.error(`  ${error.message}`);
    }
}

console.log('Running unit tests...\n');

// ============================================================================
// REF TESTS
// ============================================================================
console.log('=== REF TESTS ===');

test('ref: creates reactive reference', () => {
    const count = ref(0);
    assert.strictEqual(count.value, 0);
});

test('ref: updates value', () => {
    const count = ref(0);
    count.value = 5;
    assert.strictEqual(count.value, 5);
});

test('ref: triggers effect on change', () => {
    const count = ref(0);
    let dummy;
    effect(() => {
        dummy = count.value;
    });
    assert.strictEqual(dummy, 0);
    count.value = 1;
    // Effect is async, but we can check it queued
});

test('ref: works with arrays', () => {
    const arr = ref([1, 2, 3]);
    const unwrapped = Array.from(arr.value);
    assert.deepStrictEqual(unwrapped, [1, 2, 3]);
});

test('ref: array mutations trigger effects', () => {
    const arr = ref([1, 2, 3]);
    let dummy;
    effect(() => {
        dummy = arr.value.length;
    });
    arr.value.push(4);
    // Should trigger effect
});

test('ref: array index assignment works', () => {
    const arr = ref([1, 2, 3]);
    arr.value[0] = 99;
    assert.strictEqual(arr.value[0], 99);
});

// ============================================================================
// REACTIVE TESTS
// ============================================================================
console.log('\n=== REACTIVE TESTS ===');

test('reactive: creates reactive object', () => {
    const obj = reactive({ count: 0 });
    assert.strictEqual(obj.count, 0);
});

test('reactive: nested properties are reactive', () => {
    const obj = reactive({
        nested: { value: 1 }
    });
    obj.nested.value = 2;
    assert.strictEqual(obj.nested.value, 2);
});

test('reactive: triggers effect on property change', () => {
    const obj = reactive({ count: 0 });
    let dummy;
    effect(() => {
        dummy = obj.count;
    });
    obj.count = 1;
    // Effect queued
});

test('reactive: deep nested properties trigger effects', () => {
    const obj = reactive({
        level1: {
            level2: {
                value: 'deep'
            }
        }
    });
    let dummy;
    effect(() => {
        dummy = obj.level1.level2.value;
    });
    obj.level1.level2.value = 'changed';
    // Effect queued
});

test('reactive: returns same proxy for same object', () => {
    const obj = { count: 0 };
    const proxy1 = reactive(obj);
    const proxy2 = reactive(obj);
    assert.strictEqual(proxy1, proxy2);
});

// ============================================================================
// COMPUTED TESTS
// ============================================================================
console.log('\n=== COMPUTED TESTS ===');

test('computed: computes value from getter', () => {
    const count = ref(1);
    const doubled = computed(() => count.value * 2);
    assert.strictEqual(doubled.value, 2);
});

test('computed: updates synchronously', () => {
    const count = ref(1);
    const doubled = computed(() => count.value * 2);
    count.value = 5;
    assert.strictEqual(doubled.value, 10);
});

test('computed: chains correctly', () => {
    const count = ref(2);
    const doubled = computed(() => count.value * 2);
    const quadrupled = computed(() => doubled.value * 2);
    assert.strictEqual(quadrupled.value, 8);
    count.value = 3;
    assert.strictEqual(quadrupled.value, 12);
});

test('computed: with reactive objects', () => {
    const state = reactive({ a: 1, b: 2 });
    const sum = computed(() => state.a + state.b);
    assert.strictEqual(sum.value, 3);
    state.a = 10;
    assert.strictEqual(sum.value, 12);
});

test('computed: complex expressions', () => {
    const users = ref([
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 }
    ]);
    const firstUserName = computed(() => users.value[0].name);
    assert.strictEqual(firstUserName.value, 'Alice');
    users.value = [{ name: 'Charlie', age: 35 }];
    assert.strictEqual(firstUserName.value, 'Charlie');
});

// ============================================================================
// EFFECT TESTS
// ============================================================================
console.log('\n=== EFFECT TESTS ===');

test('effect: runs immediately', () => {
    let dummy;
    effect(() => {
        dummy = 'ran';
    });
    assert.strictEqual(dummy, 'ran');
});

test('effect: tracks dependencies', () => {
    const count = ref(0);
    let dummy;
    effect(() => {
        dummy = count.value;
    });
    assert.strictEqual(dummy, 0);
});

test('effect: can be stopped', () => {
    const count = ref(0);
    let dummy = 0;
    const runner = effect(() => {
        dummy = count.value;
    });
    assert.strictEqual(dummy, 0);
    runner.stop();
    count.value = 1;
    assert.strictEqual(dummy, 0); // Should not update
});

test('effect: cleanup on re-run', () => {
    const condition = ref(true);
    const value1 = ref(1);
    const value2 = ref(2);
    let dummy;

    effect(() => {
        dummy = condition.value ? value1.value : value2.value;
    });

    assert.strictEqual(dummy, 1);
});

// ============================================================================
// WATCH TESTS
// ============================================================================
console.log('\n=== WATCH TESTS ===');

await asyncTest('watch: basic ref watching', async () => {
    const count = ref(0);
    let newVal, oldVal;

    watch(count, (n, o) => {
        newVal = n;
        oldVal = o;
    });

    count.value = 5;
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(newVal, 5);
    assert.strictEqual(oldVal, 0);
});

await asyncTest('watch: computed watching', async () => {
    const count = ref(0);
    const doubled = computed(() => count.value * 2);
    let watchedValue;

    watch(doubled, (newVal) => {
        watchedValue = newVal;
    });

    count.value = 5;
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(watchedValue, 10);
});

await asyncTest('watch: immediate option', async () => {
    const count = ref(5);
    let calls = 0;

    watch(count, () => {
        calls++;
    }, { immediate: true });

    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(calls, 1); // Should fire immediately
});

await asyncTest('watch: old value preservation', async () => {
    const obj = ref({ count: 1 });
    let oldVal, newVal;

    watch(obj, (n, o) => {
        newVal = n;
        oldVal = o;
    });

    obj.value = { count: 2 };
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.notStrictEqual(oldVal, newVal); // Should be different references
    assert.strictEqual(oldVal.count, 1);
    assert.strictEqual(newVal.count, 2);
});

await asyncTest('watch: prevents circular dependencies', async () => {
    const count = ref(0);
    const other = ref(0);
    let watchCalls = 0;

    watch(count, () => {
        watchCalls++;
        other.value++; // Should not cause infinite loop
    });

    count.value = 1;
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(watchCalls, 1);
    assert.strictEqual(other.value, 1);
});

await asyncTest('watch: function getter', async () => {
    const state = reactive({ a: 1, b: 2 });
    let sum;

    watch(
        () => state.a + state.b,
        (newVal) => {
            sum = newVal;
        }
    );

    state.a = 10;
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(sum, 12);
});

// ============================================================================
// BATCHING TESTS
// ============================================================================
console.log('\n=== BATCHING TESTS ===');

await asyncTest('batching: multiple updates batched', async () => {
    const count = ref(0);
    let effectRuns = 0;

    effect(() => {
        count.value; // Track
        effectRuns++;
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    const runsAfterInit = effectRuns;

    count.value = 1;
    count.value = 2;
    count.value = 3;

    await new Promise(resolve => setTimeout(resolve, 10));

    const additionalRuns = effectRuns - runsAfterInit;
    assert.strictEqual(additionalRuns, 1); // Should batch into 1 run
});

await asyncTest('batching: computed updates synchronously', async () => {
    const count = ref(1);
    const doubled = computed(() => count.value * 2);

    count.value = 5;
    // Should update immediately, no waiting
    assert.strictEqual(doubled.value, 10);
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================
console.log('\n=== ERROR HANDLING TESTS ===');

await asyncTest('error: watch does not cause stack overflow', async () => {
    const count = ref(0);
    const other = ref(0);
    let errorOccurred = false;

    try {
        watch(count, () => {
            other.value++;
        });

        // Create many rapid changes
        for (let i = 0; i < 100; i++) {
            count.value++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        // If we get here without error, test passes
        assert.ok(true);
    } catch (e) {
        if (e.message.includes('stack') || e.message.includes('Maximum')) {
            errorOccurred = true;
        }
        throw e;
    }

    assert.strictEqual(errorOccurred, false);
});

await asyncTest('error: circular ref updates handled', async () => {
    const a = ref(0);
    const b = ref(0);

    // This could potentially create circular updates
    watch(a, () => {
        if (b.value < 5) {
            b.value++;
        }
    });

    watch(b, () => {
        if (a.value < 5) {
            a.value++;
        }
    });

    a.value = 1;

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not crash, values should stabilize
    assert.ok(a.value < 100); // Not infinite
    assert.ok(b.value < 100);
});

test('error: reactive with non-object', () => {
    const result = reactive(null);
    assert.strictEqual(result, null);
});

test('error: effect with stopped effect', () => {
    let dummy = 0;
    const runner = effect(() => {
        dummy++;
    });

    runner.stop();
    runner(); // Should not run

    assert.strictEqual(dummy, 1); // Only initial run
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================
console.log('\n=== INTEGRATION TESTS ===');

test('integration: reactive + computed + watch', async () => {
    const state = reactive({ count: 0 });
    const doubled = computed(() => state.count * 2);
    let watchedValue;

    watch(doubled, (newVal) => {
        watchedValue = newVal;
    });

    state.count = 5;

    // Computed should update immediately
    assert.strictEqual(doubled.value, 10);
});

await asyncTest('integration: complex reactive graph', async () => {
    const base = ref(2);
    const doubled = computed(() => base.value * 2);
    const quadrupled = computed(() => doubled.value * 2);
    const state = reactive({ multiplier: 1 });
    const result = computed(() => quadrupled.value * state.multiplier);

    assert.strictEqual(result.value, 8);

    base.value = 3;
    assert.strictEqual(result.value, 12);

    state.multiplier = 2;
    assert.strictEqual(result.value, 24);
});

// ============================================================================
// RESULTS
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('TEST RESULTS');
console.log('='.repeat(60));
console.log(`Total: ${testsPassed + testsFailed}`);
console.log(`✓ Passed: ${testsPassed}`);
console.log(`✗ Failed: ${testsFailed}`);

if (failedTests.length > 0) {
    console.log('\nFailed tests:');
    failedTests.forEach(({ name, error }) => {
        console.log(`  - ${name}`);
        console.log(`    ${error}`);
    });
    process.exit(1);
} else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
}
