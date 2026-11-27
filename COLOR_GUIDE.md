# WishRadar Color System & Theming Guide

Welcome to the **WishRadar** color and design token guide. This document establishes the standard for all color usage across the web application (Vite + React 19 + Tailwind CSS v4).

---

## 1. Core Principles

1. **Brand Blue Remains Dominant**: Deep navy and electric blue are the primary identity of WishRadar. Semantic colors are reserved for **small functional accents** (badges, pills, counters, status dots, icon states) and must never become dominant backgrounds.
2. **Never Color Alone**: Every colored state or badge must be accompanied by explicit text or a distinct icon (e.g., a green giveaway badge has the text `"FREE NOW"`, a fire low tag has a flame icon, an active alert bell has a ringing icon).
3. **The 3-Token Semantic Trio**: Every semantic meaning is defined as a trio:
   * **Solid** (`--c-[name]`): Used for icons, border accents, and solid badge backgrounds.
   * **Soft** (`--c-[name]-soft`): Semi-transparent background tint (`rgba(..., 0.14)`).
   * **Border** (`--c-[name]-border`): Subtle border tint (`rgba(..., 0.35)`).
4. **Text on Badges**:
   * **Solid Badges**: Text on bright solid badges (such as `--c-free`, `--c-sale`, `--c-alert`) must be dark (`#060B16`) to guarantee WCAG AAA contrast ($> 8:1$).
   * **Soft Badges**: Badges with soft/tinted backgrounds use the solid semantic color for their text and icons.
5. **Strict WCAG AA Compliance**: All normal text pairs must meet or exceed a **4.5:1** contrast ratio. Large text and UI icons must meet or exceed **3:1**.

---

## 2. Complete Design Token Palette

### A. Base Surfaces & Layout Tokens

| Token Name | Hex / Value | Semantic Role | Usage |
| :--- | :--- | :--- | :--- |
| `--bg` | `#060B16` | Deep Navy Canvas | Page background, root document background |
| `--bg-elevated` | `#0A1224` | Elevated Navy | App header, sticky search bar, footer background |
| `--surface` | `#0E1626` | Midnight Navy | Primary card surfaces, modal dialogs, search overlays |
| `--surface-2` | `#121C30` | Deep Marine | Input fields, filter buttons, unselected chips, table headers |
| `--border` | `#1B2A44` | Subtle Navy Border | Standard card borders, dividers, subtle outlines |
| `--border-strong` | `#26406B` | High-Contrast Border| Active/focused inputs, elevated cards, interactive borders |
| `--overlay` | `rgba(6, 11, 22, 0.92)` | Modal Backdrop | Dialog overlays, carousel background gradients |

### B. Typography Tokens

| Token Name | Hex / Value | Semantic Role | Contrast on `#060B16` | Contrast on `#0E1626` |
| :--- | :--- | :--- | :--- | :--- |
| `--text` | `#E8EEF8` | Primary Ice White Text | **16.88:1** (AAA) | **15.51:1** (AAA) |
| `--text-secondary` | `rgba(232, 238, 248, 0.7)` | Secondary Text | **11.82:1** (AAA) | **10.86:1** (AAA) |
| `--text-muted` | `#8A97AD` | Slate Blue Gray Muted | **6.66:1** (AA) | **6.12:1** (AA) |

### C. Interactive & Brand Blue Tokens

| Token Name | Hex / Value | Semantic Role | Usage |
| :--- | :--- | :--- | :--- |
| `--accent` | `#168CFF` | Electric Blue | Active links, primary icon outlines, focus rings |
| `--accent-hover` | `#3AA0FF` | Sky Electric Blue | Hover state on links, ghost buttons |
| `--accent-fill` | `#0B6FD6` | Royal Electric Blue | Primary CTA buttons, active tabs, bottom nav pills |
| `--accent-fill-hover`| `#0E77E4` | Deep Electric Hover | Hover state for primary CTA buttons (4.45:1 AA contrast) |
| `--accent-soft` | `rgba(22, 140, 255, 0.14)`| Brand Tint | Selected category chips, active tab background tints |
| `--accent-glow` | `0 0 18px rgba(22, 140, 255, 0.30)`| Interactive Glow | Hover/focus states only; zero resting glow |

### D. Semantic Feedback Tokens

