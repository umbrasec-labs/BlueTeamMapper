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
| `/matrix?focus=` | **Technique Detection Matrix** | 22 techniques with ATT&CK IDs and tactics. Filter by text, severity or tactic; sort; expand a row for event IDs to pull, the chain to run, UMBRASEC rules and the paired umbra-blue skills. |
| `/detections?focus=&tab=` | **Detections** | Every rule and query in the [UMBRASEC sigma-pack](https://umbrasec.dev/tools/sigma-pack/), shown as the canonical copy with writeup, false positives and copy button, plus all [umbra-blue](https://github.com/umbrasec-labs/umbra-blue) skills by tier. Each rule shows its [Claims Ledger](https://github.com/umbrasec-labs/detections) status (verified, not executed, stale, failing or mismatch), the blind spots and false positives the ledger proved, and the findings it tracks upstream. |
| `/runbooks` | **IR Runbooks** | Run any flow chain as a live checklist during a real incident. Start a run from this page or with **Start runbook** on a flow chain, then tick actions, record who approved each gate, pick the branch you take and write notes. Every change lands on a timestamped timeline. Open and closed runs are listed with progress and elapsed time. Import a run from its JSON export. Stored only in your browser. |
| `/runbooks/:runId` | **Live run** | One incident: steps on the chosen path with actions, notes, approval gates and branch buttons; branches and steps not taken; a live timeline with free-text entries; an elapsed clock. Close or reopen the incident. Export a Markdown timeline (copy or download) for the ticket or RCA, or the run as JSON. |
| `/skills/:name` | **Skill page** | One umbra-blue skill: tier and what it means, its ATT&CK and ATLAS IDs, the matrix techniques it covers (with your coverage rating), the UMBRASEC rules it ships and other rules for the same techniques, the flow chains it leads to, and the claude-red skills it answers. Links to its `SKILL.md`. |
| `/attack/:id` | **Technique page** | One ATT&CK or ATLAS ID, with parent and sub-technique matches: matrix techniques, UMBRASEC rules, every umbra-blue skill (exact matches and Tier 1 first), flow chains and the MITRE page. |
| `/coverage` | **Coverage Assessment** | Tick the log sources you collect and rate each technique Alert / Logged / Blind. Shows a coverage score, critical gaps and techniques that are blind for lack of a source. Export or import an ATT&CK Navigator layer. Stored only in your browser. |
| `/events?focus=` | **Event ID Reference** | Windows Security and Sysmon events grouped by category, cross-linked to techniques. |
| `/tools?q=&focus=` | **Tool Arsenal** | 60 tools in 11 categories, with fuzzy search. |
| `/sections/:id?card=` | **Section reader** | Every v3 section in full: callouts, matrices, cards and SPL hunt queries. |

**Global search** (`⌘K`, `Ctrl+K` or `/`) covers phases, layers, chains, steps, techniques, event IDs,
tools, sections and individual reference cards, and jumps straight to the matching node. Type a technique
ID such as `T1558.003` to open its technique page.

### Permalinks

Other UMBRASEC repos link into the mapper with these two routes. They are a stable contract: they will
keep resolving, so link to them freely.

| Link | Resolves to |
| --- | --- |
| `https://umbrasec-labs.github.io/BlueTeamMapper/skills/<name>` | The skill page for an umbra-blue skill, by its folder name, e.g. `/skills/detect-kerberoasting`. Every skill in umbra-blue resolves. An unknown name shows close matches and a link to all skills. |
| `https://umbrasec-labs.github.io/BlueTeamMapper/attack/<id>` | The technique page for an ATT&CK or ATLAS ID, e.g. `/attack/T1558.003` or `/attack/AML.T0051`. Case doesn't matter, and `T1558-003` or `T1558/003` redirect to `T1558.003`. An ID the mapper has nothing on still links to MITRE. |

`skillPath()` and `attackPath()` in `src/data/detections.ts` build these paths; use them for internal
links too.

### Keyboard

| Keys | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` / `/` | Open search; `↑` `↓` to move, `↵` to open |
| `1`-`7` | Select a lifecycle phase |
| `←` `→` | Cycle phases on the lifecycle map |
| `Esc` | Close the detail panel or search |
| `g` then `l` `a` `f` `r` `c` | Go to lifecycle, architecture, flows, runbooks, coverage |
| `g` then `m` `d` `t` `e` | Go to matrix, detections, tools, events |

## Tech Stack

- **Vite + React 18 + TypeScript** (strict)
- **Tailwind CSS 3** with a custom charcoal / orange theme (`tailwind.config.js`)
- **@xyflow/react** (React Flow 12) for the flow-chain graphs
- **Framer Motion** for panel, band and segment transitions (respects `prefers-reduced-motion`)
- **Fuse.js** for client-side fuzzy search
- **Lucide React** icons
- **Zustand** for the little global UI state there is
- **React Router 6** with `BrowserRouter` and a GitHub Pages 404 fallback
- Fonts self-hosted via Fontsource: **Inter Tight** (display, matching umbrasec.dev), **IBM Plex Sans** (body), **JetBrains Mono** (data)

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
npm run sync:detections   # pull rules + skills from ../umbrasec.dev and ../umbra-blue
npm run sync:detections -- --claims ../detections/out/claims.json   # also attach Claims Ledger status
```

## Deploying to GitHub Pages

The build output in `dist/` is a plain static site.

### Automatic (recommended)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`.

1. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
   (v3 was served straight from the branch, so this switch is required once.)
2. Push to `main`. The workflow checks out the sigma-pack and umbra-blue, runs `npm run sync:detections`,
   builds, scans `dist/` for secrets and PII, and publishes it. It also rebuilds daily, so newly published rules and skills appear
   without a commit here.

**Claims Ledger.** Before the sync, the workflow checks out [umbrasec-labs/detections](https://github.com/umbrasec-labs/detections),
sets up Python 3.12, installs the hash-locked harness and runs it against the same umbrasec.dev checkout the sync
reads (`python -m harness.run --upstream ../umbrasec.dev --out ../claims --exit-zero`). The sync gets the resulting
`claims.json` through `--claims`, hashes each rule file and shows **Mismatch** if the bytes differ from the ones the
harness proved. If any harness step fails, the sync runs without claims and the deploy goes ahead.

**Secrets scan.** After the build, the workflow downloads gitleaks 8.30.1, checks it against the release's
published sha256, and scans `dist/` (synced content included) with this repo's `.gitleaks.toml`. Unlike the
harness, a hit here fails the job and nothing is published.

```yaml
# .github/workflows/deploy.yml (abridged; the workflow pins each action to a commit SHA)
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1
      - uses: actions/setup-node@v7.1.0
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
        env: { VITE_BASE: "/${{ github.event.repository.name }}/" }
      - name: Scan the build for secrets and PII   # gitleaks dir dist; a hit blocks the deploy
        run: gitleaks dir dist --config .gitleaks.toml --redact --no-banner
      - uses: actions/upload-pages-artifact@v5.0.0
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5.0.1
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
    detections.ts          sigma-pack rules + umbra-blue skills, joined to techniques by ATT&CK ID
    coverage.ts            log sources and the sources each technique depends on
    legacy/*.json          extracted v3 content (sections, cards, matrices, queries, tools, events)
    external/detections.json   generated by scripts/sync-detections.mjs; never edit by hand
  components/              Layout, Sidebar, RadialMap, LayerMap, FlowGraph, DetailPanel,
                           SearchModal, PhaseCard, ToolCard, Reference renderers, ErrorBoundary…
  views/                   one file per route; everything but the lifecycle map is lazy-loaded
  lib/                     search index, graph layout, icon registry, hue tokens, keyboard helpers
    runbook.ts             runbook types, path walking (branches, not-taken steps), progress, time formatting
    runbookExport.ts       Markdown timeline export, JSON export, JSON import validation
  store/ui.ts              Zustand store (search + mobile nav open state)
  store/coverage.ts        persisted coverage self-assessment (localStorage)
  store/runbooks.ts        persisted IR runbook runs and their timelines (localStorage)
```

### Architecture notes

- **The URL is the state.** The selected phase (`?phase=`), layer (`/layers/:id`), chain and step
  (`/flows/:id?step=`) and focused matrix row, event or tool (`?focus=`) all live in the URL, so every view
  deep-links and search can jump anywhere. Zustand holds transient chrome (search modal, mobile nav) and the
  viewer's own data (coverage assessment, runbook runs), persisted to localStorage with an in-memory fallback.
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
- **Detections:** don't edit them here. Rules live in the sigma-pack (`umbrasec.dev/tools/sigma-pack`) and
  skills in umbra-blue; publish there and the next deploy picks them up. Rules are matched to techniques
  by ATT&CK ID, including parent/child IDs (T1048 ↔ T1048.003).
- **Coverage log sources:** `techniqueSources` in `src/data/coverage.ts` lists the log sources each
  technique depends on. Labels must match the Log Source Priority Matrix; a typo fails at startup.
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

### v4.2 (unreleased)
- Security: React Router 7.18.4 (fixes an open redirect via backslash in `<Link>`/`useNavigate`, GHSA-wrjc-x8rr-h8h6), `postcss-selector-parser` pinned to 7.1.6 under Tailwind 3 (GHSA-rj75-hqrm-r3gf, identical CSS output), `yaml` 2.9.1 (GHSA-48c2-rrv3-qjmp); `npm audit` is clean
- Dependabot config: weekly npm and Actions updates with a 14-day cooldown, security updates grouped
- IR Runbooks: run any of the 8 flow chains as a live checklist during an incident. Several runs at once, each
  with a title, lead, severity and an elapsed clock
- Steps follow the chain's path: single successors start automatically, decision steps wait for the analyst to
  pick a branch, and steps on other branches show as not taken
- Approval gates cannot be marked done until the approver's name is recorded
- Every action, note, approval, branch and status change is logged with a timestamp; add free-text entries too
- Export a Markdown timeline (UTC and local times, checklist, notes, approvals, branches not taken) by copy or
  download, or the whole run as JSON; import a JSON export on another browser
- **Start runbook** on every flow chain, an **IR Runbooks** sidebar entry with the open-run count, and `g` then `r`
- Runs are stored only in the browser; clearing site data deletes them
- Open tabs stay in step: a run started or edited in one tab shows in the others and is never overwritten
- Changing a branch puts untouched steps from the old branch back to pending; steps with work on them move to
  **Left the path** and keep their record in the view and the export
- A run whose chain a later release removes can still be downloaded as JSON or deleted
- Permalink pages: `/skills/<name>` for every umbra-blue skill and `/attack/<id>` for any ATT&CK or ATLAS ID
- Skill and ATT&CK links in the Detections, Matrix and Coverage views and in search now open these pages
- Matrix rows link to the full skill list for a technique when more than three skills cover it
- ATLAS links keep the `AML.` prefix, so they open the right page on atlas.mitre.org
- Search always reopens empty, even when you start typing straight away
- A link to another page opens it at the top. Back and Forward keep your place
- Claims Ledger in the Detections view: each rule shows its status from umbrasec-labs/detections, such as
  **Claims verified 9/9** or **KQL: not executed**, with the blind spots and false positives the ledger proved
  and the findings it tracks upstream. Skill and technique pages show the same chip next to each rule
- The deploy re-runs the claims harness on the sigma-pack checkout the mapper shows. A rule whose bytes differ
  from the proved bytes shows as **Mismatch**, and a harness failure never blocks the deploy

### v4.1
- Detections view: UMBRASEC sigma-pack rules (canonical copy) and umbra-blue skills, synced at build time
- Matrix rows link each technique to its UMBRASEC rules and umbra-blue skills
- Coverage Assessment: log source checklist, Alert / Logged / Blind ratings, gaps, ATT&CK Navigator export/import
- Rules and skills in global search; daily scheduled rebuild

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
