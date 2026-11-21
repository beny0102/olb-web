# olb-web

Public game viewer for **Open League Baseball** — scoreboard, event log and a 3D
pitch view for leagues that do not have a Hawk-Eye budget.

Status: **pre-alpha**. The viewer is real, the admin console and setup flow are
in place, and the offline scorer is served from `/score`; the pitch trajectory
is synthetic until `olb-vision` ships calibrated tracks.

## What it does

| Route | What you get |
| --- | --- |
| `/` | League portal: official ticker, four score cards, featured game with linescore and telemetry rail, competition slate, day ledger and the patrimony band. Every value comes from `olb-api`; missing domains stay empty. |
| `/games/[id]` | Scoreboard, count, bases, event log and pitch viewer, polled every 3 s |
| `/stats` | Standings and season leaders folded from full games |
| `/admin` | Scoped catalog, roster, transfer and user administration |
| `/setup` | One-time bootstrap for a deployment without users |
| `/score` | Offline-first scorekeeper PWA, with `/score/new` and `/score/[id]` |
| `/demo` | Fully static game replayed from an embedded event log, no backend |

- Markers are folded from the append-only event log by the API; this app only
  renders `GameState` and `Event` values that match
  [`olb-contract`](https://github.com/beny0102/olb-contract).
- The 3D scene is a client-only island (`dynamic(..., { ssr: false })`). It
  renders the strike zone, plate, mound and a synthetic pitch from release to
  plate using contract coordinates (+x to first, +y to center, +z up).
- Unknown event types are ignored safely, so the viewer keeps working when the
  contract adds fields.

## Stack

Next.js 16 (App Router) · React 19 · React Three Fiber 9 · three.js · Tailwind
CSS 4 · TypeScript strict. No UI kit, no state library.

The homepage lives in the `(portal)` route group with its own light shell; the
viewer routes keep the dark shell in `(viewer)`. Semantic tokens live in
`src/theme/tokens.css`, with league overrides in
`src/theme/leagues/metropolitana.css`. Components use `bg-surface`, `text-ink`,
`border-line` and `font-display`; no raw hex values live in components.

## Design system

The league portal follows [`DESIGN.md`](DESIGN.md) — **Heritage Athletic Governance**:
chalk surfaces, sovereign navy bands, competition crimson, Barlow Condensed display and
Hanken Grotesk body, square corners and structural rules instead of shadows. `DESIGN.md`
is the source of truth for any UI change; `src/theme/tokens.css` holds the semantic values.
League and club rebrands are documented in [`THEMING.md`](THEMING.md).

## Quick start

The app consumes two sibling repositories:

```text
olb/
├── olb-contract/
├── olb-api/
└── olb-web/
```

```bash
# 1. API on :3001 with the in-memory store
cd ../olb-api
npm install
PORT=3001 node dist/main.js   # or: npm run start:dev

# 2. Viewer on :3000
cd ../olb-web
npm install
API_URL=http://localhost:3001 NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

Open <http://localhost:3000>. Without a backend, open `/demo`.

To seed a game:

```bash
curl -s -X POST http://localhost:3001/games \
  -H 'content-type: application/json' \
  -d '{"homeTeam":"Marlins","awayTeam":"Tiburones"}'
```

## Environment

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `API_URL` | server components | `http://localhost:3000` | API base URL inside the network |
| `NEXT_PUBLIC_API_URL` | browser polling | `http://localhost:3000` | Public API base URL |

In Docker, `API_URL` points at the service name; `NEXT_PUBLIC_API_URL` must be
reachable from the browser.

## Data flow

```text
olb-api /games/:id/state ──► server render ──► LiveGame
olb-api /games/:id/events ──► initial feed
        every 3 s ─────────► delta by fromSeq ──► merged by event id
```

Polling pauses while the tab is hidden. The score and count always come from
the API projection; the viewer never re-folds events on the live path.

## Admin

The portal is also the league operator's console. Both pages call the API
through `NEXT_PUBLIC_API_URL`; no admin data is rendered on the server.

### Setup at `/setup`

A fresh deployment has no users. `/setup` creates the organization, its first
`active` user and the `org_admin` membership in one call. It asks for the setup
token, which the API takes from `SETUP_TOKEN` or writes to
`olb-api/deploy/.setup-token` (mode `0600`) on first boot. The page reports the
API's `409` once a user exists, so it cannot be replayed. The equivalent CLI
lives in `olb-api` (`npm run setup`).

### Console at `/admin`

Without a stored session, `/admin` shows the login form (`POST /auth/login` with
email and password). The Bearer token and identity stay in `localStorage`; the
console only opens for a caller holding `org_admin`.

- **Catalog**: create and edit seasons, competitions, teams, team seasons and
  players, and create games for the selected competition.
- **Roster**: edit a team season's roster by hand or paste a CSV, one player per
  line as `firstName,lastName,jersey,position`. Imports support a preview,
  reject repeated names, and can replace the existing roster. Jersey and
  position may be empty.
- **Export/import**: download an `olb.league/1` bundle for one season or the
  whole league, and re-import one with a preview and conflict report. The bundle
  format is documented in the API README.
- **Users** at `/admin/users`: create users, change name, email, status and
  password, and grant or revoke organization, competition and team-season
  memberships.
- **Checklist**: the onboarding panel tracks the minimum viable league —
  season, competition, team seasons, rosters, games and additional users — and
  links to the page that fixes each missing item.

With `seed:league` the demo credentials are listed in the API README; they are
for local use only.

## Scorer at `/score`

The scorer now lives inside this app, under `/score`. It replaces the old
standalone `olb-scorer` on port `3002`, which is retired.

- `/score` lists the games in this browser, the games already prepared from the
  league and, for an anonymous device, the scheduled games the API exposes.
- `/score/new` starts a local game; `/score/[id]` opens the scorekeeper and
  `/score/[id]/verify` checks the finished log.
- The login form reuses the admin session: both consoles read and write the
  `olb.admin.token` key in `localStorage`.
- Local games can be exported to JSON and imported back from `/score`, so a
  scorekeeper can move a device or recover a game.
- The score routes are a PWA (`/score` manifest and service worker): the shell
  loads offline and queued local games stay editable without connection.

## Development

```bash
npm run typecheck
npm test
npm run build
```

Tests cover the portal and viewer against the published contract (`isEvent`),
the admin and setup clients, the demo fold, the synthetic pitch geometry, and
the scorer under `test/scorer/`: fold, scoring, lineup, rules, finish, sync,
recovery, proposals and local-game transfer.

## What is not here yet

- WebSocket transport with snapshot + delta (ADR 0004). Polling is a stand-in.
- Real tracks: `olb-vision` does not exist yet.
- Cloudflare Workers deployment from ADR 0001, wired once there is something
  worth deploying.
- Player profiles and career pages. Season stats and standings exist at
  `/stats`; there is no per-player history beyond the current season.

## Related

- [olb](https://github.com/beny0102/olb) — whitepaper and architecture
- [olb-contract](https://github.com/beny0102/olb-contract) — schemas and codegen
- [olb-api](https://github.com/beny0102/olb-api) — event log and projection

## License

Apache-2.0. Contributions use DCO sign-off and Conventional Commits.
