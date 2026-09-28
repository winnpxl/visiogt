# Visio

Marketing site for **Visio** — a managed project delivery platform where vetted African
professionals are matched to projects by AI, with a dedicated Project Manager overseeing
delivery from brief to launch.

Static HTML, CSS and vanilla JavaScript. No build step, no dependencies.

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Homepage — hero, about, how it works, platform, categories, stories, FAQ |
| `clients.html` | For clients — what you get, the process, pricing, quality assurance |
| `talent.html` | For talent — why join, verification, opportunities, earnings |

## Running locally

Any static file server works:

```bash
npx serve -l 4321 .
```

Then open <http://localhost:4321>.

## Design system

The site implements the **Lattice** style reference — a botanical field journal on warm
parchment. All tokens live in `:root` at the top of `assets/css/styles.css`.

- **Canvas** — Parchment `#f7f6f2`. Never pure white for the page background.
- **Structure** — Forest Ink `#001f1f` carries all primary text and structural borders.
- **Brand** — the logo teal is `#21B79F` (`--color-brand`). Primary buttons use a deeper
  shade, `#157A69` (`--color-brand-action`), because white text on the lighter teal is only
  2.5:1 — below WCAG AA. The action shade reaches 5.2:1 at rest and 7.0:1 on hover.
- **Pastel taxonomy** — each content category keeps its own tint across every page:
  Mint = matching, Lime = managed delivery, Lavender = payments and testimonials,
  Blush = quality, Sage = clients, Buttercream = warm accents.
- **Type** — **Plus Jakarta Sans** at 400/500 only, loaded from Google Fonts, with tight
  tracking on display sizes and 0.08em tracking on 11px uppercase labels. A soft geometric
  sans, openly licensed (SIL OFL), so every visitor sees the same face.
- **Rhythm** — every section opens badge → heading → description.

## Brand assets

Two drop-in slots in `assets/img/` — overwrite the files, keep the filenames:

| File | Used by | Notes |
|------|---------|-------|
| `logo-lockup.svg` | Nav and footer on all three pages | Rendered at 30px height, width auto |
| `logo-mark.svg` | Symbol-only contexts | Square mark |
| `favicon.svg` | Browser tab icon | Needs to read at 16px |

The nav anchor carries `logo logo--lockup`, which hides the HTML `Visio` text so the
artwork carries the whole logo. To switch to a symbol plus live text, drop `logo--lockup`
and point `src` at `logo-mark.svg`.

Replacement SVGs need a `viewBox` so they scale to the height the layout gives them.

## Imagery

All artwork in `assets/img/` is hand-authored SVG drawn to the palette — the petal logo mark,
the hero workspace dashboard, product UI panels (brief, matching, milestones, payments,
quality review, verification, opportunities, earnings), a network illustration and four
illustrated avatars. No stock photography, per the design reference.

## JavaScript

`assets/js/main.js` is dependency-free and covers:

- **Inertial smooth scrolling** — wheel input is eased into the real window scroll position
  each frame, so sticky positioning, the native scrollbar and anchors all keep working.
  Nested scrollable areas are left to scroll natively.
- Eased anchor navigation with a sticky-nav offset
- Scroll reveal (IntersectionObserver, with a geometry fallback)
- Scroll progress bar, sticky nav state, mobile menu
- FAQ accordion, testimonial carousel, animated counters

Everything degrades to native behaviour under `prefers-reduced-motion`, and the reveal
animations only arm once JS is running so a script failure can't leave the page blank.

## Before launch

- The logo strip wordmarks (Kolaba, Northwind, Tenda Health, …) are invented placeholders.
- Testimonials and the homepage stat figures are illustrative.
- CTAs point at `mailto:` placeholders on the `visio.example` domain.

Each is marked with an HTML comment where it appears.
