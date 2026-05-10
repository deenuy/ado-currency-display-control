# How it works

A walkthrough of the codebase for contributors. If you've never built an Azure DevOps custom control, this should orient you in 15 minutes.

For installation and configuration, see the [README](../README.md).

---

## What this extension does

The extension contributes a **custom work item form control** — a tiny HTML/JS component that ADO embeds in a work item form, replacing the default rendering of a single field.

Bind the control to a numeric field (e.g. `BU Impact`, `Estimated Cost`). On a work item form, that field now shows as `$2K` or `€1.5M` instead of `2000` or `1500000`. Click to edit, type a new number, blur to save.

That's the whole product. No backend, no shadow field, no synchronization — just a UI layer over a single numeric field.

---

## What an Azure DevOps custom control is

ADO lets extensions contribute different types of UI: dashboard widgets, hub pages, menu items, and **work item form controls**. The form control is one of the smallest contribution types — it's a tiny iframe that ADO embeds at a specific spot on the work item form, in place of the field's default editor.

The control receives configuration from the form admin (which field to bind to, plus any other inputs you declare in the manifest). It talks to ADO via the `VSS` SDK, specifically the `WorkItemFormService`, which exposes methods like `getFieldValue`, `setFieldValue`, and `isFieldReadOnly`.

The contribution this extension declares:

```json
{
  "id": "currency-display-control",
  "type": "ms.vss-work-web.work-item-form-control",
  "targets": ["ms.vss-work-web.work-item-form"]
}
```

Plus three `inputs`: `FieldName`, `Currency`, `Style`. ADO renders these as a form on the **Options** tab when an admin adds the control to a field.

---

## Project layout

```
.
├── src/
│   ├── scripts/
│   │   ├── control.ts            # the form control class
│   │   └── formatCurrency.ts     # pure formatter — no SDK, no DOM
│   └── static/
│       ├── control.html          # iframe shell
│       └── css/control.css
├── tests/
│   └── formatCurrency.test.ts    # unit tests for the formatter
├── marketplace/                  # marketplace listing assets
│   ├── overview.md
│   └── logo.png
├── docs/
│   ├── HOW-IT-WORKS.md           # this file
│   └── images/
├── vss-extension.json            # extension manifest
├── package.json
├── webpack.config.js             # bundles TS → dist/control.js
├── tsconfig.json                 # main TS config
├── tsconfig.test.json            # separate config for tests
├── Makefile
└── README.md
```

The split between `control.ts` (SDK-dependent) and `formatCurrency.ts` (pure) is deliberate: the formatter has all the tricky logic, and keeping it free of VSS imports means it's unit-testable without mocking the SDK.

---

## How the control loads

ADO embeds `src/static/control.html` in an iframe at the field's slot on the work item form. That HTML is a thin shell:

```html
<div id="root">
    <span id="display" tabindex="0" role="textbox"></span>
    <input id="editor" type="number" hidden />
</div>

<script src="../lib/VSS.SDK.min.js"></script>
<script>
    VSS.init({ explicitNotifyLoaded: true, usePlatformStyles: true, ... });
    VSS.ready(function () {
        require(["dist/control"], function () { });
    });
</script>
```

Two elements: the display span (always visible by default) and the editor input (hidden by default, shown on click). The bundle `dist/control.js` is loaded after `VSS.ready()`, which registers the control class and wires it up.

---

## The control lifecycle

ADO calls these methods on your registered class:

| Method | When |
|---|---|
| `onLoaded(args)` | Work item is loaded. Time to read the field value and render. |
| `onFieldChanged(args)` | Any field changed. If it's your field, re-render. |
| `onRefreshed()` | Form was refreshed (e.g. after save). |
| `onReset()` | User discarded their changes. |
| `onUnloaded()` | Cleanup before iframe is torn down. |

Implementation in `src/scripts/control.ts`:

```typescript
class CurrencyControl {
    private fieldName!: string;
    private currency!: string;
    private style!: FormatStyle;
    private editing = false;

    public async onLoaded(): Promise<void> {
        const inputs = VSS.getConfiguration().witInputs;
        this.fieldName = inputs.FieldName;
        this.currency  = (inputs.Currency || "USD").trim();
        this.style     = inputs.Style === "full" ? "full" : "compact";
        this.wireEvents();
        await this.render();
        VSS.notifyLoadSucceeded();
    }

    public async onFieldChanged(args: any): Promise<void> {
        if (args?.changedFields?.[this.fieldName] !== undefined && !this.editing) {
            await this.render();
        }
    }
}
```

