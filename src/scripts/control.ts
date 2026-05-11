// ---------------------------------------------------------------------
// <copyright file="control.ts">
//    This code is licensed under the MIT License.
// </copyright>
// ---------------------------------------------------------------------
//
// Currency Display Control.
//
// An Azure DevOps work-item form control that replaces the default
// rendering of a configured Integer/Double field with a formatted
// currency display ($2K, €1.5M, ₹245K). Click to edit, type a number,
// blur or press Enter to commit. The underlying field stays numeric;
// formatting is purely a UI layer.
//
// Design decisions worth knowing:
//
//   1. Single source of truth. The configured field is the only state.
//      No shadow string field, no mirror, no synchronization. The
//      control is a UI wrapper, nothing more.
//
//   2. Visibility via inline `style.display`, not the `hidden` attribute.
//      Stylesheet `display` rules in the ADO form iframe override
//      `[hidden]`, which can cause both the display span and the editor
//      input to render side-by-side. Inline styles win the cascade.
//
//   3. `getFieldValue` is called without the `returnOriginalValue=true`
//      flag. Passing `true` returns the LAST-SAVED value, which makes
//      the display revert to the persisted value during in-form editing.
//      Without the flag, reads return the CURRENT value (including any
//      uncommitted edits in the form's dirty state) — which is what the
//      user expects.
//
//   4. `committing` flag guards against `onFieldChanged` racing the
//      `setFieldValue` write during a commit. Without it, the host can
//      re-fire `onFieldChanged` mid-write and read stale field data.
//
//   5. `onFieldChanged` is defensive about `args.changedFields` shape.
//      The legacy vss-web-extension-sdk delivers this as an object in
//      some versions and an array in others; missing entirely on some
//      events. We handle all three cases.
//
//   6. Lifecycle stubs (`onSaved`, `onUnloaded`) exist to silence the
//      host's "no handler found" console warnings. The host calls every
//      registered hook; missing ones produce noise.
// ---------------------------------------------------------------------
/// <reference types="vss-web-extension-sdk" />

"use strict";

import { formatCurrency, FormatStyle } from "./formatCurrency";

/** Inputs the form admin sets when binding the control (declared in vss-extension.json). */
interface ControlInputs {
    /** Reference name of the Integer/Double field to display. Required. */
    FieldName: string;
    /** ISO 4217 currency code. Defaults to USD. */
    Currency?: string;
    /** "compact" ($2K) or "full" ($2,000). Defaults to compact. */
    Style?: string;
}

class CurrencyControl {
    private fieldName!: string;
    private currency!: string;
    private style!: FormatStyle;

    private $display!: HTMLElement;
    private $editor!: HTMLInputElement;

    /** True between beginEdit and commit/cancel. Suppresses host-driven re-renders. */
    private editing = false;

    /** True while a setFieldValue call is in flight. Suppresses onFieldChanged races. */
    private committing = false;

    /** Work-item-level read-only flag from onLoaded args. No corresponding SDK getter exists. */
    private isReadOnly = false;

    // -----------------------------------------------------------------
    // ADO lifecycle hooks. The host calls these on the registered control.
    // -----------------------------------------------------------------

    /**
     * Called once when the work item form loads.
     * @param args.isReadOnly true if the work item itself is locked
     *                        (closed state, permission lock, etc.)
     */
    public async onLoaded(args: any): Promise<void> {
        this.isReadOnly = !!(args && args.isReadOnly);

        const inputs = VSS.getConfiguration().witInputs as ControlInputs;
        this.fieldName = inputs.FieldName;
        this.currency  = (inputs.Currency || "USD").trim();
        this.style     = inputs.Style === "full" ? "full" : "compact";

        this.$display = document.getElementById("display") as HTMLElement;
        this.$editor  = document.getElementById("editor")  as HTMLInputElement;

        this.wireEvents();
        await this.render();
    }

    /**
     * Called by the host whenever any field on the form changes.
     * We re-render if the change touches our field, unless the user is
     * actively editing or we're mid-commit.
     */
    public async onFieldChanged(args: any): Promise<void> {
        if (this.editing || this.committing) { return; }

        // changedFields shape varies across SDK versions:
        //   - object keyed by reference name: { "Custom.BUImpact": value }
        //   - array of reference name strings: ["Custom.BUImpact"]
        //   - missing entirely on some events
        // Default to "ours" if we can't tell — render is cheap (one field read).
        let ours = true;
        if (args && args.changedFields) {
            if (Array.isArray(args.changedFields)) {
                ours = args.changedFields.indexOf(this.fieldName) !== -1;
            } else if (typeof args.changedFields === "object") {
                ours = Object.prototype.hasOwnProperty.call(args.changedFields, this.fieldName);
            }
        }

        if (ours) { await this.render(); }
    }

    /** Called when the form refreshes (e.g. after save). Re-read the field. */
    public async onRefreshed(): Promise<void> { await this.render(); }

    /** Called when the user discards changes. Re-read the (now reverted) field. */
    public async onReset(): Promise<void> { await this.render(); }