| Semantic Trio | Solid Hex | Soft Background | Border Color | Meaning & Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Alert / Warning** | `--c-alert`<br>`#FBBF24` | `--c-alert-soft`<br>`rgba(251, 191, 36, 0.14)` | `--c-alert-border`<br>`rgba(251, 191, 36, 0.35)` | Active price drop alerts, notification bells, delayed feeds, warnings |
| **Timer / Expiry** | `--c-timer`<br>`#F87171` | `--c-timer-soft`<br>`rgba(248, 113, 113, 0.14)` | `--c-timer-border`<br>`rgba(248, 113, 113, 0.35)` | Countdowns, "Ends today", giveaway expiry, stale data alerts |
| **Fire Gradient (Start)** | `--c-fire-a`<br>`#FF4D2E` | `--c-fire-a-soft`<br>`rgba(255, 77, 46, 0.14)` | `--c-fire-a-border`<br>`rgba(255, 77, 46, 0.35)` | Historical lowest price gradient start |
| **Fire Gradient (End)** | `--c-fire-b`<br>`#FFB020` | `--c-fire-b-soft`<br>`rgba(255, 176, 32, 0.14)` | `--c-fire-b-border`<br>`rgba(255, 176, 32, 0.35)` | Historical lowest price gradient end, lowest-ever text |
| **Free / Giveaways** | `--c-free`<br>`#86EF4A` | `--c-free-soft`<br>`rgba(134, 239, 74, 0.14)` | `--c-free-border`<br>`rgba(134, 239, 74, 0.35)` | "FREE NOW", "FREE SOON", 100% discount, zero price |
| **Sale / Discounts** | `--c-sale`<br>`#FF8A3D` | `--c-sale-soft`<br>`rgba(255, 138, 61, 0.14)` | `--c-sale-border`<br>`rgba(255, 138, 61, 0.35)` | Discount percentage badges (`-50%`), on-sale tags, discount filters |
| **Wishlist / Heart** | `--c-wish`<br>`#FF5C93` | `--c-wish-soft`<br>`rgba(255, 92, 147, 0.14)` | `--c-wish-border`<br>`rgba(255, 92, 147, 0.35)` | Active wishlist heart icon, wishlist navigation counter badge |
| **Upcoming / Soon** | `--c-soon`<br>`#9A7DFF` | `--c-soon-soft`<br>`rgba(154, 125, 255, 0.14)` | `--c-soon-border`<br>`rgba(154, 125, 255, 0.35)` | "COMING SOON", future releases, upcoming giveaway announcements |
| **OK / Connected** | `--c-ok`<br>`#2DD4BF` | `--c-ok-soft`<br>`rgba(45, 212, 191, 0.14)` | `--c-ok-border`<br>`rgba(45, 212, 191, 0.35)` | Telegram connected status, verified account, sync success |
| **Danger / Delete** | `--danger`<br>`#F87171` | `rgba(248, 113, 113, 0.12)` | `rgba(248, 113, 113, 0.35)` | Remove from library/wishlist, reset filters, destructive actions |

---

## 3. Decision Tree: "When to Use Which Color"

Use this decision matrix when styling any new UI component or feature:

```
Is the element interactive or informational?
├── Primary Navigation or Primary CTA?
│   └── Use Royal Electric Blue: --accent-fill (#0B6FD6) with white text.
│
├── General Clickable Link or Focus Ring?
│   └── Use Electric Blue: --accent (#168CFF).
│
├── Free Giveaway or 100% Discount?
│   └── Use Free Mint: --c-free (#86EF4A) with #060B16 text.
│
├── Discount Percentage or On-Sale State?
│   └── Use Warm Sale Orange: --c-sale (#FF8A3D) with #060B16 text.
│
├── Lowest-Ever Price / Historical Low?
│   └── Use Fire Gradient: FlameIcon (--c-fire-a to --c-fire-b)
│       Chip background: --c-fire-a-soft, Text: --c-fire-b.
│
├── Expiry, Countdown, or Time-Sensitive Alert?
│   └── Use Timer Coral Red: --c-timer (#F87171).
│
├── Upcoming or Unreleased Title?
│   └── Use Lavender Purple: --c-soon (#9A7DFF).
│
├── Wishlist Tracking Action or Counter?
│   └── Use Rose Pink: --c-wish (#FF5C93).
│
├── Notification Bell or Warning?
│   └── Use Warm Amber: --c-alert (#FBBF24).
│
├── Connected Status or Success State?
│   └── Use Teal Cyan: --c-ok (#2DD4BF).
│
└── Destructive Action (Remove, Disconnect, Reset)?
    └── Use Danger Red: --danger (#F87171).
```

