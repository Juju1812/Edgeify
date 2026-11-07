# Edgify v2

Scan your face, get an honest AI looks score (0–100, seven traits), then face off live 1v1 and climb the leaderboard.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion
- Upstash Redis (Vercel KV) for everything: accounts, profiles, matches, friends, DMs
- Claude (`claude-opus-5-5`, vision + structured output) for scoring — `src/lib/scoring/ai-score.ts`
- Native WebRTC for match video; signalling relayed through our own API; TURN via Cloudflare

## How it works

- **Scoring** — the browser tracks the face (MediaPipe, 478 points), sends 5 tight face crops plus measured facial ratios (FWHR, midface, ESR, canthal tilt, … — `src/lib/shared/ratios.ts`) to `/api/scan`; Claude (high effort) rates them against a population-anchored rubric (50 = average adult) using the ratios as evidence, with a small capped ratio nudge on the overall. A profile's score is exactly its most recent scan (match readings decide matches but don't change it), and that scan's face-framed thumbnail becomes the profile photo. Photos of screens, no-face etc. are rejected.
- **Server-authoritative** — scores, ELO, wins/losses and match results are only ever written by the server. Clients can edit just bio / country / leaderboard visibility.
- **Matches** (`src/lib/server/matches.ts`) — ranked queue pairs players by ELO (window widens with wait time). Both players ready up → countdown → each browser uploads its own frames → the server scores both → higher overall wins (trait sum breaks ties). Timeouts forfeit or cancel automatically. Video is a nice-to-have: if WebRTC can't connect, the face-off still counts.
- **Private rooms & tournaments** — 6-character codes; 4-player single-elimination bracket. Both are unranked.
- **Friends & DMs** — mutual friend requests; messages stored server-side, friends only.

## Data

`user:*` and `session:*` keys are shared with v1 so existing accounts keep their logins. All v2 data lives under `e2:*`, so local dev / preview deploys can't clobber the live v1 data (dev and prod share one Upstash database). v1 players keep their W/L record; everyone rescans and starts at 1000 ELO.

## Environment

Pulled with `vercel env pull .env.local`:

| Variable | Purpose |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis |
| `ANTHROPIC_API_KEY` | Face scoring |
| `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | TURN relay so players behind strict NATs can see each other (optional but strongly recommended) |
| `AI_CALLS_PER_DAY` | Site-wide safety cap on AI calls per day (default 3000). Per-player scans are unlimited apart from a burst guard. |

## Scripts

```bash
npm run dev                 # http://localhost:3000
npm run build
npm run typecheck
npx tsx scripts/score-test.ts face.jpg                         # score one image
npx tsx scripts/e2e-api.ts http://localhost:3100 a.jpg b.jpg    # full API flow (creates + deletes test users)
npx tsx scripts/match-e2e.ts http://localhost:3100 out a.mjpeg b.mjpeg a.jpg b.jpg   # two-browser live match
npx tsx scripts/shots.ts http://localhost:3100 out a.jpg b.jpg  # screenshot every page
```

Scripts that call the API cost a few cents in AI calls.

## Design

Direction "Light" (`design/mockups/option-b-light.png`): apple.com-style off-white canvas, white rounded cards, Apple-blue accent, no square corners. Art in `public/art/` was generated with Codex.
