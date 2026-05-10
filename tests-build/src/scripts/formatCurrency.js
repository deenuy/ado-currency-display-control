"use strict";
// ---------------------------------------------------------------------
// Currency formatting — pure functions, no DOM, no SDK.
//
// Kept separate from control.ts so it can be unit-tested without
// mocking VSS or the work item form service.
// ---------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
/**
 * ISO 4217 currency code → display symbol.
 *
 * Curated to common codes that have a single-character symbol. Codes not
 * in this table fall back to "<CODE> " prefix (e.g. "BRL 2K"), which is
 * acceptable degradation for OSS scope.
 *
 * To add a currency, fork and append. No code changes required.
 */
const SYMBOLS = {
    USD: "$",
    CAD: "$",
    AUD: "$",
    NZD: "$",
    SGD: "$",
    HKD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
    KRW: "₩",
    CHF: "CHF ",
    SEK: "kr ",
    NOK: "kr ",
    DKK: "kr ",
    BRL: "R$",
    MXN: "$",
    ZAR: "R",
    PLN: "zł ",
    TRY: "₺"
};
/**
 * Format a numeric value as a currency string.
 *
 * Tiered behaviour for `compact` style:
 *   |value| < 1,000        → "$X" / "$X.XX"   (no abbreviation, two decimals if fractional)
 *   |value| < 10,000       → "$X,XXX"         (full number with thousands separator)
 *   |value| < 1,000,000    → "$XK"            (rounded to nearest thousand)
 *   |value| < 1,000,000,000 → "$X.XM"         (one decimal at million scale)
 *   |value| >= 1B          → "$X.XB"          (one decimal at billion scale)
 *
 * `full` style always uses thousands-separated full numbers with no abbreviation.
 *
 * Negative values render with a leading "-" (e.g. "-$50K").
 * null / undefined / NaN render as "" (empty — distinct from "$0").
 */
function formatCurrency(value, currency = "USD", style = "compact") {
    if (value == null || !Number.isFinite(value)) {
        return "";
    }
    const sym = symbolFor(currency);
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    if (style === "full") {
        // Use Intl for thousands separator. en-US is intentional — output is currency-symbol-prefixed,
        // not locale-formatted, so stable separators matter more than locale-correctness.
        return `${sign}${sym}${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    }
    // compact
    if (abs < 1000) {
        return `${sign}${sym}${trimDecimals(abs, 2)}`;
    }
    if (abs < 1000000) {
        return `${sign}${sym}${Math.round(abs / 1000)}K`;
    }
    if (abs < 1000000000) {
        return `${sign}${sym}${trimDecimals(abs / 1000000, 1)}M`;
    }
    return `${sign}${sym}${trimDecimals(abs / 1000000000, 1)}B`;
}
/** Returns the currency symbol for a code, falling back to "<CODE> ". */
function symbolFor(code) {
    const upper = (code || "USD").toUpperCase().trim();
    return SYMBOLS[upper] || `${upper} `;
}
/**
 * Round to N decimal places, then trim trailing zeros.
 * 1.5 → "1.5"   2.0 → "2"   1.234 → "1.2" (at maxDp=1)
 */
function trimDecimals(n, maxDp) {
    return parseFloat(n.toFixed(maxDp)).toString();
}
