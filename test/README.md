# Reactive Framework - Test Suite

## Running Tests

### Quick Run
```bash
npm test
```

### With Shell Script
```bash
./test-runner.sh
```

### Direct Execution
```bash
node test/unit-tests.js
```

## Test Coverage

The test suite covers **34 test cases** across the following categories:

### 1. REF Tests (6 tests)
- Creates reactive references
- Value updates
- Effect triggering
- Array support
- Array mutations
- Array index assignments

### 2. REACTIVE Tests (5 tests)
- Object reactivity
- Nested properties
- Effect triggering
- Deep nested properties
- Proxy caching

### 3. COMPUTED Tests (5 tests)
- Basic computation
- Synchronous updates
- Chaining
- Reactive object integration
- Complex expressions

### 4. EFFECT Tests (4 tests)
- Immediate execution
- Dependency tracking
- Effect stopping
- Cleanup on re-run

### 5. WATCH Tests (6 tests)
- Basic ref watching
- Computed watching
- Immediate option
- Old value preservation
- Circular dependency prevention
- Function getters

### 6. BATCHING Tests (2 tests)
- Multiple update batching
- Synchronous computed updates

### 7. ERROR HANDLING Tests (4 tests)
- Stack overflow prevention
- Circular update handling
- Invalid input handling
- Stopped effect behavior

### 8. INTEGRATION Tests (2 tests)
- Complex reactive graphs
- Multi-layer dependencies

## Exit Codes

- `0`: All tests passed ✅
- `1`: One or more tests failed ❌

## Adding New Tests

Use the test helper functions:

```javascript
// Synchronous test
test('test name', () => {
    const result = someFunction();
    assert.strictEqual(result, expected);
});

// Asynchronous test
await asyncTest('async test name', async () => {
    await someAsyncOperation();
    assert.strictEqual(result, expected);
});
```

## Key Features Tested

✅ **Reactivity System**
- ref, reactive, computed
- Dependency tracking
- Effect execution

✅ **Watch System**
- Change detection
- Old value preservation
- Circular dependency prevention

✅ **Performance**
- Update batching
- Synchronous computed values

✅ **Error Prevention**
- Stack overflow protection
- Infinite loop detection
- Invalid input handling

## CI/CD Integration

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test
```

## Test Output Example

```
=== REF TESTS ===
✓ ref: creates reactive reference
✓ ref: updates value
...

============================================================
TEST RESULTS
============================================================
Total: 34
✓ Passed: 34
✗ Failed: 0

🎉 All tests passed!
```
