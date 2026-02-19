import { JSDOM } from 'jsdom';
import { ref, reactive, computed, scanBindings } from '../src/core/reactive.js';
import assert from 'assert';

// Setup jsdom
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true
});

// Copy all window properties to global
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.MutationObserver = dom.window.MutationObserver;
global.getComputedStyle = dom.window.getComputedStyle;

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

// Helper to wait for async effects
const waitForEffects = () => new Promise(resolve => setTimeout(resolve, 10));

console.log('Running DOM tests...\n');

// ============================================================================
// TEXT BINDING TESTS
// ============================================================================
console.log('=== TEXT BINDING TESTS ===');

await asyncTest('bindText: [text] directive updates', async () => {
    const count = ref(0);
    const div = document.createElement('div');
    div.innerHTML = '<span [text]="count"></span>';
    document.body.appendChild(div);

    const store = { count };
    scanBindings(div, store);

    await waitForEffects();
    assert.strictEqual(div.querySelector('span').textContent, '0');

    count.value = 5;
    await waitForEffects();
    assert.strictEqual(div.querySelector('span').textContent, '5');

    document.body.removeChild(div);
});

await asyncTest('bindText: data-text directive updates', async () => {
    const name = ref('Alice');
    const div = document.createElement('div');
    div.innerHTML = '<p data-text="name"></p>';
    document.body.appendChild(div);

    const store = { name };
    scanBindings(div, store);

    await waitForEffects();
    assert.strictEqual(div.querySelector('p').textContent, 'Alice');

    name.value = 'Bob';
    await waitForEffects();
    assert.strictEqual(div.querySelector('p').textContent, 'Bob');

    document.body.removeChild(div);
});

// ============================================================================
// INTERPOLATION TESTS
// ============================================================================
console.log('\n=== INTERPOLATION TESTS ===');

await asyncTest('interpolation: curly braces work', async () => {
    const count = ref(42);
    const div = document.createElement('div');
    div.innerHTML = '<p>Count: {count}</p>';
    document.body.appendChild(div);

    const store = { count };
    scanBindings(div, store);

    await waitForEffects();
    assert.ok(div.textContent.includes('42'));

    count.value = 99;
    await waitForEffects();
    assert.ok(div.textContent.includes('99'));

    document.body.removeChild(div);
});

await asyncTest('interpolation: multiple values', async () => {
    const first = ref('John');
    const last = ref('Doe');
    const div = document.createElement('div');
    div.innerHTML = '<p>{first} {last}</p>';
    document.body.appendChild(div);

    const store = { first, last };
    scanBindings(div, store);

    await waitForEffects();
    assert.ok(div.textContent.includes('John Doe'));

    first.value = 'Jane';
    await waitForEffects();
    assert.ok(div.textContent.includes('Jane Doe'));

    document.body.removeChild(div);
});

await asyncTest('interpolation: expressions work', async () => {
    const count = ref(5);
    const div = document.createElement('div');
    div.innerHTML = '<p>{count * 2}</p>';
    document.body.appendChild(div);

    const store = { count };
    scanBindings(div, store);

    await waitForEffects();
    assert.ok(div.textContent.includes('10'));

    document.body.removeChild(div);
});

// ============================================================================
// IF DIRECTIVE TESTS
// ============================================================================
console.log('\n=== IF DIRECTIVE TESTS ===');

await asyncTest('[if]: shows when true', async () => {
    const visible = ref(true);
    const div = document.createElement('div');
    div.innerHTML = '<p [if]="visible">Visible</p>';
    document.body.appendChild(div);

    const store = { visible };
    scanBindings(div, store);

    await waitForEffects();
    assert.ok(div.querySelector('p')); // Element should exist

    document.body.removeChild(div);
});

await asyncTest('[if]: hides when false', async () => {
    const visible = ref(false);
    const div = document.createElement('div');
    div.innerHTML = '<p [if]="visible">Hidden</p>';
    document.body.appendChild(div);

    const store = { visible };
    scanBindings(div, store);

    await waitForEffects();
    assert.strictEqual(div.querySelector('p'), null); // Element should not exist

    document.body.removeChild(div);
});

await asyncTest('[if]: toggles visibility', async () => {
    const visible = ref(false);
    const div = document.createElement('div');
    div.innerHTML = '<p [if]="visible">Toggle</p>';
    document.body.appendChild(div);

    const store = { visible };
    scanBindings(div, store);

    await waitForEffects();
    assert.strictEqual(div.querySelector('p'), null);

    visible.value = true;
    await waitForEffects();
    assert.ok(div.querySelector('p'));

    visible.value = false;
    await waitForEffects();
    assert.strictEqual(div.querySelector('p'), null);

    document.body.removeChild(div);
});

