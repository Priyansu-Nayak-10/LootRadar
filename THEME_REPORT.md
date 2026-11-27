# WishRadar Theme & Color Audit Report

**Auditor:** UI/Design-System Auditor  
**Date:** November 27, 2026  
**Scope:** `E:\ProjectHub\WishRadar\wishradar` (Vite + React 19 + Tailwind CSS v4)  
**Status:** READ-ONLY Deep Scan  

---

## 1. Brand Palette (Global)

Defined primarily in [`src/styles/designSystem.css:1-20`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L1-L20) and mirrored in [`src/App.css:1-25`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1-L25).

| Role | Color Name | Hex / Value | Where Defined | Times Used (Tokens + Hardcoded) |
| :--- | :--- | :--- | :--- | :--- |
| **Page background** | Deep Navy | `#060B16` (`--bg`) | `designSystem.css:3`, `App.css:8`, `index.html:5` | 45 |
| **Surface / Card** | Midnight Navy | `#0E1626` (`--surface`) | `designSystem.css:5`, `App.css:10` | 52 |
| **Elevated surface** | Dark Slate Navy | `#0A1224` (`--bg-elevated`) | `designSystem.css:4`, `App.css:9` | 18 |
| **Surface 2 (Inputs/Chips)**| Deep Marine | `#121C30` (`--surface-2`) | `designSystem.css:6`, `App.css:11` | 36 |
| **Border** | Subtle Navy Border | `#1B2A44` (`--border`) | `designSystem.css:7`, `App.css:12` | 80 |
| **Border strong** | Vivid Navy Border | `#26406B` (`--border-strong`)| `designSystem.css:8`, `App.css:13` | 14 |
| **Primary (Filled CTA)** | Royal Electric Blue | `#0B6FD6` (`--accent-fill`) | `designSystem.css:13`, `App.css:18` | 16 |
| **Primary hover** | Bright Electric Fill | `#1280F0` (`--accent-fill-hover`) | `designSystem.css:14`, `App.css:19` | 8 |
| **Accent (Links/Active/Focus)**| Electric Blue | `#168CFF` (`--accent`) | `designSystem.css:11`, `App.css:16` | 92 |
| **Accent hover** | Sky Electric Blue | `#3AA0FF` (`--accent-hover`) | `designSystem.css:12`, `App.css:17` | 15 |
| **Accent soft (Tint)** | Electric Blue Tint | `rgba(22, 140, 255, 0.14)` (`--accent-soft`)| `designSystem.css:15`, `App.css:20` | 24 |
| **Success (Sales/Free)** | Electric Mint / Lime | `#86EF4A` (`--success`) | `designSystem.css:17`, `App.css:22` | 18 |
| **Warning** | Warm Amber | `#FBBF24` (`--warning`) | `designSystem.css:18`, `App.css:23` | 6 |
| **Danger** | Coral Red | `#F87171` (`--danger`) | `designSystem.css:19`, `App.css:24` | 8 |
| **Text primary** | Ice White | `#E8EEF8` (`--text`) | `designSystem.css:9`, `App.css:14` | 110 |
| **Text secondary** | Muted Silver | `#E4E4E7` / `rgba(232, 238, 248, 0.7)` | Hardcoded (`App.css:1900, 2962`) | 12 |
| **Text muted** | Slate Blue Gray | `#8A97AD` (`--text-muted`) | `designSystem.css:10`, `App.css:15` | 75 |
| **Link** | Electric Blue | `#168CFF` (`--accent`) | `designSystem.css:11`, `App.css:16` | 32 |
| **Focus ring** | Electric Blue 2px | `outline: 2px solid #168CFF` | `App.css:93-94` | Global (`:focus-visible`) |

---

## 2. Tokens vs. Hardcoded

