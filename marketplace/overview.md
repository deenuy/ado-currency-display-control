# Currency Display Control for Azure DevOps

A custom work item form control that renders any Integer or Double field as formatted currency: `$2K`, `€1.5M`, `₹245K`, etc.

## What it does

Replaces the default numeric input on the work item form with:

- **View mode**: formatted display (`$2K`, `$1.2M`, `-$50K`)
- **Edit mode**: click the value, type a number, blur or press Enter to save

Single source of truth — the underlying numeric field. No shadow string field, no synchronization.

## Reusable across fields

Add the control to as many fields as you need: BU Impact, Estimated Cost, Actual Cost, Budget, anything Integer or Double.

## Configuration

When adding the control to a field on the work item form:

| Option | Required | Default | Notes |
|---|---|---|---|
| Numeric field | yes | — | The Integer/Double field to display. ADO filters the picker to numeric fields only. |
| Currency | no | `USD` | ISO 4217 code: USD, EUR, GBP, INR, JPY, CAD, AUD, BRL, ZAR, etc. |
| Format style | no | `compact` | `compact` = $2K / $1.5M. `full` = $2,000. |

## Format examples

| Value | Compact (USD) | Full (USD) |
|---|---|---|
| 500 | $500 | $500 |
| 9,999 | $9,999 | $9,999 |
| 10,000 | $10K | $10,000 |
| 245,000 | $245K | $245,000 |
| 1,500,000 | $1.5M | $1,500,000 |
| -50,000 | -$50K | -$50,000 |

## Privacy & scope

Scope: `vso.work` (read work items). The control reads and writes the field it's bound to. No telemetry, no external network calls.