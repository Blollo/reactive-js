#!/bin/bash

# Test runner for Reactive framework
# Usage: ./test-runner.sh

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Reactive Framework - Test Suite Runner             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Run unit tests
echo "Running unit tests..."
node test/unit-tests.js

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                  ✅ ALL TESTS PASSED ✅                    ║"
    echo "╚════════════════════════════════════════════════════════════╝"
else
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                  ❌ TESTS FAILED ❌                        ║"
    echo "╚════════════════════════════════════════════════════════════╝"
fi

exit $EXIT_CODE
