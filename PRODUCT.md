# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Single user (Felix), zh-TW-first. Personal use on an iPhone — the primary design viewport is the iPhone 16 Pro Max class (440×956 CSS px), used on the sofa, on the commute, and in shops right after a purchase.

## Product Purpose

Moneyclip is a personal "selective consumption journal": keep what is worth remembering from receipts — what I bought, where, why it was worth it — item-first, with photos, OCR, barcode scanning, multi-currency price history (dossiers per product, per store, per trip), inventory tracking, a shopping list, and monthly reports. Success is being able to answer "what did I pay for this before, and was it worth it?" in seconds, offline.

## Positioning

An item-first consumption journal, not a budgeting or banking tool. A neighboring app could copy receipt scanning, but not the selective "keep what's worth keeping" editorial stance: records are curated keeps (want / bought / remember / compare / recommend / repurchase), not ledger entries. Non-goals per spec: no budgets, no bank sync, no red/green finance semantics.

## Operating Context

- Fully local PWA: React 18 + Vite + Tailwind v4 + Dexie (IndexedDB), HashRouter, offline-first. No server; data leaves the device only via explicit export.
- OCR runs through a user-configured provider (baseUrl/apiKey/model in Settings); barcode via device camera (zxing).
- Multi-currency with HKD default; manual rates; converted values always shown with ≈ or 未換算.
- Installable PWA (vite-plugin-pwa); iOS Safari is the main runtime, including safe-area insets.

## Capabilities and Constraints

- Data model: records, items, categories, attachments, settings, productCache, rateCache.
- 5-key bottom navigation: 發票 | 庫存 | [+] 新增 | 收藏 | 報表; Search, language, and Settings live in the sticky app masthead, and the shopping list lives inside 庫存 as a segmented toggle.
- Locales: zh-TW (default) and en. The zh-TW strings, placeholders, aria-labels, and accessible names are pinned byte-for-byte by the test suite (tests/, 15 files); visual work must keep every feature, flow, and string intact and tests green.
- Theme setting: system / light / dark — both appearances must exist and stay functional.
- Draft auto-restore (600ms debounce) must never lose form data.

## Brand Commitments

- Name: **Moneyclip**.
- Binding visual commitments (2026-09-03 redesign, user-confirmed):
  - iOS-26-style **liquid glass** chrome, most visibly the liquid glass bottom navigation.
  - **Mono-color editorial ink system** per `~/.agents/skills/mono-color-skill`: Cobalt `#2148B8` dominant plate + Signal Red `#C83232` control plate (expiry/destructive only), neutral substrates, plate discipline.
  - iPhone 16 Pro Max (440×956) is the primary viewport.
  - The app background is part of the design (cobalt ink-wash + print texture feeding the glass).

## Evidence on Hand

- Approved product spec: `docs/superpowers/specs/2026-09-01-moneyclip-design.md` (positioning, data model, screens, visual constraints, test strategy).
- Test suite pins all user-facing copy and interaction semantics.
- Design skill source: `~/.agents/skills/mono-color-skill` (installed 2026-09-03 from github.com/yanliudesign/mono-color-skill).

## Product Principles

1. Keep what's worth keeping — curation over ledger.
2. Item-first — the thing bought matters more than the total.
3. Local-first, never lose data — the form forgives, drafts restore.
4. Numbers at a glance — prices are the display voice; tabular, honest, converted or marked unconverted.
5. Calm operate surface — expression lives in precise details, never at the cost of the task.

## Accessibility & Inclusion

WCAG AA contrast; ≥44px touch targets; status never conveyed by color alone (status dots always carry a text label); `aria-pressed`/`aria-expanded`/`role="dialog"` semantics preserved; respects `prefers-reduced-motion`.
