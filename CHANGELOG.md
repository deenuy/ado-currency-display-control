# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-10

Initial public release.

### Added

#### Custom work item form control

- New ADO contribution `ms.vss-work-web.work-item-form-control` that replaces the default rendering of a numeric field on the work item form.
- Renders Integer and Double fields as formatted currency (e.g. `$2K`, `€1.5M`, `₹245K`).
- Click-to-edit: the formatted display becomes a numeric input on click or keyboard activation, and commits the new value on blur or Enter.
- Escape cancels an in-progress edit and reverts to the displayed value.
- Reads and writes the underlying numeric field directly via `WorkItemFormService` — no shadow string field, no synchronization logic.
- Respects field-level read-only state: read-only fields render without click-to-edit affordance.

#### Configurable inputs

- `FieldName` (required) — the Integer or Double field to bind. ADO's field picker filters to numeric types only, preventing misconfiguration at form-design time.
- `Currency` (optional, default `USD`) — ISO 4217 code. Built-in symbol mapping for USD, EUR, GBP, JPY, INR, CAD, AUD, NZD, SGD, HKD, CNY, KRW, CHF, SEK, NOK, DKK, BRL, MXN, ZAR, PLN, TRY. Unknown codes fall back to `<CODE> <value>` (e.g. `BRL 2K`).
- `Style` (optional, default `compact`) — `compact` produces `$2K` / `$1.5M`; `full` produces `$2,000` / `$1,500,000`.

#### Formatting

- Compact tier rules:
    - `|value| < 1,000` → exact value with up to 2 decimals (`$500`, `$999.5`).
    - `1,000 ≤ |value| < 1,000,000` → thousands abbreviation (`$2K`, `$245K`).
    - `1,000,000 ≤ |value| < 1,000,000,000` → millions abbreviation with one decimal (`$1.5M`, `$12M`).
    - `|value| ≥ 1,000,000,000` → billions abbreviation with one decimal (`$1.2B`).
- Full tier always renders thousands-separated full numbers via `Intl.NumberFormat` (`en-US` locale for stable separator behavior).
- Negative values render with a leading minus (`-$50K`).
- `null`, `undefined`, and `NaN` render as empty string (distinct from `$0`).

#### Visual design

- Inline rendering at 24 px height, matching ADO's default field control dimensions.
- Tabular-numeric font for stable alignment across rows in query views.
- Hover and focus states for the display element.
- Native dark-mode support via `prefers-color-scheme` media query.
- Hover tooltip on the display shows the raw underlying numeric value.
- Empty-value placeholder (`—`) for fields with no value.

#### Build and tooling

- TypeScript 5.4 source with strict type checking via `tsc --noEmit`.
- Webpack 5 production bundling to AMD modules in `dist/`.
- `vss-web-extension-sdk` 5.141 for ADO platform integration.
- `tfx-cli` 0.23 for `.vsix` packaging and marketplace publishing.
- Separate `tsconfig.test.json` for unit-test compilation, isolated from the production type configuration.

#### Testing

- Unit test suite for the `formatCurrency` function covering:
    - All four compact tiers (`<1K`, `K`, `M`, `B`).
    - Full-style formatting with thousands separators.
    - Negative values.
    - `null`, `undefined`, and `NaN` handling.
    - Multiple currency codes (USD, EUR, GBP, INR, JPY, BRL).
    - Unknown-code fallback behavior.
- Lightweight test runner — no Jest or Vitest dependency, just `tsc` + Node.

#### Open-source scaffolding

- MIT license.
- README with quick-start, configuration table, format examples, build instructions, and roadmap.
- `docs/HOW-IT-WORKS.md` walkthrough for contributors covering control lifecycle, formatter design, and common pitfalls.
- `CONTRIBUTING.md` covering dev setup, code style, and PR guidelines.
- Marketplace listing (`marketplace/overview.md`) with feature highlights and configuration guidance.
- `Makefile` with separated local-release and push steps to prevent accidental publishing.
- GitHub Actions CI workflow running typecheck, test, and build on every push and pull request.
- Issue and pull request templates.

### Security

- Extension scope limited to `vso.work` — the control reads and writes only the numeric field it is bound to.
- No telemetry, analytics, or external network calls.
- No third-party CDN dependencies; all runtime assets ship in the `.vsix`.

### Compatibility

- Azure DevOps Services (all current versions).
- Azure DevOps Server 2018 and later (TFS 15.0+).
- Modern evergreen browsers (Chrome 90+, Edge 90+, Firefox 88+, Safari 14+).
- Node 18+ required for building from source.

### Known limitations

The following are deliberately out of scope for v1.0.0 and may be considered for future releases:

- **Locale-specific abbreviations.** Indian numbering (`₹2.5L` lakhs, `₹1.2Cr` crores) is not supported. INR values use Western K/M/B abbreviations.
- **Per-binding decimal precision.** The number of decimal places at M and B scale is hardcoded to one. There is no input to configure this per field binding.
- **Multi-currency conversion.** The control displays the raw numeric value with the configured currency symbol. It does not convert between currencies; aggregating values stored in different currencies will produce incorrect totals.
- **Accounting-style negatives.** Negative values render with a leading minus (`-$50K`). Parenthesized negatives (`($50K)`) are not supported.
- **Form labels.** The field's label on the work item form is controlled by ADO process customization, not by this extension.

[1.0.0]: https://github.com/deenuy/ado-currency-display-control/releases/tag/v1.0.0