The `editing` flag matters: if the user is mid-edit when the host fires `onFieldChanged`, you don't want to clobber their input. The flag suppresses re-renders during edit mode.

---

## Reading and writing the field

The `WorkItemFormService` is ADO's bridge between your control and the underlying work item. Two methods do all the work:

```typescript
private async render(): Promise<void> {
    const service = await this.getService();
    const raw = await service.getFieldValue(this.fieldName, true);
    const num = toNumber(raw);
    this.$display.textContent = formatCurrency(num, this.currency, this.style);
}

private async commit(): Promise<void> {
    const text = this.$editor.value.trim();
    const next = text === "" ? null : Number(text);
    const service = await this.getService();
    if (next === null) {
        await service.setFieldValue(this.fieldName, null);
    } else if (Number.isFinite(next)) {
        await service.setFieldValue(this.fieldName, next);
    }
    await this.render();
}
```

`setFieldValue` doesn't save immediately — it stages the change in the form's dirty state. ADO commits it when the user clicks Save. This is exactly what you want; it integrates with ADO's normal save flow, undo/redo, dirty indicators, etc.

---

## Click-to-edit flow

```
display visible, editor hidden
     │
     ├─ User clicks display (or Enter/Space when focused)
     │
     │── beginEdit()
     │     ├─ Check isFieldReadOnly — if true, do nothing
     │     ├─ Read raw value, populate editor
     │     ├─ Hide display, show editor, focus + select
     │     └─ Set editing = true
     │
     ├─ User types a new number
     │
     ├─ User blurs or presses Enter
     │
     │── commit()
     │     ├─ Parse text → number (or null if empty)
     │     ├─ setFieldValue
     │     ├─ Set editing = false
     │     └─ render() — show display again
     │
     └─ User pressed Escape instead
        └─ Set editing = false, render() — discard edit, revert display
```

No buttons, no chrome. The whole interaction surface is the field cell itself.

---

## The formatter

`src/scripts/formatCurrency.ts` is pure. No DOM, no SDK, no side effects. It takes a number and returns a string.

```typescript
export function formatCurrency(
    value: number | null | undefined,
    currency: string = "USD",
    style: FormatStyle = "compact"
): string
```

### Compact mode rules

| Range | Output |
|---|---|
| `null`, `undefined`, `NaN` | `""` (empty — distinct from `$0`) |
| `\|value\| < 1,000` | `$500`, `$999.5` |
| `1,000 ≤ \|value\| < 1,000,000` | `$2K`, `$245K` (rounded to nearest thousand) |
| `1,000,000 ≤ \|value\| < 1,000,000,000` | `$1.5M`, `$12M` (one decimal, trimmed) |
| `\|value\| ≥ 1,000,000,000` | `$1.2B` |

Negatives keep a leading minus: `-$50K`.

### Full mode rules

Always thousands-separated full numbers: `$2,000`, `$1,500,000`. Uses `Intl.NumberFormat` under the hood for the separator.

### Currency symbols

A small lookup table in `formatCurrency.ts`:

```typescript
const SYMBOLS: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹",
    CAD: "$", AUD: "$", NZD: "$", SGD: "$", HKD: "$",
    BRL: "R$", ZAR: "R", CHF: "CHF ", SEK: "kr ", ...
};
```

To add a currency, append to the map. No code changes required. Unknown codes fall back to `<CODE> 2K` — acceptable degradation rather than a silent failure.

---

## The manifest

The most important parts of `vss-extension.json`:

### Scopes — minimal

```json
"scopes": ["vso.work"]
```

That's it. The control can read and write work items the user already has access to. Nothing else.

### Contribution and inputs

```json
"contributions": [{
    "id": "currency-display-control",
    "type": "ms.vss-work-web.work-item-form-control",
    "targets": ["ms.vss-work-web.work-item-form"],
    "properties": {
        "uri": "static/control.html",
        "height": 24,
        "inputs": [
            {
                "id": "FieldName",
                "type": "WorkItemField",
                "properties": { "workItemFieldTypes": ["Integer", "Double"] },
                "validation": { "isRequired": true }
            },
            { "id": "Currency", "validation": { "isRequired": false } },
            { "id": "Style",    "validation": { "isRequired": false } }
        ]
    }
}]
```

