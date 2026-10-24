# Linked runbooks - design

Date: 2026-10-24. Status: draft for review. No product code yet.

Backlog item 2 of "Make the Mappers a tool": when a phishing run takes the
"Execution found" branch, offer to start a linked EDR Alert run for each
affected host, so one incident becomes a tree of runs.

## Questions only you can answer

1. **When can the analyst start the EDR runs: before or after the P1 gate is
   approved?** The `escalate` step is an approval gate. Recommendation: allow it
   as soon as the step is active, because triage on a host is not containment
   and waiting for a page to be answered costs time. Isolation stays behind the
   EDR chain's own `isolate` gate.
2. **Child severity: inherit the phishing run's severity, or use the EDR
   chain's default (critical)?** Recommendation: the EDR default, since
   execution on a host is the worse event. The analyst can change it.
3. **One level deep, or can an EDR run spawn more EDR runs?** The EDR chain's
   "Scope lateral movement" step finds more hosts. Recommendation: one level in
   v1, with the data model ready for more.
4. **Closing a phishing run while linked EDR runs are still open: warn or
   block?** Recommendation: warn, the same way closing an unfinished run warns
   today.
5. **Deleting a phishing run that has linked runs: keep the children or offer
   to delete them too?** Recommendation: keep them. They show "parent not in
   this browser" and keep their own record.
6. **Add Vitest as a dev dependency for the pure helpers?** The repo has no test
   runner today (only `tsc -b` and manual browser checks). Recommendation: yes,
   for `src/lib` only.

## What it does

- The phishing chain's `escalate` step ("Escalate to P1 incident") gets a
  **Linked runs** block on its step card. The step already lists the action
  "Start EDR triage on affected hosts" and its detail says "Hand off to the EDR
  alert chain for each affected host", so this is where the hand-off lives.
- The analyst pastes or types the affected host names (one per line, or
  separated by commas or spaces), checks the list, and presses **Start N EDR
  Alert runs**. One EDR Alert run is created per host, in one store write.
- Each child run is a normal run: its own checklist, gates, branches, timeline
  and exports. It also knows its parent, the parent step, and its host.
- The parent's step card lists its children with host, status chip, progress
  and current step, each linking to the child run. More hosts can be added
  later while the step is on the path and the run is open. A host already
  linked from that step is not started twice (trimmed, case-insensitive match).
- The child's header shows "Linked from <parent title>, at Escalate to P1
  incident" with a link back. If the parent is not in this browser, it says so.
- The runbooks list keeps every run in the section for its own status, so an
  open EDR run always shows under "Open incidents", even when its parent is
  closed. A child sits nested under its parent (indented) when both have the
  same status; otherwise it is listed at the top level of its own section with
  a "Linked from <parent>" chip. The parent row has a "3 linked runs, 1 open"
  summary. A child whose parent is missing is listed at the top level with a chip.