await asyncTest('[if]: works with computed', async () => {
    const count = ref(0);
    const isPositive = computed(() => count.value > 0);
    const div = document.createElement('div');
    div.innerHTML = '<p [if]="isPositive">Positive</p>';
    document.body.appendChild(div);

    const store = { isPositive };
    scanBindings(div, store);

    await waitForEffects();
    assert.strictEqual(div.querySelector('p'), null);

    count.value = 5;
    await waitForEffects();
    assert.ok(div.querySelector('p'));

    document.body.removeChild(div);
});

// ============================================================================
// SHOW DIRECTIVE TESTS
// ============================================================================
console.log('\n=== SHOW DIRECTIVE TESTS ===');

await asyncTest('[show]: displays when true', async () => {
    const visible = ref(true);
    const div = document.createElement('div');
    div.innerHTML = '<p [show]="visible">Shown</p>';
    document.body.appendChild(div);

    const store = { visible };
    scanBindings(div, store);

    await waitForEffects();
    const p = div.querySelector('p');
    assert.notStrictEqual(p.style.display, 'none');

    document.body.removeChild(div);
});

await asyncTest('[show]: hides when false', async () => {
    const visible = ref(false);
    const div = document.createElement('div');
    div.innerHTML = '<p [show]="visible">Hidden</p>';
    document.body.appendChild(div);

    const store = { visible };
    scanBindings(div, store);

    await waitForEffects();
    const p = div.querySelector('p');
    assert.strictEqual(p.style.display, 'none');

    document.body.removeChild(div);
});

await asyncTest('[show]: toggles display', async () => {
    const visible = ref(true);
    const div = document.createElement('div');
    div.innerHTML = '<p [show]="visible">Toggle</p>';
    document.body.appendChild(div);

    const store = { visible };
    scanBindings(div, store);

    await waitForEffects();
    let p = div.querySelector('p');
    assert.notStrictEqual(p.style.display, 'none');

    visible.value = false;
    await waitForEffects();
    assert.strictEqual(p.style.display, 'none');

    document.body.removeChild(div);
});

// ============================================================================
// MODEL DIRECTIVE TESTS
// ============================================================================
console.log('\n=== MODEL DIRECTIVE TESTS ===');

await asyncTest('[model]: input binding works', async () => {
    const text = ref('initial');
    const div = document.createElement('div');
    div.innerHTML = '<input type="text" [model]="text" />';
    document.body.appendChild(div);

    const store = { text };
    scanBindings(div, store);

    await waitForEffects();
    const input = div.querySelector('input');
    assert.strictEqual(input.value, 'initial');

    text.value = 'updated';
    await waitForEffects();
    assert.strictEqual(input.value, 'updated');

    document.body.removeChild(div);
});

await asyncTest('[model]: checkbox binding works', async () => {
    const checked = ref(false);
    const div = document.createElement('div');
    div.innerHTML = '<input type="checkbox" [model]="checked" />';
    document.body.appendChild(div);

    const store = { checked };
    scanBindings(div, store);

    await waitForEffects();
    const input = div.querySelector('input');
    assert.strictEqual(input.checked, false);

    checked.value = true;
    await waitForEffects();
    assert.strictEqual(input.checked, true);

    document.body.removeChild(div);
});

// ============================================================================
// CLASS DIRECTIVE TESTS
// ============================================================================
console.log('\n=== CLASS DIRECTIVE TESTS ===');

await asyncTest('[class]: adds classes from string', async () => {
    const classes = ref('active bold');
    const div = document.createElement('div');
    div.innerHTML = '<p [class]="classes">Text</p>';
    document.body.appendChild(div);

    const store = { classes };
    scanBindings(div, store);

    await waitForEffects();
    const p = div.querySelector('p');
    assert.ok(p.classList.contains('active'));
    assert.ok(p.classList.contains('bold'));

    document.body.removeChild(div);
});

await asyncTest('[class]: adds classes from object', async () => {
    const state = reactive({ isActive: true, isError: false });
    const div = document.createElement('div');
    div.innerHTML = '<p [class]="{ active: state.isActive, error: state.isError }">Text</p>';
    document.body.appendChild(div);

    const store = { state };
    scanBindings(div, store);

    await waitForEffects();
    const p = div.querySelector('p');
    assert.ok(p.classList.contains('active'));
    assert.ok(!p.classList.contains('error'));

    document.body.removeChild(div);
});

// ============================================================================
// ATTRIBUTE DIRECTIVE TESTS
// ============================================================================
console.log('\n=== ATTRIBUTE DIRECTIVE TESTS ===');

await asyncTest('dynamic attributes: :attr binding', async () => {
    const url = ref('https://example.com');
    const div = document.createElement('div');
    div.innerHTML = '<a :href="url">Link</a>';
    document.body.appendChild(div);

    const store = { url };
    scanBindings(div, store);

    await waitForEffects();
    const a = div.querySelector('a');
    assert.strictEqual(a.getAttribute('href'), 'https://example.com');

    url.value = 'https://newurl.com';
    await waitForEffects();
    assert.strictEqual(a.getAttribute('href'), 'https://newurl.com');

    document.body.removeChild(div);
});

