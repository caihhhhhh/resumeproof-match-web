# Assessment B: deterministic and implementation evidence

Date: 2026-10-22. Read-only audit. No application source changes, deployment, real AI analysis, personal uploads, or application submissions.

## Scope and provenance

- Source authority: `app/components/home-experience.tsx`, `app/match/new/page.tsx`, shared `optimization-review.tsx`, `resume-structured-editor.tsx`, `resume-document.tsx`, `language-context.tsx`, `site-footer.tsx`, and their styles including the later `ui-theme.css` overrides.
- Main agent ran Impeccable context. B read Impeccable, critique, audit, design-taste-frontend and Computer Use instructions. Design Taste is appropriate to the landing page, not the multi-step working surface.
- B was isolated from A. Findings were withheld until main explicitly confirmed that A's independent judgment had completed.
- Detector ran exactly once: `impeccable.cmd detect --json app`, valid seven-finding JSON, process exit 1 (not the 0/2 described in playbook). No rerun.

## Deterministic scan

Seven findings: 6 warnings, 1 advisory; 3 unique rule IDs. Details in `assessment-b.detector.json`.

| Rule | Count | Exact locations | Verification |
| --- | ---: | --- | --- |
| `side-tab` / Side-tab accent border | 4 | `app/globals.css:340,900,911,945` | 340 targets admin and is out of requested surface. 900/911/945 are semantic fact warning/review status/export-block messages, not interchangeable decorative cards. Do not delete their signal merely to satisfy detector. |
| `overused-font` / Overused font | 2 | `app/globals.css:1080`, `app/lib/resume-layout.ts:20` | Both target the printable/export resume, where Arial is a deliberate document fallback. Detector description's named font list does not even name Arial. Contextual false positives for this UI audit. |
| `codex-grid-background` / Decorative grid-line background | 1 advisory | `app/globals.css:412` | Targets `.site-shell`. No TSX reference found in current app. Current homepage root is `.rp-concept`, work surface `.workspace-shell`. Excluded legacy/dead selector. |

Result: 0 verified in-scope design defects from the seven deterministic findings. This does not mean no UI/a11y problems; the manual audit below finds different issues.

## Live evidence and limitations

- Own newly created in-app browser tab. Current live homepage DOM and screenshot verified; current live empty materials DOM and screenshot verified. Current source and live copy match.
- Screenshots: `b-home-desktop.png`, `b-materials-desktop.png`, both current capture, 1265 x 712 screenshot pixels. Do not infer CSS viewport size or DPR from pixels alone.
- Initial convenience API calls `createBrowserTab`/`getTab` timed out after 30 s (with and without visibility options), although tabs were created. Documented direct API `browser.tabs.new()`, `tab.goto`, `tab.playwright.domSnapshot` and `tab.screenshot` worked.
- A later aggregate capability/evaluate call timed out, so no reliable live element-box measurements were returned. Browser viewport override never changed. No mobile screenshot, emulated touch, physical touch, dark preference, reduced-motion preference, 200% zoom, screen-reader, keyboard focus, or CWV measurements were completed by B.
- Read-only evaluate means mutation/injection is not supported by that route. No detector overlay, no `[Human]` presentation, no live-server start. Do not claim overlays are visible. Fallback is valid CLI + live DOM/screenshots + source inspection.
- Closed all four B-created tabs; final tab list empty. No server, viewport override, or temporary text body requires cleanup. Evidence artifacts are retained intentionally.
- Older fixtures (2026-09-14 concept, 2026-09-11 UX) were visually inspected only to assess fallback. They differ from current source and are not used to claim current behavior.

## Audit health (provisional where runtime testing is absent)

| Dimension | Score / 4 | Evidence and qualification |
| --- | ---: | --- |
| Accessibility | 2 | Most visible inputs have labels and errors use alert/status; raw text editor lacks a name; invisible file controls lack visible parent focus state; mode state not exposed. |
| Performance | 3 | GSAP effects scoped and cleaned; parser, DOCX and PDF libraries dynamically loaded. No measured CWV/FPS; no demonstrated performance regression. |
| Theming | 2 | Semantic root tokens and coherent light identity, but many overrides/hardcoded surface colors; no dark palette or `prefers-color-scheme` support found. Dark is untested, not a demonstrated contrast break. |
| Responsive | 2 | Explicit mobile collapse and edit/preview modes in source; several 28-42 px controls fall below skill's 44 px target. Mobile layout/touch remains untested by B. |
| Implementation integrity | 3 | Product-specific evidence/review/fact-check workflow coherent; detector output should mostly be excluded, not optimized blindly. Remaining issues are behavior/a11y consistency. |
| Total | 12 / 20 | Acceptable; targeted hardening needed. Not a WCAG conformance certification or performance test. |

