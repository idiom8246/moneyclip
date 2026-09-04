---
name: Moneyclip
description: "Cobalt Plate — iOS-26 liquid-glass chrome over a mono-color editorial print system: one cobalt ink, one signal-red control plate, two substrates."
colors:
  paper: "#fafaf7"
  paper-raised: "#ffffff"
  ink: "#0f1d3d"
  ink-soft: "#4a5a80"
  line: "#dfe5f0"
  cobalt: "#2148b8"
  cobalt-deep: "#17337e"
  cobalt-soft: "#e5ebfa"
  cobalt-lift: "#93abf2"
  cobalt-chart-mid: "#4f6fd0"
  cobalt-chart-pale: "#c3d1f6"
  signal-50: "#fbeeec"
  signal-300: "#e5a09a"
  signal-500: "#c83232"
  signal-600: "#b02a2a"
  signal-900: "#7c1f1f"
  signal-950: "#4a1313"
  dusk: "#0a0f1e"
  dusk-raised: "#131c31"
  dusk-ink: "#e9eefa"
  dusk-soft: "#97a6c8"
  dusk-line: "#26344f"
typography:
  display:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
    fontVariation: "'wdth' 110"
  detail-price:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "32px"
    fontFeature: "\"tnum\""
    fontVariation: "'wdth' 110"
  title:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 110"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'PingFang SC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.5"
  secondary:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'PingFang SC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'PingFang SC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.08em"
  field-label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'PingFang SC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "13px"
    fontWeight: 500
rounded:
  control-sm: "8px"
  control: "12px"
  media: "16px"
  card: "20px"
  surface: "24px"
  nav: "26px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  touch: "44px"
  touch-primary: "48px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "rgba(255, 255, 255, 0.4)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.cobalt}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "44px"
  chip-inactive:
    backgroundColor: "rgba(255, 255, 255, 0.55)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "44px"
  field:
    backgroundColor: "rgba(255, 255, 255, 0.45)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  card:
    backgroundColor: "rgba(255, 255, 255, 0.55)"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  nav-capsule:
    backgroundColor: "rgba(255, 255, 255, 0.72)"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.nav}"
  toast:
    backgroundColor: "rgba(255, 255, 255, 0.88)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 10px 10px 16px"
  destructive-confirm:
    backgroundColor: "{colors.signal-600}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "10px 16px"
---

# Design System: Moneyclip — Cobalt Plate

## Overview

**Creative North Star: "Cobalt Plate"**

Moneyclip is a personal print journal of kept purchases, seen through liquid glass. One cobalt ink carries every surface: the app reads as a printed sheet — cobalt ink-washes at both horizons and a halftone dot field that fades out below the masthead — with iOS-26-style liquid-glass chrome floating over it. Density, weight, and tint steps of the same hue carry hierarchy; extra hues never do. The category-default dashboard-of-cards is refused: content is editorial, chrome is optical.

The system is built for one canvas — iPhone 16 Pro Max class (440×956 CSS px), used on the sofa, on the commute, and in shops right after a purchase — so it is an Operate surface whose expression lives entirely in precise details: the specular lip on a button, the blur of a toast, the tabular numerals of a price. Glass here is a specific effect, not decoration: every translucent surface refracts the printed sheet behind it (fixed-attachment background), and inputs deliberately sit on glass as hairline wells rather than stacking a second blur layer.

Dark mode is a first-class second substrate ("cobalt night"), not an afterthought: a `.dark` class on `<html>`, driven by a user setting (system / light / dark), swaps every token pair.

**Key Characteristics:**
- Mono-color editorial ink: Cobalt #2148B8 dominant plate; hierarchy via density, never hue count.
- Signal Red #C83232 is a control plate — expiry and destructive only.
- Liquid glass in four grades (soft 12px blur → deep 40px blur), always over the real printed background.
- Archivo Variable (self-hosted, wdth axis) is the display voice for mastheads and money; system CJK stack carries all body copy.
- Fixed mobile canvas (max-w 440px), 8px spacing rhythm, 44px touch floor.
- Two complete token substrates (paper light / dusk dark) kept in lockstep.

## Brand Mark

The Moneyclip mark is a white paper clip whose inner wire draws an **M**, held on a solid cobalt plate. It is deliberately geometric and single-color so it remains legible at 36px in the sticky masthead, at favicon scale, and inside platform icon masks. The app header uses the code-native `BrandMark`; `public/icons/icon.svg` and `public/favicon.svg` carry the same geometry. The dedicated `public/icons/maskable.svg` reduces the mark inside Android's safe zone and uses full-bleed cobalt, so launcher cropping cannot cut the monogram.

## Colors

A two-plate print system on two substrates: a dominant cobalt plate does all structural work, a signal-red control plate appears only where money or data can be destroyed, and both live on neutral paper by day and cobalt night after dark.

