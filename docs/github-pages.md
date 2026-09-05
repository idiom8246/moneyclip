# Static hosting and invoice storage

Moneyclip remains a client-side React app. It needs no SQL server, Prisma service,
or second invoice database. GitHub Pages serves the built files; IndexedDB stores
the user's data in their browser. This matches GitHub's [static hosting model](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## One source of editable data

- `moneyclip.records`: each record owns optional `invoice` metadata and its canonical
  `items` array. The Invoice and Items tabs, invoice collection, search and dossiers
  read this same record. Existing journal records need no migration.
- Invoice metadata includes printed totals, payments and gateway fields, adjustments,
  tax buckets, multiple loyalty programs, coupons, rebates, regional fields and
  document sections. Optional extensible entries preserve country-specific detail.
- `attachments` retains original uploaded image bytes and separate display thumbnails,
  linked to that record. `invoice.sources` retains raw OCR responses and source-photo
  references. These are evidence, not another editable copy of the transaction.
- Decimal strings preserve printed monetary precision, zeroes and signs. Derived
  item prices use known quantity and pricing units. Discrepancies are shown for
  review, never used to overwrite printed totals. Receipt discounts are not
  arbitrarily allocated to individual products.

Repeated OCR preserves observations and fills metadata gaps. Existing edited values
take precedence; incoming items are offered for explicit addition when items already
exist. Overlapping observations disable completeness-based reconciliation until
review; raw responses remain available even when structured observations overlap.

## Deployment

The existing `.github/workflows/deploy.yml` installs dependencies, typechecks, tests,
builds, and uploads `dist` to Pages. The configured Vite base is `/moneyclip/`.
For another repository path or a root custom domain, adjust `base` in
`vite.config.ts` before rebuilding. The PWA uses a relative start URL and generated
scope under that base. Routes use hashes, such as
`/moneyclip/#/invoices` and `/moneyclip/#/record/<id>?tab=invoice`, so direct links
and refreshes do not need server-side route rewrites.

Local verification: `npm test`, `npm run build`, then `npm run preview`.
This implementation does not itself publish or change repository hosting settings.

## Retention and privacy

Use **JSON export** for full backups: invoice metadata, canonical items, raw OCR
responses, and attached images with MIME types are included. CSV is a summary, not
a full-fidelity backup. Older JSON bundles remain supported.

Browser storage is not GitHub storage or automatic cross-device sync. Clearing site
data, private browsing, storage eviction, or moving to a different origin can make
local records unavailable. Export backups regularly and before changing origins.
Original photos consume more space than thumbnails; backup files may contain
sensitive payment and loyalty information. Keep them out of public repositories.

OCR still calls the configured external vision service directly from the browser.
The service must accept browser requests (CORS) and a connection allowed from an
HTTPS site. Hosted Pages cannot run a local Python OCR engine or keep a server-side
secret. Never bake a private shared API key into the frontend or repository.

The supplied receipt descriptions are synthetic test inputs, not verified OCR
ground truth. No tax-law, barcode-weight, loyalty-refund or lottery automation is
inferred from those descriptions; the original receipt evidence remains authoritative.
