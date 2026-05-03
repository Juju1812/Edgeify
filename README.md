# EdgeIfy

Ranked 1v1 face-off platform. Webcam-only capture, geometric "EdgeScore" entertainment metric (symmetry / proportions / jawline / canthal tilt), ELO-based matchmaking, global leaderboard. Inspired by gaming-tournament UI; framed as entertainment, **not** an objective beauty judgment.

## Status

This commit ships the **landing page + project scaffolding only**, per the original brief ("build the landing page first so I can see the visual direction before you go deeper"). Card destinations (`/arena`, `/lab`, `/leaderboard`, `/private`) are stub pages.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **Framer Motion**
- **Prisma** + **PostgreSQL** (schema included; SQLite-friendly for local)
- **NextAuth.js** with Google OAuth + guest sessions *(planned next pass)*
- **face-api.js** for client-side detection + landmarks *(planned next pass)*
- **Cloudinary** for the single chosen photo per user *(planned next pass)*
- **Pusher** (or Socket.io) for live matchmaking *(planned next pass)*

## Setup

```bash
# 1. Install deps
npm install

# 2. Copy env template and fill in values
cp .env.example .env

# 3. (Optional, for DB work) Generate Prisma client + run migration
npm run prisma:generate
npm run prisma:migrate -- --name init

# 4. (Optional) Seed leaderboard with 50 fake users
npm run db:seed

# 5. Dev server
npm run dev
# → http://localhost:3000
```

## Environment variables

See [.env.example](./.env.example). For pure landing-page dev you can leave them blank — the page renders without auth or DB. They're required as features come online:

| Variable | Required for |
|---|---|
| `DATABASE_URL` | Prisma / leaderboard / matches |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | Auth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `CLOUDINARY_*` | Storing the user's chosen face photo |
| `PUSHER_*`, `NEXT_PUBLIC_PUSHER_*` | Real-time matchmaking |

## Project layout

```
src/
  app/
    page.tsx              # Landing page (lobby)
    layout.tsx
    globals.css
    arena/                # Stub: 1v1 ranked matchmaking
    lab/                  # Stub: solo calibration / face scan
    leaderboard/          # Stub: top 100
    private/              # Stub: private rooms / brackets
    touch-grass/          # Easter egg
  components/
    GuestBanner.tsx       # "You're playing as a Guest" header
    HeroBadge.tsx         # SEASON 1 + name/rank/ELO + online dot
    ModeCard.tsx          # The four glassmorphic mode cards
    SocialRow.tsx         # Discord / TikTok / IG / Reddit / YT / X
    SideRail.tsx          # Right-edge floating action buttons
    Footer.tsx            # Disclaimer + privacy/terms/touch-grass
    ComingSoon.tsx        # Used by stub routes
    icons.tsx             # All SVG icons (no icon-library dep)
  lib/
    rank.ts               # ELO → tier mapping
prisma/
  schema.prisma           # Full DB schema (User, FaceProfile, Rating, Match, PrivateRoom, Report)
  seed.ts                 # 50 fake leaderboard users
```

## Schema diagram (text)

```
User ──┬── Account            (NextAuth)
       ├── Session             (NextAuth)
       ├── FaceProfile 1:1     (geometric scores + embedding)
       ├── Rating 1:1          (ELO, W/L, streak, placements)
       ├── Match (as A or B)   (status, scores, winner, ΔELO, rounds JSON)
       └── PrivateRoom (owner) (6-char code, size 4/8/16, rules JSON)

Match ── PrivateRoom?          (optional bracket linkage)
Report ── User (target)        (HARASSMENT/NSFW/IMPERSONATION/UNDERAGE/OTHER)
```

## Privacy / safety commitments (encoded in schema + UI)

- `User.isOver18` + `User.consentedAt` — **age gate** required before face capture.
- `User.hideFromBoard` — privacy toggle: hide face from public leaderboard.
- `FaceProfile.embedding` — for same-person dedupe across alts.
- `User.banned` + `Report` — moderation pipeline.
- Webcam-only capture (no uploads); liveness blink check planned at capture-time.
- NSFW moderation on every capture, planned client-side + server-side.
- Hard delete via `onDelete: Cascade` from `User` so "delete my account" wipes everything.

## What's next

In rough priority order:

1. **`/lab`** — webcam capture, face-api.js model loading, multi-angle prompts, geometric scoring, EdgeScore reveal animation, 5 placement matches.
2. **NextAuth + Prisma adapter** — Google + guest sessions, age gate at signup.
3. **`/leaderboard`** — paginated DB-backed top 100, country filter, search.
4. **`/arena`** — Pusher channels, ELO ±100 widening matchmaker, versus screen, Bo3.
5. **`/private`** — 6-char code generator, bracket logic.
6. **Profile + match history** with ELO graph.

## Deploy

Designed for Vercel:

- Push to GitHub, import to Vercel.
- Set env vars in Vercel dashboard.
- Use a managed Postgres (Vercel Postgres, Neon, or Supabase).
- Set `NEXTAUTH_URL` to the production URL.

## A note on framing

EdgeIfy is a **game**. The EdgeScore is a deterministic composite of geometric measurements (golden-ratio proportions, bilateral symmetry, jawline angle, canthal tilt). It does not — and cannot — measure attractiveness. Every page carries that disclaimer. There's also a `Touch grass →` link in the footer.
