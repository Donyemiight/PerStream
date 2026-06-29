# PerStream — API Reference

**Base URL (local):** `http://localhost:3000`
**Base URL (live):** `https://seas-ing-served-amy.trycloudflare.com`
**Base URL (static):** `https://bmabr9uvyv2q.space.minimax.io` (demo mode only)

**Auth:** Most endpoints accept an optional `X-User-Id` header. Creator endpoints require it.

---

## Health

### `GET /api/health`
Service status.

```json
{ "ok": true, "service": "perstream-backend", "mode": "live", "meter": { "active": 0 }, "time": 1782653935123 }
```

---

## Auth

### `POST /api/auth/login`
Sign in with email. Creates embedded Arc wallet if new user.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}' \
  http://localhost:3000/api/auth/login
```

Response:
```json
{
  "user": {
    "id": "usr_1782653936062_rhegwj",
    "handle": "you",
    "email": "you@example.com",
    "wallet": "0xE670683C25E2d658bf013b6f861139aa8413E56B",
    "role": "listener",
    "created_at": 1782653936062
  },
  "wallet": { "address": "0xE670...", "mode": "live" }
}
```

### `GET /api/auth/me`
Returns the current user. Requires `X-User-Id`.

> Note: Logout is client-side only — clears `localStorage` and reloads. No backend endpoint needed.

---

## Tracks

### `GET /api/tracks`
Public catalog of all tracks (no auth).

```json
{
  "tracks": [
    {
      "id": "trk_1782571621281_hxwgob",
      "creator_id": "usr_1782571621177_ngwjza",
      "title": "Ep. 1: The Cold-Start Cliff",
      "description": "Why per-second beats subscriptions",
      "audio_url": "https://.../assets/podcast-full.mp3",
      "duration_sec": 256,
      "price_per_sec": 100,
      "cover_url": "",
      "category": "general",
      "status": "published",
      "created_at": 1782571621281,
      "plays": 261,
      "earnings_total": 26100000
    }
  ]
}
```

### `GET /api/tracks/:id`
Single track with embedded creator info.

### `POST /api/tracks`
Multipart audio upload (listener). Form fields:
- `audio` (file): MP3, WAV, M4A
- `title`, `description`, `pricePerSec`, `durationSec`, `coverUrl`

### `GET /api/tracks/:id/stream`
Returns audio URL or HTTP 402 Payment Required if balance is too low.

```json
{
  "ok": true,
  "trackId": "trk_...",
  "audioUrl": "https://.../assets/loop.mp3",
  "pricePerSec": 100,
  "durationSec": 17
}
```

402 response:
```json
{
  "error": "payment_required",
  "pricePerSec": 100,
  "pricePerSecUsd": "0.000100",
  "creator": "usr_...",
  "trackId": "trk_..."
}
```

### `GET /api/tracks/audio/:filename`
Raw audio file (MP3).

---

## Listen (per-second payment flow)

### `POST /api/listen/start`
Start a session.

```bash
curl -X POST -H "X-User-Id: $USER_ID" -H "Content-Type: application/json" \
  -d '{"trackId":"trk_..."}' \
  http://localhost:3000/api/listen/start
```

### `GET /api/listen/poll?sessionId=...`
Polls per-second tick. Call every 1 second.

```json
{
  "tick": true,
  "secondsPlayed": 5,
  "amountPaid": 500,
  "balance": { "available": 499500 }
}
```

### `POST /api/listen/stop`
Ends session, triggers on-chain batched settlement.

```json
{
  "session": { ... },
  "totalPaidUsd": "0.000500",
  "settlement": {
    "txHash": "0x...",
    "arcscanUrl": "https://testnet.arcscan.app/tx/0x...",
    "tickCount": 5
  }
}
```

### `POST /api/listen/deposit`
Add USDC to listener balance.

```bash
curl -X POST -H "X-User-Id: $USER_ID" -H "Content-Type: application/json" \
  -d '{"amountUsd": 5}' \
  http://localhost:3000/api/listen/deposit
```

---

## Creator

### `GET /api/creator/dashboard`
Full creator dashboard data.

```json
{
  "creator": { ... },
  "profile": { "display_name": "...", "bio": "...", ... },
  "earnings": { "total": "0.0638", "today": "0", "thisWeek": "0", "thisMonth": "0" },
  "analytics": {
    "totalStreams": 261,
    "activeListeners": 0,
    "newTracksToday": 0,
    "totalTracks": 4,
    "publishedTracks": 4,
    "draftTracks": 0,
    "mostStreamed": [ ... ]
  },
  "tracks": [ ... ],
  "withdrawals": [ ... ],
  "notifications": [ ... ],
  "unreadCount": 0,
  "feedback": { ... },
  "leads": { "count": 0 }
}
```

### `POST /api/creator/tracks`
Multipart upload (creator). Same fields as `POST /api/tracks` plus:
- `category` (tech, crypto, music, comedy, education, general)
- `status` (published, draft, unlisted)

### `PUT /api/creator/tracks/:id`
Update track metadata. Ownership-checked.

```bash
curl -X PUT -H "X-User-Id: $USER_ID" -H "Content-Type: application/json" \
  -d '{"title":"New title","category":"crypto","pricePerSec":"200"}' \
  http://localhost:3000/api/creator/tracks/trk_xxx
```

### `DELETE /api/creator/tracks/:id`
Delete track. Ownership-checked.

### `POST /api/creator/tracks/:id/status`
Publish/unpublish.

```bash
curl -X POST -H "X-User-Id: $USER_ID" -H "Content-Type: application/json" \
  -d '{"status":"draft"}' \
  http://localhost:3000/api/creator/tracks/trk_xxx/status
```

### `GET /api/creator/profile` / `PUT /api/creator/profile`
Creator profile (display name, bio, avatar, social links).

### `GET /api/creator/notifications` / `POST /api/creator/notifications/:id/read`
List notifications; mark one as read.

### `GET /api/creator/withdrawals`
List withdrawals.

### `POST /api/creator/withdraw`
Withdraw USDC on-chain.

```bash
curl -X POST -H "X-User-Id: $USER_ID" -H "Content-Type: application/json" \
  -d '{"amountUsd":"0.0001"}' \
  http://localhost:3000/api/creator/withdraw
```

Returns Arcscan link for the on-chain tx.

---

## AI Listener Agent

### `POST /api/agent/listen`
Agent listens to one track.

```json
{ "trackId": "trk_...", "budgetUsd": 1, "maxSeconds": 30, "email": "agent@example.com" }
```

### `POST /api/agent/auto`
Multi-track discovery.

```json
{ "budgetUsd": 5, "maxTracks": 10, "email": "agent@example.com" }
```

### `GET /api/agent/info`
Returns agent capabilities.

---

## Audit (on-chain proof)

### `GET /api/audit/stats`
Aggregate stats: total ticks, total USDC, unique listeners.

### `GET /api/audit/ticks?limit=50`
Recent tick records.

### `GET /api/audit/export`
Download JSONL ledger file.

---

## Feedback & leads

- `POST /api/feedback` — 5-star rating + comment
- `GET /api/feedback` — list all
- `GET /api/feedback/stats` — distribution
- `POST /api/lead` — email capture for early-access
- `GET /api/lead/count` — lead count

---

## Error codes

| Code | Meaning |
|---|---|
| 400 | Bad request (missing field, invalid format) |
| 401 | Not authenticated (X-User-Id required) |
| 402 | Payment required (x402) |
| 403 | Not owner / permission denied |
| 404 | Track / resource not found |
| 500 | Server error |

All errors return `{ "error": "code", "reason": "human readable" }`.