    /**
     * No-op lifecycle stubs.
     *
     * The ADO form host invokes every registered hook on every control;
     * if a method is missing, the host logs "No handler found on any
     * channel for message: ..." to the console. Implementing as no-ops
     * keeps the console clean for users of this extension.
     */
    public async onSaved():    Promise<void> { /* intentionally empty */ }
    public async onUnloaded(): Promise<void> { /* intentionally empty */ }

    // -----------------------------------------------------------------
    // Event wiring
    // -----------------------------------------------------------------

    private wireEvents(): void {
        // Display → edit mode. Click, Enter, or Space all trigger edit
        // (Space + Enter for keyboard accessibility on the [role=textbox]).
        const enter = () => {
            this.beginEdit().catch(err =>
                console.error("[CurrencyControl] beginEdit threw:", err)
            );
        };

        this.$display.addEventListener("click", enter);
        this.$display.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); }
        });

        // Editor → commit on blur or Enter; revert on Escape.
        this.$editor.addEventListener("blur", () => {
            this.commit().catch(err =>
                console.error("[CurrencyControl] commit threw:", err)
            );
        });

        this.$editor.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.$editor.blur(); // commit via blur handler
            }
            if (e.key === "Escape") {
                this.editing = false;
                this.render().catch(err =>
                    console.error("[CurrencyControl] render threw:", err)
                );
            }
        });
    }

    // -----------------------------------------------------------------
    // View state transitions
    //
    // Inline style.display has higher specificity than stylesheet rules,
    // so this works regardless of what control.css says about either
    // element's default display.
    // -----------------------------------------------------------------

    private showDisplay(): void {
        this.$display.style.display = "";       // restore stylesheet default
        this.$editor.style.display  = "none";
    }

    private showEditor(): void {
        this.$display.style.display = "none";
        this.$editor.style.display  = "";
    }

    // -----------------------------------------------------------------
    // Render / edit / commit
    // -----------------------------------------------------------------

    /** Read the current field value and paint the formatted display. */
    private async render(): Promise<void> {
        const num = await this.readFieldValue();

        this.$display.textContent = formatCurrency(num, this.currency, this.style);
        this.$display.title = num == null ? "" : String(num);    // hover shows raw number

        this.showDisplay();
        this.editing = false;
    }

    /** Swap to the editor input, populated with the current numeric value. */
    private async beginEdit(): Promise<void> {
        if (this.isReadOnly) { return; }

        const num = await this.readFieldValue();
        this.$editor.value = num == null ? "" : String(num);

        this.showEditor();
        this.editing = true;
        this.$editor.focus();
        this.$editor.select();
    }

    /** Write the editor's value back to the field, then re-render. */
    private async commit(): Promise<void> {
        if (!this.editing) { return; }
        this.editing    = false;
        this.committing = true;

        try {
            const text = this.$editor.value.trim();
            const next = text === "" ? null : Number(text);

            const service = await this.getService();
            if (next === null) {
                // Clear the field.
                await service.setFieldValue(this.fieldName, null);
            } else if (Number.isFinite(next)) {
                await service.setFieldValue(this.fieldName, next);
            }
            // Invalid input (e.g. "abc" → NaN) falls through silently;
            // render() below restores the display to the field's current value.

            await this.render();
        } finally {
            // Release the lock even on error so future renders aren't permanently blocked.
            this.committing = false;
        }
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /**
     * Read the field's CURRENT value (including unsaved in-form edits).
     *
     * Critical: do NOT pass `true` as the second argument to getFieldValue.
     * That returns the LAST-SAVED value, ignoring uncommitted changes, which
     * causes the display to revert to the persisted value while the user is
     * still editing. Without the flag, the read reflects the form's dirty
     * state — which is what we want.
     */
    private async readFieldValue(): Promise<number | null> {
        const service = await this.getService();
        const raw = await service.getFieldValue(this.fieldName);
        return toNumber(raw);
    }

    /**
     * Resolve the WorkItemFormService instance.
     *
     * The service module is stashed on `window` by the SDK registration
     * block at the bottom of this file. The service itself is cached by
     * the SDK; calling `getService()` repeatedly is cheap.
     */
    private async getService(): Promise<any> {
        return await (window as any).WorkItemFormService.getService();
    }
}

/**
 * Coerce a raw field value to a number, or null if not coerceable.
 *
 * ADO normally returns Integer/Double fields as `number | null`, but
 * be defensive: legacy data or other extensions may produce strings or
 * other shapes. NaN and Infinity are treated as null.
 */
function toNumber(raw: any): number | null {
    if (raw == null || raw === "") { return null; }
    if (typeof raw === "number")   { return Number.isFinite(raw) ? raw : null; }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------
// SDK registration.
//
// Called once when the iframe loads, before any work item is rendered.
// The contribution id MUST match the id in vss-extension.json — if these
// drift, the host will fail to bind the control to its iframe.
// ---------------------------------------------------------------------
VSS.require(["TFS/WorkItemTracking/Services"], (Services: any) => {
    // Stash the form-service module on window so getService() can resolve
    // it without re-issuing VSS.require on every call.
    (window as any).WorkItemFormService = Services.WorkItemFormService;

    VSS.register("currency-display-control", () => new CurrencyControl());

    // Signal readiness to the host. Without this, ADO shows a "taking
    // longer than expected to load" banner after ~10 seconds.
    VSS.notifyLoadSucceeded();
});