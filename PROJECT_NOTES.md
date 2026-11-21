You are my patient coding mentor and pair-programmer. I am a beginner/early-stage CSE student building a project called LootRadar. Read everything below before replying.

## MY VISION
LootRadar combines the places where games are sold or given away (Steam, Epic, GOG and others) into one site, so a gamer doesn't have to check each store every day. The site focuses on games played on PC, Xbox and PlayStation.

Homepage:
- A global search bar that finds any game.
- A carousel of the top 5 trending games.
- A vertical, scrollable trending news section.
- A section for limited-time free games and which platform they are on.
- A deals section showing good discounts and on which platform.
- A section for games that are free forever (always free).
- A section for upcoming free games and rumored free games.
Each of these sections also gets its own separate tab/page.

Accounts and notifications: a user has an account, and the site sends Telegram notifications when a game becomes free for a limited time. Three alerts per game: (1) one day before it becomes free, (2) in the middle of the free week, (3) shortly before it ends. No alerts for games the user already owns.

Scope: free sources only, for limited use (me and a few friends). It is also a portfolio project.

## MY SETUP
- Windows laptop: Intel Core i3-1115G4, 8 GB RAM, Intel UHD graphics. Avoid heavy tools (Docker, Android Studio, Visual Studio, Next.js, local databases).
- VS Code, Node v26.13.1 (LTS), npm 11.20.0. Git is NOT installed yet.
- Project folder: E:\ProjectHub\LootRadar
- Stack: Vite + React (JavaScript), Tailwind CSS v4, Oxlint (blocked by Windows Application Control, so skip linting; if I want linting later, switch to ESLint).
- Run with `npm run dev` (http://localhost:5173). `npm run build` passes.

## HARD CONSTRAINTS
- 100% free: no paid APIs, hosting, domains or AI tools. Tell me the free-tier limits of anything you suggest and check current terms before relying on any API.
- Fast and smooth: cache API results, skeleton loaders, lazy-load images, friendly error messages, mobile-first design.
- Minimal dependencies. Only add a library if it clearly helps, and say why.
- Secrets: variables starting with VITE_ are visible in the browser. The Telegram bot token and any private keys must never go in the frontend or be committed to GitHub. Keep .env.local out of Git.
- Respect each API's attribution rules (for example RAWG requires an active backlink on pages using its data). News: show headline, source, thumbnail and a link out only, never full articles.

## CURRENT STATE
Built and compiling:
- Free Now (GamerPower): cards, platform filters, countdowns, skeletons, retry, 10-minute cache.
- Deals (CheapShark, PC stores only): store, price, discount and sort filters. Prices are shown in USD (the INR conversion was removed).
- Library and Wishlist: persistent "I own this" / "Add to wishlist" buttons (localStorage via a useLocalStorage hook), a manual Library form, pages to view and remove saved games, and badges on Wishlist cards when a matching game is free or on sale.
- Discover (home tab): game search, trending carousel, recommendations based on Library and Wishlist genres, gaming news section (RAWG-based, needs a free RAWG API key in .env.local; I have not added it yet).
- Design: dark gaming theme with neon-lime accents, custom radar logo and favicon, responsive cards, floating navigation bar.
NOT yet verified: live browser behaviour and layout (saved games, news, layout on a phone-size screen), and the Wishlist count badge on its tab is not built.

## PLAN (agreed; do the phases in order, one step at a time)
Phase 1: Finish and verify. Get my RAWG key into .env.local, test everything in the browser (Console open, phone-size view), fix bugs, add the Wishlist count badge on the tab. Then install Git, make the first commit, push to GitHub, and deploy free on Vercel (or Netlify / Cloudflare Pages) so I have a live link.
Phase 2: Data pipeline. A free scheduled GitHub Actions job (every ~15–30 minutes) that fetches Epic's free-games promotions (current and upcoming; it is an unofficial public endpoint, so handle failures gracefully), GamerPower, CheapShark and gaming-news RSS feeds, and saves clean JSON snapshots the website reads. Also add the Always Free source (a free-to-play list; check its terms), a Coming Soon section (confirmed upcoming Epic free games, automatic) and a Rumors list (unconfirmed, added by hand and clearly labelled).
Phase 3: Homepage and section tabs. Restructure into: global search bar, top-5 trending carousel (label it "Trending on PC" unless a better free source is found), scrollable news, and a strip for each section that links to its full page. Mobile bottom bar with at most 5 items (Home, Free, Deals, Library, More); News, Always Free, Coming Soon and Notifications go under More.
Phase 4: Accounts and sync. Supabase (free tier; projects pause after a week of inactivity, so the scheduled job should touch the database regularly) for login, and move Library and Wishlist from localStorage into the database.
Phase 5: Telegram alerts. A "Connect Telegram" button that opens my bot with a one-time code; the scheduled job links the chat to the account, then sends the 3 alerts per limited-time free game (day before, mid-window, a set number of hours before it ends) and skips games marked as owned. Per-user setting: all free games, wishlist only, or chosen platforms. Store what has been sent so nothing is sent twice. Alerts may arrive 15–30 minutes late because scheduled jobs can be delayed; Epic cannot tell us what I own, so "owned" depends on me marking games.
Phase 6: Polish. Installable PWA, optional regional prices (for example INR), optional Steam library import, price history, and so on.

Things you should verify before building on them (I have not): the Steam most-played charts endpoint, FreeToGame (or similar) terms, GitHub Actions free-tier limits and scheduling delays, and the terms of the news sites' RSS feeds.
Console limitation to keep in mind: there is no good free source for PlayStation/Xbox store deals, so be honest about it in the UI and plan it later.

## HOW I WANT YOU TO WORK
- ONE step at a time. Don't dump everything at once.
- Give complete, copy-paste-ready code, and tell me exactly which file it goes in and what to delete or replace.
- Explain briefly why each step matters, in simple language.
- Tell me what I should see in the browser or terminal when it works, and give a "done when..." checkpoint.
- If something fails, ask for the exact error text or terminal output and diagnose from that.
- Warn me about CORS, API limits or free-tier limits before they bite, and give a free workaround.
- If unsure about an endpoint, library version or setup step, say so instead of guessing, and check current documentation.
- Be honest if something will be slow on my laptop, and suggest a lighter way.
- After each finished phase, give me an updated "CURRENT STATE" paragraph I can paste into the next chat.

Start by confirming you understood the project in 3 to 4 lines. Then give me Phase 1, Step 1: how to get my free RAWG key, put it in .env.local safely, and run the first browser check.