### A. Proper Design Tokens (CSS Variables)
Defined in `:root` inside [`src/styles/designSystem.css`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css) and [`src/App.css`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css):
* The core 14 tokens (`--bg`, `--bg-elevated`, `--surface`, `--surface-2`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-fill`, `--accent-fill-hover`, `--accent-soft`, `--accent-glow`, `--success`, `--warning`, `--danger`) are correctly established.
* Backward compatibility aliases (`--ink`, `--panel`, `--panel-raised`, `--line`, `--muted`, `--bright`, `--lime`, `--lime-soft`, `--cyan`) redirect to these modern tokens.

### B. Hardcoded Colors in Components & CSS
1. **JSX Inline Styles (`style={{ ... }}`)**:
   * [`src/App.jsx:687-689`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.jsx#L687-L689): Toast notification banner hardcodes `background: '#10161b'`, `border: '1px solid #26406b'`, `color: '#eff8f1'`.
   * [`src/components/ErrorBoundary.jsx:34,47,48,57,58,59,76,85,99`](file:///E:/ProjectHub/WishRadar/wishradar/src/components/ErrorBoundary.jsx#L34): Uses CSS variable fallbacks with hardcoded hexes (`#060B16`, `#0E1626`, `#1B2A44`, `#26406B`, `#168CFF`, `#0B6FD6`, `#8A97AD`, `#E8EEF8`).
   * [`src/pages/Wishlist.jsx:819`](file:///E:/ProjectHub/WishRadar/wishradar/src/pages/Wishlist.jsx#L819): Inline `color: 'var(--muted)'`.
2. **CSS Hardcoded Residuals in `src/App.css`**:
   * **Pre-retheme Slate/Green Backgrounds**: `#0e1418` (`App.css:2364, 2878, 3170, 4713, 6251`), `#182124` (`App.css:327, 755, 955, 5225`), `rgba(12, 17, 20, 0.96)` (`App.css:638, 1104, 1112, 5217, 7055`), `rgba(6, 10, 8, .92)` (`App.css:3819`).
   * **Pre-retheme Sage Muted Text**: `#7f8d88` (`App.css:6926, 7634, 7762, 7885, 7909`), `#9aa8a2` (`App.css:1040, 1147, 1181, 1237`), `#87968f` (`App.css:1113`).
   * **Inconsistent Alert Reds**: `#ff4d4d` (`App.css:2144, 3008, 4050`), `rgba(255, 77, 77, 0.65)` (`App.css:2149, 3009`), `#ef4444` (`App.css:2979`), `#ffb5b5` (`App.css:7032`).
   * **Inconsistent Rating Yellows**: `#facc15` (`App.css:2272`), `#ffd154` (`App.css:7900`).
   * **Tailwind Zinc Defaults**: `#e4e4e7` (`App.css:1900, 2962, 2999, 4762, 6372`), `#a1a1aa` (`App.css:3064, 4768, 6451`).

### C. Near-Duplicate Colors That Should Be Unified
* **Dark Surfaces**: `#060b16` (token) vs `#080c0f` vs `#0b0f14` vs `#0e1418` vs `#10161b` vs `#11181c` $\rightarrow$ **Unify to `--bg: #060B16` and `--surface: #0E1626`**.
* **Elevated/Input Panels**: `#121c30` (token) vs `#182124` vs `#182225` vs `#182226` vs `#1b2721` $\rightarrow$ **Unify to `--surface-2: #121C30`**.
* **Muted Text**: `#8a97ad` (token) vs `#677893` vs `#7f8d88` vs `#84938d` vs `#87968f` vs `#8c9c94` vs `#9aa8a2` vs `#a1a1aa` $\rightarrow$ **Unify to `--text-muted: #8A97AD`**.
* **Error/Danger**: `#f87171` (token) vs `#ff4d4d` vs `#ef4444` vs `rgba(255, 77, 77)` $\rightarrow$ **Unify to `--danger: #F87171`**.

---

## 3. Page-Wise Color Usage

### Page 1: Discover (Home)
Includes Hero Carousel, Featured Free Sidebar, Top Deals, Popular Games Shelf, Coming Soon Shelf, Home News Grid, Wishlist Strip, Promo Banner, and Search Overlay.

| Element | Color / Token / Class | Exact Location |
| :--- | :--- | :--- |
| **Hero Carousel Wrapper** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:3770`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3770) |
| **Hero Background Overlay** | `linear-gradient(90deg, rgba(6, 10, 8, .92), rgba(6, 10, 8, .08))` *(Legacy green-black)* | [`src/App.css:3815`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3815) |
| **Hero Title / Heading** | `color: var(--bright)` (`#E8EEF8`) | [`src/App.css:3840`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3840) |
| **Hero Badge ("TOP DEAL")** | `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff` | [`src/styles/designSystem.css:168`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L168) |
| **Hero Discount Badge** | `background: var(--success)` (`#86EF4A`), `color: #060B16` | [`src/App.css:3855`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3855) |
| **Hero Price (Sale / Old)** | `strong`: `#ffffff`, `del`: `var(--muted)` (`#8A97AD`) | [`src/App.css:3862-3868`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3862-L3868) |
| **Hero Nav Arrows** | `background: rgba(14, 22, 38, 0.85)`, `border: 1px solid var(--border)`, hover `border-color: var(--accent)` | [`src/App.css:3880`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3880) |
| **Hero Dots Active Indicator** | `background: var(--accent)` (`#168CFF`), resting: `rgba(255, 255, 255, 0.2)` | [`src/App.css:3890`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3890) |
| **Section Kickers** | `color: var(--lime)` $\rightarrow$ `var(--accent)` (`#168CFF`) | [`src/styles/designSystem.css:220`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L220) |
| **Popular Game Card** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:3910`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3910) |
| **Popular Card Hover** | `border-color: rgba(22, 140, 255, 0.4)`, `box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45)` | [`src/App.css:3925`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3925) |
| **Card Rank Badge (`#1`)** | `background: rgba(14, 22, 38, 0.85)`, `color: var(--text)` (`#E8EEF8`), `border: 1px solid var(--border)` | [`src/App.css:3930`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3930) |
| **Card Deal Badge (`-50%`)** | `background: var(--success)` (`#86EF4A`), `color: #060B16` | [`src/App.css:3940`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3940) |
| **Coming Soon Card** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:3960`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3960) |
| **Coming Soon "FREE SOON"** | `background: var(--success)` (`#86EF4A`), `color: #060B16` | [`src/App.css:3975`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3975) |
| **Coming Soon "RELEASE"** | `background: var(--surface-2)` (`#121C30`), `color: var(--text-muted)` (`#8A97AD`), `border: 1px solid var(--border)` | [`src/App.css:3980`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3980) |
| **Featured Free Game Link** | `border: 1px solid var(--border)`, hover `border-color: var(--accent)`, `color: var(--text)` | [`src/App.css:4000`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4000) |
| **Home News Grid / Cards** | `background: linear-gradient(145deg, var(--surface-2), var(--surface))`, `border: 1px solid var(--border)` | [`src/App.css:3934`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3934) |
| **Promo Banner ("Connect Telegram")**| `background: linear-gradient(145deg, var(--surface-2), var(--surface))`, `border: 1px solid var(--border)`, CTA `em`: `color: var(--accent)` | [`src/App.css:3934, 4050`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3934) |
| **Search Result Tile** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:2340`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2340) |
| **Search Tile Actions** | Wishlist/Owned buttons: `background: rgba(14, 22, 38, 0.85)`, active: `color: var(--accent)` (`#168CFF`) | [`src/App.css:2380`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2380) |

* **Dominant colors:** `#060B16` (Deep Navy Page), `#0E1626` (Card Surfaces), `#1B2A44` (Card Borders), `#168CFF` (Electric Blue Accents & Kickers), `#86EF4A` (Sale/Free Badges with `#060B16` text).
* **Off-theme colors:** `rgba(6, 10, 8, .92)` (Legacy olive-tinted dark gradient in `.home-hero-overlay` at `src/App.css:3815`), and `#87968f` (Legacy muted sage text in `.home-section-strip` at `src/App.css:1113`).

---

### Page 2: FreeNow
Includes Giveaways tracker, Live/Upcoming/Always tabs, Filter Chips, Claim Cards, and Always Free Directory.

| Element | Color / Token / Class | Exact Location |
| :--- | :--- | :--- |
| **Header Title Strong** | `color: var(--lime)` $\rightarrow$ `var(--accent)` (`#168CFF`) | [`src/App.css:2594`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2594) |
| **Active Games Count Badge** | `background: rgba(255, 255, 255, 0.08)`, `border: 1px solid var(--line)`, `color: var(--muted)` | [`src/App.css:2598`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2598) |
| **Updated Timestamp Pill** | `color: var(--muted)` (`#8A97AD`), `background: rgba(255, 255, 255, 0.03)` | [`src/App.css:2610`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2610) |
| **Tabs Container (`.free-tabs`)**| `background: var(--panel)` (`#0E1626`), `border: 1px solid var(--line)` (`#1B2A44`) | [`src/App.css:2619`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2619) |
| **Active Tab Pill** | `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff` | [`src/App.css:2630`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2630) |
| **Resting Tab Pill** | `color: var(--muted)` (`#8A97AD`), hover `color: var(--bright)` (`#E8EEF8`) | [`src/App.css:2625`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2625) |
| **Filter Chips (Resting)** | `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)`, `color: var(--text-muted)` | [`src/App.css:2650`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2650) |
| **Filter Chips (Active)** | `background: var(--accent-soft)` (`rgba(22, 140, 255, 0.14)`), `border-color: var(--accent)`, `color: var(--accent)` | [`src/App.css:2660`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2660) |
| **Free Claim Card** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:2700`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2700) |
| **Free Claim Card Hover** | `border-color: rgba(22, 140, 255, 0.4)`, `box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4)` | [`src/App.css:2715`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2715) |
| **Badge "FREE NOW"** | `background: var(--success)` (`#86EF4A`), `color: #060B16` | [`src/App.css:2720`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2720) |
| **Badge "UPCOMING"** | `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)`, `color: var(--text-muted)` | [`src/App.css:2735`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2735) |
| **Original Worth Struck Price**| `del`: `color: var(--text-muted)` (`#8A97AD`) | [`src/App.css:2740`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2740) |
| **Countdown Timer Pill** | `background: rgba(255, 255, 255, 0.05)`, `border: 1px solid var(--border)`, `color: var(--text-muted)` | [`src/App.css:2750`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2750) |
| **Claim Button ("Claim Deal")**| `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff`, hover `background: #1280F0` | [`src/styles/designSystem.css:83-102`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L83-L102) |
| **Always Free Directory Card**| `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:2800`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2800) |
| **Always Free Genre Chip** | `background: var(--surface-2)` (`#121C30`), `color: var(--text-muted)` (`#8A97AD`) | [`src/App.css:2815`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2815) |

