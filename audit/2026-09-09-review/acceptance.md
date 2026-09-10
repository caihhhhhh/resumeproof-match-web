# Acceptance — 2026-09-10

Implemented: structured entry fields preserve partial date input; leading project content remains editable; fact review uses the original resume, detects reassigned metrics and avoids duplicate confirmations; all-gap evidence reports are valid; short source lines and original offsets are preserved; unavailable suggestions are distinguished from no rewrite needed. Save failures are surfaced for base resumes. DOCX uses explicit A4 and template spacing. Workspace typography, controls and narrow-screen edit/preview switching are updated. Base-resume events are allowed, demo events are marked, stage counts are deduplicated by journey, and saved summaries are redacted.

Verified:
- ESLint, TypeScript and production build passed.
- Eight assertions in diagnostics.cjs passed.
- Built-in browser at localhost:3001: demo report → review without adopting suggestions; project content visible; partial date `2` stayed in Dates without changing role; restoring date removed the fact flag; preview toggle worked. PDF generation returned from loading without a displayed error.

Limits: downloaded PDF binary and DOCX pagination were not independently inspected. Build retains an upstream fontkit browser-export warning and bundle-size warning. This pass did not establish an AI latency improvement, validate every JD/OCR provider, or complete a security/load audit. Admin stage counts are explicitly not a strict ordered cohort funnel; the 10,000-row read cap is disclosed. No claim that all original audit findings have been resolved.