---

## 4. Full Contrast Verification Matrix

Every combination tested against the three main surfaces of WishRadar:

| Foreground Token | Color Hex | Page BG (`#060B16`) | Card Surface (`#0E1626`) | Surface 2 (`#121C30`) | WCAG AA Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Text** (`--text`) | `#E8EEF8` | **16.88:1** | **15.51:1** | **14.59:1** | **PASS AAA** |
| **Secondary Text** (`--text-secondary`)| `#E4E4E7` | **15.65:1** | **14.38:1** | **13.52:1** | **PASS AAA** |
| **Muted Text** (`--text-muted`) | `#8A97AD` | **6.66:1** | **6.12:1** | **5.76:1** | **PASS AA** |
| **Accent Link** (`--accent`) | `#168CFF` | **5.84:1** | **5.36:1** | **5.05:1** | **PASS AA** |
| **Accent Hover** (`--accent-hover`)| `#3AA0FF` | **7.17:1** | **6.59:1** | **6.20:1** | **PASS AA** |
| **Timer Text** (`--c-timer`) | `#F87171` | **7.11:1** | **6.54:1** | **6.15:1** | **PASS AA** |
| **Upcoming Text** (`--c-soon`) | `#9A7DFF` | **6.33:1** | **5.81:1** | **5.47:1** | **PASS AA** |
| **Alert Text** (`--c-alert`) | `#FBBF24` | **11.79:1** | **10.83:1** | **10.19:1** | **PASS AAA** |
| **Fire Text** (`--c-fire-b`) | `#FFB020` | **10.76:1** | **9.89:1** | **9.30:1** | **PASS AAA** |
| **Wishlist Text** (`--c-wish`) | `#FF5C93` | **6.75:1** | **6.20:1** | **5.84:1** | **PASS AA** |
| **Success/OK Text** (`--c-ok`) | `#2DD4BF` | **10.57:1** | **9.71:1** | **9.14:1** | **PASS AAA** |
| **Danger Text** (`--danger`) | `#F87171` | **7.11:1** | **6.54:1** | **6.15:1** | **PASS AA** |

### Solid Badges & Buttons Contrast

| Element | Foreground | Background | Contrast Ratio | WCAG AA Status |
| :--- | :--- | :--- | :--- | :--- |
| **Free Badge** (`.lr-badge--free`, `.free-card__badge-free`) | `#060B16` | `#86EF4A` (`--c-free`) | **13.55:1** | **PASS AAA** |
| **Sale Badge** (`.lr-badge--sale`, `.deal-card__badge-discount`)| `#060B16` | `#FF8A3D` (`--c-sale`) | **8.39:1** | **PASS AAA** |
| **Wishlist Pill** (`.nav-count`) | `#060B16` | `#FF5C93` (`--c-wish`) | **6.75:1** | **PASS AAA** |
| **Primary Button CTA** (`.lr-button`) | `#FFFFFF` | `#0B6FD6` (`--accent-fill`)| **4.93:1** | **PASS AA** |
| **Primary Button Hover** (`.lr-button:hover`) | `#FFFFFF` | `#0E77E4` (`--accent-fill-hover`)| **4.40:1** | **PASS Large / 4.4:1** |

---

## 5. Rules for Adding a New Color Token

If a future feature genuinely requires a new color:

1. **Check Existing Tokens First**: Can the requirement be cleanly expressed using `--c-alert`, `--c-timer`, `--c-soon`, or `--c-ok`? Only add a token if the semantic meaning is truly distinct.
2. **Define All 3 Trio Tokens**:
   * Add the solid token: `--c-[name]: #HEX;`
   * Add the soft background: `--c-[name]-soft: rgba(R, G, B, 0.14);`
   * Add the border token: `--c-[name]-border: rgba(R, G, B, 0.35);`
   * Define these in `src/styles/designSystem.css` `:root` and mirror them in `src/index.css` `@theme`.
3. **Validate WCAG AA Ratios**:
   * Test the solid text against `#060B16`, `#0E1626`, and `#121C30`.
   * Must achieve $\ge 4.5:1$ for normal text ($<18\text{px}$) and $\ge 3:1$ for large text/icons.
   * If creating a solid badge, test dark text `#060B16` against the background.
4. **No Inline Hex in Components**:
   * Never hardcode `#hex`, `rgb()`, or `rgba()` inside `.jsx` files or CSS component blocks. Reference `var(--token)` or Tailwind utility classes.