- Timelines: the parent gets one `link` entry per child ("Started linked run:
  EDR Alert on WS-0142"), tied to the spawning step. Each child's timeline
  starts with a `run` entry "Linked from <parent title>". Closing, reopening or
  deleting a child adds a `link` entry, tied to the same step, to the parent.

### When the parent's branch changes

If the analyst changes the triage branch from "Execution found" to "No
execution" after starting children, `escalate` leaves the path:

- Starting children ticks the step's "Start EDR triage on affected hosts"
  action (`spawns.action`, below), so the step has a record. `resetStranded`
  then keeps it instead of putting it back to pending, and `splitNotTaken` lists
  it under "Left the path" rather than "not run".
- The step card under "Left the path" still shows its linked runs, read-only:
  no more hosts can be added, and the children keep running on their own.
- Before the branch change is applied, the branch buttons say that N linked
  runs were started from a step that will leave the path. The change is not
  blocked.
- The Markdown export lists the step under "Steps worked before the branch
  changed", with its linked runs.

## Out of scope (v1)

- Spawn points on any other step or chain (EDR lateral movement, credential
  compromise from EDR, ransomware patient zero). The data model allows them;
  only the phishing `escalate` step uses it.
- Linking two runs that already exist, moving a child to another parent, or
  unlinking.
- Reading hosts from the EDR or SIEM. Host names are typed or pasted.
- Subjects other than hosts (user accounts, mailboxes, cloud tenants).
- Cascading close or delete. Each run closes on its own.
- A graph view of the tree, and any change to the Flows page or FlowGraph
  beyond what the data change needs to keep compiling.
- Sync between browsers or people. Runs stay in this browser, as today.
- Roll-up of child progress into the parent's own progress bar. The parent's
  bar stays its own steps; the children summary sits beside it.

## Data changes

### Chain data (`src/data/types.ts`, `src/data/flowChains.ts`)

`FlowStep` gets an optional field:

```ts
/** This step can start one linked run of another chain per subject (v1: per host). */
spawns?: {
  chainId: string;
  per: 'host';
  label: string;
  /** Index into the step's `actions` that starting linked runs ticks. */
  action: number;
};
```

Phishing `escalate` gets
`spawns: { chainId: 'edr-alert', per: 'host', label: 'Start EDR triage on affected hosts', action: 2 }`
(its third action is "Start EDR triage on affected hosts").
A build-time check (or a dev assertion where `flowChainById` is built) fails if
`spawns.chainId` names a chain that does not exist or `spawns.action` is not an
index into `actions`.

### Run (`src/lib/runbook.ts`)

Additive, all optional, so runs saved by the current release load unchanged:

```ts
export interface RunLink {
  runId: string;
  stepId: string;
  /** Snapshots, so the link still reads when the parent is gone. */
  title: string;
  chainId: string;
}

export interface Run {
  // ...existing fields
  /** Set on a run started from another run's step. */
  parent?: RunLink;
  /** What this run is about, e.g. the host name. */
  subject?: { kind: 'host'; value: string };
}
```

The link is stored on the child only. A parent's children are derived by
scanning `runs` for `parent.runId === id` (a pure helper `childRuns(runs, id,
stepId?)`). One source of truth means no two-sided updates to keep in step
across tabs, and deleting either side leaves nothing dangling to clean up.

`LogKind` gains `'link'` (label "Linked run", its own dot colour). Older
releases that import a newer file map unknown kinds to `'entry'`, which already
happens in `parseRunJson`.

A tab still running the previous release after a deploy does not go through
`parseRunJson`: it loads new runs straight from storage (the `storage` event,
`rehydrate()` and `latestRuns`). Its `runToMarkdown` looks up
`logKindLabel[e.kind]` only for entries without a `stepId`, and would throw on
an unknown kind. So every `link` entry carries the spawning step's `stepId`
(the old code then uses the step label), and the child's opening entry uses
the existing `run` kind. The new release also falls back to "Entry" for any
kind it does not know, so the next new kind cannot crash it.

New pure helpers in `src/lib/runbook.ts`: `parseHosts(text)` (split, trim,
drop empties, dedupe case-insensitively, cap length per host), `childRuns`,
`childSummary` (counts open and closed), and `defaultChildTitle(chain, host,
parent)` giving "EDR Alert on WS-0142 (Phishing incident 24 Oct 2026)".

## Storage changes (`src/store/runbooks.ts`)

- Same key `btm-runbooks-v1` and persist `version: 1`. No migration: the new
  fields are optional and absent on old runs.
- New action `startLinkedRuns(parentId, stepId, hosts) => string[]`. In one
  `set()` built on `latestRuns()`, like every other write, it checks that the
  parent is open, that the step has `spawns` and is on the parent's path, drops
  hosts already linked from that step, creates each child with `freeId()`, and
  appends the parent's `link` entries. It activates the step if it was pending
  and ticks its `spawns.action`, logged like any other tick, so the step has a
  record (see "When the parent's branch changes"). Children start with the lead copied from the
  parent and the severity from question 2.
- `closeRun`, `reopenRun` and `deleteRun` on a child add a `link` entry to the
  parent if the parent is in this browser and open. A closed parent is not
  changed (closed runs are read-only today).
- `deleteRun` on a parent leaves its children as they are (question 5).
- Size: a run is a few KB; a tree of 20 runs stays far below the localStorage
  quota. The existing memory fallback for blocked storage is unchanged.
- Host names are incident data the analyst types. They stay in this browser and
  in the exports the analyst makes, never in URLs, page titles or anything
  sent out. Child routes stay `/runbooks/<id>`.

## Export

### Markdown

- Parent: a new `## Linked runs` section after "Steps on the path taken": a
  table of host, chain, run ID, status, progress ("3 of 7") and current step,
  plus the `link` entries already in the timeline.
- Child: a `Linked from` row in the header table with the parent's title and
  run ID.
- New **Copy incident Markdown** / **Download incident .md** on a parent with
  children: the parent's document followed by each child's, headings pushed
  down one level, children in start order. Single-run exports stay as they are.

### JSON

- Single-run export is unchanged except that `parent` and `subject` are
  included. Format `blue-team-mapper/runbook`, `version: 1` stays: the change is
  additive and older parsers drop unknown fields.
- New **Download incident JSON** on a parent:
  `{ format: 'blue-team-mapper/runbook-tree', version: 1, exportedAt, rootId, runs: [...] }`.
- `parseRunJson` keeps `parent` only if it is well formed, and `subject` only if
  `kind` is `'host'` and the value is a non-empty string within the length cap.
- Import accepts either format. A tree imports in one store write; when
  `importRun`'s rules give a run a new ID (duplicate or invalid), every
  `parent.runId` in the same file that pointed at the old ID is rewritten. A
  single child imported alone keeps its `parent` link, which resolves if that
  parent is already in this browser and shows "parent not in this browser"
  otherwise.

## Views

- `RunbookRunView.tsx`: a `LinkedRunsBlock` in `StepCard` for steps with
  `spawns` (host input, preview of the parsed list, start button, child list).
  Read-only when the run is closed or the step has left the path. A `Linked
  from` line in `RunHeader`. The close confirmation mentions open children.
  Focus and live-region announcements follow the existing `follow` pattern.
- `RunbooksView.tsx`: each run stays in the section for its own status; a
  child is nested under its parent only when both share that status, otherwise
  it is top level with a "Linked from" chip. Parent rows show the children
  summary.
- `BranchBlock`: a warning before a branch change takes a step with linked
  runs off the path.
- `components/Runbook.tsx`: the delete confirmation on a parent says how many
  linked runs stay.

## Testing

- Pure helpers (`parseHosts`, `childRuns`, tree export, tree import with ID
  rewrites, `parseRunJson` on old and new files) under Vitest if question 6 is
  yes, otherwise a scripted check run with `tsx`.
- `npm run build` (tsc and Vite) clean.
- Browser check with the Playwright recipe: start a phishing run, take
  "Execution found", start three hosts with one duplicate, confirm two runs plus
  a skipped duplicate, open a child and back, close a child and see the parent
  entry, switch the triage branch to "No execution" and check that escalate
  stays under "Left the path" with its linked runs, close the parent with a
  child open and check that the child still shows under "Open incidents", export and re-import the incident JSON in a fresh profile, and load a
  `btm-runbooks-v1` value saved by the current release to prove no migration
  is needed. Check at phone width as well as desktop.
