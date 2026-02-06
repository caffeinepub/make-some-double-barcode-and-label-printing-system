# Specification

## Summary
**Goal:** Make the Label Settings preview match the CPCL printed output 1:1 by unifying layout calculations, and ensure saved label layout settings stay synchronized between UI, backend persistence, and printing.

**Planned changes:**
- Create a single shared layout computation (in dots) that is used by both the Settings preview renderer and the CPCL command generator so centering, X/Y positions, barcode scaling, and spacing match exactly.
- Fix preview rendering stability so dot-to-pixel scaling does not accumulate distortion across repeated adjustments/re-renders.
- Correct centering behavior so, when enabled, both barcode blocks are horizontally centered consistently in both preview and printed output.
- Enforce minimum non-overlapping gaps: between each barcode and its serial-number text, and between the first and second barcode blocks; clamp effective spacing when user settings would cause overlap and reflect the clamped layout in the preview.
- Load all label layout-related controls from the saved backend LabelConfig on page load, allow editing, persist on Save, and ensure CPCL printing uses the newly saved values (not preview-only).
- When centering is disabled, respect user-configured X/Y positioning for barcode/text in both preview and CPCL output, keeping text/title/barcode X calculations consistent (avoid preview-only approximations that cause drift).

**User-visible outcome:** Adjusting label layout settings updates the on-screen preview and the printed CPCL label identically, with reliable centering/spacing, no preview scaling drift, and saved settings that apply to future prints.