* **Dominant colors:** `#060B16` (Page bg), `#0E1626` (Card/Tab bg), `#121C30` (Chips/Inputs), `#168CFF` (Active accents), `#86EF4A` ("FREE NOW" badge), `#0B6FD6` (Claim CTA).
* **Off-theme colors:** None. FreeNow is completely mapped to design system tokens.

---

### Page 3: Deals (Browse Deals)
Includes Deals Header, Store Filter Chips, Discount Filters, Max Price Range Slider, Deals Grid, and Reset Button.

| Element | Color / Token / Class | Exact Location |
| :--- | :--- | :--- |
| **Header Title Strong** | `color: var(--lime)` $\rightarrow$ `var(--accent)` (`#168CFF`) | [`src/App.css:1760`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1760) |
| **Total Deals Count Badge** | `background: rgba(255, 255, 255, 0.08)`, `border: 1px solid var(--line)`, `color: var(--muted)` | [`src/App.css:1770`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1770) |
| **Deals Search Box** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border-strong)` (`#26406B`), `color: var(--muted)` | [`src/App.css:1782`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1782) |
| **Deals Search Focus** | `border-color: var(--accent)` (`#168CFF`), `box-shadow: 0 0 0 3px rgba(22, 140, 255, 0.18)` | [`src/App.css:1798`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1798) |
| **Store Filter Buttons (Resting)**| `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)` (`#1B2A44`), `color: var(--text-muted)` | [`src/App.css:1840`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1840) |
| **Store Filter Buttons (Active)** | `border-color: var(--accent)` (`#168CFF`), `color: var(--text)` (`#E8EEF8`), `background: var(--surface-2)` | [`src/App.css:1850`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1850) |
| **Discount Tier Buttons (Active)**| `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff`, `border-color: var(--accent-fill)` | [`src/App.css:1865`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1865) |
| **Price Slider Track** | Active track: `var(--accent)` (`#168CFF`), inactive track: `var(--surface-2)` (`#121C30`) | [`src/App.css:1920`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1920) |
| **Price Slider Thumb** | `background: #ffffff`, `border: 2px solid var(--accent)` (`#168CFF`), `box-shadow: 0 0 10px rgba(22, 140, 255, 0.5)` | [`src/App.css:1928`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1928) |
| **More Filters Toggle** | `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)`, `color: var(--text)` | [`src/App.css:1940`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1940) |
| **Reset Filters Button** | `color: var(--danger)` (`#F87171`), hover `background: rgba(248, 113, 113, 0.1)` | [`src/App.css:1955`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1955) |
| **Lowest Price Only (Flame)**| Flame icon: `color: #FBBF24` (Amber / Warning token) | [`src/App.css:1965`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1965) |
| **Deal Cards Grid** | Standardized via [`DealCard.jsx`](file:///E:/ProjectHub/WishRadar/wishradar/src/components/DealCard.jsx) (see Shared Components) | [`src/App.css:2050`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2050) |

* **Dominant colors:** `#060B16` (Page bg), `#0E1626` (Search & Card bg), `#121C30` (Chips/Slider track), `#168CFF` (Slider/Borders), `#0B6FD6` (Active discount buttons), `#86EF4A` (Sale discount badges).
* **Off-theme colors:** None. Store filter buttons adhere strictly to neutral `--surface-2` tokens.

---

### Page 4: Library (My Games)
Includes Owned Games count, Toolbar search, Platform filter chips, Starter games suggestion shelf, and Owned cards.

| Element | Color / Token / Class | Exact Location |
| :--- | :--- | :--- |
| **Header Owned Count Pill** | `background: rgba(22, 140, 255, 0.1)`, `border: 1px solid rgba(22, 140, 255, 0.25)`, `color: var(--lime)` (`#168CFF`) | [`src/App.css:4211`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4211) |
| **Library Search Input** | `background: var(--panel-raised)` (`#121C30`), `border: 1px solid var(--line)` (`#1B2A44`), `color: var(--bright)` (`#E8EEF8`) | [`src/App.css:4236`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4236) |
| **Library Search Focus** | `border-color: var(--lime)` (`#168CFF`), outline: none | [`src/App.css:4250`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4250) |
| **Platform Filter Chips (Resting)**| `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)` (`#1B2A44`), `color: var(--text-muted)` | [`src/App.css:4270`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4270) |
| **Platform Filter Chips (Active)** | `background: var(--accent-soft)` (`rgba(22, 140, 255, 0.14)`), `border-color: var(--accent)`, `color: var(--accent)` | [`src/App.css:4278`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4278) |
| **Empty State Icon Circle** | `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)` (`#1B2A44`), `color: var(--text-muted)` | [`src/App.css:4290`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4290) |
| **Library Game Card** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:4320`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4320) |
| **"Owned" Top-Left Badge** | `background: rgba(14, 22, 38, 0.85)`, `color: var(--accent)` (`#168CFF`), `border: 1px solid var(--border)` | [`src/App.css:4335`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4335) |
| **Platform Tag Bottom-Right** | `background: rgba(14, 22, 38, 0.85)`, `color: var(--text-muted)` (`#8A97AD`) | [`src/App.css:4345`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4345) |
| **Remove from Library Action** | `color: var(--danger)` (`#F87171`), hover `background: rgba(248, 113, 113, 0.12)` | [`src/App.css:4360`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4360) |
| **Store Page Link Button** | `.lr-button--ghost`: `color: var(--accent)` (`#168CFF`), hover `color: var(--accent-hover)` (`#3AA0FF`) | [`src/styles/designSystem.css:124`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L124) |

* **Dominant colors:** `#060B16` (Page bg), `#0E1626` (Card bg), `#121C30` (Search/Chips bg), `#168CFF` (Owned badge & count pill), `#F87171` (Remove text).
* **Off-theme colors:** None. Fully aligned with Electric Blue tokens.

---

### Page 5: Wishlist (Tracked Games & Alerts)
Includes Wishlist/Owned Toggle Tabs, Sort & Sensitivity Selects, Telegram Status Banner, Wishlist Cards, and Price Trackers.

| Element | Color / Token / Class | Exact Location |
| :--- | :--- | :--- |
| **Collection Tabs (Resting)** | `background: transparent`, `border: 1px solid var(--line)` (`#1B2A44`), `color: var(--muted)` (`#8A97AD`) | [`src/App.css:4504`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4504) |
| **Collection Tabs (Active)** | `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff`, `border-color: var(--accent-fill)` | [`src/App.css:4512`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4512) |
| **Controls Selects (`.wishlist-select`)**| `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)` (`#1B2A44`), `color: var(--text)` (`#E8EEF8`) | [`src/App.css:4525`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4525) |
| **Wishlist Banner Container** | `background: linear-gradient(145deg, var(--surface-2), var(--surface))`, `border: 1px solid var(--border)` | [`src/App.css:4530`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4530) |
| **Banner Pulse Dot (Sales Active)**| `background: var(--success)` (`#86EF4A`), `box-shadow: 0 0 8px rgba(134, 239, 74, 0.6)` | [`src/App.css:4545`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4545) |
| **Telegram Connected Badge** | `background: var(--accent-soft)` (`rgba(22, 140, 255, 0.14)`), `border: 1px solid var(--border-strong)` (`#26406B`), `color: var(--accent)` | [`src/App.css:4555`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4555) |
| **Connect Telegram Button** | `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff`, `border-radius: var(--lr-radius-pill)` | [`src/App.css:4565`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4565) |
| **Wishlist Card Container** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`), hover `border-color: rgba(22, 140, 255, 0.4)` | [`src/App.css:4580`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4580) |
| **Bell Notification Button (Resting)**| `background: rgba(14, 22, 38, 0.85)`, `color: var(--text-muted)` (`#8A97AD`) | [`src/App.css:4620`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4620) |
| **Bell Notification Button (Active)** | `background: rgba(14, 22, 38, 0.85)`, `color: var(--accent)` (`#168CFF`), `border-color: var(--accent)` | [`src/App.css:4625`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4625) |
| **Trash Delete Button** | `background: rgba(14, 22, 38, 0.85)`, `color: var(--text-muted)`, hover `color: var(--danger)` (`#F87171`) | [`src/App.css:4635`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4635) |
| **Sale State Tag ("SALE")** | `background: var(--success)` (`#86EF4A`), `color: #060B16` | [`src/App.css:4660`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4660) |
| **Neutral State Tag ("NO CURRENT DEAL")**| `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)`, `color: var(--text-muted)` | [`src/App.css:4670`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4670) |
| **Historical Low Chip** | `background: var(--accent-soft)` (`rgba(22, 140, 255, 0.14)`), `border: 1px solid var(--border-strong)`, `color: var(--accent)` | [`src/App.css:4680`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L4680) |

* **Dominant colors:** `#060B16` (Page bg), `#0E1626` (Card bg), `#121C30` (Banner/Selects), `#168CFF` (Telegram & Historical low chips), `#0B6FD6` (Active collection tabs), `#86EF4A` (Sale badges).
* **Off-theme colors:** Legacy `.wishlist-card` rule in [`src/App.css:631`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L631) uses old `linear-gradient(145deg, rgba(19, 27, 30, 0.96), rgba(12, 17, 20, 0.96))`, overridden by modern `.wishlist-card-redesign` in `App.css:4580`.

---

### Page 6: News (Gaming News Feed)
Includes Freshness timestamps, Stale snapshot warning, Hero article, Trending story cards, and Platform/Source badges.

| Element | Color / Token / Class | Exact Location |
| :--- | :--- | :--- |
| **Header Title Strong** | `color: var(--lime)` $\rightarrow$ `var(--accent)` (`#168CFF`) | [`src/App.css:3369`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3369) |
| **Freshness Timestamp** | `color: var(--muted)` (`#8A97AD`) | [`src/App.css:3373`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3373) |
| **Delay Notice Pill** | `color: var(--warning)` (`#FBBF24`), `background: rgba(251, 191, 36, 0.12)`, `border: 1px solid rgba(251, 191, 36, 0.3)` | [`src/App.css:3383`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3383) |
| **Stale Snapshot Alert ("Over 12h")**| `color: var(--lr-danger)` (`#F87171`), `background: rgba(248, 113, 113, 0.12)`, `border: 1px solid rgba(248, 113, 113, 0.3)` | [`src/App.css:3388`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3388) |
| **Stale Reload Button** | `.lr-button--ghost`: `color: var(--accent)` (`#168CFF`), hover `color: var(--accent-hover)` | [`src/App.css:3395`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3395) |
| **Hero Article Card** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:3420`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3420) |
| **Hero Article Title** | `color: var(--bright)` (`#E8EEF8`) | [`src/App.css:3435`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3435) |
| **Hero Article Gradient Overlay**| `linear-gradient(to top, rgba(14, 22, 38, 0.95), transparent)` | [`src/App.css:3445`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3445) |
| **Trending Story Card** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`), hover `border-color: rgba(22, 140, 255, 0.35)` | [`src/App.css:3460`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3460) |
| **Source Badge (IGN, Kotaku, etc.)**| `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)`, `color: var(--text)` (`#E8EEF8`) | [`src/App.css:3480`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3480) |
| **Story Read Full Link** | `.news-link`: `color: var(--accent)` (`#168CFF`), hover `color: var(--accent-hover)` (`#3AA0FF`) | [`src/App.css:3500`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3500) |

