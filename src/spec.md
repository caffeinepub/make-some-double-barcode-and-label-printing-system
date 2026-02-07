# Specification

## Summary
**Goal:** Add persistent, per-serial-prefix label counters (55V/55Y/72V) and a configurable serial-number text size that applies consistently to label preview and printing.

**Planned changes:**
- Backend: Store and expose three separate persistent counters for label prints by serial prefix: 55V (Dual Band), 55Y (Tri Band), 72V (New Dual Band); support fetching each value, incrementing based on prefix, and resetting all counters.
- Frontend (Scan & Print): Display three separate counter tiles/cards (“Dual Band Labels”, “Tri Band Labels”, “New Dual Band Labels”) sourced from backend values; increment the correct counter after a successful print based on the scanned serial’s first 3 characters and keep values correct after refresh.
- Frontend (Label Settings + printing): Add a “Serial Text Size” control saved with LabelConfig (using the existing `textSize` field); apply the configured size to both the label preview renderer and CPCL output for the serial-number text, with a sensible default for missing/zero values.

**User-visible outcome:** Users see three separate label counters (Dual Band / Tri Band / New Dual Band) that persist across reloads and increment based on the scanned serial prefix, and they can adjust “Serial Text Size” so the serial number appears larger/smaller in both preview and the printed label.
