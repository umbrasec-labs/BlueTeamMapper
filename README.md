# Blue Team Mapper v4

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![Theme](https://img.shields.io/badge/theme-charcoal%20%2F%20orange-F25623)

**An interactive spatial map of blue team / defensive security operations.**

v4 rebuilds the v3 single-page reference as a clickable map: a radial defense lifecycle, expandable
architecture layers, branching response flow chains, and searchable reference views. All v3 content is
kept and structured as typed data.

**Live version:** https://umbrasec-labs.github.io/BlueTeamMapper/
**Companion project:** [Red Team Mapper](https://umbrasec-labs.github.io/RedTeamMapper/), the offensive counterpart.

## Why This Exists

Red vs Blue is most effective when both sides speak the same language. This mapper turns the Red Team
perspective into practical defensive controls, detection opportunities, hardening steps and hunting
queries, all in one visual reference.

## Views

| Route | View | What it does |
| --- | --- | --- |
| `/` | **Lifecycle Map** | Radial hub with the 7 phases (Visibility → Detection → Triage → Response → Hardening → Intel/Hunt → Recovery). Click a phase to highlight its links and open a panel with objectives, key tools, health measures, layers, related flow chains and the full section. Animated arrows show flow; dashed outer arcs show feedback loops (new rules, hunts → detections, visibility gaps). |
| `/layers/:id` | **Architecture Layers** | 10 stacked bands (Visibility, Endpoint, Detection, Response, Threat Hunting, Identity, Hardening, Network, Cloud, Intel & Deception). Expanding a band reveals P0/P1/P2 key controls, callouts, tree matrices, reference cards, hunt queries and tools. |
| `/flows/:id?step=` | **Flow Chains** | React Flow graphs for Phishing, EDR Alert, Credential Compromise, Ransomware, DCSync, Cloud Token Theft, ADCS Exploitation and Data Exfiltration, with decision branches and analyst-approval gates. Click a step for actions, evidence (linked to event IDs), tools and common mistakes. |
| `/matrix?focus=` | **Technique Detection Matrix** | 22 techniques with ATT&CK IDs and tactics. Filter by text, severity or tactic; sort; expand a row for event IDs to pull and the chain to run. |
| `/events?focus=` | **Event ID Reference** | Windows Security and Sysmon events grouped by category, cross-linked to techniques. |
| `/tools?q=&focus=` | **Tool Arsenal** | 60 tools in 11 categories, with fuzzy search. |
| `/sections/:id?card=` | **Section reader** | Every v3 section in full: callouts, matrices, cards and SPL hunt queries. |

**Global search** (`⌘K`, `Ctrl+K` or `/`) covers phases, layers, chains, steps, techniques, event IDs,
tools, sections and individual reference cards, and jumps straight to the matching node.

### Keyboard

| Keys | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` / `/` | Open search; `↑` `↓` to move, `↵` to open |
| `1`–`7` | Select a lifecycle phase |
| `←` `→` | Cycle phases on the lifecycle map |
| `Esc` | Close the detail panel or search |
| `g` then `l` `a` `f` `m` `t` `e` | Go to lifecycle, architecture, flows, matrix, tools, events |

## Tech Stack

- **Vite + React 18 + TypeScript** (strict)
- **Tailwind CSS 3** with a custom charcoal / orange theme (`tailwind.config.js`)
- **@xyflow/react** (React Flow 12) for the flow-chain graphs
- **Framer Motion** for panel, band and segment transitions (respects `prefers-reduced-motion`)
- **Fuse.js** for client-side fuzzy search
- **Lucide React** icons
- **Zustand** for the little global UI state there is
- **React Router 6** with `BrowserRouter` and a GitHub Pages 404 fallback
- Fonts self-hosted via Fontsource: **Syne** (display), **IBM Plex Sans** (body), **JetBrains Mono** (data)

No backend, no runtime API calls, no external UI component library.

## Getting Started

Requires Node 20+ (22 recommended).

```bash
npm install
npm run dev        # http://localhost:5173/BlueTeamMapper/
```

Other scripts:

```bash
npm run typecheck  # tsc -b
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally
npm run extract    # re-extract v3 content into src/data/legacy/ (needs python3 + beautifulsoup4)
```

## Deploying to GitHub Pages

The build output in `dist/` is a plain static site.

### Automatic (recommended)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`.

1. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
   (v3 was served straight from the branch, so this switch is required once.)
2. Push to `main`. The workflow runs `npm ci && npm run build` and publishes `dist/`.

```yaml
# .github/workflows/deploy.yml (abridged)
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
        env: { VITE_BASE: "/${{ github.event.repository.name }}/" }
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Base path

Vite's `base` is read from `VITE_BASE` and defaults to `/BlueTeamMapper/`.

| Hosting | Build command |
| --- | --- |
| Project site `https://<owner>.github.io/BlueTeamMapper/` | `npm run build` |
| Project site under a different repo name | `VITE_BASE=/<repo>/ npm run build` |
| User/org site `https://<owner>.github.io/` or a custom domain | `VITE_BASE=/ npm run build` |

The router's `basename` follows `import.meta.env.BASE_URL`, so nothing else needs changing.

### Client-side routes on Pages

GitHub Pages has no SPA rewrites, so a deep link such as `/BlueTeamMapper/flows/ransomware?step=backups`
would normally 404. The build emits a `404.html` (see `githubPagesSpaFallback` in `vite.config.ts`) that
encodes the path into the query string and redirects to the app root; a small inline script in
`index.html` restores the original URL before React boots. Deep links, refreshes and shared links all work.

## Project Structure

```
legacy/index.html          v3 static page, kept as the content source
scripts/extract_legacy.py  v3 HTML → src/data/legacy/*.json
src/
  data/                    all content; components never hard-code it
    types.ts               the content model
    phases.ts              7 lifecycle phases + phase links (flow / feedback)
    layers.ts              10 architecture layers → sections, tool categories, key controls
    flowChains.ts          8 response chains with steps, branches and approval gates
    techniques.ts          matrix rows + ATT&CK IDs, tactics, event IDs, chain links
    tools.ts / events.ts / sections.ts   typed wrappers over the extracted JSON
    legacy/*.json          extracted v3 content (sections, cards, matrices, queries, tools, events)
  components/              Layout, Sidebar, RadialMap, LayerMap, FlowGraph, DetailPanel,
                           SearchModal, PhaseCard, ToolCard, Reference renderers, ErrorBoundary…
  views/                   one file per route; everything but the lifecycle map is lazy-loaded
  lib/                     search index, graph layout, icon registry, hue tokens, keyboard helpers
  store/ui.ts              Zustand store (search + mobile nav open state)
```

### Architecture notes

- **The URL is the state.** The selected phase (`?phase=`), layer (`/layers/:id`), chain and step
  (`/flows/:id?step=`) and focused matrix row, event or tool (`?focus=`) all live in the URL, so every view
  deep-links and search can jump anywhere. Zustand only holds transient chrome (search modal, mobile nav).
- **The radial map is hand-built SVG,** not React Flow. Its segments are annular sectors with arcs, which
  React Flow's node/edge model doesn't express well; SVG gives precise geometry, glow filters and focusable
  segments. React Flow does what it's best at: the zoomable, pannable flow-chain graphs.
- **Flow layout** is a small layered algorithm (`src/lib/graphLayout.ts`): rank by longest path, wrap ranks
  into snaking rows, drop branch steps into a lane below. No dagre dependency for graphs of under 10 nodes.
- **Code splitting:** the lifecycle map ships in the main bundle; every other view is `React.lazy`, and
  React Flow lands in its own chunk loaded only by the Flow Chains view.
- **Accessibility:** phase segments are focusable buttons with `aria-pressed`; panels are labelled
  landmarks; search is a `combobox`/`listbox` with `aria-activedescendant`; flow chains have a parallel
  keyboard-operable step list; there is a skip link; motion respects the OS setting.

## Extending the Data

Everything renders from `src/data/`. New entries appear in the views and in search automatically.

- **Add a flow chain:** append to `flowChains` in `src/data/flowChains.ts`. Steps run in array order; add
  `next: [{ to: 'stepId', label: 'Condition' }]` to branch, `next: []` to end a branch, and `gate: true` for
  an analyst-approval step. Evidence strings like `Sysmon 10 (...)` or `Event 4662` link to the event reference.
- **Add a technique:** add a row to the v3 table (or `src/data/legacy/techniques.json`) and its ATT&CK ID,
  tactic, event IDs and chain to `ENRICHMENT` in `src/data/techniques.ts`. A missing enrichment fails loudly
  at startup.
- **Add a tool or event:** edit `src/data/legacy/tools.json` / `events.json`. New tool categories also need
  an entry in `CATEGORY_META` in `src/data/tools.ts`.
- **Add a layer:** append to `layers` in `src/data/layers.ts`, pointing `sections` at section ids and
  `toolCategories` at tool category ids.
- **Change a phase:** edit `src/data/phases.ts`. Phase links on the radial map are in `phaseLinks`.
- **Edit reference cards:** either edit `src/data/legacy/sections.json` directly, or edit
  `legacy/index.html` and run `npm run extract`.
- **Icons and colors** are named keys (`IconKey`, `Hue` in `types.ts`) resolved by `src/lib/icons.ts` and
  `src/lib/hues.ts`, so data files never import React.

## Palette (charcoal / orange)

Surfaces, text and borders are the umbrasec.dev palette, pushed one step darker for the map canvas, plus
the muted eight-hue coding set from v3 so categories and severities stay distinguishable on charcoal.

| Token | Hex | Use |
| --- | --- | --- |
| `ink-900` | `#111111` | page background (with a faint grid) |
| `ink-850` / `ink-800` | `#161616` / `#1b1b1b` | panels, cards |
| `fog` / `fog-bright` | `#959c95` / `#ccd0cf` | body text / headings |
| `ember` | `#f25623` | primary accent, active states, critical |
| `gold` | `#d9a441` | high, warnings, approval gates |
| `khaki` | `#aeab94` | medium |
| `sage` | `#88a57d` | low, success |
| `teal` | `#5fb3a1` | code, feedback loops |
| `slate` / `mauve` / `rose` | `#8fa3b8` / `#b48ead` / `#cf8a78` | category coding |

## Changelog

### v4.0
- Rebuilt as a Vite + React + TypeScript app deployed to GitHub Pages with GitHub Actions
- Radial lifecycle map with phase detail panel, flow and feedback links, keyboard selection
- Expandable architecture layer bands with P0/P1/P2 key controls
- Interactive React Flow graphs for 8 response chains, with branches, approval gates and step details
- Filterable, sortable technique matrix with ATT&CK IDs and tactics
- Event ID and tool arsenal views; ⌘K global search across all content
- v3 content extracted to typed JSON (`scripts/extract_legacy.py`); original page kept in `legacy/`

### v3.0
- Sticky sidebar navigation with grouped phase categories and scroll-spy
- 7-phase lifecycle bar, callout boxes, card accent bars
- SOAR Playbooks, Splunk SPL hunt queries, Technique Detection Matrix (22 techniques), Vulnerability SLA
  table, ADCS ESC1/ESC4/ESC6 remediation, EDR blind spots, Evidence & Chain of Custody, MFA Strength Hierarchy

### v2.0
- Initial public release