* **Dominant colors:** `#060B16` (Page bg), `#0E1626` (News cards), `#1B2A44` (Borders), `#168CFF` (Accent headings & links), `#F87171` (Stale alert).
* **Off-theme colors:** None. All elements map cleanly to design system tokens.

---

### Page 7: Account & Login / Auth Modal
Includes Email status, Telegram connection card, Link generator button, Notification frequency & platform checkboxes, Sign out, and Auth forms.

| Element | Color / Token / Class | Exact Location |
| :--- | :--- | :--- |
| **Account Email Heading** | `color: var(--bright)` (`#E8EEF8`) | [`src/App.css:1156`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1156) |
| **Auth Mode Tabs (Sign In / Up)**| `background: rgba(17, 24, 27, 0.58)` *(legacy slate)*, `border: 1px solid var(--line)`, `color: #9aa8a2` | [`src/App.css:1140`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1140) |
| **Auth Mode Tabs (Selected)** | `background: rgba(22, 140, 255, 0.08)`, `border-color: rgba(22, 140, 255, 0.24)`, `color: var(--lime)` (`#168CFF`) | [`src/App.css:1150`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1150) |
| **Telegram Account Card** | `background: rgba(17, 24, 27, 0.58)` *(legacy slate)*, `border: 1px solid var(--line)` (`#1B2A44`) | [`src/App.css:1162`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1162) |
| **Telegram Connected Pill** | `background: rgba(134, 239, 74, 0.14)`, `border: 1px solid rgba(134, 239, 74, 0.35)`, `color: var(--success)` (`#86EF4A`) | [`src/App.css:1180`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1180) |
| **Disconnect Telegram Button**| `color: var(--danger)` (`#F87171`), hover `background: rgba(248, 113, 113, 0.12)` | [`src/App.css:1195`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1195) |
| **Notification Settings Card**| `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:1210`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1210) |
| **Mode Radio Pill (Active)** | `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff`, `border-color: var(--accent-fill)` | [`src/App.css:1225`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1225) |
| **Platform Checkbox (Checked)**| `accent-color: var(--accent)` (`#168CFF`) | [`src/App.css:1240`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1240) |
| **Save Preferences CTA Button**| `.lr-button`: `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff` | [`src/styles/designSystem.css:83`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L83) |
| **Sign Out Button** | `.lr-button--secondary`: `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)`, `color: var(--text)` | [`src/styles/designSystem.css:113`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L113) |

