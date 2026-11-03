# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** InvestPro  
**Generated:** 2026-11-03  
**Category:** Banking / Education Fintech (light)  
**Note:** Auto-generated dark/glass/purple palette was overridden for trust, accessibility, and product audience (iniciantes e servidores públicos).

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary / Nav | `#0F172A` | `--color-primary` |
| Secondary | `#1E3A8A` | `--color-secondary` |
| CTA / Accent | `#CA8A04` | `--color-cta` |
| CTA Hover | `#A16207` | `--color-cta-hover` |
| Background | `#F8FAFC` | `--color-background` |
| Surface | `#FFFFFF` | `--color-surface` |
| Text / Ink | `#020617` | `--color-ink` |
| Muted text | `#475569` | `--color-muted` |
| Border | `#E2E8F0` | `--color-border` |
| Success | `#059669` | `--color-success` |
| AI badge | `#334155` | `--color-ai` |

**Color Notes:** Banking Trust — navy + gold CTA on light slate background. No purple-dominant AI chrome.

### Typography

- **Heading Font:** IBM Plex Sans (via `next/font/google`)
- **Body Font:** IBM Plex Sans
- **Mood:** financial, trustworthy, professional, corporate, banking
- **Weights:** 400, 500, 600, 700

### Style

- Soft Minimalism / Swiss Modernism 2.0 (light)
- Hero + Features + CTA landing pattern
- Stacked bar for allocation (not pie) for accessibility
- Subtle shadows only; no glassmorphism, no glow, no dark OLED default

### Spacing

| Token | Value |
|-------|-------|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `16px` |
| `--space-lg` | `24px` |
| `--space-xl` | `32px` |
| `--space-2xl` | `48px` |

### Motion

- Transitions: 150–300ms (`duration-200`)
- Respect `prefers-reduced-motion: reduce`
- Hover: color/opacity/border — avoid layout-shifting scale

### Interaction

- All clickable elements: `cursor-pointer`
- Visible `:focus-visible` ring (gold/navy)
- Touch targets ≥ 44px on form options
- Loading buttons: disabled + spinner text

### Icons

- SVG only (Heroicons-style), never emoji as icons
- Consistent 24×24 viewBox; size with `w-5 h-5` / `w-6 h-6`

### Anti-patterns

- Dark mode as default
- Purple CTA / purple AI glow as primary brand
- Emoji icons
- Pie charts for allocation
- Instant state changes without feedback
- Low-contrast muted text (`slate-400` on white)

### Pre-Delivery Checklist

- [ ] No emojis as icons
- [ ] cursor-pointer on clickables
- [ ] Hover 150–300ms
- [ ] Light contrast ≥ 4.5:1
- [ ] Focus-visible for keyboard
- [ ] prefers-reduced-motion
- [ ] Responsive 375 / 768 / 1024 / 1440
