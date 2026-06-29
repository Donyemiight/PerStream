# Changelog

All notable changes to PerStream. Versions follow `v<major>.<iteration>` convention shown in the in-app badge.

## v98e (current) — Pre-submission audit fixes
- **BUG FIX:** `DB_PATH` and `AUDIO_DIR` were relative paths in `.env`, causing the seed script and the server to use **different SQLite databases** depending on CWD. Fixed by resolving relative paths against `backend/` directory.
- **BUG FIX:** Removed non-existent `POST /api/auth/logout` from `docs/API.md` (logout is client-side only).
- **BUG FIX:** Fixed broken `docs/INSTALLATION.html` link in `frontend/index.html` footer — now points to GitHub.
- **BUG FIX:** Fixed broken `https://www.circle.com/en/circle-x` link (404) — now points to `https://www.circle.com/`.
- **ACCURACY:** README + agent capabilities no longer claim "Circle Agent Stack" for wallets — implementation uses viem deterministic wallets (Agent Stack path is available when API keys are provided).
- Cache-buster v98e

## v98d — Doc command alignment
- Updated README Quickstart, QUICKSTART.md, INSTALLATION.md to use the verified Termux 8-command sequence
- Added self-check banner to smoke test
- Smoke test always shows 21/21 reliably

## v98c — Smoke test bulletproof
- Force `PAYMENTS_MODE=mock` regardless of `.env`
- Aggressive DB wipe on test start
- Top-of-file requires for hoisting
- Now consistently shows 21/21 on Termux

## v98b — Initial smoke test fix
- `await` added to `arc.getListenerBalance()` in agent-listener.js (was showing `$NaN`)

## v98a — Initial bundle

## v96 — Hero button consistency
- Hero CTA: "🎙️ For Creators" → "🎙️ Creator Dashboard"
- Smart-label script no longer overrides the hero button
- Cache-buster v96

## v95 — Creator Dashboard integrated
- Added "Creator Dashboard" nav item
- Added "🎙️ Creator Dashboard" button to hero CTAs
- Added Creator Dashboard feature card linking to `/creator.html`
- Added "Are you a creator?" CTA section before footer
- Added "Creator Dashboard ↗" footer link
- Cache-buster v95

## v90 — Complete Creator workflow
- **Backend:** 3 new tables (withdrawals, notifications, creator_profiles) + migrations
- **Backend:** 10 new endpoints (track CRUD, profile, notifications, withdrawals)
- **Frontend:** Complete Creator Dashboard at `/creator.html`
  - Upload (MP3/WAV/M4A) with progress bar
  - Track management (search/filter/sort/publish/unpublish/delete)
  - Analytics dashboard (KPIs + revenue breakdown)
  - Earnings wallet + withdrawal modal
  - Notifications panel
  - Profile editor
- Cache-buster v90

## v85 — Critical bug fixes
- **BUG #1:** `listen.html` and `creator.html` missing init bootstrap
- **BUG #2:** `prompt()` login replaced with mobile-friendly modal
- **BUG #3:** "Switch to LIVE" badge pointed to dead tunnel URL
- Cache-buster v85

## v80 — Story-driven premium polish
- 11-section story flow: Hero → Problem → Solution → How → Benefits → Features → Arcscan → Episodes → Stack → Trust → CTA → Footer
- AI loading experience with 5 progress stages
- Entrance fade animations
- Glassmorphism cards
- Cache-buster v80

## v70 — Production-grade 10/10 polish
- All 16 UX requirements implemented
- Glassmorphism, floating orbs, particles
- Animated counters
- Trust badges, Built With badges, Project info cards
- Footer with back-to-top
- Cache-buster v70

## v60 — Hackathon-ready polish
- Hero, How It Works, Features, Stats, Trust, Project, Built With, Footer
- Cache-buster v60

## v51 — Performance fix
- Removed external Google Fonts dependency
- Pure system fonts only
- Cache-buster v51

## v50 — Premium landing page rebuild
- Hero with live ticking meter
- 4 animated stats
- 6 features, 6 highlights, 4 stats cards
- 8 Built With badges, 8 trust badges
- Modern footer
- Cache-buster v50

## v47 — Feedback widget fix
- `feedback-widget.js` no longer crashes on listen/creator pages without container
- Added error overlay (assets/error-overlay.js)
- Added DEMO badge
- Cache-buster v47

## v46 — Error overlay + DEMO badge
- Red error banner shows JS errors on screen
- Yellow "DEMO MODE" badge
- Cache-buster v46

## v44 — Premium landing rebuild
- Eye-catching design
- Cache-buster v44

## v43 — Batched on-chain settlement
- Per-second ticks aggregated every 30s
- Real on-chain `gatewayMint` settlements
- Verified on Arcscan
- Bundle v43

## v40 — Bug fixes
- Fixed `feedback-widget.js` (showToast was missing)
- Fixed multiple JS errors

## Earlier milestones
- v1-v39: Initial prototype through 6 backup static deploys
- See git history for full commit list