## Prioritized verified findings

1. **[P1] Advanced raw editor has no programmatic label.** `app/components/resume-structured-editor.tsx:202` has a `textarea` after a paragraph, without `label`, `aria-label`, or `aria-labelledby`. Its surrounding `details` summary does not label the textarea. Main material textareas correctly use `aria-label`, so this is an isolated regression. Add associated visible label. WCAG 1.3.1/3.3.2/4.1.2. Suggested: `$impeccable harden`.
2. **[P1] Keyboard file-upload focus is visually hidden.** `app/globals.css:708,717` makes file inputs 1 x 1 and opacity 0; global focus outline at 1437 is on that invisible element. No matching `.compact-upload:focus-within` or `.jd-file-upload:focus-within` exists in loaded styles. Parent upload labels are not tab stops. Primary keyboard entry affordance needs a visible label focus ring. WCAG 2.4.7 risk verified at source, not exercised in browser. Suggested: `$impeccable harden`.
3. **[P2] Choice controls expose inconsistent state.** Materials mode buttons at `app/match/new/page.tsx:1005-1007` only change `.is-active`, with no pressed/selected state. Template buttons at 1085-1086 declare radio roles but no roving tabindex/arrow-key support. Homepage comparison controls at `home-experience.tsx:87` correctly expose `aria-pressed`; use that as incumbent pattern. Suggested: `$impeccable harden`.
4. **[P2] Reduced-motion treatment is incomplete across transitions.** Homepage correctly gates GSAP/parallax and instant-switches papers (`home-experience.tsx:26-59`). `globals.css:1458-1464` globally forces 0.01 ms animation/transition, while explicit `window.scrollTo({behavior:'smooth'})` remains at `page.tsx:450,703,721,892,934`; the lower results jump at 1059 already honors preference. Preserve useful state feedback while making all navigation scrolls instant in reduce mode. This is code verified, not preference-emulated. Suggested: `$impeccable animate`.
5. **[P2] Touch sizes uneven outside main CTAs.** Source minima: `ui-theme.css:11` language 40 px, `globals.css:1405` material-mode/base actions 42 px, `globals.css:1431` editor mini-actions 38 px, `ui-theme.css:61` footer links 28 px. Main CTAs and suggestion actions already reach 44+ px. These are CSS minima, not returned live bounding boxes, and below the skill's 44 px usability floor; do not mislabel all as a WCAG 2.5.8 failure (AA is 24 px with spacing exceptions). Suggested: `$impeccable adapt`.

## Minor / conditional observations

- Source color calculations for homepage paper on white: header `#909398` = 3.08:1, footer `#87898d` = 3.50:1 (`home-experience.css:22` compressed line). Small 12 px readable text should be 4.5:1. Main `#0068d9` CTA with white text = 5.27:1; body `#666b72` with white = 5.37:1. These are authored-color calculations, not sampled rendered/antialiased pixels. Treat meaningful small labels as P2, not a complete contrast audit.
- Global focus color `#7595ff` on white = 2.80:1 (`globals.css:1437`), under the 3:1 non-text indicator target. Actual surrounding surface and browser focus rendering untested.
- Working-surface readiness spans / parse progress lack a live region, unlike error `role=alert` and many explicit result statuses (`page.tsx:987-989,1014,1018`). Main async completion could be announced and focus moved to the new heading; current screen transitions mostly only scroll. P2 improvement, no actual screen-reader session run.
- No dark CSS/token swap exists in the three loaded CSS files. Under Design Taste consumer-page default this is an implementation gap; under a deliberately light paper brand it may be accepted as a documented constraint. Ask intent before expansion.
- Storage write serializes the whole draft on every keystroke (`page.tsx:412-416`); derived parsing/fact audit also runs during render (640-645). Large-document cost is a hypothesis requiring a trace, not a confirmed performance bug.

## Strengths to preserve

- Local example is synthetic and clearly labeled; adoption/undo status is explicit and does not modify the user's resume.
- Honest requirement gaps, source/suggestion rationale, required fact confirmations, export gating and preserved manual edits are product-specific safeguards.
- Labels on main fields; standard native details/buttons/checkboxes; explicit errors; session draft persistence; dynamic parser/export imports; GSAP context and observer cleanup are sound foundations.
