# Shared invoice and item data

Approved by the user in conversation on 2026-09-05: implement the reviewed receipt improvements, retain invoice and item details, provide an Invoice tab, and support GitHub Pages without two overlapping databases.

## Storage and ownership

Keep the existing Moneyclip IndexedDB database and records table. Each ConsumptionRecord owns optional invoice metadata and its existing items array. No separate invoice or product transaction database. Invoice and Items are views of the same record; invoice lists filter the records table. Raw OCR responses and images are evidence, not independently editable copies of the transaction. Existing records remain valid without migration.

Invoice metadata includes transcript, source images and OCR response evidence, printed totals, payment arrays, adjustments with item references, tax buckets, loyalty, coupons, document sections, local identifiers/dates, currency evidence, policies and additional extracted fields. Each item supports raw labels, signed line amounts, measurements, scoped identifiers, and explicit price basis. Decimal strings retain printed monetary precision and signs. Calculations distinguish missing from zero and never repair printed data.

## Behavior

The form retains invoice metadata across OCR, draft restoration, edits and saves. Recognition remains user initiated and leaves edited fields intact. Every attached image can be selected for recognition; evidence remains attached to the image used. Repeat OCR retains prior evidence without duplicating live items. Unknown response fields remain available in the raw response. Original newly imported image bytes are retained alongside thumbnails.

Record detail exposes Items and Invoice tabs. Invoice details are grouped into readable sections, with original text, source image access and complete extracted data available through disclosures. A Collection invoice view lists the same records, and a direct invoice route opens the Invoice tab. Item totals and dossier prices use explicit net line totals where available; adjustments and coupons cannot appear as purchased inventory. Unallocated receipt discounts are disclosed, not silently assigned to products. Search covers invoice text/identifiers and item identifiers. Backups round-trip invoice metadata, richer items and original image types; older bundles remain accepted.

## Hosting and UX

Retain static Vite, HashRouter and client-side Dexie. No server/database service or server secret is introduced. PWA start URL/scope must stay beneath the configured Pages base. OCR still uses the user's configured browser-accessible provider, subject to HTTPS/CORS. Reuse the existing mobile layout, warm palette, accessible controls, and English/Traditional Chinese translations. Invoice retrieval and original text take priority over decorative UI.

## Verification

Use synthetic fixtures clearly identified as such: inconsistent 7-Eleven totals, zero/free/negative lines, fractional kg amounts, split tenders/change, masked references, country metadata, and unallocated promotions. Verify raw preservation, price basis, search, draft/save/edit and JSON image round-trip. Exercise tabs and legacy records with real IndexedDB tests. Run the complete test suite, typecheck/build, and a production preview under the Pages subpath with mobile and desktop inspection. Original receipt images from the quoted corpus are unavailable; do not claim OCR accuracy against them.