### Primary
- **Cobalt Plate Ink** (#2148b8): the one structural ink. Primary buttons, active chips and nav lens, links and focus rings, chart fills, the caret, text selection, the add-puck. On dark grounds it lifts to **Cobalt Lift** (#93abf2) for text and small fills.
- **Cobalt Press** (#17337e): deeper step for emphasized text on cobalt tints (chip labels, savings figures on washes).
- **Cobalt Wash** (#e5ebfa): the plate's tint — reason/tag chips, icon squares, bar-chart tracks, savings-card ground. Dark mode re-expresses it as cobalt-lift at 15% alpha.
- **Chart cobalt ramp** (#4f6fd0 mid, #c3d1f6 pale): two extra steps of the same hue used only inside the donut/bars so categories stay distinguishable without leaving the plate.

### Secondary
- **Signal Red control plate** (#c83232, with 50/300/600/900/950 steps #fbeeec / #e5a09a / #b02a2a / #7c1f1f / #4a1313): expiry warnings ("expiring soon" banner, status dots) and destructive actions (delete buttons, confirm panels). Nothing else. It is never a second accent, and there are no red/green finance semantics anywhere in the app.

### Neutral
- **Neutral White** (#fafaf7): the light substrate — the paper under everything; PWA theme color.
- **Raised Paper** (#ffffff): solid raised fills; its alpha variants (40–88%) are the glass tints.
- **Midnight Ink** (#0f1d3d): primary text on light; also the shadow/edge tint for the whole light glass system (all glass shadows are this ink at 4–35%).
- **Faded Ink** (#4a5a80): secondary text, placeholders, inactive nav keys, chart "everything else" slice.
- **Print Hairline** (#dfe5f0): 1px borders, scrollbar color, link underlines.
- **Cobalt Night** (#0a0f1e): the dark substrate; PWA background color.
- **Night Raised** (#131c31): dark raised fills and dark glass tints.
- **Night Ink** (#e9eefa): primary text on dark; also the dark hairline tint (at 11%).
- **Night Soft Ink** (#97a6c8): secondary text on dark.
- **Night Hairline** (#26344f): dark 1px borders and bar-chart tracks.

### Named Rules
**The One-Ink Rule.** Cobalt is the only structural ink. Hierarchy is carried by density, weight, and tint steps of the same hue — never by introducing hues. If a screen needs a new color, it needs a different tint step instead.

**The Signal-Plate Rule.** Signal Red is a control plate, not a color. It appears exclusively on expiry state and destructive flow (warn → confirm → execute). Any other use of red is a defect.

**The Two-Substrate Rule.** Every color ships as a light/dark pair (paper↔dusk, ink↔dusk-ink, line↔dusk-line, cobalt↔cobalt-lift). Nothing ships light-only; the night substrate is re-derived per token, not dimmed with an overlay.

## Typography

**Display Font:** Archivo Variable, self-hosted (`@fontsource-variable/archivo/wdth.css`), width axis engaged — with system-ui / PingFang TC fallbacks
**Body Font:** System CJK stack (`ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'PingFang SC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif`)
**Label/Mono Font:** none — numerals in data use `tabular-nums` on the surrounding face

**Character:** An editorial pairing: condensed-ish Archivo speaks the app's voice — mastheads and money — while the system CJK stack stays invisible and legible for Chinese body copy. The display voice is earned by the numbers: every money figure is Archivo bold with tabular figures.

### Hierarchy
- **Display** (700, 28px, tracking −0.02em, wdth 112): the masthead "Moneyclip" only. The widest stretch in the system.
- **Headline** (700, 34px / 40px line, tabular, wdth 110): hero money figures (monthly report total, trip total). A 26px variant serves record-detail price and the collapsed monthly total.
- **Title** (600–700, 20–24px, tracking −0.025em, wdth 110 at 20px): page titles (PageHeader h1, 20px semibold) and record-detail titles (24px bold). Small Archivo figures (est. totals at 18px, dossier stats at 14px) drop the stretch but keep bold + tabular.
- **Body** (400, 16px, 1.5): item titles set at 16px semibold with `tracking-tight`; running copy stays regular. Secondary line: 14px in Faded Ink.
- **Label** (600, 11px, +0.08em, uppercase): section-card titles and metric labels ("本月總計", "TOTAL") — always in Faded Ink, always naming real content below or beside it. Field labels: 13px medium, sentence case.

### Named Rules
**The Display Voice Rule.** Archivo Variable speaks only for the app's voice — mastheads and money. Body copy, labels, and chrome stay in the system CJK stack; Archivo is never set as body text.

**The Numbers-First Rule.** Every money figure is bold, `tabular-nums`, and honest: converted values carry ≈, unconverted ones are marked 未換算. Charts mirror every number as text; the SVG is decoration, the data survives without it.

## Layout

A fixed mobile canvas: the content column is capped at 440px and centered; no responsive breakpoints are authored — composition is single-column at every width. Page gutter is 16px (`px-4`). Headers are sticky glass bars (`min-h-14`, `hairline-b` divider) pinned to the top; the liquid-glass bottom nav floats at the bottom inset by `max(0.75rem, env(safe-area-inset-bottom))`; toasts stack above it. Content clears both.

The spacing rhythm is an 8px base with a 4px half-step: `gap-2` (8px) is the dominant unit everywhere, `gap-3` / `p-3` (12px) inside record cards, `p-4` (16px) for section padding and gutters, `p-5` (20px) only for the hero report card. Vertical stacks run `space-y-2`/`space-y-3`; sections separate at `mt-3`–`mt-4`. More space always sits above a heading than below it.

The touch floor is 44px (`min-h-11`) for every interactive element; primary actions get 48px (`min-h-12`); nav keys are 56px (`min-h-14`). Density changes — tighter groups, roomier separation — are the hierarchy mechanism, per the One-Ink Rule.

## Elevation & Depth

A hybrid: glass refraction for material, soft offset shadows for float. Every glass surface carries a three-part **specular edge** — `inset 0 1px 0` white top lip, `inset 0 0 0 1px` white ring, `inset 0 -1px 0` ink shade — plus exactly one offset soft ambient shadow (never a border under a wide shadow). Hairline dividers are themselves shadows: `0 1px 0 var(--hairline)` for headers, `inset 0 0 0 1px var(--hairline)` for wells. All shadows carry offset and blur; there are no zero-blur halos and no flat-outline cards.

### Shadow Vocabulary
- **Glass edge** (`var(--glass-edge)`): the specular inset stack on every glass grade; light uses white 70/26% + ink 4%, dark uses white 12/7% + black 24%.
- **Float** (`var(--glass-shadow)` — `0 1px 2px` ink 5%, `0 16px 40px -16px` ink 28%): chrome that hovers — headers, the nav capsule.
- **Rest** (`var(--glass-shadow-soft)` — `0 1px 2px` ink 4%, `0 8px 24px -12px` ink 18%): cards and chips at rest; RecordCard upgrades to Float on hover.
- **Deep** (`0 24px 64px -24px` ink 35%): modals and the toast, paired with `glass-deep`.
- **Pressed glow** (`btn-cobalt` stack): specular lip + cobalt drop glow (`0 10px 24px -10px` cobalt 55%) under the primary plate.

### Named Rules
**The Real Refraction Rule.** Glass always blurs something real: the fixed-attachment printed sheet (cobalt ink-washes + 1px/16px halftone field, masked out below 46% of the viewport). Chrome is never glass-over-nothing — if the background is missing, the glass is wrong.

**The No Nested Glass Rule.** Inputs sit on glass as hairline wells — translucent solid fill plus a 1px inset ring — never as a second blur layer. Glass on glass reads as mud.

## Shapes

The radius ladder is continuous and generous, in the liquid-glass idiom: 8px (`control-sm`) inside segmented wells, 12px (`control`) for buttons, fields, and list rows, 16px (`media`) for photos and larger inline surfaces, 20px (`card`) for cards and sections, 24px (`surface`) for hero cards, dialogs, and the empty-state plate, 26px (`nav`) for the bottom-nav capsule, and `pill` (9999px) for chips, round buttons, and the toast. Borders are hairlines only — 1px in `--hairline` or `--color-line`; heavier strokes appear solely on the signal plate (1px `signal-300` warning outlines). Circles are reserved for small controls (icon buttons, status dots, the add-puck), and the add-puck notches into the nav capsule with a 4px substrate-colored ring that visually melts it into the page.

## Components

### Buttons
- **Shape:** 12px radius (`control`), 44px min height, press feedback `active:scale-[0.97]`.
- **Primary:** solid cobalt plate (`btn-cobalt`) — Cobalt #2148b8 ground, white text, specular inset lip + soft cobalt glow; 10px 16px padding, 14px semibold; hover `brightness-110`, disabled opacity 50%.
- **Ghost:** translucent paper (white 40%) with a 1px inset hairline ring; hover raises to white 70%.
- **On-glass tertiary:** `glass-soft` plates for secondary card actions (edit/cancel), same radius and metrics.

### Chips
- **Style:** pills, 44px min height, 6px 14px padding, 14px medium. Inactive: `glass-soft` with ink text; active: solid cobalt (`btn-cobalt`).
- **State:** always `aria-pressed`; every chip is text (plus optional lucide icon or category emoji), never color-only. Press scales to 0.95.

### Cards / Containers
- **Corner Style:** 20px for record/section cards, 24px for hero report cards.
- **Background:** `glass-soft` (white 55%, blur 12px, saturate 1.35 light; night-raised 55% dark).
- **Shadow Strategy:** specular edge + Rest shadow; hover upgrades to Float; press scales 0.99.
- **Border:** none — the edge stack is the border.
- **Internal Padding:** 12px in record cards, 16px in sections. Section cards open with an 11px uppercase label and an optional 28px cobalt-wash icon square.

### Inputs / Fields
- **Style:** hairline wells — translucent paper fill (white 45% / dusk 45%), 1px inset hairline shadow, 12px radius, 44px height, 16px text. Never a second glass layer.
- **Focus:** keeps the global `:focus-visible` 2px cobalt outline (offset 2px) and adds an inset 1.5px cobalt ring with a breath of cobalt glow (`0 1px 6px` cobalt 18%). Caret is cobalt everywhere.
- **Error / Disabled:** disabled opacity 50%; destructive context is carried by the signal plate, not by field styling.

### Navigation
- **Style:** one `glass-strong` capsule (26px radius, blur 28px, saturate 1.8), 5-key grid: Invoices | Inventory | [+] | Saved | Reports. Search, language, and settings live in the persistent app masthead.
- **States:** active key sits in a cobalt lens (Cobalt Wash 80% + inset specular, cobalt text); inactive keys are Faded Ink on bare glass. Keys scale 0.95 on press.
- **Add key:** a 56px cobalt puck (btn-cobalt) notched 32px above the capsule with a 4px substrate-colored ring; scales to 0.90 on press.
- **Mobile treatment:** fixed, safe-area aware, rises into place with the `rise-in` entrance.

### Toast
- **Style:** `glass-deep` pill (white 88%, blur 40px, saturate 1.9, Deep shadow), pops once via `toast-in` (0.18s ease-out, 8px rise + 0.96 scale). Optional action chip: Cobalt Wash ground, cobalt semibold text. Auto-dismisses at 4.5s; `role="status"`.

### Signature: Cobalt-lens Bottom Nav
The nav capsule is the world's thesis in one component: liquid glass over the printed sheet, one cobalt lens marking position, one raised cobalt puck offering the primary action in the thumb zone. It is the element every new surface must harmonize with — never cover it, never stack content under it.

### Charts
Dependency-free SVG. The donut fills from the cobalt ramp (#2148b8 → #17337e → #4f6fd0 → #93abf2 → #c3d1f6 → #4a5a80 slate for "everything else") with a hole matching its glass card (`var(--chart-hole)`); bar tracks are Cobalt Wash, fills cobalt (lift on dark). Every value is mirrored as text with `tabular-nums`; percentages sit beside truncated labels in Faded Ink.

### Destructive Flow
Warn with outline (1px `signal-300` border, `signal-600` text, hover Signal-50 wash) → confirm panel (`signal-50/60`, `signal-300` border, `signal-900/950` text) → execute with solid `signal-600` and a soft red shadow. Three steps, one plate, always cancellable.

## Do's and Don'ts

### Do:
- **Do** use the four glass grades for their jobs: `glass-soft` (cards, chips, rows), `glass` (generic surfaces), `glass-strong` (chrome: header, nav), `glass-deep` (dialogs, toast).
- **Do** pair every color with its dark token and check both appearances; the night substrate is a re-derived palette, not a dimmer.
- **Do** theme the browser surfaces: selection cobalt 22%, cobalt caret, thin scrollbars in the hairline color, 2px cobalt `:focus-visible` outline at 2px offset, patched autofill.
- **Do** keep every interactive target ≥44px and give press feedback (`active:scale-0.90–0.99` by element size).
- **Do** convey status with a text label next to any dot or icon — color alone never carries status.
- **Do** respect `prefers-reduced-motion`: both entrance animations off, all transitions clamped to 0.01ms.
- **Do** feed the glass: any new full-screen surface keeps the fixed ink-wash + halftone background intact so chrome has something to refract.

### Don't:
- **Don't** introduce a second structural hue; reach for a cobalt tint step instead (One-Ink Rule).
- **Don't** use Signal Red for emphasis, links, badges, or "hot" decoration — expiry and destructive only (Signal-Plate Rule).
- **Don't** nest glass on glass; fields on glass plates are hairline wells (No Nested Glass Rule).
- **Don't** put glass chrome over a flat or empty background — without the printed sheet the refraction dies (Real Refraction Rule).
- **Don't** set money without `tabular-nums`, or let an unconverted figure pose as converted (≈ or 未換算, always).
- **Don't** stretch Archivo into body copy or set the masthead in the system face; the display voice is reserved for mastheads and money.