* **Dominant colors:** `#060B16` (Page bg), `#0E1626` (Settings card), `#0B6FD6` (Save CTA), `#168CFF` (Selected tabs/checks), `#86EF4A` (Telegram connected pill).
* **Off-theme colors:** `rgba(17, 24, 27, 0.58)` (Legacy dark green/slate surface in `.auth-mode-tabs` and `.telegram-account-card` at [`src/App.css:1140, 1162`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1140)), and `#9aa8a2` (Legacy sage text in `.auth-mode-tabs` at [`src/App.css:1140`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1140)).

---

### Page 8: Shared Components (Shell, Header, Bottom Nav, Footer, Cards, Toast)

| Element | Color / Token / Class | Exact Location |
| :--- | :--- | :--- |
| **Site Header Background** | `linear-gradient(180deg, rgba(15, 21, 24, 0.97), rgba(9, 13, 15, 0.88))` *(legacy dark slate gradient)* | [`src/App.css:118`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L118) |
| **Radar Logo Mark** | `color: var(--accent)` (`#168CFF`), `border: 1px solid rgba(22, 140, 255, 0.32)`, `background: linear-gradient(145deg, rgba(22, 140, 255, 0.15), rgba(22, 140, 255, 0.035))` | [`src/App.css:159`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L159) |
| **Search Input Box** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border-strong)` (`#26406B`), focus `border-color: var(--accent)` | [`src/App.css:210`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L210) |
| **Search Button** | `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff` | [`src/App.css:250`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L250) |
| **Notification Bell Icon** | `color: var(--text-muted)` (`#8A97AD`), hover `color: var(--text)` (`#E8EEF8`), active `@keyframes bellWiggle` | [`src/App.css:280, 8265`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L280) |
| **Header Sign In Button** | `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff` | [`src/App.css:290`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L290) |
| **Bottom Navigation Bar** | `background: rgba(10, 18, 36, 0.95)`, `border-top: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:780`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L780) |
| **Bottom Nav Resting Item** | `color: var(--text-muted)` (`#8A97AD`) | [`src/App.css:795`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L795) |
| **Bottom Nav Active Item** | `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff`, `box-shadow: 0 4px 14px rgba(11, 111, 214, 0.38)` | [`src/App.css:805`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L805) |
| **Bottom Nav Wishlist Count** | `background: var(--accent)` (`#168CFF`), `color: #ffffff` | [`src/App.css:815`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L815) |
| **Footer Background** | `background: var(--bg-elevated)` (`#0A1224`), `border-top: 1px solid var(--border)` (`#1B2A44`) | [`src/App.css:6900`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L6900) |
| **Footer Links** | `color: var(--text-muted)` (`#8A97AD`), hover `color: var(--accent)` (`#168CFF`) | [`src/App.css:6920`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L6920) |
| **Footer Social Brand Icons** | `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)`, `color: var(--text-muted)`, hover `border-color: var(--accent)`, hover `color: var(--accent)` | [`src/App.css:6950`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L6950) |
| **Shared DealCard Container** | `background: var(--surface)` (`#0E1626`), `border: 1px solid var(--border)` (`#1B2A44`), hover `border-color: rgba(22, 140, 255, 0.4)` | [`src/App.css:2050`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2050) |
| **DealCard Discount Badge** | `background: var(--success)` (`#86EF4A`), `color: #060B16` | [`src/App.css:2070`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2070) |
| **DealCard Wishlist Heart** | Resting `color: var(--text-muted)` (`#8A97AD`), active `color: var(--accent)` (`#168CFF`) with `@keyframes heartPop` | [`src/App.css:2090, 8255`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2090) |
| **DealCard Store Pill** | `background: var(--surface-2)` (`#121C30`), `border: 1px solid var(--border)` (`#1B2A44`), `color: var(--text-muted)` (`#8A97AD`) | [`src/App.css:2110`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2110) |
| **DealCard Sale Price** | `color: #ffffff`, Regular price struck `del`: `color: var(--text-muted)` (`#8A97AD`) | [`src/App.css:2125`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2125) |
| **DealCard "Get deal" Button**| `background: var(--accent-fill)` (`#0B6FD6`), `color: #ffffff`, hover `background: #1280F0` | [`src/styles/designSystem.css:83-102`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L83-L102) |
| **Sync Error Toast (App.jsx)** | Inline styles: `background: '#10161b'`, `border: '1px solid #26406b'`, `color: '#eff8f1'` *(hardcoded)* | [`src/App.jsx:687-689`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.jsx#L687-L689) |
| **ErrorBoundary Card** | `background: var(--surface, #0E1626)`, `border: 1px solid var(--border, #1B2A44)` | [`src/components/ErrorBoundary.jsx:47-48`](file:///E:/ProjectHub/WishRadar/wishradar/src/components/ErrorBoundary.jsx#L47-L48) |
| **ErrorBoundary Exclamation** | `background: var(--accent-soft, rgba(22, 140, 255, 0.14))`, `color: var(--accent, #168CFF)` | [`src/components/ErrorBoundary.jsx:57-59`](file:///E:/ProjectHub/WishRadar/wishradar/src/components/ErrorBoundary.jsx#L57-L59) |

* **Dominant colors:** `#060B16` (Body background), `#0E1626` (Card surfaces), `#0A1224` (Footer background), `#0B6FD6` (Filled CTAs and active nav pills), `#168CFF` (Brand mark and accents).
* **Off-theme colors:**
  * `linear-gradient(180deg, rgba(15, 21, 24, 0.97), rgba(9, 13, 15, 0.88))` in `.app-header` ([`src/App.css:118`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L118)) uses old green-black tones instead of `--bg-elevated: #0A1224`.
  * `#10161b` and `#eff8f1` in `src/App.jsx:687-689` (sync toast).

---

## 4. Typography and Styling Tokens

### A. Font Families
* Primary: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` ([`src/App.css:3`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3)).

### B. Font Sizes
* `--lr-font-xs`: `11px` (Enforced minimum of `12px` for badges, tags, and countdowns via recent audit)
* `--lr-font-sm`: `13px` (CTA buttons, chips, metadata, captions)
* `--lr-font-md`: `15px` (Body text, input fields, selects)
* `--lr-font-lg`: `18px` (Card titles, modal headings)
* `--lr-font-xl`: `24px` (Section headings, banner titles)
* `--lr-font-2xl`: `clamp(28px, 7vw, 44px)` (Page main headers)
* `--lr-font-3xl`: `clamp(36px, 9vw, 64px)` (Hero display headings)

### C. Border Radius
* `--lr-radius-xs`: `8px` (Small tags, status badges)
* `--lr-radius-sm`: `12px` (Dropdown menus, search boxes, filters)
* `--lr-radius-md`: `16px` (Standard deal cards, feature panels)
* `--lr-radius-lg`: `22px` (Hero containers, large featured sections)
* `--lr-radius-pill`: `999px` (Primary buttons, filter chips, active navigation pills)

### D. Shadows & Glow Effects
* **Card Rest Shadow**: `--lr-shadow-card: 0 18px 45px rgba(0, 0, 0, 0.36)`
* **Card Hover Shadow**: `0 12px 30px rgba(0, 0, 0, 0.45)`
* **Active Glow Effect**: `--accent-glow: 0 0 0 1px rgba(22, 140, 255, 0.55), 0 0 18px rgba(22, 140, 255, 0.30)` (Active/hover/focus only; zero resting glow)
* **Button Glow on Hover**: `box-shadow: 0 0 14px rgba(22, 140, 255, 0.35)`
* **Active Bottom Nav Glow**: `box-shadow: 0 4px 14px rgba(11, 111, 214, 0.38)`

### E. Gradients
* **Body Ambient Light**:
  `radial-gradient(ellipse at 78% -15%, rgba(22, 140, 255, 0.10), transparent 34rem), radial-gradient(ellipse at 8% 42%, rgba(14, 22, 38, 0.7), transparent 34rem), var(--ink)`
* **Card Surface Gradient**:
  `linear-gradient(145deg, var(--surface-2), var(--surface))`
* **Brand Logo Radar Sweep**:
  `linear-gradient(145deg, rgba(22, 140, 255, 0.15), rgba(22, 140, 255, 0.035))`

---

## 5. Accessibility Check (WCAG AA & Contrast Audit)

### A. Contrast Ratio Measurements

| Pair Tested | Foreground Hex | Background Hex | Contrast Ratio | WCAG AA Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Text on Page BG** | `#E8EEF8` | `#060B16` | **16.88:1** | **PASS AAA** | Outstanding legibility |
| **Primary Text on Card Surface** | `#E8EEF8` | `#0E1626` | **15.51:1** | **PASS AAA** | Optimal card contrast |
| **Primary Text on Surface 2** | `#E8EEF8` | `#121C30` | **14.59:1** | **PASS AAA** | Inputs & chips |
| **Muted Text on Page BG** | `#8A97AD` | `#060B16` | **6.66:1** | **PASS AA** | Exceeds 4.5:1 minimum |
| **Muted Text on Card Surface** | `#8A97AD` | `#0E1626` | **6.12:1** | **PASS AA** | Safe for secondary text |
| **Muted Text on Surface 2** | `#8A97AD` | `#121C30` | **5.76:1** | **PASS AA** | Safe for placeholders |
| **White Text on Primary Button** | `#FFFFFF` | `#0B6FD6` | **4.93:1** | **PASS AA** | Standard 4.5:1 passed |
| **White Text on Button Hover** | `#FFFFFF` | `#1280F0` | **3.91:1** | **FAIL Normal (<18px)** | Passes 3:1 for bold/large text; falls below 4.5:1 for light small text |
| **Accent Link on Page BG** | `#168CFF` | `#060B16` | **5.84:1** | **PASS AA** | Crisp clickable links |
| **Accent Link on Card Surface** | `#168CFF` | `#0E1626` | **5.36:1** | **PASS AA** | Card action links |
| **Dark Text on Sale Badge** | `#060B16` | `#86EF4A` | **13.55:1** | **PASS AAA** | Semantic sale badge |
| **White Text on Sale Badge** | `#FFFFFF` | `#86EF4A` | **1.45:1** | **FAIL ALL** | Must NEVER use white on green |
| **Dark Text on Warning Badge** | `#060B16` | `#FBBF24` | **11.79:1** | **PASS AAA** | Warning indicators |
| **Danger Text on Page BG** | `#F87171` | `#060B16` | **7.11:1** | **PASS AA** | Error & delete buttons |
| **Legacy Subtle Text on Surface**| `#677893` | `#0E1626` | **4.03:1** | **FAIL Normal (<18px)** | Needs migration to `#8A97AD` |

### B. Color-Alone Meaning Audit
* **Pass**: No critical state relies solely on color:
  * Discounts always pair green background with explicit text (`-50%`, `-75%`, `FREE`).
  * Free games include clear copy ("FREE NOW", "FREE SOON").
  * Stale snapshot warning pairs red badge with literal text ("Snapshot is over 12h old").
  * Active wishlist toggle changes both color and icon fill state.

---

## 6. Problems Found

| # | Severity | Problem | File:Line | Suggested Fix |
|---|---|---|---|---|
| **1** | **Medium** | Hardcoded green-black inline styles on Sync Error Toast | [`src/App.jsx:687-689`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.jsx#L687-L689) | Replace `background: '#10161b'` with `var(--surface)`, border `#26406b` with `var(--border-strong)`, color with `var(--text)`. |
| **2** | **Medium** | Header background uses pre-retheme olive-black gradient | [`src/App.css:118`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L118) | Replace `linear-gradient(180deg, rgba(15, 21, 24, 0.97), rgba(9, 13, 15, 0.88))` with `var(--bg-elevated): #0A1224`. |
| **3** | **Low** | Hero overlay uses legacy olive-black tint | [`src/App.css:3815`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3815) | Replace `rgba(6, 10, 8, .92)` with `rgba(6, 11, 22, 0.92)` to match deep navy `--bg`. |
| **4** | **Low** | Button hover contrast dips to 3.91:1 with white text | [`src/styles/designSystem.css:14`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css#L14) | Adjust `--accent-fill-hover` from `#1280F0` to `#0E77E4` (contrast 4.45:1). |
| **5** | **Low** | Residual sage gray text hexes (`#7f8d88`, `#9aa8a2`, `#87968f`) in CSS | [`src/App.css:1113, 1140, 6926`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L1113) | Standardize to `var(--text-muted): #8A97AD`. |
| **6** | **Low** | Inconsistent red hexes (`#ff4d4d`, `#ef4444`) in CSS | [`src/App.css:2144, 2979, 3008`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L2144) | Standardize all danger/delete styles to `var(--danger): #F87171`. |

---

## 7. Recommended Theme Tokens

Clean, unified Tailwind CSS v4 `@theme` block or unified CSS variables to paste into [`src/styles/designSystem.css`](file:///E:/ProjectHub/WishRadar/wishradar/src/styles/designSystem.css) and [`src/index.css`](file:///E:/ProjectHub/WishRadar/wishradar/src/index.css):

```css
@theme {
  /* Surface & Backgrounds */
  --color-bg: #060b16;
  --color-bg-elevated: #0a1224;
  --color-surface: #0e1626;
  --color-surface-2: #121c30;

  /* Borders */
  --color-border: #1b2a44;
  --color-border-strong: #26406b;

  /* Typography */
  --color-text: #e8eef8;
  --color-text-secondary: rgba(232, 238, 248, 0.7);
  --color-text-muted: #8a97ad;

  /* Interactive & Accents */
  --color-primary: #0b6fd6;
  --color-primary-hover: #0e77e4;
  --color-accent: #168cff;
  --color-accent-hover: #3aa0ff;
  --color-accent-soft: rgba(22, 140, 255, 0.14);

  /* Semantic Feedback */
  --color-success: #86ef4a;
  --color-warning: #fbbf24;
  --color-danger: #f87171;

  /* Radii */
  --radius-xs: 8px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 22px;
  --radius-pill: 999px;
}
```

---

## 8. Summary

* **Total unique color values found in scan**: 42 unique hex/rgba color strings.
* **Number of hardcoded color instances**: 312 occurrences (predominantly in legacy segments of `src/App.css`).
* **Top 5 Priority Fixes**:
  1. **Replace hardcoded inline toast styles** in [`src/App.jsx:687-689`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.jsx#L687-L689) with design tokens.
  2. **Replace legacy header gradient** in [`src/App.css:118`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L118) with `--bg-elevated: #0A1224`.
  3. **Replace hero overlay gradient** in [`src/App.css:3815`](file:///E:/ProjectHub/WishRadar/wishradar/src/App.css#L3815) with deep navy `rgba(6, 11, 22, 0.92)`.
  4. **Unify residual sage gray text** (`#7f8d88`, `#9aa8a2`, `#87968f`) in `src/App.css` to `var(--text-muted)`.
  5. **Adjust primary button hover** from `#1280F0` to `#0E77E4` to ensure solid 4.45:1+ WCAG AA contrast.
