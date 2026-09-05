# Shared invoice details implementation plan

**Goal:** Retain and retrieve invoice and item information from one local record while preserving GitHub Pages hosting.

**Architecture:** Optional invoice metadata is embedded in ConsumptionRecord; line details extend its existing items. Evidence stores original images and raw OCR responses. All views, search and analytics consume these records.

**Tech Stack:** Existing TypeScript, React, Dexie, Vite, Vitest; no backend.

**Spec:** ../specs/2026-09-05-invoice-details-design.md

## Global constraints

- One existing Moneyclip IndexedDB database; no duplicate live invoice/item collections.
- Existing records and older JSON backups remain readable.
- Printed evidence is preserved; derived values never rewrite it.
- HashRouter and static GitHub Pages deployment remain supported.
- English and Traditional Chinese UI; inherit existing visual system.

## Task 1: Receipt model and extraction

Files: src/db/invoice.ts, src/db/types.ts, src/lib/decimal.ts, src/lib/invoice.ts, src/lib/ocr.ts, tests/invoice.test.ts.

- [x] Write failing tests for retaining transcript, payment metadata, unknown raw response fields and signed/zero item amounts.
- [x] Add optional InvoiceDetails and item fields; decimal-string arithmetic and conservative review checks.
- [x] Extend the OCR prompt and sanitizer; keep raw responses as evidence. Verify tests.

## Task 2: Shared consumers and persistence

Files: src/lib/records.ts, src/lib/analytics.ts, src/lib/search.ts, src/lib/snapshots.ts, src/lib/drafts.ts, src/lib/images.ts, src/lib/exportImport.ts; tests/invoice.test.ts and tests/exportImport.test.ts.

- [x] Test net line prices, measured goods, excluded adjustment lines, scoped product matching and full metadata/image backup round-trip.
- [x] Route totals/dossiers/search through shared item helpers. Preserve original images and MIME types.
- [x] Carry invoice details in drafts and exports; retain old bundle support. Verify tests.

## Task 3: Capture and invoice retrieval

Files: src/pages/RecordFormPage.tsx, src/pages/RecordDetailPage.tsx, src/pages/CollectionPage.tsx, src/components/InvoiceDetails.tsx, src/components/ItemDetails.tsx, src/App.tsx, src/i18n/en.ts, src/i18n/zh-TW.ts, tests/invoice-ui.test.tsx.

- [x] Write integration tests for Invoice/Items navigation and unchanged shared record identity after edit/save.
- [x] Persist invoice state in the form, select OCR image, retain extraction history and show review details before save.
- [x] Add accessible invoice/item tabs and invoice collection view with localized, grouped data and transcript disclosures.
- [x] Verify forms, legacy records and tabs; inspect mobile/desktop renders.

## Task 4: Pages and release verification

Files: vite.config.ts, docs/github-pages.md.

- [x] Correct PWA start URL/scope to configured base, document static hosting and local persistence/backup behavior.
- [x] Run npm test and npm run build; verify built asset/manifest URLs and production hash-route refresh.
- [x] Review the final diff, resolve material findings, and record verification results.

## Execution notes

The user's explicit implementation approval covers the design. Execute the coupled data/form changes in this workspace and leave them reviewable; no publish, push or deployment is requested. Progress is recorded in this plan. Use a final independent review for the finished implementation.

## Verification result

2026-09-05: `npm test` passed 101 tests across 16 files; `npm run build`
passed TypeScript and production/PWA generation. `git diff --check` passed.
The suite still emits React test `act(...)` warnings; the build reports a large
bundle warning. Neither is a failed check.

Local production Chromium checks passed at `/moneyclip/`: 390px and 1280px
invoice/item views, no horizontal overflow, hash-route reload, relative PWA start
URL and scope, offline invoice reload, and no page errors. A synthetic network OCR
fixture exercised PNG upload, original-byte retention, draft persistence/reload,
save, raw-response preservation, photo-source links and canonical adjustment/item
links. Real receipt images and live provider accuracy were not available to test.

Independent code review findings were addressed: retain printed totals on quantity
edits, guard mismatched pricing units, bind extraction-local item references,
merge repeated observations without losing identical split-payment rows, persist
date-touch state, and preserve frozen FX snapshots on non-price edits. Regression
tests cover the arithmetic, merge, reference and snapshot fixes. The same reviewer
inspected desktop/mobile screenshots and reported no blocking usability findings.
The UI detector returned no findings on the four changed detail/form components.
The final reviewer verdict confirmed both last-round fixes resolved: non-pricing
edits preserve FX snapshots and adjustment identity is independent of generated IDs.
Visual review used the existing code reviewer with the captured screenshots rather
than a dedicated design-review agent; it was limited to blocking usability issues.
