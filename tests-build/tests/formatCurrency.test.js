"use strict";
// Unit tests for formatCurrency. Run with: npm test
// Designed to run under any test runner that understands ESM/CJS — Jest, Vitest, Node test.
Object.defineProperty(exports, "__esModule", { value: true });
const formatCurrency_1 = require("../src/scripts/formatCurrency");
const cases = [
    // [value, currency, style, expected]
    [null, "USD", "compact", ""],
    [undefined, "USD", "compact", ""],
    [NaN, "USD", "compact", ""],
    [0, "USD", "compact", "$0"],
    [500, "USD", "compact", "$500"],
    [999.5, "USD", "compact", "$999.5"],
    [1000, "USD", "compact", "$1K"],
    [9999, "USD", "compact", "$10K"],
    [10000, "USD", "compact", "$10K"],
    [12345, "USD", "compact", "$12K"],
    [245678, "USD", "compact", "$246K"],
    [1500000, "USD", "compact", "$1.5M"],
    [12000000, "USD", "compact", "$12M"],
    [1200000000, "USD", "compact", "$1.2B"],
    [-50000, "USD", "compact", "-$50K"],
    // currencies
    [2000, "EUR", "compact", "€2K"],
    [2000, "GBP", "compact", "£2K"],
    [2000, "INR", "compact", "₹2K"],
    [2000, "JPY", "compact", "¥2K"],
    [2000, "BRL", "compact", "R$2K"],
    [2000, "ZZZ", "compact", "ZZZ 2K"], // unknown code → fallback
    // full style
    [2000, "USD", "full", "$2,000"],
    [12345678, "USD", "full", "$12,345,678"],
    [-50000, "USD", "full", "-$50,000"],
];
let passed = 0, failed = 0;
for (const [value, currency, style, expected] of cases) {
    const actual = (0, formatCurrency_1.formatCurrency)(value, currency, style);
    if (actual === expected) {
        passed++;
    }
    else {
        failed++;
        console.error(`  FAIL  formatCurrency(${value}, "${currency}", "${style}")`);
        console.error(`        expected: "${expected}"`);
        console.error(`        actual:   "${actual}"`);
    }
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
