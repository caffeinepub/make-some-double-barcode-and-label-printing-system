# Specification

## Summary
**Goal:** Ensure CPCL labels print with centered, non-overlapping barcode + serial blocks (matching the physical reference), make Label Settings affect actual print output with persistence, and fix serial-prefix-based title mapping.

**Planned changes:**
- Update CPCL command generation so each barcode and its serial text are horizontally centered on the label, with consistent vertical spacing so barcode/text never overlap (including when barcode height changes), and with adequate spacing between the first and second barcode+text blocks.
- Wire Label Settings (barcode X/Y, text Y, barcode height/width scale, and any spacing/centering parameters used) to the CPCL generation used for printing (not preview only), persist these settings, and reload/apply them on future prints.
- Fix prefix-to-title mapping for scanned/printed serials: "55V" → "Dual Band", "55Y" → "Tri Band", "72V" → "New Version Dual Band", and initialize these defaults if mappings are empty/uninitialized.

**User-visible outcome:** Printed labels show correctly centered barcodes and serial numbers with clear spacing and no collisions; changes made in Label Settings reliably change the printed output and persist across app restarts; scanned serial prefixes display/print the correct title.
