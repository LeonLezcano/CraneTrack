# CraneTrack Design System

## 1. Visual Direction and Scene

CraneTrack is an **Operate-mode** emergency dispatch console and windshield-mounted driver cab tool for 24/7 heavy towing, roadside assistance, pre-tow damage inspection, and split-billing settlement with Argentine insurance providers.

- **Dial:** `ENERGY 4 / RHYTHM 6 / MOTION 2`
- **Primary Environment:** Nighttime dispatch desks, roadside shoulders, and windshield phone mounts under low ambient light.
- **Theme Policy (Fixed High-Contrast Dark UI + Print-Light Sheets):** CraneTrack intentionally uses a dark asphalt-slate workspace on screen to prevent glare inside truck cabins at night and preserve legibility under emergency beacons. Printable A4 legal documents (`#printContainer`) switch explicitly to a crisp white-paper, dark-ink layout via `@media print`.

## 2. Color Tokens

| Role | Token / Class | Hex | Usage |
| :--- | :--- | :--- | :--- |
| Canvas | `bg-slate-950` | `#020617` | Application background, form inputs |
| Surface | `bg-slate-900` | `#0f172a` | Primary panels, header, table containers |
| Elevated / Hover | `bg-slate-800` | `#1e293b` | Secondary buttons, inactive nav tabs, row hover |
| Border / Divider | `border-slate-800` / `border-slate-700` | `#1e293b` / `#334155` | Structural hairlines and table dividers |
| Accent (Safety Orange) | `bg-orange-600` / `text-orange-400` | `#ea580c` / `#fb923c` | Primary CTA, active navigation tab, license plates |
| Focus Ring | `:focus-visible` | `#fb923c` | 2px solid keyboard focus ring with 2px offset |
| Semantic Success | `text-emerald-400` / `bg-emerald-950` | `#34d399` / `#022c22` | Within-SLA badges, insured coverage, Wake Lock active |
| Semantic Warning | `text-amber-300` / `bg-amber-950` | `#fcd34d` / `#451a03` | On-scene status, mechanical safety warnings |
| Semantic Danger | `text-red-300` / `bg-red-950` | `#fca5a5` / `#450a0a` | SLA breach, destructive actions, validation errors |
| Text Primary | `text-slate-100` | `#f1f5f9` | Headings, primary data values |
| Text Secondary | `text-slate-300` / `text-slate-400` | `#cbd5e1` / `#94a3b8` | Labels, table metadata (WCAG AA >= 4.5:1 on `#0f172a` and `#020617`) |

## 3. Typography Scale

- **UI Sans:** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (zero external font dependencies for offline-first reliability).
- **Data Monospace:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` (used strictly for license plates, distances, ARS currency totals, order IDs, and SHA-256 digests).

| Element | Class | Size | Weight |
| :--- | :--- | :--- | :--- |
| Page Title (`h1`) | `text-2xl font-bold tracking-tight` | 24px (1.5rem) | 700 |
| Section Heading (`h2`) | `text-lg font-bold` | 18px (1.125rem) | 700 |
| Panel Subheading (`h3`) | `text-sm font-bold uppercase tracking-wider` | 14px (0.875rem) | 700 |
| Body / Form Controls | `text-sm` | 14px (0.875rem) | 400-600 |
| Table Cells / Helper Copy | `text-xs` | 12px (0.75rem) | 400-600 |

## 4. Layout Rhythm, Spacing & Accessibility

- **Flat Hierarchy:** Panels separate subsections with whitespace (`space-y-5`) and 1px hairline dividers (`border-t border-slate-800` or `divide-y divide-slate-800`), avoiding nested bordered cards inside cards.
- **Touch Targets (Mobile & Cab Mode):**
  - Standard interactive controls (nav tabs, form inputs, selects, table action buttons, delete icons): minimum `44px x 44px` (`min-h-[44px] min-w-[44px]`).
  - Cab Mode primary actions (Wake Lock, Google Maps, Call Client, Confirm Arrival): minimum `48px` height (`min-h-[48px]`) for glove-friendly windshield mount operation.
- **Responsive Grids:** All multi-column form and action grids collapse cleanly to `grid-cols-1` on narrow viewports (`< 640px`).
- **Motion:** Functional state transitions (`150ms`) only; respects `@media (prefers-reduced-motion: reduce)` by disabling transitions and animations.
- **Iconography:** Monochrome inline SVGs (`1.5px-2px` uniform stroke, `aria-hidden="true"`), zero decorative emojis in UI controls.
