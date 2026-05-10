// ---------------------------------------------------------------------
// <copyright file="control.ts">
//    This code is licensed under the MIT License.
// </copyright>
// ---------------------------------------------------------------------
//
// Currency Display Control.
//
// Replaces the work-item form's default rendering of a configured
// Integer/Double field with a formatted currency display ($2K, €1.5M, …).
// Click to edit; the editor accepts a raw number which is written back
// to the underlying field on commit.
//
// Single source of truth: the configured field. No mirror field, no
// shadow state. The control is purely a UI wrapper around the field.
// ---------------------------------------------------------------------

/// <reference types="vss-web-extension-sdk" />
"use strict";

import { formatCurrency, FormatStyle } from "./formatCurrency";

/** Inputs passed by the form admin via vss-extension.json `inputs`. */
interface ControlInputs {
    FieldName: string;
    Currency?: string;
    Style?: string;
}

class CurrencyControl {
    private fieldName!: string;
    private currency!: string;
    private style!: FormatStyle;

    private $display!: HTMLElement;
    private $editor!: HTMLInputElement;
    private editing = false;

    public async onLoaded(): Promise<void> {
        const inputs = VSS.getConfiguration().witInputs as ControlInputs;
        this.fieldName = inputs.FieldName;
        this.currency  = (inputs.Currency || "USD").trim();
        this.style     = inputs.Style === "full" ? "full" : "compact";

        this.$display = document.getElementById("display") as HTMLElement;
        this.$editor  = document.getElementById("editor")  as HTMLInputElement;

        this.wireEvents();
        await this.render();

        VSS.notifyLoadSucceeded();
    }

    /** Re-render when our field changes (host calls this on every field change). */
    public async onFieldChanged(args: any): Promise<void> {
        if (args && args.changedFields && args.changedFields[this.fieldName] !== undefined) {
            // Only re-render the display if the user isn't actively editing —
            // otherwise we'd clobber their typing.
            if (!this.editing) { await this.render(); }
        }
    }

    public async onRefreshed(): Promise<void> { await this.render(); }
    public async onReset():    Promise<void>  { await this.render(); }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    private wireEvents(): void {
        // Click or focus the display → enter edit mode.
        const enter = () => this.beginEdit();
        this.$display.addEventListener("click", enter);
        this.$display.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); }
        });

        // Commit on blur or Enter; cancel on Escape.
        this.$editor.addEventListener("blur", () => this.commit());
        this.$editor.addEventListener("keydown", (e) => {
            if (e.key === "Enter")  { this.$editor.blur(); }
            if (e.key === "Escape") { this.editing = false; this.render(); }
        });
    }

    private async render(): Promise<void> {
        const service = await this.getService();
        const raw = await service.getFieldValue(this.fieldName, true);
        const num = toNumber(raw);

        this.$display.textContent = formatCurrency(num, this.currency, this.style);
        this.$display.title = num == null ? "" : String(num);   // hover shows raw value

        this.$display.hidden = false;
        this.$editor.hidden  = true;
        this.editing = false;
    }

    private async beginEdit(): Promise<void> {
        const service = await this.getService();
        const isReadOnly = await service.isFieldReadOnly(this.fieldName);
        if (isReadOnly) { return; }

        const raw = await service.getFieldValue(this.fieldName, true);
        const num = toNumber(raw);

        this.$editor.value = num == null ? "" : String(num);
        this.$display.hidden = true;
        this.$editor.hidden  = false;
        this.editing = true;
        this.$editor.focus();
        this.$editor.select();
    }

    private async commit(): Promise<void> {
        if (!this.editing) { return; }

        const text = this.$editor.value.trim();
        const next = text === "" ? null : Number(text);

        const service = await this.getService();
        if (next === null) {
            await service.setFieldValue(this.fieldName, null);
        } else if (Number.isFinite(next)) {
            await service.setFieldValue(this.fieldName, next);
        }
        // Invalid input (e.g. "abc") → silently revert by re-rendering current value.

        await this.render();
    }

    private async getService(): Promise<any> {
        // Lazily resolved every call — the SDK caches the service.
        return await VSS.getService<any>(VSS.ServiceIds.ExtensionData)
            .then(() => (window as any).WorkItemFormService.getService());
    }
}

/** Coerce raw field value to number. ADO returns numeric fields as `number | null`; defensive parse otherwise. */
function toNumber(raw: any): number | null {
    if (raw == null || raw === "") { return null; }
    if (typeof raw === "number")   { return Number.isFinite(raw) ? raw : null; }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------
// SDK registration. The contribution id MUST match vss-extension.json.
// ---------------------------------------------------------------------
VSS.require(["TFS/WorkItemTracking/Services"], (Services: any) => {
    // Stash the form-service module on window so getService() above can resolve it
    // without re-importing inside an async callback.
    (window as any).WorkItemFormService = Services.WorkItemFormService;

    VSS.register("currency-display-control", () => new CurrencyControl());
});