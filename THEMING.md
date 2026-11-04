# Theming

The portal rebrands through tokens only. Components never know which league or
club they are rendering; they consume the aliases declared in
`src/app/globals.css` (`bg-surface`, `text-ink`, `border-line`, `font-display`,
`bg-accent`, `bg-band`, …). `DESIGN.md` stays the source of truth for the
Heritage Athletic Governance structure, type and spacing.

## Layers

| Layer | File | Selector | What it may change |
| --- | --- | --- | --- |
| Base | `src/theme/tokens.css` | `:root` | The full system palette and font stacks from `DESIGN.md` |
| League | `src/theme/leagues/<league>.css` | `[data-league="<league>"]` | League identity: accent, band, gold and related semantic tokens |
| Club | `src/theme/teams.css` | `[data-team="<slug>"]` | Club identity: the same semantic tokens, no component rules |
| User | — (reserved) | — | A future per-visitor preference; nothing ships today |

The portal layout (`src/app/(portal)/layout.tsx`) imports the files in that
order and sets `data-league="metropolitana"` on the shell. A team page sets
`data-team="<slug>"` on its own wrapper, inside the league shell.

The Tailwind aliases in `src/app/globals.css` are declared with `@theme inline`,
so utilities such as `bg-accent` read the scoped `--olb-*` value at the element
instead of a value resolved once on `:root`.

## Precedence

Custom properties inherit. For a given token the nearest ancestor with a value
wins, so a `[data-team]` block overrides `[data-league]`, which overrides
`:root`. Import order only breaks ties between selectors of equal specificity;
it is not a cascade tool. A club without a `[data-team]` block therefore falls
back to the league theme with no extra selector and no empty rules.

## Rebrand a league (one file)

1. Create `src/theme/leagues/<league>.css` with a single
   `[data-league="<league>"]` block.
2. Override only semantic tokens (`--olb-accent`, `--olb-band`, …).
3. Import it after `tokens.css` in `src/app/(portal)/layout.tsx` and set the
   matching `data-league` value on the shell.
4. Do not touch components, and do not add structure here.

Metropolitana ships the canonical palette, so its file is intentionally empty.

## Rebrand a club (one block)

Add one block to `src/theme/teams.css`:

```css
[data-team="tiburones"] {
  --olb-accent: #0e5c5a;
  --olb-accent-soft: #d8ece9;
  --olb-band: #062f2e;
  --olb-band-muted: #9ec4bf;
  --olb-gold: #c9a646;
}
```

The team route (`/equipos/<slug>`) resolves the slug from standings and game
records, wraps the page in `<div data-team={slug}>` and nothing else changes.
Clubs without a block use the league palette.

## Contrast rule

Text and its background must reach **at least 4.5:1**. This applies to every
token pair a theme introduces, including muted text on a dark band and gold
labels on accent fills.

Tiburones pairs (WCAG 2.1 relative luminance):

| Pair | Ratio |
| --- | --- |
| `--olb-band-ink` on `--olb-accent` | 7.79:1 |
| `--olb-band-ink` on `--olb-band` | 14.44:1 |
| `--olb-band-muted` on `--olb-band` | 7.64:1 |
| `--olb-gold` on `--olb-band` | 6.21:1 |

`--olb-band-muted` on `--olb-accent` (4.12:1) and `--olb-gold` on
`--olb-accent` (3.35:1) do not pass; use `--olb-band-ink` for text on an accent
fill.

## What not to do

- No raw hex values in components or pages. A colour belongs in a theme file.
- No theme values in JavaScript or data objects; themes are CSS custom
  properties, not runtime configuration.
- No theme that breaks the 4.5:1 rule, even for a "brand" colour.
- No component rules, layout, spacing or radius changes in theme files. Those
  belong to `DESIGN.md` and the base layer.
- No `!important` and no per-page style overrides: scope with `data-team` or
  `data-league` so the cascade stays predictable.
