# Currency Display Control for Azure DevOps

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/deenuy.ado-currency-display-control?label=Marketplace&color=0078d4)](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-currency-display-control)
[![GitHub Stars](https://img.shields.io/github/stars/deenuy/ado-currency-display-control?style=flat&color=ffd700)](https://github.com/deenuy/ado-currency-display-control/stargazers)
[![Build](https://github.com/deenuy/ado-currency-display-control/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/deenuy/ado-currency-display-control/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

An Azure DevOps work item form control that renders any Integer or Double field as formatted currency — `$2K`, `€1.5M`, `₹245K`, `-$50K`. Reusable across **BU Impact**, **Estimated Cost**, **Actual Cost**, or any custom numeric field you bind it to.

![Demo](docs/images/demo.gif)

## Why

Azure DevOps numeric fields render as raw numbers: `2000`, `1500000`. For PMO dashboards, executive reviews, and portfolio reporting, teams want human-readable currency formatting on the work item form itself — not just in custom dashboards.

This control replaces the default numeric input with a formatted display. Click to edit, type a number, blur or press Enter to save. The underlying field stays as a clean numeric value (single source of truth), so it remains usable in queries, charts, OData feeds, and any other ADO context.

## Features

- **Single source of truth.** No shadow string field, no sync logic. The control is purely a UI layer over a numeric field.
- **Reusable.** Bind the same control to multiple fields. One install covers BU Impact, Estimated Cost, Actual Cost — any numeric field.
- **Multi-currency.** USD, EUR, GBP, INR, JPY, CAD, AUD, BRL, ZAR, and more. ISO 4217 codes.
- **Two format styles.** `compact` (`$2K`, `$1.5M`) for dashboards-style summaries, or `full` (`$2,000`, `$1,500,000`) when precision matters.
- **Negative values.** Cost overruns and savings render as `-$50K`.
- **Type-safe binding.** ADO's field picker only offers Integer and Double fields when configuring the control.
- **Zero telemetry.** No external network calls. Scope: `vso.work` (read/write work items the user already has access to).

## Quick start

### Install from the marketplace

1. Visit the [marketplace listing](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-currency-display-control).
2. Click **Get it free** and select your Azure DevOps organization.

### Configure on a work item form

1. **Organization Settings → Process** → pick your process (e.g. Agile, Scrum, your custom process).
2. Pick the work item type (e.g. Epic, Feature, User Story).
3. Click the numeric field you want to format → **New custom control** → **Currency Display**.
4. Set the options:

   | Option | Required | Default | Notes |
   |---|---|---|---|
   | **Numeric field** | yes | — | Pick any Integer or Double field. ADO filters to numeric types automatically. |
   | **Currency** | no | `USD` | ISO 4217 code. Unknown codes fall back to `<CODE> 2K`. |
   | **Format style** | no | `compact` | `compact` = `$2K`, `full` = `$2,000` |

5. Save the process. Reload any work item — the field now renders as currency.

### Format examples

| Value | Compact (USD) | Full (USD) | Compact (EUR) |
|---|---|---|---|
| 500 | `$500` | `$500` | `€500` |
| 2,000 | `$2K` | `$2,000` | `€2K` |
| 245,678 | `$246K` | `$245,678` | `€246K` |
| 1,500,000 | `$1.5M` | `$1,500,000` | `€1.5M` |
| 12,000,000 | `$12M` | `$12,000,000` | `€12M` |
| -50,000 | `-$50K` | `-$50,000` | `-€50K` |

## Build from source

```bash
git clone https://github.com/deenuy/ado-currency-display-control.git
cd ado-currency-display-control
npm install
npm run typecheck     # tsc --noEmit
npm run test          # formatter unit tests
npm run build         # production bundle in dist/
make package          # builds + produces a .vsix in releases/
```

### Test locally

1. Upload the `.vsix` privately: **Marketplace → Manage → Upload extension → Share with your org**.
2. Install it in a test ADO organization.
3. Wire it into a work item form per the quick-start steps above.

### Publish to the marketplace

```bash
# One-time: get a PAT from https://dev.azure.com/<your-org>/_usersSettings/tokens
# Scope: Marketplace (publish)
npx tfx login --service-url https://marketplace.visualstudio.com --token <YOUR_PAT>

# Bump the version in vss-extension.json, then:
npm run publish:marketplace
```

## How it works

A quick mental model: the control is a small TypeScript class registered with the ADO host. When the work item form loads, ADO instantiates the control inside an iframe, hands it the configured field name, and the control reads the field's value via the SDK and renders a formatted display. On click, it swaps to a numeric input; on blur, it writes the number back.

For the full walkthrough — file layout, control lifecycle, format function design, build pipeline — see [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md).

## Compatibility

| Component | Version |
|---|---|
| Azure DevOps Services | All versions |
| Azure DevOps Server | 2018+ (TFS 15.0+) |
| Browsers | All modern browsers (Chrome 90+, Edge 90+, Firefox 88+, Safari 14+) |
| Node (for building from source) | 18+ |

## Contributing

Contributions welcome. This is a small, focused extension — issues, bug reports, and PRs are all appreciated.

- **Read [CONTRIBUTING.md](CONTRIBUTING.md)** for development setup, code style, and PR guidelines.
- **Open an issue** before submitting non-trivial PRs so we can discuss the design first.
- **Add tests** for any formatter changes — `tests/formatCurrency.test.ts` is the place.

Good first issues:

- Add more currency symbols to `src/scripts/formatCurrency.ts` (`SYMBOLS` map).
- Add a `decimals` input to let admins choose precision at M/B scale.
- Add accessibility improvements (ARIA labels, keyboard shortcuts).
- Translate the README and overview to other languages.

## Roadmap

Not committed, just possibilities:

- **Locale-specific abbreviations.** Lakhs and crores for INR (`₹2.5L`, `₹1.2Cr`). Out of scope for v1; PRs welcome.
- **Per-binding decimal precision.** Currently hardcoded to 1 decimal at M/B; a config input would let admins choose 0–3.
- **Multi-currency conversion.** Show `2000 USD` as `≈€1,850`. Needs an FX rate source and adds significant scope; probably a separate extension.
- **Parentheses for negatives.** Some finance teams prefer `($50K)` over `-$50K`.

## Security

This control runs in an ADO-provided iframe with the `vso.work` scope. It reads and writes only the numeric field it's bound to. There are no external network calls, no telemetry, no analytics. If you find a security issue, please email <your-security-email@example.com> rather than opening a public issue.

## License

[MIT](LICENSE.md). Use it, fork it, ship it.

## Acknowledgements

- Built on the [vss-web-extension-sdk](https://github.com/Microsoft/vss-web-extension-sdk).
- Sister project: [ado-query-rollup-widget](https://github.com/deenuy/ado-query-rollup-widget), the dashboard widget that aggregates these numeric fields by Area Path, Assigned To, or any group-by dimension.