Two things to know:

1. **`workItemFieldTypes`** is the guardrail — ADO will only let admins bind the control to Integer or Double fields. String fields aren't even offered.
2. **`height: 24`** matches the default ADO form field height. The control fits inline; no visual disruption.

### Files

```json
"files": [
    { "path": "dist", "addressable": true },
    { "path": "src/static", "addressable": true, "packagePath": "static" },
    { "path": "node_modules/vss-web-extension-sdk/lib", "addressable": true, "packagePath": "lib" }
]
```

`packagePath` re-roots the path inside the `.vsix`. `src/static` on disk becomes `static/` in the package, which is why `control.html` references `dist/control` and `../lib/VSS.SDK.min.js` directly.

---

## Build pipeline

```
npm run build  →  rimraf dist  →  tsc --noEmit (typecheck)  →  webpack production
                                                                  ↓
                                                             dist/control.js
                                                             dist/control.js.map
```

Webpack bundles `src/scripts/control.ts` (and the `formatCurrency.ts` it imports) into a single AMD module. AMD because that's the module format `VSS.require([...])` expects. The `VSS/*`, `TFS/*`, and `q` modules are declared as externals — they're provided by the host at runtime, not bundled.

`tfx extension create` then reads `vss-extension.json`, copies the listed files into a `.vsix`, and writes it to the working directory. The Makefile moves it into `releases/` and tags the commit.

---

## Testing

Two layers of tests:

### Unit tests for `formatCurrency`

`tests/formatCurrency.test.ts` is a plain TypeScript file — no Jest, no Vitest. It compiles via a separate `tsconfig.test.json` and runs under Node. Inside, it loops a table of `(value, currency, style, expected)` tuples and compares outputs.

```bash
npm test
```

This is the right test surface — the formatter is where all the tricky logic lives. The control class itself is mostly SDK glue that's hard to unit-test usefully without mocking the entire VSS surface area.

### Integration testing

Manual. Package the `.vsix`, upload it privately to a test ADO org, bind it to a field, and load a work item. There's no headless way to run ADO's form host, so this is unavoidable.

When adding a feature, the loop is:

```
edit → npm run build → make package → upload → reload work item → verify
```

Iteration is ~30 seconds with the build cached. Tolerable.

---

## Common pitfalls

**Hex-escaped output in non-ASCII test cases.** Some shells render `€` and `₹` as multi-byte sequences differently. If you see `\xE2\x82\xAC` instead of `€` in test output, your terminal isn't UTF-8. The bytes are correct; it's a display issue.

**`Number.isFinite` not available on ES5 target.** Even with `target: "es5"`, you need `es2015.core` in the `lib` array of `tsconfig.json`. Otherwise the typecheck fails. Runtime is fine — all modern browsers have it.

**Form admin can't find the field in the picker.** Custom controls only appear on fields where the admin clicks **Edit → New custom control**. If the field doesn't have that option, it's a system field that ADO doesn't allow custom controls on. Use a custom Integer/Double field instead.

**Control doesn't show formatted value on first load.** Usually means `onLoaded` is throwing before `notifyLoadSucceeded`. Check the browser console inside the form's iframe — `Inspect → frames` to switch context.

---

## How to extend

A few common contributions and where to make them:

| Goal | Where |
|---|---|
| Add a currency symbol | `formatCurrency.ts` — append to `SYMBOLS` map |
| Add a format style (e.g. `accounting`) | `formatCurrency.ts` — extend the `FormatStyle` type and the if-tree |
| Custom decimal precision | `vss-extension.json` (add an input) + `formatCurrency.ts` (consume it) |
| Different render on read-only | `control.ts` `render()` — check `isFieldReadOnly` and adjust style |
| Localize abbreviations (lakhs, crores) | `formatCurrency.ts` — branch on a new `Locale` input |
| Parentheses for negatives | `formatCurrency.ts` — change the `sign` logic |

When changing the manifest (`inputs`, `scopes`, contribution `id`), bump the version in `vss-extension.json` before re-publishing. The marketplace rejects re-uploads with the same version.

---

## Where to ask

Open an issue or discussion on GitHub. The codebase is small enough that "I don't understand X" questions usually point to a documentation gap worth fixing.