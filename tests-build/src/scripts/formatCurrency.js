// ---------------------------------------------------------------------
// <copyright file="formatCurrency.ts">
//    This code is licensed under the MIT License.
// </copyright>
// ---------------------------------------------------------------------
//
// Pure formatting functions. No DOM, no SDK, no side effects.
//
// Kept separate from control.ts so the formatter can be unit-tested
// without mocking VSS or the work-item form service.
// ---------------------------------------------------------------------
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
/**
 * ISO 4217 currency code → display symbol.
 *
 * Curated to common codes that have a single-character symbol or a
 * recognisable short prefix. Codes not in this table fall back to
 * "<CODE> " as a prefix (e.g. "BRL 2K" if BRL were missing), which is
 * acceptable degradation.
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
 * Compact tier rules:
 *   |value| < 1,000           → exact, up to 2 decimals    "$500" / "$999.5"
 *   |value| < 1,000,000       → thousands abbreviation     "$2K" / "$245K"
 *   |value| < 1,000,000,000   → millions, 1 decimal trimmed "$1.5M" / "$12M"
 *   |value| ≥ 1,000,000,000   → billions, 1 decimal trimmed "$1.2B"
 *
 * Full style always renders the full number with thousands separators
 * via Intl.NumberFormat (en-US locale for stable separator behaviour;
 * the currency symbol is prepended manually rather than via the locale).
 *
 * Negative values render with a leading minus: "-$50K".
 * null, undefined, and NaN render as the empty string (distinct from "$0").
 */
function formatCurrency(value, currency = "USD", style = "compact") {
    if (value == null || !Number.isFinite(value)) {
        return "";
    }
    const sym = symbolFor(currency);
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    if (style === "full") {
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
/** Look up a currency symbol, falling back to "<CODE> " for unknown codes. */
function symbolFor(code) {
    const upper = (code || "USD").toUpperCase().trim();
    return SYMBOLS[upper] || `${upper} `;
}
/**
 * Round to N decimal places, then trim trailing zeros.
 * 1.5 → "1.5", 2.0 → "2", 1.234 (at maxDp=1) → "1.2"
 */
function trimDecimals(n, maxDp) {
    return parseFloat(n.toFixed(maxDp)).toString();
}
