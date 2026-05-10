// Unit tests for formatCurrency. Run with: npm test
// Designed to run under any test runner that understands ESM/CJS — Jest, Vitest, Node test.

import { formatCurrency } from "../src/scripts/formatCurrency";
import { strict as assert } from "assert";

const cases: Array<[number | null | undefined, string, "compact" | "full", string]> = [
    // [value, currency, style, expected]
    [null,           "USD", "compact", ""],
    [undefined,      "USD", "compact", ""],
    [NaN,            "USD", "compact", ""],
    [0,              "USD", "compact", "$0"],
    [500,            "USD", "compact", "$500"],
    [999.5,          "USD", "compact", "$999.5"],
    [1_000,          "USD", "compact", "$1K"],
    [9_999,          "USD", "compact", "$10K"],
    [10_000,         "USD", "compact", "$10K"],
    [12_345,         "USD", "compact", "$12K"],
    [245_678,        "USD", "compact", "$246K"],
    [1_500_000,      "USD", "compact", "$1.5M"],
    [12_000_000,     "USD", "compact", "$12M"],
    [1_200_000_000,  "USD", "compact", "$1.2B"],
    [-50_000,        "USD", "compact", "-$50K"],

    // currencies
    [2_000,          "EUR", "compact", "€2K"],
    [2_000,          "GBP", "compact", "£2K"],
    [2_000,          "INR", "compact", "₹2K"],
    [2_000,          "JPY", "compact", "¥2K"],
    [2_000,          "BRL", "compact", "R$2K"],
    [2_000,          "ZZZ", "compact", "ZZZ 2K"],   // unknown code → fallback

    // full style
    [2_000,          "USD", "full",    "$2,000"],
    [12_345_678,     "USD", "full",    "$12,345,678"],
    [-50_000,        "USD", "full",    "-$50,000"],
];

let passed = 0, failed = 0;
for (const [value, currency, style, expected] of cases) {
    const actual = formatCurrency(value as any, currency, style);
    if (actual === expected) {
        passed++;
    } else {
        failed++;
        console.error(`  FAIL  formatCurrency(${value}, "${currency}", "${style}")`);
        console.error(`        expected: "${expected}"`);
        console.error(`        actual:   "${actual}"`);
    }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { process.exit(1); }