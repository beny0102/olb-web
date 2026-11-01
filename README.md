# olb-web

Public game viewer for **Open League Baseball** — scoreboard, event log and a 3D
pitch view for leagues that do not have a Hawk-Eye budget.

Status: **pre-alpha**. The viewer is real; the pitch trajectory it draws is
synthetic until `olb-vision` ships calibrated tracks.

## What it does

| Route | What you get |
| --- | --- |
| `/` | Game list from `olb-api`, with a clear offline state when the API is down |
| `/games/[id]` | Scoreboard, count, bases, event log and pitch viewer, polled every 3 s |
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

## Development

```bash
npm run typecheck
npm test
npm run build
```

Tests cover the demo log against the published contract (`isEvent`), the fold
used by the static demo, and the synthetic pitch geometry.

## What is not here yet

- WebSocket transport with snapshot + delta (ADR 0004). Polling is a stand-in.
- Auth: the viewer is read-only, but the API still accepts writes from anyone.
- Real tracks: `olb-vision` does not exist yet.
- Cloudflare Workers deployment from ADR 0001, wired once there is something
  worth deploying.
- League pages, standings, player profiles.

## Related

- [olb](https://github.com/beny0102/olb) — whitepaper and architecture
- [olb-contract](https://github.com/beny0102/olb-contract) — schemas and codegen
- [olb-api](https://github.com/beny0102/olb-api) — event log and projection

## License

Apache-2.0. Contributions use DCO sign-off and Conventional Commits.
