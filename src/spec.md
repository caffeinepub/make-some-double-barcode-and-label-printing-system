# Specification

## Summary
**Goal:** Make Scan & Print reliably auto-print a CPCL label after two valid scans, and enforce strict invalid-prefix errors across the scan workflow.

**Planned changes:**
- Fix Scan & Print auto-print timing so a successful second scan triggers exactly one automatic CPCL print when a USB printer is connected, including when scans occur back-to-back (eliminate race conditions between async validation and scan handlers).
- Prevent duplicate auto-prints by ensuring printing is gated to one print per validated pair of serials.
- Add clear operator feedback when auto-print cannot run (non-CPCL protocol or no connected USB printer) and skip any print attempt in those cases.
- Enforce strict prefix validation on every scan: immediately reject invalid prefixes with an English toast and a red/invalid field state; do not add invalid serials to scanned-serial tracking and do not advance the workflow.
- Ensure backend/frontend handling does not silently allow scans when prefix validation fails: show an English toast indicating validation could not be performed and record a best-effort errorLog entry; ensure backend prefix validation has deterministic default behavior.

**User-visible outcome:** Operators can scan two valid serials and the label auto-prints reliably (CPCL + USB printer) without pressing Print; invalid-prefix scans are immediately blocked with clear English errors and do not progress the workflow.
