<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design system (mandatory)

`DESIGN.md` at the repo root is the visual source of truth (**Heritage Athletic
Governance**). Read it before any UI change, together with the approved reference
`../design/18-heritage-athletic-refined.html`.

- Use the semantic tokens in `src/theme/tokens.css` and the Tailwind aliases in
  `src/app/globals.css`. No raw hex values in components.
- Portal: surface `#f9f9ff`, cards `#ffffff` with `1px #cbd2dc`, bands `#111b31`,
  accent `#ba0222`, gold `#cba72f`, radius `0`, no ambient shadows.
- Typography: Barlow Condensed for display and tabular stats, Hanken Grotesk for
  body and labels. `label-caps` is uppercase, 11/14, tracking 0.08em.
- Missing domain data (standings, rosters, stats, video) gets an empty state or is
  removed. Never invent scores, players or classifications.
- Verify computed styles and screenshots at 1280 and 390 before committing.