await asyncTest('dynamic attributes: data-attr- binding', async () => {
    const id = ref('item-1');
    const div = document.createElement('div');
    div.innerHTML = '<div data-attr-id="id">Element</div>';
    document.body.appendChild(div);

    const store = { id };
    scanBindings(div, store);

    await waitForEffects();
    const el = div.querySelector('div');
    assert.strictEqual(el.getAttribute('id'), 'item-1');

    document.body.removeChild(div);
});

// ============================================================================
// EVENT DIRECTIVE TESTS
// ============================================================================
console.log('\n=== EVENT DIRECTIVE TESTS ===');

await asyncTest('events: @click binding', async () => {
    let clicked = false;
    const handleClick = () => { clicked = true; };
    const div = document.createElement('div');
    div.innerHTML = '<button @click="handleClick">Click</button>';
    document.body.appendChild(div);

    const store = { handleClick };
    scanBindings(div, store);

    const button = div.querySelector('button');
    button.click();

    assert.strictEqual(clicked, true);

    document.body.removeChild(div);
});

await asyncTest('events: data-onclick binding', async () => {
    const count = ref(0);
    const increment = () => { count.value++; };
    const div = document.createElement('div');
    div.innerHTML = '<button data-onclick="increment">+</button>';
    document.body.appendChild(div);

    const store = { increment, count };
    scanBindings(div, store);

    const button = div.querySelector('button');
    button.click();

    assert.strictEqual(count.value, 1);

    document.body.removeChild(div);
});

await asyncTest('events: method with arguments', async () => {
    let receivedArg = null;
    const handleClick = (arg) => { receivedArg = arg; };
    const div = document.createElement('div');
    div.innerHTML = '<button @click="handleClick(\'test\')">Click</button>';
    document.body.appendChild(div);

    const store = { handleClick };
    scanBindings(div, store);

    const button = div.querySelector('button');
    button.click();

    assert.strictEqual(receivedArg, 'test');

    document.body.removeChild(div);
});

// ============================================================================
// DATA-FOR TESTS
// ============================================================================
console.log('\n=== DATA-FOR TESTS ===');

await asyncTest('data-for: renders list', async () => {
    const items = ref(['Apple', 'Banana', 'Cherry']);
    const div = document.createElement('div');
    div.innerHTML = '<ul><li data-for="item of items">{item}</li></ul>';
    document.body.appendChild(div);

    const store = { items };
    scanBindings(div, store);

    await waitForEffects();
    const lis = div.querySelectorAll('li');
    assert.strictEqual(lis.length, 3);

    document.body.removeChild(div);
});

await asyncTest('data-for: updates on array change', async () => {
    const items = ref(['A', 'B']);
    const div = document.createElement('div');
    div.innerHTML = '<ul><li data-for="item of items">{item}</li></ul>';
    document.body.appendChild(div);

    const store = { items };
    scanBindings(div, store);

    await waitForEffects();
    let lis = div.querySelectorAll('li');
    assert.strictEqual(lis.length, 2);

    items.value.push('C');
    await waitForEffects();
    lis = div.querySelectorAll('li');
    assert.strictEqual(lis.length, 3);

    document.body.removeChild(div);
});

await asyncTest('data-for: with index', async () => {
    const items = ref(['X', 'Y']);
    const div = document.createElement('div');
    div.innerHTML = '<ul><li data-for="(item, index) of items">{index}: {item}</li></ul>';
    document.body.appendChild(div);

    const store = { items };
    scanBindings(div, store);

    await waitForEffects();
    const lis = div.querySelectorAll('li');
    assert.strictEqual(lis.length, 2);

    document.body.removeChild(div);
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================
console.log('\n=== INTEGRATION TESTS ===');

await asyncTest('integration: computed + [if] + interpolation', async () => {
    const users = ref([
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 }
    ]);
    const firstUser = computed(() => users.value[0].name);
    const isAlice = computed(() => firstUser.value === 'Alice');

    const div = document.createElement('div');
    div.innerHTML = '<div [if]="isAlice">Hello {firstUser}!</div>';
    document.body.appendChild(div);

    const store = { isAlice, firstUser };
    scanBindings(div, store);

    await waitForEffects();
    assert.ok(div.querySelector('div'));
    assert.ok(div.textContent.includes('Alice'));

    users.value = [{ name: 'Charlie', age: 35 }];
    await waitForEffects();
    assert.strictEqual(div.querySelector('div'), null);

    document.body.removeChild(div);
});

// ============================================================================
// RESULTS
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('DOM TEST RESULTS');
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
    console.log('\n🎉 All DOM tests passed!');
    process.exit(0);
}
