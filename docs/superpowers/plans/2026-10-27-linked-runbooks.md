# Linked Runbooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a phishing run takes "Execution found", the analyst starts one linked EDR Alert run per affected host from the `escalate` step. One incident then becomes a tree of runs that list, export and import together.

**Architecture:** The link is stored only on the child (`Run.parent`, `Run.subject`). A parent's children are always derived with `childRuns(runs, id)`. All logic that touches more than one run is pure and lives in a new `src/lib/runLinks.ts`, with chains and an id generator passed in. The zustand store wraps each of those functions in one `set()` built on `latestRuns()`. Vitest covers `src/lib` only. The views read `useRunbooks((s) => s.runs)` once and derive from it with `useMemo`.

**Tech Stack:** React 18, TypeScript 5.9 (strict, noUnused*), Vite 6.4.5, zustand 5.0.16, Tailwind 3, lucide-react, Vitest 4.1.11 (new), Playwright 1.49.1 (browser check only, installed in the scratchpad, never in the repo).

**Spec:** `docs/superpowers/specs/2026-10-24-linked-runbooks-design.md`. The decisions there are final. Read it before Task 1.

**Verified:** Every test, implementation and view change below was dry-run on a scratch copy of main (9dd0183) on 2026-10-27, then dry-run again after the review fixes the same day.
- `npm test`: 61 tests pass.
- `tsc -b` and `npm run build` are clean.
- The Task 14 browser check passes all 74 checks at 1280px and 375px. It also passes against a `btm-runbooks-v1` value captured from a build of main.
- The four checks the review added (in-paste duplicate, edit form not carried to the child, the header link opening the spawn step, the branch warning with one child closed) fail against the plan as it stood before the review.

## Global Constraints

- Repo: `BlueTeamMapper` (the clone inside the umbrasec-labs workspace). Prefix every shell command with `cd <repo> &&`.
- Branch `feat/linked-runbooks`. Each task ends with one commit.
- Every commit keeps `npm test` and `npm run build` green.
- Prefix every git command with `GIT_CONFIG_GLOBAL=/dev/null`, because the sandbox cannot read `~/.gitconfig`.
- Never run `git config` and never set an identity; commits use the repo's existing local identity.
- Never `git add .`: the untracked `.claude/` must stay out. Add the paths each task names.
- Commit messages are plain sentence case like the history ("Record the linked-runbooks decisions (#29)"). No `feat:` prefix, no Co-Authored-By, no attribution lines.
- Never use en or em dashes anywhere: code, copy, comments, commits. Use a plain hyphen. The `.githooks/commit-msg` hook rejects them in messages.
- No emails, tokens or personal data in code, fixtures, docs or commits. Fixture leads are role words ("on-call").
- Every npm command that hits the registry needs `--cache "$TMPDIR/npm-cache"` (`~/.npm` is read-only in the sandbox) and `registry.npmjs.org` in allowed_domains.
- Pushing, opening the PR and merging are done by the user.
- Storage key stays `btm-runbooks-v1` and persist `version: 1`. No `migrate`.
  - zustand 5 with a changed version and no `migrate` hydrates nothing, and the next write wipes storage.
- Host names never go in URLs or `document.title`. Child routes stay `/runbooks/<id>`.
- Every `link` log entry carries the spawning step's `stepId`.
  - A tab on the previous release renders `logKindLabel[e.kind]` only for entries without a stepId, and would throw on `link`.
- One level deep in v1. Only phishing `escalate` gets `spawns`.
- Vitest runs `src/lib/**/*.test.ts` only. Test files are type-checked by `tsc -b` under `strict` and `noUnusedLocals`/`noUnusedParameters`, so every test must compile.
  - Import `describe`, `it` and `expect` from `'vitest'`. There are no globals.
- Tests never assert locale-formatted strings (`defaultRunTitle`, `localDateTime`, `when()`). The `test` script pins `TZ=UTC`.
- Test fixtures use the real chains from `@/data/flowChains`. `edgeCache` in `runbook.ts` is keyed by chain id, so a fixture chain that reuses a real id gets stale edges.
- zustand 5 selectors must never return a fresh array or object. Use `useRunbooks((s) => s.runs)` plus `useMemo`, or a selector that returns a number.
- Readers of `run.parent` / `run.subject` go through `linkOf(run)` / `hostOf(run)`. Runs from storage (`latestRuns`, `rehydrate`) skip `parseRunJson` and can hold anything.
- Pin any new GitHub Action by full SHA, exactly as `deploy.yml` does.
- Line hints such as `L364` or `:605` always refer to main (9dd0183), not to the file as the previous task left it. Earlier tasks move lines, so find the place by the function or component the hint names.

## Review Focus

These failure modes are not covered by the spec's own examples. Each one has a pinning test in the task named.

1. **Unticking the spawn action after starting runs, then changing the branch.** Without a guard, `resetStranded` puts escalate back to pending and its linked runs vanish from the page. Expected: the tick cannot be removed while linked runs exist (`spawnTickLocked`, Task 6 test; checkbox locked, Task 14 check).
2. **Pasting a whole asset export (hundreds of hosts), or re-pasting a growing list.** Expected: at most `HOSTS_PER_START` (50) new hosts per start. Hosts already linked are set aside before the cap, so they never use it up. The rest are counted and shown, and the store starts only the first 50 new hosts it is given (Task 4 `parseHosts` tests, Task 6 "at most HOSTS_PER_START" test).
3. **Runs from storage with a malformed `parent`/`subject`, or a log kind from a newer release** (another tab, a hand-edited value). Expected: treated as unlinked, labelled "Entry", never a crash (Task 3 `toString` Markdown test, Task 4 "ignores malformed values" test, Task 13 v1 `groupRuns` test).
4. **Re-importing an incident JSON into the browser that exported it** (every id taken, and possibly a repeated id inside the file). Expected: a new copy whose children point at the new parent copy, never at the original (Task 8 "re-importing into the browser that exported it" and "repeated id" tests).
5. **Siblings started in one batch, or with all-digit ids** (`22222222` sorts first as an integer-like key). Expected: start order everywhere, from a 1 ms stagger plus a `byStart` sort, never `Object.values` order (Task 4 `childRuns` test, Task 6 stagger assertion).
6. **Following a link from one run to another** (a child row, or the child's "Linked from" link). The route keeps the same component for a new `runId`, so without a key the parent's open Edit details form, close confirmation and notices carry over to the child (Save would rename the child), and the `#rb-step-<id>` reveal never fires. Expected: `RunView` is keyed by run id (Task 11), and the Task 14 check covers both cases.

## Beyond the spec (approved by the user 2026-10-27)

The plan adds two guards the spec does not decide. Both defend rules the spec does set, and each is small to undo. The user approved both on 2026-10-27; list both under "Beyond the spec" in the PR body.

1. **The spawn action stays ticked while linked runs exist** (`spawnTickLocked`, Task 6; locked checkbox and hint, Task 11). Today the analyst can untick any action. Without the lock, unticking it and then changing the triage branch lets `resetStranded` put escalate back to pending, and its linked runs disappear from the page. That breaks the spec's "the step has a record" rule. If the user says no, drop `spawnTickLocked`, the store guard and the checkbox lock. Instead, make `resetStranded` in `src/store/runbooks.ts` treat a step with linked runs as touched.
2. **At most 50 new hosts per start** (`HOSTS_PER_START`, Tasks 4, 6 and 11). The spec caps only the length of each host name. The cap keeps a pasted asset export from creating hundreds of runs in one click, and the spec sizes storage for "a tree of 20 runs". Hosts past the cap are counted and shown ("Start these, then paste the other N"). The store starts the first 50 new hosts and never refuses the batch. If the user says no, delete `HOSTS_PER_START`, the `extra` count, its notice and the `break` in `buildLinkedRuns`, along with their tests.

`deploy.yml` is not changed. Spec decision 6 adds Vitest for `src/lib`, and the new `ci.yml` runs it on every pull request. Gating every deploy on it, including the daily 06:17 cron rebuild, is a pipeline change the spec did not decide.

## File Map

| File | Change |
| --- | --- |
| `package.json`, `package-lock.json` | `vitest` 4.1.11 (exact) devDependency, `"test": "TZ=UTC vitest run"` |
| `vite.config.ts` | `/// <reference types="vitest/config" />`, `test` block |
| `.github/workflows/ci.yml` | new: PR runs `npm ci`, `npm test`, `npm run build` (`deploy.yml` is unchanged) |
| `src/data/types.ts` | `FlowStep.spawns?` |
| `src/data/flowChains.ts` | escalate `spawns`; `spawnProblems()`; dev assertion |
| `src/lib/runbook.ts` | `RunLink`, `HostSubject`, `Run.parent?/subject?`, `'link'` kind, `kindLabel`, `parseHosts`, `isRunLink`, `isHostSubject`, `linkOf`, `hostOf`, `byStart`, `childRuns`, `childSummary`, `defaultChildTitle`, `closeWarning` |
| `src/lib/runLinks.ts` | new: `draft`, `activate`, `normalize`, `freeId`, `newRun`, `linkName`, `buildLinkedRuns`, `spawnTickLocked`, `closeRunIn`, `reopenRunIn`, `deleteRunIn`, `assignImportIds`, `ImportIdReason`, `childrenLeavingPath`, `groupRuns` |
| `src/lib/runbookExport.ts` | Entry fallback, `parent`/`subject` parsing, `parseImport`, tree JSON, Markdown linked sections, `incidentToMarkdown`, incident file names |
| `src/store/runbooks.ts` | uses `runLinks`; `write()` helper; `startLinkedRuns`, `importRuns`; parent entries on close, reopen and delete; spawn-tick lock |
| `src/views/RunbookRunView.tsx` | `link` dot, `LinkedRunsBlock`, step chip and lock, `RunView` keyed by run id, branch warning, header "Linked from" and host, close warning, children summary, incident exports |
| `src/views/RunbooksView.tsx` | nested rows, link chips, tree import |
| `src/components/Runbook.tsx` | delete confirmation counts linked runs |
| `src/lib/__fixtures__/runs.ts`, `src/lib/__fixtures__/runbooks-v1.json` | test fixtures |
| `src/lib/*.test.ts` | `runbook`, `chainData`, `runLinks`, `runbookExport` |
| `README.md` | `npm test` line, changelog |

---

### Task 1: Vitest, the test script and CI

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm), `vite.config.ts`, `README.md:93`
- Create: `src/lib/runbook.test.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `npm test` (runs `TZ=UTC vitest run` over `src/lib/**/*.test.ts`, node environment).

- [ ] **Step 1: Branch**

Run: `cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git switch -c feat/linked-runbooks`
Expected: `Switched to a new branch 'feat/linked-runbooks'`.

The sandbox may leave an empty read-only `.git/config.lock`. Before the user pushes, tell them to run `! rm <repo>/.git/config.lock`.

- [ ] **Step 2: Install Vitest**

Run: `cd <repo> && npm i -D -E vitest@4.1.11 --cache "$TMPDIR/npm-cache"` (allowed_domains: `registry.npmjs.org`).

Version choice:
- 4.1.11 (2026-08-18) depends on vite `^6 || ^7 || ^8` and dedupes onto the installed vite 6.4.5.
- 4.1.12 is under two weeks old.
- Vitest 5 is not checked against vite 6.

Then check: `cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git diff --stat package-lock.json` shows only added lines, and `npm ls vite` shows one `vite@6.4.5`.

If a later `tsc -b` reports missing modules such as `react-router-dom`, run `cd <repo> && npm ci --cache "$TMPDIR/npm-cache"`. Sandbox npm 12 pruned `node_modules` once in the dry run, and `npm ci` restored it. An "install scripts blocked: esbuild" warning is harmless.

- [ ] **Step 3: Script and config**

In `package.json` `scripts`, add after `"typecheck"`:
```json
    "test": "TZ=UTC vitest run",
```

In `vite.config.ts`, make the first line:
```ts
/// <reference types="vitest/config" />
```

Add this block before `esbuild:`. The reference is what lets `tsconfig.node.json` accept the `test` key.
```ts
  test: {
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
```

- [ ] **Step 4: Write a test that pins current behaviour**

`src/lib/runbook.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import { formatDuration, runPath } from './runbook';

describe('formatDuration', () => {
  it('formats minutes, hours and days', () => {
    expect(formatDuration(30_000)).toBe('<1m');
    expect(formatDuration(12 * 60_000)).toBe('12m');
    expect(formatDuration(65 * 60_000)).toBe('1h 05m');
    expect(formatDuration(51 * 3_600_000)).toBe('2d 3h');
  });
});

describe('runPath', () => {
  it('stops at the phishing triage decision until a branch is picked', () => {
    const chain = flowChainById['phishing'];
    expect(runPath(chain, {}).awaiting?.id).toBe('triage');
    expect(runPath(chain, { triage: 'escalate' }).steps.map((s) => s.id)).toEqual([
      'received', 'gateway', 'triage', 'escalate', 'block', 'hunt', 'purge',
    ]);
  });
});
```
It pins existing behaviour, so it passes on the first run. Its job is to prove the runner, the `@` alias and the type-check all work.

- [ ] **Step 5: Run the tests and the build**

Run: `cd <repo> && npm test`
Expected: `Test Files  1 passed (1)` and `Tests  2 passed (2)`.

Run: `cd <repo> && npm run build`
Expected: `tsc -b` silent, then `✓ built in`.

- [ ] **Step 6: CI**

`.github/workflows/ci.yml`:
```yaml
# Tests and a production build on every pull request. The build uses the committed
# src/data/external/detections.json, so it needs none of the deploy workflow's sync steps.
name: ci
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
```

Leave `.github/workflows/deploy.yml` as it is (see "Beyond the spec").

In `README.md`, add under `npm run typecheck  # tsc -b` (line 93):
```
npm test           # Vitest over the pure helpers in src/lib
```

- [ ] **Step 7: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add package.json package-lock.json vite.config.ts src/lib/runbook.test.ts .github/workflows/ci.yml README.md && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Add Vitest for src/lib and run it in CI"
```

---

### Task 2: Spawn points in the chain data

**Files:**
- Modify: `src/data/types.ts:187-188` (after `gate?`), `src/data/flowChains.ts:64` (escalate) and after line 557 (`flowChainById`)
- Test: `src/lib/chainData.test.ts`

**Interfaces:**
- Produces: `FlowStep.spawns?: { chainId: string; per: 'host'; label: string; action: number }`
- Produces: `spawnProblems(chains: FlowChain[]): string[]` exported from `src/data/flowChains.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/chainData.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { flowChainById, flowChains, spawnProblems } from '@/data/flowChains';
import type { FlowChain } from '@/data/types';

describe('spawn points', () => {
  it('every spawn point in the shipped chains is valid', () => {
    expect(spawnProblems(flowChains)).toEqual([]);
  });

  it('phishing escalate starts EDR Alert runs and ticks its third action', () => {
    const step = flowChainById['phishing'].steps.find((s) => s.id === 'escalate')!;
    expect(step.spawns).toEqual({ chainId: 'edr-alert', per: 'host', label: 'Start EDR triage on affected hosts', action: 2 });
    expect(step.actions[step.spawns!.action]).toBe('Start EDR triage on affected hosts');
  });

  it('reports an unknown chain and an action index out of range', () => {
    const bad: FlowChain = {
      ...flowChainById['phishing'],
      id: 'fixture-bad-spawn',
      steps: [{ id: 'x', label: 'X', phase: 'response', detail: '', actions: ['one'], spawns: { chainId: 'nope', per: 'host', label: 'L', action: 1 } }],
    };
    expect(spawnProblems([bad])).toEqual([
      'fixture-bad-spawn/x spawns unknown chain "nope"',
      'fixture-bad-spawn/x spawns.action 1 is not an index into its 1 actions',
    ]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd <repo> && npm test`
Expected: `chainData.test.ts` fails (`spawnProblems` is not exported, and `spawns` is not on `FlowStep`).

- [ ] **Step 3: Implement**

In `src/data/types.ts`, add this after `gate?: boolean;` in `FlowStep`. The text is copied from the spec.
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

In `src/data/flowChains.ts`, on the escalate step, add this after its `actions:` line:
```ts
        spawns: { chainId: 'edr-alert', per: 'host', label: 'Start EDR triage on affected hosts', action: 2 },
```

After the `flowChainById` definition, add the function and the assertion. The assertion runs in `npm run dev` and under Vitest. `import.meta.env.DEV` is false in `npm run build`, so the CI test is the build-time check.
```ts
/** What is wrong with the chains' spawn points: an unknown chain, or an action index out of range. */
export function spawnProblems(chains: FlowChain[]): string[] {
  const ids = new Set(chains.map((c) => c.id));
  const problems: string[] = [];
  for (const c of chains) {
    for (const s of c.steps) {
      if (!s.spawns) continue;
      if (!ids.has(s.spawns.chainId)) problems.push(`${c.id}/${s.id} spawns unknown chain "${s.spawns.chainId}"`);
      if (!Number.isInteger(s.spawns.action) || s.spawns.action < 0 || s.spawns.action >= s.actions.length) {
        problems.push(`${c.id}/${s.id} spawns.action ${s.spawns.action} is not an index into its ${s.actions.length} actions`);
      }
    }
  }
  return problems;
}

// Dev and tests: fail loudly on a bad spawn point. CI runs the same check in src/lib/chainData.test.ts.
if (import.meta.env.DEV) {
  const problems = spawnProblems(flowChains);
  if (problems.length) throw new Error(`Bad spawn points in flowChains.ts:\n${problems.join('\n')}`);
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Tests  5 passed (5)`, and a clean build. The optional field compiles in FlowGraph, FlowsView, StepDetail and search unchanged.

- [ ] **Step 5: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/data/types.ts src/data/flowChains.ts src/lib/chainData.test.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Let a flow step start linked runs; phishing escalate starts EDR Alert runs"
```

---

### Task 3: The `link` log kind, an "Entry" fallback, and the v1 fixtures

**Files:**
- Modify: `src/lib/runbook.ts:11` (`LogKind`), `:57-65` (`logKindLabel`)
- Modify: `src/views/RunbookRunView.tsx:58-66` (`kindDot`) and `:605`
- Modify: `src/lib/runbookExport.ts:55`
- Create: `src/lib/__fixtures__/runs.ts`, `src/lib/__fixtures__/runbooks-v1.json`
- Test: `src/lib/runbook.test.ts`, `src/lib/runbookExport.test.ts` (new)

**Interfaces:**
- Produces: `LogKind` includes `'link'`; `logKindLabel.link === 'Linked run'`
- Produces: `kindLabel(kind: string): string`, which is never an inherited method and falls back to `'Entry'`
- Produces (test-only):
  - `fixtureRun(id: string, chainId: string, over?: Partial<Run>): Run`
  - `ids(...list: string[]): () => string`
  - `runbooks-v1.json`, a `btm-runbooks-v1` value in the current release's shape

- [ ] **Step 1: Fixtures**

`src/lib/__fixtures__/runs.ts`:
```ts
import type { Run } from '../runbook';

/** A bare run for tests. Step records are optional: helpers treat a missing one as pending. */
export function fixtureRun(id: string, chainId: string, over: Partial<Run> = {}): Run {
  return {
    id,
    chainId,
    title: `Run ${id}`,
    lead: '',
    severity: 'high',
    startedAt: '2026-10-24T09:00:00.000Z',
    status: 'active',
    steps: {},
    choices: {},
    log: [],
    ...over,
  };
}

/** Ids from a fixed list, so tests know every new run's id. */
export const ids = (...list: string[]) => () => {
  const id = list.shift();
  if (!id) throw new Error('fixture id list ran out');
  return id;
};
```

`src/lib/__fixtures__/runbooks-v1.json` holds exactly what the current store persists.
- The phishing run has every step record, so `parseRunJson` round-trips it unchanged; the Step 2 test proves that.
- The closed EDR run has only some step records, like a run saved before its chain gained steps.

```json
{
  "state": {
    "runs": {
      "k7m2p9qa": {
        "id": "k7m2p9qa",
        "chainId": "phishing",
        "title": "Phishing incident 24 Oct 2026",
        "lead": "on-call",
        "severity": "high",
        "startedAt": "2026-10-24T09:00:00.000Z",
        "status": "active",
        "steps": {
          "received": { "status": "done", "startedAt": "2026-10-24T09:00:00.000Z", "actions": [true, true], "notes": "Reported by finance.", "doneAt": "2026-10-24T09:05:00.000Z" },
          "gateway": { "status": "done", "startedAt": "2026-10-24T09:05:00.000Z", "actions": [true, false], "notes": "", "doneAt": "2026-10-24T09:12:00.000Z" },
          "triage": { "status": "done", "startedAt": "2026-10-24T09:12:00.000Z", "actions": [true, true], "notes": "", "doneAt": "2026-10-24T09:30:00.000Z" },
          "escalate": { "status": "active", "startedAt": "2026-10-24T09:30:00.000Z", "actions": [true, false, false], "notes": "" },
          "block": { "status": "pending", "actions": [false, false, false], "notes": "" },
          "hunt": { "status": "pending", "actions": [false, false, false], "notes": "" },
          "purge": { "status": "pending", "actions": [false, false, false], "notes": "" }
        },
        "choices": { "triage": "escalate" },
        "log": [
          { "at": "2026-10-24T09:00:00.000Z", "kind": "run", "text": "Incident opened on the Phishing runbook" },
          { "at": "2026-10-24T09:00:00.000Z", "kind": "step", "text": "Started", "stepId": "received" },
          { "at": "2026-10-24T09:04:00.000Z", "kind": "note", "text": "Reported by finance.", "stepId": "received" },
          { "at": "2026-10-24T09:05:00.000Z", "kind": "step", "text": "Marked done", "stepId": "received" },
          { "at": "2026-10-24T09:30:00.000Z", "kind": "branch", "text": "Took branch \"Execution found\" → Escalate to P1 incident", "stepId": "triage" },
          { "at": "2026-10-24T09:30:00.000Z", "kind": "step", "text": "Started", "stepId": "escalate" },
          { "at": "2026-10-24T09:31:00.000Z", "kind": "action", "text": "Checked: Page on-call analyst", "stepId": "escalate" },
          { "at": "2026-10-24T09:32:00.000Z", "kind": "entry", "text": "Called the mail team" }
        ]
      },
      "q3x8c4vd": {
        "id": "q3x8c4vd",
        "chainId": "edr-alert",
        "title": "EDR Alert incident 23 Oct 2026",
        "lead": "",
        "severity": "critical",
        "startedAt": "2026-10-23T14:00:00.000Z",
        "closedAt": "2026-10-23T15:00:00.000Z",
        "status": "closed",
        "steps": {
          "alert": { "status": "active", "startedAt": "2026-10-23T14:00:00.000Z", "actions": [false, false], "notes": "" }
        },
        "choices": {},
        "log": [
          { "at": "2026-10-23T14:00:00.000Z", "kind": "run", "text": "Incident opened on the EDR Alert runbook" },
          { "at": "2026-10-23T14:00:00.000Z", "kind": "step", "text": "Started", "stepId": "alert" },
          { "at": "2026-10-23T15:00:00.000Z", "kind": "run", "text": "Incident closed" }
        ]
      }
    }
  },
  "version": 1
}
```

- [ ] **Step 2: Write the failing tests**

Add to `src/lib/runbook.test.ts`. Add `kindLabel` to the `./runbook` import.
```ts
describe('kindLabel', () => {
  it('labels link entries and falls back to Entry for kinds it does not know', () => {
    expect(kindLabel('link')).toBe('Linked run');
    expect(kindLabel('handoff')).toBe('Entry');
    expect(kindLabel('toString')).toBe('Entry');
  });
});
```

Create `src/lib/runbookExport.test.ts`. Later tasks extend this file and its imports.
```ts
import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import stored from './__fixtures__/runbooks-v1.json';
import type { Run } from './runbook';
import { parseRunJson, RUNBOOK_FORMAT, runToMarkdown } from './runbookExport';

const phishing = flowChainById['phishing'];
const NOW = Date.parse('2026-10-24T12:00:00.000Z');
/** The `btm-runbooks-v1` value the current release (before linked runs) writes. */
const v1Runs = stored.state.runs as unknown as Record<string, Run>;
const v1Run = v1Runs.k7m2p9qa;
const exportOf = (run: unknown) => JSON.stringify({ format: RUNBOOK_FORMAT, version: 1, exportedAt: '2026-10-24T12:00:00.000Z', run });

describe('runs saved by the current release', () => {
  it('a v1 export parses to the same run, with no parent or subject', () => {
    const run = parseRunJson(exportOf(v1Run));
    expect(run).toEqual(v1Run);
    expect('parent' in run || 'subject' in run).toBe(false);
  });

  it('labels a timeline entry of a kind it does not know as Entry, even "toString"', () => {
    const run = { ...v1Run, log: [...v1Run.log, { at: '2026-10-24T09:40:00.000Z', kind: 'toString', text: 'From a newer release' }] } as Run;
    expect(runToMarkdown(run, phishing, NOW)).toContain('| 2026-10-24T09:40:00Z | Entry | From a newer release |');
  });
});
```

- [ ] **Step 3: Run them to make sure the new ones fail**

Run: `cd <repo> && npm test`
Expected:
- `kindLabel` fails because it is not exported.
- The `toString` test fails with `TypeError: s.replace is not a function`, from `cell()` at `runbookExport.ts:32`.
- The round-trip test already passes; it pins the format.

- [ ] **Step 4: Implement**

`src/lib/runbook.ts`:
- `LogKind` gets `| 'link'`.
- `logKindLabel` gets `link: 'Linked run',`.
- Add `kindLabel` after the `logKindLabel` definition. `own` is a const defined later in the file; that is fine, because `kindLabel` only calls it at run time.
```ts
/** Label for any stored kind, including one a later release added: never an inherited method. */
export const kindLabel = (kind: string) => own(logKindLabel, kind) ?? 'Entry';
```

`src/lib/runbookExport.ts`:
- Add `kindLabel` and `own` to the `./runbook` import.
- Replace line 55's step cell `cell(e.stepId ? label[e.stepId] ?? e.stepId : logKindLabel[e.kind])` with:
```ts
cell(e.stepId ? own(label, e.stepId) ?? String(e.stepId) : kindLabel(e.kind))
```
`logKindLabel` stays imported, because `kinds` uses it.

`src/views/RunbookRunView.tsx`:
- `kindDot` gets `link: 'bg-rose',`. `rose` is the one accent not used by the runbook UI, and `bg-rose` is already generated through `hues.ts`.
- Line 605 `${kindDot[e.kind]}` becomes `${own(kindDot, e.kind) ?? kindDot.entry}`.

- [ ] **Step 5: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Test Files  3 passed (3)`, `Tests  8 passed (8)`, and a clean build. The build proves the `kindDot` record is complete.

- [ ] **Step 6: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runbook.ts src/lib/runbookExport.ts src/views/RunbookRunView.tsx src/lib/__fixtures__ src/lib/runbook.test.ts src/lib/runbookExport.test.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Add the link log kind and label unknown kinds as Entry"
```

---

### Task 4: Run links and the pure link helpers

**Files:**
- Modify: `src/lib/runbook.ts`: types near line 32; helpers after `defaultRunTitle` (line 257)
- Test: `src/lib/runbook.test.ts`

**Interfaces:**
- Produces, all in `src/lib/runbook.ts`:
  - `interface RunLink { runId: string; stepId: string; title: string; chainId: string }`
  - `interface HostSubject { kind: 'host'; value: string }`
  - `Run.parent?: RunLink`, `Run.subject?: HostSubject`
  - `HOST_MAX = 253`, `HOSTS_PER_START = 50`
  - `interface ParsedHosts { hosts: string[]; already: string[]; tooLong: number; dupes: number; extra: number }`
  - `parseHosts(text: string, skip?: ReadonlySet<string>): ParsedHosts`, where `skip` holds the lower-cased hosts already linked
  - `isRunLink(v: unknown): v is RunLink`, `isHostSubject(v: unknown): v is HostSubject`
  - `linkOf(run: Run): RunLink | undefined`, `hostOf(run: Run): string | undefined` (trimmed)
  - `byStart(a: Run, b: Run): number`
  - `childRuns(runs: Record<string, Run>, id: string, stepId?: string): Run[]`
  - `interface ChildSummary { total; open; closed; text }`, `childSummary(children: Run[]): ChildSummary`
  - `defaultChildTitle(chain: FlowChain, host: string, parent: Run): string`
  - `closeWarning(openSteps: number, estimated: boolean, openChildren: number): string`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/runbook.test.ts`. Extend the imports to:
- from `./runbook`: `childRuns, childSummary, closeWarning, defaultChildTitle, formatDuration, HOST_MAX, hostOf, HOSTS_PER_START, kindLabel, linkOf, parseHosts, runPath, type HostSubject, type RunLink`
- `import { fixtureRun } from './__fixtures__/runs';`

```ts
describe('parseHosts', () => {
  it('splits on new lines, commas and spaces, trims and drops empties', () => {
    expect(parseHosts(' WS-0142,WS-0187\n\n  srv-db01  ws-0200 ,').hosts).toEqual(['WS-0142', 'WS-0187', 'srv-db01', 'ws-0200']);
  });

  it('drops case-insensitive duplicates, keeps the first spelling and counts them', () => {
    const r = parseHosts('WS-0142 ws-0142 Ws-0142 WS-0187');
    expect(r.hosts).toEqual(['WS-0142', 'WS-0187']);
    expect(r.dupes).toBe(2);
  });

  it('leaves out hosts longer than HOST_MAX and counts them', () => {
    const r = parseHosts(`ok-1 ${'a'.repeat(HOST_MAX + 1)} ${'b'.repeat(HOST_MAX)}`);
    expect(r.hosts).toEqual(['ok-1', 'b'.repeat(HOST_MAX)]);
    expect(r.tooLong).toBe(1);
  });

  it('keeps at most HOSTS_PER_START hosts and counts the rest', () => {
    const many = Array.from({ length: HOSTS_PER_START + 7 }, (_, i) => `host-${i}`).join('\n');
    const r = parseHosts(`${many}\nhost-0`);
    expect(r.hosts).toHaveLength(HOSTS_PER_START);
    expect(r.hosts[0]).toBe('host-0');
    expect(r.extra).toBe(7);
    expect(r.dupes).toBe(1);
  });

  it('sets aside hosts already linked before the cap applies', () => {
    const linked = Array.from({ length: HOSTS_PER_START }, (_, i) => `host-${i}`);
    const fresh = ['new-1', 'new-2', 'new-3', 'new-4', 'new-5'];
    const r = parseHosts([...linked.map((h) => h.toUpperCase()), ...fresh].join('\n'), new Set(linked));
    expect(r.hosts).toEqual(fresh);
    expect(r.already).toEqual(linked.map((h) => h.toUpperCase()));
    expect(r.extra).toBe(0);
  });

  it('gives nothing for blank input', () => {
    expect(parseHosts(' \n , ')).toEqual({ hosts: [], already: [], tooLong: 0, dupes: 0, extra: 0 });
  });
});

describe('links read from storage', () => {
  const link = { runId: 'parent01', stepId: 'escalate', title: 'Phishing incident', chainId: 'phishing' };

  it('accepts a well-formed parent and host', () => {
    const r = fixtureRun('child001', 'edr-alert', { parent: link, subject: { kind: 'host', value: ' WS-0142 ' } });
    expect(linkOf(r)).toEqual(link);
    expect(hostOf(r)).toBe('WS-0142');
  });

  it('ignores malformed values that skipped import checks', () => {
    const bad = [
      fixtureRun('a0000001', 'edr-alert', { parent: 'x' as unknown as RunLink }),
      fixtureRun('a0000002', 'edr-alert', { parent: { ...link, runId: 5 } as unknown as RunLink }),
      fixtureRun('a0000003', 'edr-alert', { parent: { ...link, runId: '' } }),
      fixtureRun('a0000004', 'edr-alert', { subject: { kind: 'user', value: 'x' } as unknown as HostSubject }),
      fixtureRun('a0000005', 'edr-alert', { subject: { kind: 'host', value: '   ' } }),
      fixtureRun('a0000006', 'edr-alert', { subject: { kind: 'host', value: 'a'.repeat(HOST_MAX + 1) } }),
    ];
    expect(bad.map(linkOf)).toEqual(bad.map(() => undefined));
    expect(bad.map(hostOf)).toEqual(bad.map(() => undefined));
  });
});

describe('childRuns and childSummary', () => {
  const at = (s: number) => `2026-10-24T10:00:0${s}.000Z`;
  const link = (stepId: string) => ({ runId: 'parent01', stepId, title: 'P', chainId: 'phishing' });
  const runs = Object.fromEntries(
    [
      fixtureRun('parent01', 'phishing'),
      fixtureRun('zzzz0001', 'edr-alert', { parent: link('escalate'), startedAt: at(2), status: 'closed' }),
      fixtureRun('aaaa0002', 'edr-alert', { parent: link('escalate'), startedAt: at(1) }),
      fixtureRun('bbbb0003', 'edr-alert', { parent: link('hunt'), startedAt: at(1) }),
      fixtureRun('cccc0004', 'edr-alert', { parent: { ...link('escalate'), runId: 'other001' } }),
      fixtureRun('22222222', 'edr-alert', { parent: link('escalate'), startedAt: at(3) }),
    ].map((r) => [r.id, r]),
  );

  it('lists runs linked from a run in start order, all steps or one', () => {
    expect(childRuns(runs, 'parent01').map((r) => r.id)).toEqual(['aaaa0002', 'bbbb0003', 'zzzz0001', '22222222']);
    expect(childRuns(runs, 'parent01', 'escalate').map((r) => r.id)).toEqual(['aaaa0002', 'zzzz0001', '22222222']);
    expect(childRuns(runs, 'nobody01')).toEqual([]);
  });

  it('counts open and closed', () => {
    expect(childSummary(childRuns(runs, 'parent01', 'escalate'))).toEqual({ total: 3, open: 2, closed: 1, text: '3 linked runs, 2 open' });
    expect(childSummary([runs.aaaa0002]).text).toBe('1 linked run, 1 open');
  });
});

describe('defaultChildTitle', () => {
  it('names the chain, the host and the parent', () => {
    const parent = fixtureRun('parent01', 'phishing', { title: 'Phishing incident 24 Oct 2026' });
    expect(defaultChildTitle(flowChainById['edr-alert'], 'WS-0142', parent)).toBe('EDR Alert on WS-0142 (Phishing incident 24 Oct 2026)');
  });
});

describe('closeWarning', () => {
  it('covers open steps, open linked runs, or both', () => {
    expect(closeWarning(2, false, 0)).toBe('2 steps are still open.');
    expect(closeWarning(1, true, 0)).toBe('At least 1 step is still open.');
    expect(closeWarning(0, false, 1)).toBe('1 linked run is still open.');
    expect(closeWarning(0, false, 3)).toBe('3 linked runs are still open.');
    expect(closeWarning(2, true, 1)).toBe('At least 2 steps and 1 linked run are still open.');
    expect(closeWarning(0, false, 0)).toBe('');
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd <repo> && npm test`
Expected: the new `runbook.test.ts` tests fail (missing exports).

- [ ] **Step 3: Implement in `src/lib/runbook.ts`**

Before `export interface Run`:
```ts
/** Where a linked run came from. Snapshots, so the link still reads when the parent is gone. */
export interface RunLink {
  runId: string;
  stepId: string;
  title: string;
  chainId: string;
}

/** What a run is about. v1 has hosts only. */
export interface HostSubject {
  kind: 'host';
  value: string;
}
```

At the end of `Run`, after `log`:
```ts
  /** Set on a run started from another run's step. */
  parent?: RunLink;
  /** What this run is about, e.g. the host name. */
  subject?: HostSubject;
```

After `defaultRunTitle`, add the helpers. `parseHosts(text, skip = new Set())` follows these rules, in this order, for each token:
- It splits on `/[\s,]+/` and skips empty tokens.
- A token longer than `HOST_MAX` adds to `tooLong`.
- A case-insensitive repeat of an earlier token adds to `dupes`; the first spelling is kept.
- A token whose lower-cased form is in `skip` goes to `already`. It does not count toward the cap.
- Other tokens go to `hosts` until it holds `HOSTS_PER_START`; the ones after that add to `extra`.

The guards and the sort are written out because the storage-safety rules live in them:
```ts
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shortStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/**
 * A well-formed parent link. Runs loaded from storage skip import checks, so readers go through this.
 * `runId` is any short string, not RUN_ID_RE: an incident import maps a file's invalid ids to new ones.
 */
export function isRunLink(v: unknown): v is RunLink {
  return isRecord(v) && shortStr(v.runId, 64) && shortStr(v.stepId, 64) && typeof v.title === 'string' && shortStr(v.chainId, 64);
}

export function isHostSubject(v: unknown): v is HostSubject {
  return isRecord(v) && v.kind === 'host' && typeof v.value === 'string' && !!v.value.trim() && v.value.trim().length <= HOST_MAX;
}

export const linkOf = (run: Run): RunLink | undefined => (isRunLink(run.parent) ? run.parent : undefined);
export const hostOf = (run: Run): string | undefined => (isHostSubject(run.subject) ? run.subject.value.trim() : undefined);

/** Oldest first. Runs started together get start times a millisecond apart; the id breaks any other tie. */
export const byStart = (a: Run, b: Run) =>
  a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
```

`childRuns` filters `Object.values(runs)` on `l = linkOf(r)`. It keeps a run when:
- `l.runId === id`,
- `r.id !== id`, and
- `stepId` is not given, or `l.stepId === stepId`.

It then sorts with `byStart`.

`childSummary.text` is `` `${total} linked ${total === 1 ? 'run' : 'runs'}, ${open} open` ``. `open` counts the runs with `status === 'active'`.

`defaultChildTitle` returns `` `${chain.title} on ${host} (${parent.title})` ``.

`closeWarning` produces the exact strings in the test, in three cases:
- both: `"{atLeast}{n} step(s) and {m} linked run(s) are still open."`
- steps only: `"{atLeast}{n} step is/steps are still open."`
- linked runs only: `"{m} linked run is/runs are still open."`

`atLeast` is `'At least '` when `estimated` is true and applies to steps only. Nothing open returns `''`.

- [ ] **Step 4: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Tests  20 passed (20)`, and a clean build.

- [ ] **Step 5: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runbook.ts src/lib/runbook.test.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Add run links and the pure helpers for linked runs"
```

---

### Task 5: Move run building into `src/lib/runLinks.ts` (no behaviour change)

**Files:**
- Create: `src/lib/runLinks.ts`
- Modify: `src/store/runbooks.ts`: remove `Draft` (L127), `activate` (L129-135), `normalize` (L191-196) and `freeId` (L202-206); `mutate` (L211-224); `createRun` (L229-262)
- Test: `src/lib/runLinks.test.ts` (new)

**Interfaces:**
- Produces, in `src/lib/runLinks.ts`:
  - `type Chains = Record<string, FlowChain>`
  - `type Draft = { run: Run; chain: FlowChain; at: string; log: (kind: LogKind, text: string, stepId?: string) => void }`
  - `draft(run: Run, chain: FlowChain, at: string): Draft`
  - `activate(d: Draft, stepId: string): void`, moved unchanged
  - `normalize(run: Run, chain: FlowChain): void`, moved unchanged
  - `freeId(runs: Record<string, Run>, gen?: () => string): string`, where `gen` defaults to `newRunId`
  - `interface NewRunFields { title: string; lead: string; severity: Severity; parent?: RunLink; subject?: HostSubject }`
  - `newRun(chain: FlowChain, id: string, at: string, f: NewRunFields): Run`
- Imports for this task: `FlowChain` and `Severity` types from `@/data/types`; `newRunId`, `own` and the types `HostSubject`, `LogKind`, `Run`, `RunLink` from `./runbook`.

- [ ] **Step 1: Write the failing tests**

`src/lib/runLinks.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import { freeId, newRun } from './runLinks';
import { fixtureRun, ids } from './__fixtures__/runs';

const chains = flowChainById;
const edr = chains['edr-alert'];
const T0 = '2026-10-24T10:00:00.000Z';

describe('newRun', () => {
  it('builds the same run createRun always built', () => {
    const r = newRun(edr, 'run00001', T0, { title: 'T', lead: '', severity: 'critical' });
    expect(r.steps.alert).toEqual({ status: 'active', startedAt: T0, actions: [false, false], notes: '' });
    expect(r.steps.tree).toEqual({ status: 'pending', actions: [false, false, false], notes: '' });
    expect(r.log).toEqual([
      { at: T0, kind: 'run', text: 'Incident opened on the EDR Alert runbook' },
      { at: T0, kind: 'step', text: 'Started', stepId: 'alert' },
    ]);
    expect('parent' in r || 'subject' in r).toBe(false);
  });

  it('opens a linked run with a "Linked from" entry', () => {
    const parent = { runId: 'parent01', stepId: 'escalate', title: 'Phishing incident', chainId: 'phishing' };
    const r = newRun(edr, 'run00001', T0, { title: 'T', lead: '', severity: 'critical', parent, subject: { kind: 'host', value: 'WS-0142' } });
    expect(r.log[0]).toEqual({ at: T0, kind: 'run', text: 'Linked from Phishing incident' });
    expect(r.parent).toEqual(parent);
    expect(r.subject).toEqual({ kind: 'host', value: 'WS-0142' });
  });
});

describe('freeId', () => {
  it('skips ids already used', () => {
    expect(freeId({ aaaa1111: fixtureRun('aaaa1111', 'phishing') }, ids('aaaa1111', 'bbbb2222'))).toBe('bbbb2222');
  });
});
```
Later tasks add `const phishing = chains['phishing'];`, which is why `chains` is a separate const.

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd <repo> && npm test`
Expected: `runLinks.test.ts` fails: `Failed to resolve import "./runLinks"`.

- [ ] **Step 3: Implement**

Create `src/lib/runLinks.ts` with a header comment:
```ts
/**
 * Pure run edits that the runbooks store wraps in one `set()` each: building runs, starting
 * linked runs, and the writes that touch more than one run. Chains come in as a parameter.
 */
```

Move `activate` and `normalize` verbatim from the store and export them.

`draft` builds the logger the store's `mutate` builds inline today:
```ts
export function draft(run: Run, chain: FlowChain, at: string): Draft {
  return { run, chain, at, log: (kind, text, stepId) => run.log.push({ at, kind, text, ...(stepId ? { stepId } : {}) }) };
}
```

`freeId` is today's version with `gen` in place of `newRunId`.

`newRun` builds exactly the run `createRun` builds today (store L237-255): first step active with `startedAt: at`, every other step pending, `actions` all false, `notes: ''`, `choices: {}`. Its log is:
- only when `f.parent` is set: `{ at, kind: 'run' as const, text: \`Linked from ${f.parent.title}\` }`
- `{ at, kind: 'run', text: \`Incident opened on the ${chain.title} runbook\` }`
- `{ at, kind: 'step', text: 'Started', stepId: chain.steps[0].id }`

The object ends with `...(f.parent ? { parent: f.parent } : {}), ...(f.subject ? { subject: f.subject } : {})`, so an ordinary run has neither key.

In `src/store/runbooks.ts`:
- Delete `Draft`, `activate`, `normalize` and `freeId`.
- The import block above the `export type` line becomes the six lines below. Only the `@/data` and `@/lib/runbook` imports change, and the `@/lib/runLinks` import is new; the zustand and `@/lib/hues` imports stay as they are.
```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { flowChainById, type Severity } from '@/data';
import { defaultRunTitle, isFinished, own, RUN_ID_RE, runPath, successors, type Run, type StepRecord, type StepStatus } from '@/lib/runbook';
import { activate, draft, freeId, newRun, normalize, type Draft } from '@/lib/runLinks';
import { severityMeta } from '@/lib/hues';
```
- In `mutate`, replace the two lines that build `at` and call `fn({...})` with `fn(draft(run, chain, new Date().toISOString()));`.
- In `createRun`'s `set()`, keep `runs`/`newId`, then:
```ts
            const run = newRun(chain, newId, new Date().toISOString(), {
              title: title?.trim() || defaultRunTitle(chain),
              lead: lead?.trim() ?? '',
              severity: severity ?? chain.severity,
            });
```

- [ ] **Step 4: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Test Files  4 passed (4)`, `Tests  23 passed (23)`, and a clean build. `noUnusedLocals` catches any import left behind.

- [ ] **Step 5: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runLinks.ts src/lib/runLinks.test.ts src/store/runbooks.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Move run building out of the runbooks store into src/lib"
```

---

### Task 6: Start linked runs

**Files:**
- Modify: `src/lib/runLinks.ts`, `src/store/runbooks.ts` (`RunbooksState`, `mutate`, `toggleAction`, the new action)
- Test: `src/lib/runLinks.test.ts`

**Interfaces:**
- Consumes: Task 4 `childRuns`, `defaultChildTitle`, `HOST_MAX`, `HOSTS_PER_START`, `hostOf`; `runPath`.
- Produces, in `runLinks.ts`:
  - `linkName(run: Run, chains: Chains): string`, giving "EDR Alert on WS-0142" for a host run, else the run's title
  - `buildLinkedRuns(runs, chains, parentId: string, stepId: string, hosts: string[], at: string, gen?: () => string): { runs: Record<string, Run>; started: string[] } | null`
  - `spawnTickLocked(runs: Record<string, Run>, runId: string, step: FlowStep, index: number): boolean`
- Produces, in the store:
  - `startLinkedRuns(parentId: string, stepId: string, hosts: string[]) => string[]`
  - `type RunLink` re-exported
  - `toggleAction` refuses to untick a locked spawn action

- [ ] **Step 1: Write the failing tests**

In `src/lib/runLinks.test.ts`:
- Extend the imports: `childRuns, HOSTS_PER_START, type Run` from `./runbook`, and `buildLinkedRuns, spawnTickLocked` from `./runLinks`.
- Add `const phishing = chains['phishing'];`.

Then add:
```ts
/** An open phishing run that took "Execution found", so escalate is on the path and in progress. */
function parentRun(over: Partial<Run> = {}): Run {
  const run = newRun(phishing, 'parent01', '2026-10-24T09:00:00.000Z', { title: 'Phishing incident', lead: 'on-call', severity: 'high' });
  for (const id of ['received', 'gateway', 'triage']) run.steps[id].status = 'done';
  run.steps.escalate = { status: 'active', startedAt: '2026-10-24T09:30:00.000Z', actions: [false, false, false], notes: '' };
  run.choices = { triage: 'escalate' };
  return { ...run, ...over };
}
const start = (runs: Record<string, Run>, hosts: string[], gen = ids('child001', 'child002', 'child003')) =>
  buildLinkedRuns(runs, chains, 'parent01', 'escalate', hosts, T0, gen);

describe('buildLinkedRuns', () => {
  it('starts one EDR Alert run per host, linked to the parent step', () => {
    const out = start({ parent01: parentRun() }, ['WS-0142', 'WS-0187'])!;
    expect(out.started).toEqual(['child001', 'child002']);
    const c = out.runs.child001;
    expect(c.chainId).toBe('edr-alert');
    expect(c.title).toBe('EDR Alert on WS-0142 (Phishing incident)');
    expect(c.lead).toBe('on-call');
    expect(c.severity).toBe('critical');
    expect(c.parent).toEqual({ runId: 'parent01', stepId: 'escalate', title: 'Phishing incident', chainId: 'phishing' });
    expect(c.subject).toEqual({ kind: 'host', value: 'WS-0142' });
    expect(c.log[0].text).toBe('Linked from Phishing incident');
    expect(out.runs.child002.startedAt > c.startedAt).toBe(true);
  });

  it('ticks the spawn action once and logs a link entry per run on the step', () => {
    const out = start({ parent01: parentRun() }, ['WS-0142', 'WS-0187'])!;
    const p = out.runs.parent01;
    expect(p.steps.escalate.actions).toEqual([false, false, true]);
    expect(p.log.slice(-3)).toEqual([
      { at: T0, kind: 'action', text: 'Checked: Start EDR triage on affected hosts', stepId: 'escalate' },
      { at: T0, kind: 'link', text: 'Started linked run: EDR Alert on WS-0142', stepId: 'escalate' },
      { at: T0, kind: 'link', text: 'Started linked run: EDR Alert on WS-0187', stepId: 'escalate' },
    ]);
    const again = start(out.runs, ['WS-0200'], ids('child003'))!;
    expect(again.runs.parent01.log.filter((e) => e.kind === 'action')).toHaveLength(1);
  });

  it('activates a pending spawn step', () => {
    const p = parentRun();
    p.steps.escalate = { status: 'pending', actions: [false, false, false], notes: '' };
    const out = start({ parent01: p }, ['WS-0142'])!;
    expect(out.runs.parent01.steps.escalate).toMatchObject({ status: 'active', startedAt: T0 });
    expect(out.runs.parent01.log.find((e) => e.kind === 'step' && e.at === T0)).toEqual({ at: T0, kind: 'step', text: 'Started', stepId: 'escalate' });
  });

  it('skips hosts already linked from the step, trimmed and case-insensitive', () => {
    const first = start({ parent01: parentRun() }, ['WS-0142'])!;
    const out = start(first.runs, [' ws-0142 ', 'WS-0187', 'ws-0187'], ids('child002', 'child003'))!;
    expect(out.started).toEqual(['child002']);
    expect(childRuns(out.runs, 'parent01', 'escalate')).toHaveLength(2);
    expect(start(out.runs, ['WS-0142', 'WS-0187'], ids('child009'))).toBeNull();
  });

  it('gives a batch distinct ids even when the generator repeats', () => {
    const out = start({ parent01: parentRun() }, ['a', 'b'], ids('dupe0001', 'dupe0001', 'next0002'))!;
    expect(out.started).toEqual(['dupe0001', 'next0002']);
  });

  it('refuses a closed parent, a step off the path, a step without a spawn point, or a missing parent', () => {
    expect(start({ parent01: parentRun({ status: 'closed' }) }, ['WS-0142'])).toBeNull();
    expect(start({ parent01: parentRun({ choices: { triage: 'block' } }) }, ['WS-0142'])).toBeNull();
    expect(buildLinkedRuns({ parent01: parentRun() }, chains, 'parent01', 'block', ['WS-0142'], T0)).toBeNull();
    expect(start({}, ['WS-0142'])).toBeNull();
  });

  it('starts at most HOSTS_PER_START new hosts at a time, the first ones given', () => {
    const many = Array.from({ length: HOSTS_PER_START + 1 }, (_, i) => `h-${i}`);
    const out = buildLinkedRuns({ parent01: parentRun() }, chains, 'parent01', 'escalate', many, T0)!;
    expect(out.started).toHaveLength(HOSTS_PER_START);
    expect(out.runs[out.started[0]].subject?.value).toBe('h-0');
    expect(Object.values(out.runs).some((r) => r.subject?.value === `h-${HOSTS_PER_START}`)).toBe(false);
  });

  it('locks the spawn tick while linked runs exist', () => {
    const step = phishing.steps.find((s) => s.id === 'escalate')!;
    const runs = start({ parent01: parentRun() }, ['WS-0142'])!.runs;
    expect(spawnTickLocked(runs, 'parent01', step, 2)).toBe(true);
    expect(spawnTickLocked(runs, 'parent01', step, 0)).toBe(false);
    expect(spawnTickLocked({ parent01: parentRun() }, 'parent01', step, 2)).toBe(false);
  });

  it('does not change the runs it was given', () => {
    const runs = { parent01: parentRun() };
    const before = structuredClone(runs);
    start(runs, ['WS-0142']);
    expect(runs).toEqual(before);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd <repo> && npm test`
Expected: the `buildLinkedRuns` tests fail (`buildLinkedRuns is not a function`, or a missing export).

- [ ] **Step 3: Implement in `src/lib/runLinks.ts`**

Change the imports:
- add `FlowStep` to the `@/data/types` type import;
- add `childRuns, defaultChildTitle, HOST_MAX, HOSTS_PER_START, hostOf, runPath` to the `./runbook` import.

```ts
/** "EDR Alert on WS-0142" for a host run, else the run's title. */
export const linkName = (run: Run, chains: Chains) => {
  const host = hostOf(run);
  return host ? `${own(chains, run.chainId)?.title ?? run.chainId} on ${host}` : run.title;
};

/**
 * Start one linked run per new host from a spawn step of an open parent, in one edit. Returns null
 * when nothing can start: parent missing or closed, no spawn point, step off the path, or no new
 * host. Hosts already linked from the step are dropped (trimmed, case-insensitive), and only the
 * first HOSTS_PER_START new hosts start.
 */
export function buildLinkedRuns(
  runs: Record<string, Run>,
  chains: Chains,
  parentId: string,
  stepId: string,
  hosts: string[],
  at: string,
  gen: () => string = newRunId,
): { runs: Record<string, Run>; started: string[] } | null {
  const parent = own(runs, parentId);
  const chain = parent && own(chains, parent.chainId);
  if (!parent || !chain || parent.status !== 'active') return null;
  const step = chain.steps.find((s) => s.id === stepId);
  const spawns = step?.spawns;
  const childChain = spawns && own(chains, spawns.chainId);
  if (!step || !spawns || !childChain) return null;
  if (!runPath(chain, parent.choices).steps.some((s) => s.id === stepId)) return null;

  const linked = new Set(childRuns(runs, parentId, stepId).map((c) => hostOf(c)?.toLowerCase()));
  const fresh: string[] = [];
  for (const h of hosts) {
    if (fresh.length === HOSTS_PER_START) break;
    const host = h.trim();
    const key = host.toLowerCase();
    if (!host || host.length > HOST_MAX || linked.has(key)) continue;
    linked.add(key);
    fresh.push(host);
  }
  if (fresh.length === 0) return null;

  const p: Run = structuredClone(parent);
  normalize(p, chain);
  const d = draft(p, chain, at);
  activate(d, stepId);
  const rec = p.steps[stepId];
  if (!rec.actions[spawns.action]) {
    rec.actions[spawns.action] = true;
    d.log('action', `Checked: ${step.actions[spawns.action]}`, stepId);
  }

  const next = { ...runs };
  const link: RunLink = { runId: p.id, stepId, title: p.title, chainId: p.chainId };
  const started: string[] = [];
  fresh.forEach((host, i) => {
    const id = freeId(next, gen);
    // A millisecond apart, so start order survives every sort by startedAt.
    const childAt = new Date(Date.parse(at) + i).toISOString();
    next[id] = newRun(childChain, id, childAt, {
      title: defaultChildTitle(childChain, host, p),
      lead: p.lead,
      severity: childChain.severity,
      parent: link,
      subject: { kind: 'host', value: host },
    });
    d.log('link', `Started linked run: ${childChain.title} on ${host}`, stepId);
    started.push(id);
  });
  next[p.id] = p;
  return { runs: next, started };
}

/** The spawn action stays ticked while runs linked from the step exist: the tick keeps the step through a branch change. */
export const spawnTickLocked = (runs: Record<string, Run>, runId: string, step: FlowStep, index: number) =>
  step.spawns?.action === index && childRuns(runs, runId, step.id).length > 0;
```

The store check is "parent open and step on the path", not "step active". Spec decision 1 lets the analyst add hosts at any time while the step is on the path and the run is open, including after escalate is done. The UI decides when to show the block.

- [ ] **Step 4: Wire the store**

In `src/store/runbooks.ts`:
1. Imports:
   - add `buildLinkedRuns, spawnTickLocked` to the `@/lib/runLinks` import;
   - re-export `RunLink`: `export type { LogEntry, LogKind, Run, RunLink, StepRecord, StepStatus } from '@/lib/runbook';`.
2. In `RunbooksState`, after `importRun`:
```ts
  /**
   * One linked run per new host from a spawn step of an open run, in one write. Returns the new
   * runs' ids; empty when nothing started (closed run, step off the path, hosts already linked).
   */
  startLinkedRuns: (parentId: string, stepId: string, hosts: string[]) => string[];
```
3. `mutate`'s callback also receives the latest runs. Its signature becomes `fn: (d: Draft, runs: Record<string, Run>) => void`, and the call is `fn(draft(run, chain, new Date().toISOString()), runs);`.
4. Add this helper after `mutate`. Every multi-run write uses it.
```ts
      /** A write that may touch several runs. `fn` returns its input unchanged when there is nothing to do. */
      const write = (fn: (runs: Record<string, Run>) => Record<string, Run>) =>
        set((state) => {
          const next = fn(latestRuns(state.runs));
          return next === state.runs ? state : { runs: next };
        });
```
5. In `toggleAction`:
   - take `(d, runs)`;
   - look up `step` once (`const step = d.chain.steps.find((x) => x.id === stepId); const text = step?.actions[index];`);
   - after the existing `if (!s || text === undefined) return;`, add:
```ts
            // The tick records that linked runs started here; it keeps the step through a branch change.
            if (s.actions[index] && step && spawnTickLocked(runs, runId, step, index)) return;
```
6. Add the action:
```ts
        startLinkedRuns: (parentId, stepId, hosts) => {
          let started: string[] = [];
          write((runs) => {
            const out = buildLinkedRuns(runs, flowChainById, parentId, stepId, hosts, new Date().toISOString());
            started = out?.started ?? [];
            return out?.runs ?? runs;
          });
          return started;
        },
```

- [ ] **Step 5: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Tests  32 passed (32)`, and a clean build.

- [ ] **Step 6: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runLinks.ts src/lib/runLinks.test.ts src/store/runbooks.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Start one linked EDR Alert run per host from a spawn step"
```

---

### Task 7: Closing, reopening and deleting a child tell its parent

**Files:**
- Modify: `src/lib/runLinks.ts`, `src/store/runbooks.ts` (`closeRun` L364-369, `reopenRun` L371-381, `deleteRun` L383-388)
- Test: `src/lib/runLinks.test.ts`

**Interfaces:**
- Produces, in `runLinks.ts`. Each returns the same object when there is nothing to do:
  - `closeRunIn(runs, chains, runId: string, at: string): Record<string, Run>`
  - `reopenRunIn(runs, chains, runId: string, at: string): Record<string, Run>`
  - `deleteRunIn(runs, chains, runId: string, at: string): Record<string, Run>`

- [ ] **Step 1: Write the failing tests**

Add `closeRunIn, deleteRunIn, reopenRunIn` to the import and `const T1 = '2026-10-24T11:00:00.000Z';`. Then:
```ts
describe('closeRunIn, reopenRunIn and deleteRunIn', () => {
  const tree = () => start({ parent01: parentRun() }, ['WS-0142', 'WS-0187'])!.runs;
  const linkTexts = (runs: Record<string, Run>) => runs.parent01.log.filter((e) => e.kind === 'link' && e.at === T1).map((e) => e.text);

  it('closing a child tells the open parent, at the spawn step', () => {
    const runs = closeRunIn(tree(), chains, 'child001', T1);
    expect(runs.child001).toMatchObject({ status: 'closed', closedAt: T1 });
    expect(runs.parent01.log.at(-1)).toEqual({ at: T1, kind: 'link', text: 'Linked run closed: EDR Alert on WS-0142', stepId: 'escalate' });
  });

  it('reopening and deleting a child tell the parent too', () => {
    let runs = closeRunIn(tree(), chains, 'child001', T1);
    runs = reopenRunIn(runs, chains, 'child001', T1);
    runs = deleteRunIn(runs, chains, 'child002', T1);
    expect(runs.child001.status).toBe('active');
    expect(runs.child002).toBeUndefined();
    expect(linkTexts(runs)).toEqual([
      'Linked run closed: EDR Alert on WS-0142',
      'Linked run reopened: EDR Alert on WS-0142',
      'Linked run deleted: EDR Alert on WS-0187',
    ]);
  });

  it('leaves a closed parent alone', () => {
    const runs = closeRunIn(tree(), chains, 'parent01', T1);
    const after = closeRunIn(runs, chains, 'child001', T1);
    expect(after.parent01).toBe(runs.parent01);
  });

  it('returns the same object when there is nothing to do', () => {
    const runs = tree();
    expect(reopenRunIn(runs, chains, 'child001', T1)).toBe(runs);
    expect(closeRunIn(closeRunIn(runs, chains, 'child001', T1), chains, 'child001', T1).child001.log.filter((e) => e.text === 'Incident closed')).toHaveLength(1);
    expect(deleteRunIn(runs, chains, 'missing1', T1)).toBe(runs);
  });

  it('deleting a parent keeps its children', () => {
    const runs = deleteRunIn(tree(), chains, 'parent01', T1);
    expect(Object.keys(runs).sort()).toEqual(['child001', 'child002']);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd <repo> && npm test`
Expected: the new tests fail because the functions are missing.

- [ ] **Step 3: Implement**

Add `linkOf` to the `./runbook` import of `runLinks.ts`.

This private helper holds every rule from the spec:
```ts
/**
 * Add a `link` entry about `child` to its parent: only when the parent is here, open, and has
 * the step. The entry always carries the step id, which older releases need to render it.
 */
function noteParent(runs: Record<string, Run>, chains: Chains, child: Run, what: string, at: string): Record<string, Run> {
  const link = linkOf(child);
  const parent = link && own(runs, link.runId);
  const chain = parent && own(chains, parent.chainId);
  if (!link || !parent || !chain || parent.status !== 'active' || !chain.steps.some((s) => s.id === link.stepId)) return runs;
  const p: Run = structuredClone(parent);
  p.log.push({ at, kind: 'link', text: `${what}: ${linkName(child, chains)}`, stepId: link.stepId });
  return { ...runs, [p.id]: p };
}
```

`closeRunIn`:
1. `cur = own(runs, runId)`, `chain = own(chains, cur.chainId)`.
2. Return `runs` if either is missing or `cur.status === 'closed'`.
3. `structuredClone` + `normalize`, set `status = 'closed'` and `closedAt = at`, and run `draft(run, chain, at).log('run', 'Incident closed')`.
4. Return `noteParent({ ...runs, [runId]: run }, chains, run, 'Linked run closed', at)`.

`reopenRunIn` mirrors it:
- it returns `runs` unless `status === 'closed'`;
- it sets `status = 'active'` and deletes `closedAt`;
- it logs `'Incident reopened'`;
- its parent entry text is `'Linked run reopened'`.

These keep today's entries exactly.

`deleteRunIn`:
1. Return `runs` if the run is missing.
2. Copy the map and delete the run.
3. Return `noteParent(next, chains, cur, 'Linked run deleted', at)`.

- [ ] **Step 4: Wire the store**

Add `closeRunIn, deleteRunIn, reopenRunIn` to the store's `@/lib/runLinks` import, and replace the three actions:
```ts
        closeRun: (runId) => write((runs) => closeRunIn(runs, flowChainById, runId, new Date().toISOString())),

        reopenRun: (runId) => write((runs) => reopenRunIn(runs, flowChainById, runId, new Date().toISOString())),

        deleteRun: (runId) => write((runs) => deleteRunIn(runs, flowChainById, runId, new Date().toISOString())),
```
A no-op now writes nothing; the old `reopenRun` on an active run wrote an unchanged clone.

- [ ] **Step 5: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Tests  37 passed (37)`, and a clean build.

- [ ] **Step 6: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runLinks.ts src/lib/runLinks.test.ts src/store/runbooks.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Log closing, reopening and deleting a linked run on its open parent"
```

---

### Task 8: Import several runs in one write, with links following new ids

**Files:**
- Modify: `src/lib/runLinks.ts`, `src/store/runbooks.ts` (`ImportIdReason` L33, `importRun` L390-401, `RunbooksState`)
- Test: `src/lib/runLinks.test.ts`

**Interfaces:**
- Produces:
  - `type ImportIdReason = 'kept' | 'duplicate' | 'invalid'`, moved to `runLinks.ts` and re-exported by the store
  - `assignImportIds(existing: Record<string, Run>, incoming: Run[], gen?: () => string): { runs: Record<string, Run>; results: { id: string; reason: ImportIdReason }[] }`
- Produces, in the store:
  - `importRuns(runs: Run[]) => { id: string; reason: ImportIdReason }[]`
  - `importRun(run)`, which now returns `get().importRuns([run])[0]`

- [ ] **Step 1: Write the failing tests**

Add `assignImportIds` to the import, then:
```ts
describe('assignImportIds', () => {
  const child = (id: string, parentId: string) =>
    fixtureRun(id, 'edr-alert', { parent: { runId: parentId, stepId: 'escalate', title: 'P', chainId: 'phishing' } });

  it('keeps free ids', () => {
    const out = assignImportIds({}, [fixtureRun('parent01', 'phishing'), child('child001', 'parent01')]);
    expect(out.results).toEqual([
      { id: 'parent01', reason: 'kept' },
      { id: 'child001', reason: 'kept' },
    ]);
    expect(out.runs.child001.parent?.runId).toBe('parent01');
  });

  it('rewrites links when the parent id is taken', () => {
    const existing = { parent01: fixtureRun('parent01', 'phishing') };
    const out = assignImportIds(existing, [fixtureRun('parent01', 'phishing'), child('child001', 'parent01')], ids('new00001'));
    expect(out.results[0]).toEqual({ id: 'new00001', reason: 'duplicate' });
    expect(out.runs.child001.parent?.runId).toBe('new00001');
    expect(out.runs.parent01).toBe(existing.parent01);
  });

  it('rewrites links when the parent id is invalid', () => {
    const out = assignImportIds({}, [fixtureRun('Not Valid', 'phishing'), child('child001', 'Not Valid')], ids('new00001'));
    expect(out.results[0]).toEqual({ id: 'new00001', reason: 'invalid' });
    expect(out.runs.child001.parent?.runId).toBe('new00001');
  });

  it('treats a repeated id in one file as a duplicate and links to the first run with it', () => {
    const out = assignImportIds({}, [fixtureRun('parent01', 'phishing'), fixtureRun('parent01', 'phishing'), child('child001', 'parent01')], ids('new00001'));
    expect(out.results.map((r) => r.reason)).toEqual(['kept', 'duplicate', 'kept']);
    expect(out.runs.child001.parent?.runId).toBe('parent01');
  });

  it('re-importing into the browser that exported it makes a new copy linked to itself', () => {
    const existing = start({ parent01: parentRun() }, ['WS-0142', 'WS-0187'])!.runs;
    // What parseImport gives back for that browser's own incident file: the same runs, every id taken.
    const file = structuredClone([existing.parent01, ...childRuns(existing, 'parent01')]);
    const out = assignImportIds(existing, file, ids('new00001', 'new00002', 'new00003'));
    expect(out.results).toEqual([
      { id: 'new00001', reason: 'duplicate' },
      { id: 'new00002', reason: 'duplicate' },
      { id: 'new00003', reason: 'duplicate' },
    ]);
    expect(childRuns(out.runs, 'new00001').map((r) => r.id)).toEqual(['new00002', 'new00003']);
    expect(childRuns(out.runs, 'parent01').map((r) => r.id)).toEqual(['child001', 'child002']);
    expect(out.runs.child001).toBe(existing.child001);
  });

  it('leaves links to runs outside the file alone', () => {
    const out = assignImportIds({}, [child('child001', 'elsewhere')]);
    expect(out.runs.child001.parent?.runId).toBe('elsewhere');
  });

  it('never hands out a new id that a later run in the file uses', () => {
    const existing = { child001: fixtureRun('child001', 'edr-alert') };
    const out = assignImportIds(existing, [child('child001', 'parent01'), fixtureRun('next0002', 'phishing')], ids('next0002', 'free0003'));
    expect(out.results).toEqual([
      { id: 'free0003', reason: 'duplicate' },
      { id: 'next0002', reason: 'kept' },
    ]);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd <repo> && npm test`
Expected: the new tests fail because `assignImportIds` is missing.

- [ ] **Step 3: Implement in `runLinks.ts`**

Add `RUN_ID_RE` to the `./runbook` import.

The map key is the raw incoming id, including an invalid one. That way a child whose parent had a bad id still follows it.
```ts
/** Why an imported run kept its ID or got a new one. */
export type ImportIdReason = 'kept' | 'duplicate' | 'invalid';

/**
 * Add imported runs. A run keeps its file id unless the id is invalid or already used (here or
 * earlier in the same file), and a new id never takes one the file uses. Links between runs of the
 * same file follow the new ids; when a file repeats an id, links point at the first run with it.
 * Links to runs outside the file stay as they are.
 */
export function assignImportIds(
  existing: Record<string, Run>,
  incoming: Run[],
  gen: () => string = newRunId,
): { runs: Record<string, Run>; results: { id: string; reason: ImportIdReason }[] } {
  const next = { ...existing };
  const moved = new Map<string, string>();
  // A new id never takes one that a later run in the same file still needs.
  const inFile = new Set(incoming.map((r) => r.id));
  const fresh = () => freeId(next, () => {
    let id = gen();
    while (inFile.has(id)) id = gen();
    return id;
  });
  const results = incoming.map((r) => {
    const valid = RUN_ID_RE.test(r.id);
    const taken = valid && own(next, r.id) !== undefined;
    const id = valid && !taken ? r.id : fresh();
    if (!moved.has(r.id)) moved.set(r.id, id);
    next[id] = { ...r, id };
    return { id, reason: (!valid ? 'invalid' : taken ? 'duplicate' : 'kept') as ImportIdReason };
  });
  for (const { id } of results) {
    const run = next[id];
    const link = linkOf(run);
    const to = link && moved.get(link.runId);
    if (link && to && to !== link.runId) next[id] = { ...run, parent: { ...link, runId: to } };
  }
  return { runs: next, results };
}
```

- [ ] **Step 4: Wire the store**

1. Delete `export type ImportIdReason` from the store.
2. Add `assignImportIds, type ImportIdReason` to the `@/lib/runLinks` import, and add `export type { ImportIdReason } from '@/lib/runLinks';`.
3. Drop `RUN_ID_RE` from the `@/lib/runbook` import.
4. The persist creator becomes `(set, get) => {`. Using `get` avoids the circular type error that `useRunbooks.getState()` inside the initializer causes.
5. In `RunbooksState`, after `importRun`:
```ts
  /** Adds the runs of an incident file in one write; links inside the file follow any new ids. */
  importRuns: (runs: Run[]) => { id: string; reason: ImportIdReason }[];
```
6. Replace `importRun` with:
```ts
        importRun: (incoming) => get().importRuns([incoming])[0],

        importRuns: (incoming) => {
          let results: { id: string; reason: ImportIdReason }[] = [];
          write((runs) => {
            const out = assignImportIds(runs, incoming);
            results = out.results;
            return out.runs;
          });
          return results;
        },
```

- [ ] **Step 5: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Tests  44 passed (44)`, and a clean build.

- [ ] **Step 6: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runLinks.ts src/lib/runLinks.test.ts src/store/runbooks.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Import several runs in one write and keep links between them"
```

---

### Task 9: JSON: parent and subject, incident export, and import of either format

**Files:**
- Modify: `src/lib/runbookExport.ts`: constants L29; `runToJson` L114; `runFileName` L125; `downloadRunJson` L141; `parseRunJson` L186-271
- Test: `src/lib/runbookExport.test.ts`

**Interfaces:**
- Produces:
  - `RUNBOOK_TREE_FORMAT = 'blue-team-mapper/runbook-tree'`
  - `runTreeToJson(root: Run, children: Run[]): string`, giving `{ format, version: 1, exportedAt, rootId, runs: [root, ...children] }`
  - `type ImportFile = { kind: 'run'; run: Run } | { kind: 'tree'; rootId: string; runs: Run[] }`
  - `parseImport(text: string): ImportFile`. It is all or nothing: one bad run rejects the file. `rootId` falls back to the first run's id.
  - `parseRunJson(text)`, unchanged for callers, which now keeps a well-formed `parent` and `subject`
  - `runFileName(run, ext, kind: 'runbook' | 'incident' = 'runbook')`
  - `downloadIncidentJson(root: Run, children: Run[]): void`

- [ ] **Step 1: Write the failing tests**

Extend the imports of `runbookExport.test.ts`:
- replace `import type { Run } from './runbook';` with `import { childRuns, HOST_MAX, type Run } from './runbook';` (a type-only import cannot take a value);
- `buildLinkedRuns, newRun` from `./runLinks`;
- `parseImport, RUNBOOK_TREE_FORMAT, runFileName, runToJson, runTreeToJson` from `./runbookExport`;
- `fixtureRun, ids` from `./__fixtures__/runs`.

Add `const chains = flowChainById;` and change `phishing` to `chains['phishing']`. Then add:
```ts
/** A phishing parent on "Execution found" with linked runs for two hosts. */
function tree() {
  const parent = newRun(phishing, 'parent01', '2026-10-24T09:00:00.000Z', { title: 'Phishing incident', lead: 'on-call', severity: 'high' });
  parent.choices = { triage: 'escalate' };
  for (const id of ['received', 'gateway', 'triage']) parent.steps[id].status = 'done';
  parent.steps.escalate.status = 'active';
  const out = buildLinkedRuns({ parent01: parent }, chains, 'parent01', 'escalate', ['WS-0142', 'WS-0187'], '2026-10-24T10:00:00.000Z', ids('child001', 'child002'))!;
  return out.runs;
}
```

Add this case inside the existing `runs saved by the current release` describe:
```ts
  it('drops a malformed parent or subject on import', () => {
    const run = parseRunJson(exportOf({ ...v1Run, parent: { runId: 5 }, subject: { kind: 'user', value: 'x' } }));
    expect('parent' in run || 'subject' in run).toBe(false);
    const long = parseRunJson(exportOf({ ...v1Run, subject: { kind: 'host', value: 'a'.repeat(HOST_MAX + 1) } }));
    expect('subject' in long).toBe(false);
  });
```

And these new describes:
```ts
describe('parent and subject in single-run JSON', () => {
  it('round-trips a linked run', () => {
    const child = tree().child001;
    const back = parseRunJson(runToJson(child));
    expect(back.parent).toEqual({ runId: 'parent01', stepId: 'escalate', title: 'Phishing incident', chainId: 'phishing' });
    expect(back.subject).toEqual({ kind: 'host', value: 'WS-0142' });
    expect(back.log.map((e) => e.kind)).toEqual(child.log.map((e) => e.kind));
  });

  it('keeps link entries on import', () => {
    const parent = tree().parent01;
    const links = parseRunJson(runToJson(parent)).log.filter((e) => e.kind === 'link');
    expect(links.map((e) => e.stepId)).toEqual(['escalate', 'escalate']);
  });
});

describe('incident JSON', () => {
  it('exports the parent first and imports as a tree', () => {
    const runs = tree();
    const text = runTreeToJson(runs.parent01, childRuns(runs, 'parent01'));
    const file = JSON.parse(text);
    expect(file).toMatchObject({ format: RUNBOOK_TREE_FORMAT, version: 1, rootId: 'parent01' });
    const parsed = parseImport(text);
    expect(parsed.kind).toBe('tree');
    if (parsed.kind !== 'tree') return;
    expect(parsed.rootId).toBe('parent01');
    expect(parsed.runs.map((r) => r.id)).toEqual(['parent01', 'child001', 'child002']);
    expect(parsed.runs[1].parent?.runId).toBe('parent01');
  });

  it('still reads a single-run export', () => {
    const parsed = parseImport(exportOf(v1Run));
    expect(parsed).toEqual({ kind: 'run', run: v1Run });
  });

  it('rejects the whole file when one run cannot be read', () => {
    const bad = JSON.stringify({ format: RUNBOOK_TREE_FORMAT, version: 1, rootId: 'parent01', runs: [v1Run, { ...v1Run, chainId: 'gone' }] });
    expect(() => parseImport(bad)).toThrow('Run 2 of 2 in that incident file: That runbook uses the chain "gone"');
    expect(() => parseImport(JSON.stringify({ format: RUNBOOK_TREE_FORMAT, runs: [] }))).toThrow('That incident file has no runs in it.');
  });

  it('falls back to the first run when rootId is missing or unknown', () => {
    const text = JSON.stringify({ format: RUNBOOK_TREE_FORMAT, version: 1, rootId: 'nope', runs: [v1Run] });
    const parsed = parseImport(text);
    expect(parsed.kind === 'tree' && parsed.rootId).toBe('k7m2p9qa');
  });

  it('names incident files apart from single runs', () => {
    const r = fixtureRun('parent01', 'phishing', { title: 'Phishing incident', startedAt: '2026-10-24T09:00:00.000Z' });
    expect(runFileName(r, 'json', 'incident')).toBe('incident-phishing-incident-2026-10-24.json');
    expect(runFileName(r, 'md')).toBe('runbook-phishing-incident-2026-10-24.md');
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd <repo> && npm test`
Expected:
- The other new tests fail on missing exports, and `parent`/`subject` are dropped by the round trip.
- Two pass already and are pins, not proof of this task:
  - "drops a malformed parent or subject" passes because the current parser drops every unknown field.
  - "keeps link entries on import" passes because Task 3 added `link` to `logKindLabel`, which feeds the parser's `kinds`.

- [ ] **Step 3: Implement in `runbookExport.ts`**

1. Add `isHostSubject, isRunLink` to the `./runbook` import.
2. After `RUNBOOK_FORMAT`:
```ts
/** One incident: a run and the runs linked from it. */
export const RUNBOOK_TREE_FORMAT = 'blue-team-mapper/runbook-tree';
```
3. After `runToJson`:
```ts
/** "Download incident JSON": the parent first, then its linked runs. */
export function runTreeToJson(root: Run, children: Run[]): string {
  return JSON.stringify(
    { format: RUNBOOK_TREE_FORMAT, version: 1, exportedAt: new Date().toISOString(), rootId: root.id, runs: [root, ...children] },
    null,
    2,
  );
}
```
4. Change `runFileName` to take `kind: 'runbook' | 'incident' = 'runbook'` and produce `` `${kind}-${slug(run.title)}-${run.startedAt.slice(0, 10)}.${ext}` ``.
5. After `downloadRunJson`:
```ts
/** "Download incident JSON": a parent and its linked runs, for import in one go. */
export const downloadIncidentJson = (root: Run, children: Run[]) =>
  downloadText(runFileName(root, 'json', 'incident'), runTreeToJson(root, children), 'application/json');
```
6. Split the parser:
   - `readJson(text): unknown` takes today's try/catch and message unchanged.
   - `parseRunJson(text)` becomes:
```ts
export function parseRunJson(text: string): Run {
  const data = readJson(text);
  return parseRunObject(isObj(data) && isObj(data.run) ? data.run : data);
}
```
   - The private `parseRunObject(raw: unknown): Run` holds today's body from the `if (!isObj(raw) || ...)` check on. Its literal gains:
```ts
  const p = raw.parent;
  const parent = isRunLink(p) ? { runId: p.runId, stepId: p.stepId, title: p.title, chainId: p.chainId } : undefined;
  const subject = isHostSubject(raw.subject) ? { kind: 'host' as const, value: raw.subject.value.trim() } : undefined;
```
     and ends with `...(parent ? { parent } : {}), ...(subject ? { subject } : {}),`. Only the known fields are copied.
7. The dispatcher:
```ts
export type ImportFile = { kind: 'run'; run: Run } | { kind: 'tree'; rootId: string; runs: Run[] };

/** Parse either export: one run, or an incident (a run and its linked runs). All or nothing. */
export function parseImport(text: string): ImportFile {
  const data = readJson(text);
  if (!isObj(data) || data.format !== RUNBOOK_TREE_FORMAT) return { kind: 'run', run: parseRunObject(isObj(data) && isObj(data.run) ? data.run : data) };
  if (!Array.isArray(data.runs) || data.runs.length === 0) throw new Error('That incident file has no runs in it.');
  const list = data.runs;
  const runs = list.map((r, i) => {
    try {
      return parseRunObject(r);
    } catch (err) {
      throw new Error(`Run ${i + 1} of ${list.length} in that incident file: ${err instanceof Error ? err.message : 'unreadable.'}`);
    }
  });
  const rootId = typeof data.rootId === 'string' && runs.some((r) => r.id === data.rootId) ? data.rootId : runs[0].id;
  return { kind: 'tree', rootId, runs };
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Tests  52 passed (52)`, and a clean build. `RunbooksView` still calls `parseRunJson`, which is fine until Task 13.

- [ ] **Step 5: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runbookExport.ts src/lib/runbookExport.test.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Keep run links in JSON exports and add the incident JSON format"
```

---

### Task 10: Markdown with linked runs, and the incident document

**Files:**
- Modify: `src/lib/runbookExport.ts` (`runToMarkdown` L36-112)
- Test: `src/lib/runbookExport.test.ts`

**Interfaces:**
- Produces:
  - `interface MarkdownOptions { runs?: Record<string, Run>; footer?: boolean }`
  - `runToMarkdown(run: Run, chain: FlowChain, now = Date.now(), opts: MarkdownOptions = {}): string`
  - `incidentToMarkdown(root: Run, runs: Record<string, Run>, now = Date.now()): string`

- [ ] **Step 1: Write the failing tests**

Add `incidentToMarkdown` to the import. Add to the `runs saved by the current release` describe:
```ts
  it('a stored v1 value renders with no linked-run sections', () => {
    const md = runToMarkdown(v1Run, phishing, NOW, { runs: v1Runs });
    expect(md).not.toContain('Linked');
    expect(md).toContain('| Run ID | `k7m2p9qa` |');
    expect(childRuns(v1Runs, 'k7m2p9qa')).toEqual([]);
  });
```
And:
```ts
describe('Markdown with linked runs', () => {
  it('a parent lists its linked runs after the path, and on the spawn step', () => {
    const runs = tree();
    const md = runToMarkdown(runs.parent01, phishing, NOW, { runs });
    expect(md).toContain('## Linked runs');
    expect(md.indexOf('## Linked runs')).toBeGreaterThan(md.indexOf('## Steps on the path taken'));
    expect(md).toContain('| WS-0142 | EDR Alert | `child001` | Open | 0 of at least 3 | EDR behavioral alert |');
    expect(md).toContain('- EDR Alert on WS-0142 (`child001`, Open)');
    expect(md).toContain('| 2026-10-24T10:00:00Z | Escalate to P1 incident | Started linked run: EDR Alert on WS-0187 |');
  });

  it('a child names its parent and host in the header', () => {
    const runs = tree();
    const md = runToMarkdown(runs.child001, flowChainById['edr-alert'], NOW, { runs });
    expect(md).toContain('| Linked from | Phishing incident (`parent01`), at Escalate to P1 incident |');
    expect(md).toContain('| Host | WS-0142 |');
  });

  it('a step that left the path keeps its linked runs', () => {
    const runs = tree();
    const moved = { ...runs.parent01, choices: { triage: 'block' } };
    const md = runToMarkdown(moved, phishing, NOW, { runs: { ...runs, parent01: moved } });
    const worked = md.slice(md.indexOf('## Steps worked before the branch changed'));
    expect(worked).toContain('### Escalate to P1 incident (approval gate)');
    expect(worked).toContain('- EDR Alert on WS-0187 (`child002`, Open)');
  });

  it('an incident document holds the parent then each child, one level down, one footer', () => {
    const runs = tree();
    const md = incidentToMarkdown(runs.parent01, runs, NOW);
    const h2 = md.split('\n').filter((l) => /^## [^#]/.test(l));
    expect(md.startsWith('# Incident: Phishing incident\n')).toBe(true);
    expect(h2).toEqual(['## Phishing incident', '## EDR Alert on WS-0142 (Phishing incident)', '## EDR Alert on WS-0187 (Phishing incident)']);
    expect(md).toContain('### Timeline');
    expect(md).not.toMatch(/^# (?!Incident: )/m);
    expect(md.match(/Exported from Blue Team Mapper/g)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd <repo> && npm test`
Expected:
- `tsc` is not part of `npm test`, so Vitest runs. The new tests fail: there is no `## Linked runs`, no `Linked from` row, and `incidentToMarkdown` is missing.
- The v1 test may already pass at run time; `npm run build` fails on the unknown 4th argument until Step 3.

- [ ] **Step 3: Implement**

1. Imports:
   - add `childRuns, hostOf, linkOf, progressCount, runProgress` to the `./runbook` import;
   - add `import { linkName } from './runLinks';`.
2. The signature:
```ts
export interface MarkdownOptions {
  /** All runs in this browser. With it, a parent lists its linked runs. */
  runs?: Record<string, Run>;
  /** The "Exported from" line. Off for runs inside an incident document, which ends with one. */
  footer?: boolean;
}

const runStatusText = (r: Run) => (r.status === 'closed' ? 'Closed' : 'Open');

export function runToMarkdown(run: Run, chain: FlowChain, now = Date.now(), { runs, footer = true }: MarkdownOptions = {}): string {
```
   The first lines of the body get `const kids = runs ? childRuns(runs, run.id) : [];`.
3. Insert this before the `| Run ID |` row:
```ts
  const link = linkOf(run);
  if (link) {
    const at = flowChainById[link.chainId]?.steps.find((s) => s.id === link.stepId)?.label;
    out.push(`| Linked from | ${cell(oneLine(link.title))} (\`${cell(link.runId)}\`)${at ? `, at ${cell(at)}` : ''} |`);
  }
  const host = hostOf(run);
  if (host) out.push(`| Host | ${cell(host)} |`);
```
4. In `stepBlock`, after the actions checklist and its blank line. This covers both the path and the "worked before the branch changed" blocks.
```ts
    const linked = kids.filter((c) => linkOf(c)?.stepId === step.id);
    if (linked.length) {
      out.push('Linked runs:', '', ...linked.map((c) => `- ${oneLine(linkName(c, flowChainById))} (\`${c.id}\`, ${runStatusText(c)})`), '');
    }
```
5. Right after `path.steps.forEach(...)`:
```ts
  if (kids.length) {
    out.push('## Linked runs', '', '| Host | Chain | Run ID | Status | Progress | Current step |', '| --- | --- | --- | --- | --- | --- |');
    for (const c of kids) {
      const cc = flowChainById[c.chainId];
      const p = cc && runProgress(c, cc);
      const current = c.status === 'closed' ? 'None' : (p?.current?.label ?? 'None');
      out.push(
        `| ${cell(hostOf(c) ?? oneLine(c.title))} | ${cell(cc?.title ?? c.chainId)} | \`${c.id}\` | ${runStatusText(c)} | ${p ? progressCount(p) : 'Unknown chain'} | ${cell(current)} |`,
      );
    }
    out.push('');
  }
```
6. The footer:
   - replace the last `out.push('---', ...)` with `if (footer) out.push(...exportFooter(now));`;
   - add the helper `const exportFooter = (now: number) => ['---', '', \`Exported from Blue Team Mapper on ${isoUtc(new Date(now).toISOString())}.\`, ''];`.
7. The incident document. Demoting by regex is safe: every line of user text sits in a table row (`|`), a list item (`- `) or a quote (`> `), and titles go through `oneLine`.
```ts
/** Push every heading down one level. Only headings start with "#": user text sits in tables, lists and quotes. */
const demote = (md: string) => md.replace(/^#/gm, '##');

/** A parent run and its linked runs as one document, children in start order. */
export function incidentToMarkdown(root: Run, runs: Record<string, Run>, now = Date.now()): string {
  const chain = flowChainById[root.chainId];
  const kids = childRuns(runs, root.id);
  const out = [`# Incident: ${oneLine(root.title)}`, '', `The ${chain?.title ?? root.chainId} run, then its ${kids.length} linked ${kids.length === 1 ? 'run' : 'runs'} in start order.`, ''];
  for (const r of [root, ...kids]) {
    const c = flowChainById[r.chainId];
    out.push(
      c
        ? demote(runToMarkdown(r, c, now, { runs, footer: false }))
        : `## ${oneLine(r.title)}\n\nThis run uses the chain "${r.chainId}", which this version of the mapper does not have. Run ID \`${r.id}\`.\n`,
    );
  }
  out.push(...exportFooter(now));
  return out.join('\n');
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Tests  57 passed (57)`, and a clean build.

- [ ] **Step 5: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runbookExport.ts src/lib/runbookExport.test.ts && GIT_CONFIG_GLOBAL=/dev/null git commit -m "List linked runs in the Markdown export and add the incident document"
```

---

### Task 11: Run page: the linked runs block on the spawn step

**Files:**
- Modify: `src/views/RunbookRunView.tsx`: imports (L4-53), `ids` (L76-83), new components before `StepCard` (L254), `StepCard` (L254-532), `RunView` (L887-1055), the default export's last line (L1109)

**Interfaces:**
- Consumes:
  - `useRunbooks().startLinkedRuns(parentId, stepId, hosts): string[]` (Task 6)
  - `parseHosts(text, skip)`, `hostOf`, `linkOf`, `childRuns`, `HOST_MAX`, `HOSTS_PER_START` (Task 4)
  - `runProgress`, `progressCount`
- Produces:
  - `StepCard` prop `linkedRuns: Run[]` (every run linked from this run, in start order)
  - ids `ids.hosts(stepId) = rb-${stepId}-hosts` and `ids.child(runId) = rb-linked-${runId}`

- [ ] **Step 1: Imports and ids**

Imports:
- lucide: add `Link2`;
- `@/lib/runbook`: add `childRuns, HOST_MAX, hostOf, HOSTS_PER_START, linkOf, parseHosts`.

`ids` gets:
```ts
  hosts: (stepId: string) => `rb-${stepId}-hosts`,
  child: (runId: string) => `rb-linked-${runId}`,
```

- [ ] **Step 2: Add `LinkedRunRow` and `LinkedRunsBlock` before `StepCard`**

The design rules:
- It follows the GateBlock layout in rose.
- A `<form>` sits beside GateBlock's, never nested inside it.
- Links stay usable inside a disabled fieldset; inputs do not.
- Announcements and focus use the existing `follow`/`focusSoon` pattern. The message ends with the running total, so two starts in a row never announce the same string, which the live region would skip.
- `parseHosts` gets the hosts already linked, so they never use up the 50-host cap. The preview shows the new hosts, then the already linked ones struck through, then the count of duplicates left out.
```tsx
function LinkedRunRow({ child }: { child: Run }) {
  const chain = flowChainById[child.chainId];
  const p = chain ? runProgress(child, chain) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
      <Link
        id={ids.child(child.id)}
        to={`/runbooks/${child.id}`}
        className="min-w-0 font-mono text-[13px] text-fog-bright [overflow-wrap:anywhere] hover:text-ember"
      >
        {hostOf(child) ?? child.title}
      </Link>
      <RunStatusChip status={child.status} />
      <span className="tabular text-2xs text-fog-muted">{p ? `${progressCount(p)} steps` : 'Chain not in this version'}</span>
      {child.status === 'active' && p?.current && <span className="text-2xs text-fog-muted">Now: {p.current.label}</span>}
    </li>
  );
}

/** Start one linked run per affected host from a spawn step, and list the runs started here. */
function LinkedRunsBlock({
  run,
  step,
  linked,
  readOnly,
  follow,
}: {
  run: Run;
  step: FlowStep;
  /** Runs linked from this step, in start order. */
  linked: Run[];
  readOnly: boolean;
  follow: FollowUp;
}) {
  const [text, setText] = useState('');
  const spawns = step.spawns;
  // Hosts already linked from this step, lower-cased. parseHosts sets them aside before its cap.
  const have = useMemo(() => new Set(linked.map((c) => hostOf(c)?.toLowerCase()).filter((h): h is string => !!h)), [linked]);
  const parsed = useMemo(() => parseHosts(text, have), [text, have]);
  if (!spawns) return null;
  const chainTitle = flowChainById[spawns.chainId]?.title ?? 'linked';
  const runs = (n: number) => `${chainTitle} ${n === 1 ? 'run' : 'runs'}`;
  const fresh = parsed.hosts;
  const already = parsed.already.length;
  const id = ids.hosts(step.id);
  const previewId = `${id}-preview`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!fresh.length) return;
    const started = store().startLinkedRuns(run.id, step.id, fresh);
    setText('');
    // A host another tab linked in the meantime counts as already linked.
    const wasLinked = already + fresh.length - started.length;
    const skipped = [
      parsed.dupes ? `${parsed.dupes} ${parsed.dupes === 1 ? 'duplicate' : 'duplicates'}` : '',
      wasLinked ? `${wasLinked} already linked` : '',
    ]
      .filter(Boolean)
      .join(' and ');
    follow.say(
      `Started ${started.length} ${runs(started.length)}.${skipped ? ` Skipped ${skipped}.` : ''} ${
        linked.length + started.length
      } linked from ${step.label}.`,
    );
    focusSoon(...(started[0] ? [ids.child(started[0])] : []), id);
  };

  return (
    <div className="rounded-lg border border-rose/30 bg-rose/[0.06] p-3">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-rose">
        <Link2 aria-hidden className="h-4 w-4" /> Linked runs
      </div>
      <p className="mt-1 text-2xs text-fog-muted">
        {spawns.label}: one {chainTitle} run per host, each with its own checklist and timeline.
      </p>
      {linked.length > 0 ? (
        <ul aria-label={`Runs linked from ${step.label}`} className="mt-2 space-y-1.5">
          {linked.map((c) => (
            <LinkedRunRow key={c.id} child={c} />
          ))}
        </ul>
      ) : (
        readOnly && <p className="mt-2 text-[13px] text-fog-dim">No linked runs were started from this step.</p>
      )}
      {!readOnly && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <div>
            <label htmlFor={id} className="mb-1 block text-2xs text-fog-dim">
              Affected hosts
            </label>
            <textarea
              id={id}
              value={text}
              rows={2}
              onChange={(e) => setText(e.target.value)}
              aria-describedby={previewId}
              placeholder="WS-0142, WS-0187 or one per line"
              className="block w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[13px] text-fog-bright outline-none placeholder:font-sans placeholder:text-fog-muted focus:border-ember/50"
            />
          </div>
          <div id={previewId} className="space-y-1.5">
            {fresh.length + already > 0 && (
              <ul aria-label="Hosts to start" className="flex flex-wrap gap-1.5">
                {fresh.map((h) => (
                  <li key={h} className="chip text-fog-bright">
                    {h}
                  </li>
                ))}
                {parsed.already.map((h) => (
                  <li key={h} className="chip text-fog-muted">
                    <span className="line-through decoration-fog-muted/60">{h}</span>
                    <span className="text-2xs">already linked</span>
                  </li>
                ))}
              </ul>
            )}
            {parsed.dupes > 0 && (
              <p className="text-2xs text-fog-muted">
                {parsed.dupes === 1 ? '1 duplicate' : `${parsed.dupes} duplicates`} left out.
              </p>
            )}
            {parsed.tooLong > 0 && (
              <p className="text-2xs text-gold">
                {parsed.tooLong === 1 ? '1 entry is' : `${parsed.tooLong} entries are`} longer than {HOST_MAX} characters
                and left out.
              </p>
            )}
            {parsed.extra > 0 && (
              <p className="text-2xs text-gold">
                Only {HOSTS_PER_START} new hosts start at a time. Start these, then paste the other {parsed.extra}.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn" disabled={!fresh.length}>
              <Play aria-hidden className="h-4 w-4" /> {fresh.length ? `Start ${fresh.length} ${runs(fresh.length)}` : `Start ${chainTitle} runs`}
            </button>
            {already > 0 && <span className="text-2xs text-fog-muted">{already} already linked, left out.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: StepCard**

1. Add the prop `linkedRuns: Run[]` with the doc comment `/** Every run linked from this run, in start order. */`, and destructure it.
2. After `chosenEdge`: `const stepLinked = linkedRuns.filter((c) => linkOf(c)?.stepId === step.id);`
3. Header chip after the Decision chip. It makes the count visible on a collapsed card under "Left the path":
```tsx
                {stepLinked.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-rose/40 bg-rose/10 px-1.5 py-px font-mono text-2xs text-rose">
                    <Link2 aria-hidden className="h-3 w-3" /> {stepLinked.length} linked
                  </span>
                )}
```
4. Lock the spawn checkbox, mirroring the store guard from Task 6:
   - In the actions map, after `const on = ...`:
```tsx
                      // Unticking would let a branch change reset the step and hide its linked runs.
                      const locked = on && i === step.spawns?.action && stepLinked.length > 0;
```
   - On the `<input>`, add `disabled={locked}`, `aria-describedby={locked ? `${id}-lock` : undefined}`, and `disabled:opacity-60` on its className.
   - After `</label>`, still inside the `<li>`, so the hint is not struck through:
```tsx
                          {locked && (
                            <p id={`${id}-lock`} className="pl-8 text-2xs text-fog-muted">
                              Linked runs started here, so this stays ticked.
                            </p>
                          )}
```
5. Between the GateBlock line and the BranchBlock line:
```tsx
                {step.spawns && <LinkedRunsBlock run={run} step={step} linked={stepLinked} readOnly={readOnly} follow={follow} />}
```
   - `readOnly` is already "closed run, or step left the path", which is exactly the spec's read-only rule.
   - Spawning does not depend on `needsApproval`: decision 1 allows it while the gate is pending.

- [ ] **Step 4: RunView threading and key**

After `withCard`:
```tsx
  // The whole map, then derive: a selector that builds a new array each call loops under zustand 5.
  const runs = useRunbooks((s) => s.runs);
  const linked = useMemo(() => childRuns(runs, run.id), [runs, run.id]);
```
Pass `linkedRuns={linked}` to both `StepCard` lists: the path cards and the "Left the path" cards.

The links added here are the first ones from one run to another. The route `runbooks/:runId` keeps the same `RunView` when only `runId` changes. Without a key, the old run's local state carries over to the new one: the Edit details fields (Save would rename the child), the close confirmation, notices, and `reveal`, which reads `#rb-step-<id>` only on mount. So in the default export `RunbookRunView`, the last line becomes:
```tsx
  // Keyed by run: following a link to another run starts fresh (edit form, close confirmation, notices, the #rb-step reveal).
  return <RunView key={run.id} run={run} chain={chain} now={now} />;
```

- [ ] **Step 5: Build and spot-check**

Run: `cd <repo> && npm test && npm run build`
Expected: 57 tests pass, and the build is clean.

Optional spot check with `npm run dev`:
1. Start a phishing run, mark received and gateway done, and take "Execution found".
2. Type `WS-0142, ws-0187 WS-0142` and see two chips, "1 duplicate left out." and "Start 2 EDR Alert runs".
3. Press it: two rows appear, and "Start EDR triage on affected hosts" is ticked and locked.

Task 14 automates all of this.

- [ ] **Step 6: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/views/RunbookRunView.tsx && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Start and list linked runs on the escalate step card"
```

---

### Task 12: Run page: header link, close warning, exports and the branch warning

**Files:**
- Modify: `src/lib/runLinks.ts`, `src/lib/runLinks.test.ts`
- Modify: `src/views/RunbookRunView.tsx`: `BranchBlock` (L207-252), `RunHeader` (L697-876), `RunView`

**Interfaces:**
- Produces: `childrenLeavingPath(chain: FlowChain, choices: Record<string, string>, stepId: string, target: string, children: Run[]): Run[]`
- Consumes:
  - `closeWarning`, `childSummary` (Task 4)
  - `incidentToMarkdown`, `runToMarkdown(..., { runs })` (Task 10)
  - `downloadIncidentJson`, `runFileName(..., 'incident')` (Task 9)

- [ ] **Step 1: Write the failing test**

Add `childrenLeavingPath` to the `./runLinks` import:
```ts
describe('childrenLeavingPath', () => {
  const tree = start({ parent01: parentRun() }, ['WS-0142', 'WS-0187'])!.runs;
  const kids = childRuns(tree, 'parent01');

  it('counts the linked runs whose step leaves the path on the other branch', () => {
    expect(childrenLeavingPath(phishing, { triage: 'escalate' }, 'triage', 'block', kids)).toHaveLength(2);
    expect(childrenLeavingPath(phishing, { triage: 'escalate' }, 'triage', 'escalate', kids)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd <repo> && npm test`
Expected: FAIL, because `childrenLeavingPath` is missing.

- [ ] **Step 3: Implement**

A step counts as leaving when it is on the path now and, after the change, is neither on the new path nor waiting on a later decision (`undecided`):
```ts
/** Linked runs that would leave the path if the decision at `stepId` went to `target` instead. */
export function childrenLeavingPath(
  chain: FlowChain,
  choices: Record<string, string>,
  stepId: string,
  target: string,
  children: Run[],
): Run[] {
  const now = new Set(runPath(chain, choices).steps.map((s) => s.id));
  const after = runPath(chain, { ...choices, [stepId]: target });
  const stays = new Set([...after.steps, ...after.undecided].map((s) => s.id));
  return children.filter((c) => {
    const l = linkOf(c);
    return !!l && now.has(l.stepId) && !stays.has(l.stepId);
  });
}
```
Run: `cd <repo> && npm test`
Expected: `Tests  58 passed (58)`.

- [ ] **Step 4: BranchBlock warning**

1. Imports: add `import { childrenLeavingPath } from '@/lib/runLinks';`.
2. Add the prop `linkedRuns: Run[]` with the doc comment `/** Every run linked from this run. */`. StepCard passes `linkedRuns={linkedRuns}` to it.
3. In the map, after `label`. The count covers every linked run from the step, closed ones too (spec: "N linked runs were started from a step that will leave the path"). Only the "keeps running" clause is about the open ones:
```tsx
          // Linked runs whose step this branch takes off the path. The open ones keep running; say so before the click.
          const leavingRuns = on ? [] : childrenLeavingPath(chain, run.choices, step.id, e.target, linkedRuns);
          const leaving = leavingRuns.length;
          const stillOpen = leavingRuns.filter((c) => c.status === 'active').length;
          const warnId = `${ids.branch(step.id, i)}-warn`;
          const moved = leaving === 1 ? '1 linked run is now' : `${leaving} linked runs are now`;
          const keepRunning =
            stillOpen === 0
              ? ''
              : stillOpen === leaving
                ? ` ${leaving === 1 ? 'It keeps' : 'They keep'} running.`
                : ` ${stillOpen === 1 ? 'The open one keeps' : `The ${stillOpen} open ones keep`} running.`;
```
4. On the button:
   - add `aria-describedby={leaving ? warnId : undefined}`;
   - make the third argument of `follow.step(...)` `` `Took “${label}” at ${step.label}${leaving ? `. ${moved} under Left the path` : ''}` ``.
5. After the `→ ... · Not taken` span:
```tsx
                {leaving > 0 && (
                  <span id={warnId} className="mt-1 block text-2xs text-gold">
                    {leaving === 1 ? '1 linked run was' : `${leaving} linked runs were`} started from a step that leaves the
                    path on this branch.{keepRunning}
                  </span>
                )}
```
The change itself is not blocked (spec).

- [ ] **Step 5: RunHeader**

1. Imports:
   - `@/lib/runbook`: add `childSummary, closeWarning`;
   - `@/lib/runbookExport`: add `downloadIncidentJson, incidentToMarkdown`.
2. Add the props `runs: Record<string, Run>` (every run in this browser) and `linked: Run[]` (runs linked from this run, in start order).
3. After `const open = ...`:
```tsx
  const warning = closeWarning(open, progress.estimated, linked.filter((c) => c.status === 'active').length);
  const link = linkOf(run);
  const parent = link ? own(runs, link.runId) : undefined;
  const parentStep = link ? flowChainById[link.chainId]?.steps.find((s) => s.id === link.stepId)?.label : undefined;
  const host = hostOf(run);
```
4. `close()` opens the confirmation on `if (warning && !confirmClose)`. That covers the third case, a complete run with open children (spec Q4: warn, not block).
5. The confirmation text (L803-804) becomes `{warning} Close anyway?`.
6. `copy` takes `incident: boolean`:
```tsx
  const copy = async (incident: boolean) => {
    const ok = await copyText(incident ? incidentToMarkdown(run, runs) : runToMarkdown(run, chain, Date.now(), { runs }));
    const what = incident ? `Incident Markdown copied, with ${linked.length} linked ${linked.length === 1 ? 'run' : 'runs'}.` : 'Markdown copied.';
    setNotice(
      ok
        ? { tone: 'ok', text: `${what} Paste it into the ticket or the RCA.` }
        : { tone: 'error', text: `The browser blocked the clipboard. Use Download ${incident ? 'incident ' : ''}.md instead.` },
    );
  };
```
7. After the `<h2>`. The link goes to the parent's spawn step, through the existing `#rb-step-<id>` reveal. On client navigation that reveal runs only because Task 11 keys `RunView` by run id, so the parent's `RunView` mounts fresh and reads the hash:
```tsx
          {link && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fog-dim">
              <Link2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-rose" />
              <span className="[overflow-wrap:anywhere]">
                Linked from{' '}
                {parent ? (
                  <Link
                    to={`/runbooks/${parent.id}#${ids.card(link.stepId)}`}
                    className="text-fog-bright underline underline-offset-2 hover:text-ember"
                  >
                    {parent.title}
                  </Link>
                ) : (
                  <span className="text-fog-bright">{link.title}</span>
                )}
                {parentStep && `, at ${parentStep}`}
              </span>
              {!parent && <span className="text-gold">· parent not in this browser</span>}
            </p>
          )}
```
8. In the `<dl>`, before Lead:
```tsx
            {host && (
              <div className="flex gap-1.5">
                <dt className="text-fog-muted">Host</dt>
                <dd className="font-mono text-fog-bright [overflow-wrap:anywhere]">{host}</dd>
              </div>
            )}
```
9. After `<RunProgressBar ... />`. The summary sits beside the bar and is not rolled into it:
```tsx
        {linked.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-fog-muted">
            <Link2 aria-hidden className="h-3 w-3 shrink-0 text-rose" /> {childSummary(linked).text}. Their steps are not in this bar.
          </p>
        )}
```
10. Export row:
   - "Copy Markdown" calls `copy(false)`.
   - "Download .md" passes `runToMarkdown(run, chain, Date.now(), { runs })`.
   - After "Download JSON":
```tsx
        {linked.length > 0 && (
          <>
            <button type="button" className="btn" onClick={() => copy(true)}>
              <Copy aria-hidden className="h-4 w-4" /> Copy incident Markdown
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => downloadText(runFileName(run, 'md', 'incident'), incidentToMarkdown(run, runs), 'text/markdown')}
            >
              <FileDown aria-hidden className="h-4 w-4" /> Download incident .md
            </button>
            <button type="button" className="btn" onClick={() => downloadIncidentJson(run, linked)}>
              <FileJson aria-hidden className="h-4 w-4" /> Download incident JSON
            </button>
          </>
        )}
```
11. In RunView: `<RunHeader ... runs={runs} linked={linked} follow={follow} />`.

- [ ] **Step 6: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: 58 tests pass, and the build is clean.

- [ ] **Step 7: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runLinks.ts src/lib/runLinks.test.ts src/views/RunbookRunView.tsx && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Show the parent link, open linked runs and incident exports on the run page"
```

---

### Task 13: Runbooks list nesting, incident import and the delete count

**Files:**
- Modify: `src/lib/runLinks.ts`, `src/lib/runLinks.test.ts`
- Modify: `src/views/RunbooksView.tsx`: imports, `OrphanRow` L30-56, `RunRow` L58-105, `onImport` L139-155, sections L210-221 and L319-330
- Modify: `src/components/Runbook.tsx` (L4, L22-38)

**Interfaces:**
- Produces:
  - `interface RunGroup { run: Run; children: Run[] }`
  - `groupRuns(section: Run[], runs: Record<string, Run>): RunGroup[]`
- Consumes:
  - `parseImport` (Task 9)
  - `importRuns` (Task 8)
  - `childRuns`, `childSummary`, `linkOf` (Task 4)

- [ ] **Step 1: Write the failing tests**

Add `groupRuns` to the import:
```ts
describe('groupRuns', () => {
  const tree = start({ parent01: parentRun() }, ['WS-0142', 'WS-0187'])!.runs;

  it('nests children under a parent with the same status, in start order', () => {
    const groups = groupRuns([tree.child002, tree.child001, tree.parent01], tree);
    expect(groups.map((g) => [g.run.id, g.children.map((c) => c.id)])).toEqual([['parent01', ['child001', 'child002']]]);
  });

  it('keeps a child at the top level when the parent has another status or is missing', () => {
    const closed = closeRunIn(tree, chains, 'parent01', T1);
    expect(groupRuns([closed.child002, closed.child001], closed).map((g) => g.run.id)).toEqual(['child002', 'child001']);
    const orphan = { child001: tree.child001 };
    expect(groupRuns([orphan.child001], orphan)).toEqual([{ run: orphan.child001, children: [] }]);
  });

  it('lists runs saved by the current release one per row', () => {
    const a = fixtureRun('aaaa0001', 'phishing');
    const b = fixtureRun('bbbb0002', 'edr-alert', { parent: 'x' as unknown as Run['parent'] });
    expect(groupRuns([a, b], { aaaa0001: a, bbbb0002: b })).toEqual([
      { run: a, children: [] },
      { run: b, children: [] },
    ]);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd <repo> && npm test`
Expected: FAIL, because `groupRuns` is missing.

- [ ] **Step 3: Implement `groupRuns`**

Add `byStart` to the `./runbook` import. `section` is one status, newest first (`sortRuns`), and top-level rows keep that order. Requiring `!linkOf(p)` keeps v1 one level deep, and a malformed A-to-B, B-to-A cycle cannot nest.
```ts
export interface RunGroup {
  run: Run;
  /** Linked runs shown nested under `run`, in start order. */
  children: Run[];
}

/**
 * Lay out one section of the runbooks list (runs of one status, newest first). A linked run sits
 * under its parent when the parent is in the same section and is not itself linked; otherwise it
 * stays at the top level, where its row shows a "Linked from" chip.
 */
export function groupRuns(section: Run[], runs: Record<string, Run>): RunGroup[] {
  const ids = new Set(section.map((r) => r.id));
  const under = new Map<string, Run[]>();
  const top: Run[] = [];
  for (const r of section) {
    const l = linkOf(r);
    const p = l && own(runs, l.runId);
    if (p && p.id !== r.id && ids.has(p.id) && p.status === r.status && !linkOf(p)) {
      under.set(p.id, [...(under.get(p.id) ?? []), r]);
    } else top.push(r);
  }
  return top.map((run) => ({ run, children: (under.get(run.id) ?? []).sort(byStart) }));
}
```
Run: `cd <repo> && npm test`
Expected: `Tests  61 passed (61)`.

- [ ] **Step 4: RunbooksView**

1. Imports:
   - lucide: add `Link2`;
   - `@/lib/runbook`: add `childRuns, childSummary, linkOf, own`;
   - `parseRunJson` becomes `parseImport`;
   - add `import { groupRuns, type RunGroup } from '@/lib/runLinks';`.
2. Before `OrphanRow`:
```tsx
/**
 * Link chips for a row: "Linked from <parent>" when the row is not nested under its parent, and
 * "3 linked runs, 1 open" on a parent.
 */
function LinkInfo({ run, runs, nested }: { run: Run; runs: Record<string, Run>; nested: boolean }) {
  const link = linkOf(run);
  const parent = link ? own(runs, link.runId) : undefined;
  const kids = childRuns(runs, run.id);
  return (
    <>
      {link && !nested && (
        <span className="inline-flex max-w-full items-center gap-1 rounded border border-rose/40 bg-rose/10 px-1.5 py-px text-2xs text-rose [overflow-wrap:anywhere]">
          <Link2 aria-hidden className="h-3 w-3 shrink-0" />
          Linked from {parent?.title ?? link.title}
          {!parent && ' · parent not in this browser'}
        </span>
      )}
      {kids.length > 0 && (
        <span className="inline-flex items-center gap-1 rounded border border-rose/40 px-1.5 py-px font-mono text-2xs text-rose">
          <Link2 aria-hidden className="h-3 w-3 shrink-0" />
          {childSummary(kids).text}
        </span>
      )}
    </>
  );
}

type RowProps = { run: Run; runs: Record<string, Run>; nested?: boolean };
```
3. `OrphanRow({ run, runs, nested = false }: RowProps)` and `RunRow({ run, runs, nested = false, now }: RowProps & { now: number })`:
   - Each root element changes from `<li className="glass ...">` to `<div className="glass ...">`. The `<li>` moves to `RunItem`, so a row can hold a nested list.
   - Each puts `<LinkInfo run={run} runs={runs} nested={nested} />` after `<RunStatusChip ... />`.
   - `RunRow` passes `runs` and `nested` to its `OrphanRow` fallback.
4. After `RunRow`:
```tsx
/** A top-level row, with the linked runs that share its status nested under it. */
function RunItem({ group, runs, now }: { group: RunGroup; runs: Record<string, Run>; now: number }) {
  return (
    <li>
      <RunRow run={group.run} runs={runs} now={now} />
      {group.children.length > 0 && (
        <ul aria-label={`Runs linked from ${group.run.title}`} className="ml-4 mt-2 space-y-2 border-l border-rose/25 pl-3 sm:ml-6">
          {group.children.map((c) => (
            <li key={c.id}>
              <RunRow run={c} runs={runs} nested now={now} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
```
5. Both sections map `groupRuns(active, runs)` and `groupRuns(closed, runs)` to `<RunItem key={g.run.id} group={g} runs={runs} now={now} />`. The heading counts (`active.length`, `closed.length`) still count every run in the section.
6. In `onImport`'s `try`:
   - `const parsed = parseImport(await file.text());`
   - `kind === 'run'` keeps today's code, using `parsed.run`.
   - Otherwise:
```tsx
        const results = useRunbooks.getState().importRuns(parsed.runs);
        const at = Math.max(0, parsed.runs.findIndex((r) => r.id === parsed.rootId));
        const n = parsed.runs.length - 1;
        const moved = results.filter((r) => r.reason !== 'kept').length;
        setNotice({
          tone: 'ok',
          text: `Imported the incident "${parsed.runs[at].title}" with ${n} linked ${n === 1 ? 'run' : 'runs'} from ${file.name}.${
            moved
              ? ` ${moved === 1 ? '1 run got a new ID' : `${moved} runs got new IDs`}, because the ID was taken in this browser or not valid. The links between them still hold.`
              : ''
          }`,
          to: `/runbooks/${results[at].id}`,
        });
```

- [ ] **Step 5: Delete confirmation**

In `src/components/Runbook.tsx`:
1. Import `childRuns` from `@/lib/runbook`.
2. After `deleteRef`. The hook sits before the `if (confirm)` early return:
```tsx
  // A count, not the list: a selector that returns a new array on every call loops under zustand 5.
  const linked = useRunbooks((s) => childRuns(s.runs, run.id).length);
```
3. After `Delete this run and its timeline?`:
```tsx
        {linked > 0 && ` Its ${linked} linked ${linked === 1 ? 'run stays' : 'runs stay'}.`}
```

- [ ] **Step 6: Run the tests and the build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Tests  61 passed (61)`, and a clean build.

- [ ] **Step 7: Commit**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add src/lib/runLinks.ts src/lib/runLinks.test.ts src/views/RunbooksView.tsx src/components/Runbook.tsx && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Nest linked runs in the runbooks list and import incident files"
```

---

### Task 14: Browser check at desktop and phone width, changelog, hand-off

**Files:**
- Modify: `README.md` (Changelog `### v4.2 (unreleased)`)
- Scratch only, never committed: `$SP/pw/capture-v1.mjs`, `$SP/pw/linked-runs-check.mjs`, builds under `$SP`

Set `SP` to this session's scratchpad directory. Keep all builds out of the repo's `dist/`.

- [ ] **Step 1: Full test and build**

Run: `cd <repo> && npm test && npm run build`
Expected: `Test Files  4 passed (4)`, `Tests  61 passed (61)`, `✓ built in`.

- [ ] **Step 2: Install Playwright in the scratchpad**

Run:
```bash
mkdir -p $SP/pw && cd $SP/pw && npm init -y >/dev/null && npm i --cache "$TMPDIR/npm-cache" playwright@1.49.1 && PLAYWRIGHT_BROWSERS_PATH=$SP/pw/browsers npx playwright install chromium-headless-shell
```
allowed_domains: `registry.npmjs.org`, `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, `playwright.azureedge.net`, `playwright-akamai.azureedge.net`, `playwright-verizon.azureedge.net`.

- [ ] **Step 3: Builds of main and of the branch**

```bash
mkdir -p $SP/main && cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git archive main | tar -x -C $SP/main && ln -sfn <repo>/node_modules $SP/main/node_modules && cd $SP/main && npx vite build --outDir $SP/main-dist
cd <repo> && npx vite build --outDir $SP/after-dist
```

- [ ] **Step 4: Capture a `btm-runbooks-v1` value with the current release**

`$SP/pw/capture-v1.mjs`:
```js
// Make a btm-runbooks-v1 value with the current release (main): one phishing run on "Execution found"
// with an action ticked and a note, and one closed EDR Alert run. Writes it to the path in argv[2].
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://localhost:4174/BlueTeamMapper';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const p = await (await b.newContext({ bypassCSP: true })).newPage();
await p.goto(`${BASE}/runbooks`);
await p.fill('#rb-title', 'Live v1 phishing');
await p.getByRole('button', { name: 'Start runbook' }).click();
await p.waitForURL(/\/runbooks\/[a-z0-9]+$/);
await p.click('#rb-step-received-done');
await p.click('#rb-step-gateway-done');
await p.click('#rb-step-triage-branch-1');
await p.check('#rb-escalate-a0');
await p.fill('#rb-escalate-notes', 'Paged the on-call lead.');
await p.locator('#rb-escalate-notes').blur();
await p.goto(`${BASE}/runbooks?chain=edr-alert`);
await p.fill('#rb-title', 'Live v1 EDR');
await p.getByRole('button', { name: 'Start runbook' }).click();
await p.waitForURL(/\/runbooks\/[a-z0-9]+$/);
await p.click('#rb-close');
await p.click('#rb-close-confirm');
await p.locator('#rb-reopen').waitFor();
writeFileSync(process.argv[2], await p.evaluate(() => localStorage.getItem('btm-runbooks-v1')));
await b.close();
```
Run it. Start the server and the browser in the same Bash command, because a background server runs in a separate sandbox.
```bash
cd $SP/main && (npx vite preview --outDir $SP/main-dist --port 4174 --strictPort >$SP/preview-main.log 2>&1 &) ; sleep 3; cd $SP/pw && PLAYWRIGHT_BROWSERS_PATH=$SP/pw/browsers timeout 120 node capture-v1.mjs $SP/v1-live.json; lsof -ti:4174 -sTCP:LISTEN | xargs -r kill
```
Expected: `$SP/v1-live.json` starts with `{"state":{"runs":{` and ends with `"version":1}`.

- [ ] **Step 5: Write the browser check**

`$SP/pw/linked-runs-check.mjs` follows the spec's Testing list at 1280x900 and 375x812:
- start a phishing run, take "Execution found", start three hosts with one duplicate, and confirm two runs plus a skipped duplicate ("1 duplicate left out.");
- open a child with the parent's Edit details form open, and check the form does not carry over;
- close the child, follow its "Linked from" link back, and check that the escalate card opens with focus and the timeline has the close entry;
- switch the branch to "No execution", and check the warning (both runs counted, only the open one "keeps running") and that escalate stays under "Left the path" with its runs;
- close the parent with a child open, and check the child under "Open incidents";
- export the incident JSON and re-import it in a fresh profile;
- load a v1 value with no migration.

Every page also asserts:
- no host name in `page.url()` or `document.title`;
- no horizontal scroll;
- no page errors.

`bypassCSP` is needed because the build enforces `script-src 'self'`.

```js
// Browser check for linked runbooks. Run against `vite preview`.
// Usage: BASE=http://localhost:4173/BlueTeamMapper FIXTURE=<runbooks-v1.json> [LIVE_V1=<captured value>] OUT=<dir> node linked-runs-check.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173/BlueTeamMapper';
const OUT = process.env.OUT ?? '.';
const fixture = JSON.stringify(JSON.parse(readFileSync(process.env.FIXTURE, 'utf8')));
const log = [];
const check = (ok, what) => {
  log.push(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) process.exitCode = 1;
};
/** Waits up to 5 s: routes load lazily and imports read the file asynchronously. */
const seen = (loc) => loc.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
const LINKED = 'ul[aria-label="Runs linked from Escalate to P1 incident"] > li';

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
for (const vp of [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 375, height: 812 },
]) {
  const tag = (s) => `[${vp.name}] ${s}`;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, bypassCSP: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const noHostLeak = async (where) => {
    const t = (await page.title()) + page.url();
    check(!/ws-0142|ws-0187/i.test(t), tag(`no host in URL or title (${where})`));
  };
  const noSideScroll = async (where) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(w <= 0, tag(`no horizontal scroll (${where}): ${w}px`));
  };

  // Start a phishing run and take "Execution found".
  await page.goto(`${BASE}/runbooks`);
  await page.getByRole('button', { name: 'Start runbook' }).click();
  await page.waitForURL(/\/runbooks\/[a-z0-9]+$/);
  const parentUrl = page.url();
  await page.click('#rb-step-received-done');
  await page.click('#rb-step-gateway-done');
  await page.click('#rb-step-triage-branch-1');

  // Three hosts, one a duplicate: two runs start.
  await page.fill('#rb-escalate-hosts', 'WS-0142, WS-0187\nws-0142');
  check(await seen(page.getByText('1 duplicate left out.', { exact: true })), tag('the duplicate in the paste is counted and left out'));
  await page.getByRole('button', { name: 'Start 2 EDR Alert runs' }).click();
  await page.locator(LINKED).nth(1).waitFor();
  check((await page.locator(LINKED).count()) === 2, tag('two linked runs listed on escalate'));
  check((await page.locator('#rb-escalate-a2').isChecked()) && (await page.locator('#rb-escalate-a2').isDisabled()), tag('spawn action ticked and locked'));
  await page.fill('#rb-escalate-hosts', 'ws-0187');
  check(await seen(page.getByText('already linked', { exact: true })), tag('a host already linked is marked'));
  check(await page.getByRole('button', { name: 'Start EDR Alert runs' }).isDisabled(), tag('start is disabled for an already linked host'));
  await page.fill('#rb-escalate-hosts', '');
  await noHostLeak('parent');
  await noSideScroll('parent');
  await page.screenshot({ path: `${OUT}/${vp.name}-1-parent-linked.png`, fullPage: true });

  // Open a child with the parent's Edit details form open: the child page starts fresh.
  await page.click('#rb-edit');
  await page.getByRole('link', { name: 'WS-0142' }).click();
  await page.waitForURL((u) => u.href !== parentUrl);
  check((await page.locator('#rb-edit-title').count()) === 0, tag("the parent's edit form does not carry over to the child"));
  check(await seen(page.getByText('at Escalate to P1 incident')), tag('child header shows Linked from ... at Escalate to P1 incident'));
  await noHostLeak('child');
  await noSideScroll('child');
  await page.screenshot({ path: `${OUT}/${vp.name}-2-child.png`, fullPage: true });
  await page.click('#rb-close');
  await page.click('#rb-close-confirm');
  await page.locator('header').getByRole('link', { name: /Phishing incident/ }).click();
  await page.waitForURL((u) => u.href.startsWith(parentUrl));
  const focused = await page
    .waitForFunction(() => document.activeElement?.id === 'rb-step-escalate-toggle', null, { timeout: 5000 })
    .then(() => true, () => false);
  check(focused && (await page.getAttribute('#rb-step-escalate-toggle', 'aria-expanded')) === 'true', tag('the Linked from link opens and focuses the spawn step'));
  check(await seen(page.getByText('Linked run closed: EDR Alert on WS-0142')), tag('parent timeline has the close entry'));

  // Switch triage to "No execution": the warning shows first, then escalate stays under Left the path.
  await page.click('#rb-step-triage-toggle');
  const warn = page.locator('#rb-step-triage-branch-0-warn');
  check(await seen(warn), tag('branch warning before the change'));
  // WS-0142 is closed by now and WS-0187 is open.
  const warnText = (await warn.textContent()) ?? '';
  check(
    warnText.includes('2 linked runs were started from a step that leaves the path on this branch.') && warnText.includes('The open one keeps running.'),
    tag(`branch warning counts both and says only the open one keeps running: ${warnText}`),
  );
  await page.click('#rb-step-triage-branch-0');
  const left = page.locator('ol[aria-label="Steps that left the path"]');
  check(await seen(left.getByText('Escalate to P1 incident')), tag('escalate is under Left the path'));
  await page.click('#rb-step-escalate-toggle');
  check((await page.locator(LINKED).count()) === 2, tag('left-the-path card still lists its linked runs'));
  check((await page.locator('#rb-escalate-hosts').count()) === 0, tag('no host input once the step left the path'));
  await page.screenshot({ path: `${OUT}/${vp.name}-3-left-the-path.png`, fullPage: true });

  // Close the parent while a child is open: the warning names it, and the child stays under Open incidents.
  await page.click('#rb-close');
  check(await seen(page.getByText(/1 linked run (is|are) still open|and 1 linked run are still open/)), tag('close warning mentions the open linked run'));
  await page.click('#rb-close-confirm');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download incident JSON' }).click();
  const file = `${OUT}/${vp.name}-incident.json`;
  await (await download).saveAs(file);
  await page.goto(`${BASE}/runbooks`);
  const open = page.locator('section[aria-labelledby="rb-active-h"]');
  check(await seen(open.getByText(/EDR Alert on WS-0187/)), tag('open child listed under Open incidents'));
  check(await seen(open.getByText(/Linked from Phishing incident/)), tag('open child has a Linked from chip'));
  const closedSection = page.locator('section[aria-labelledby="rb-closed-h"]');
  check(await seen(closedSection.locator('ul[aria-label^="Runs linked from"]').getByText(/EDR Alert on WS-0142/)), tag('closed child nested under the closed parent'));
  await noSideScroll('list');
  await page.screenshot({ path: `${OUT}/${vp.name}-4-list.png`, fullPage: true });
  check(errors.length === 0, tag(`no page errors ${errors.join(' | ')}`));

  // Re-import the incident JSON in a fresh profile.
  const ctx2 = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, bypassCSP: true });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/runbooks`);
  await p2.setInputFiles('#runbook-import', file);
  check(await seen(p2.getByText(/Imported the incident .* with 2 linked runs/)), tag('incident import notice'));
  await p2.getByRole('link', { name: 'Open it' }).click();
  await p2.click('#rb-step-escalate-toggle');
  check((await p2.locator(LINKED).count()) === 2, tag('imported parent lists both linked runs'));
  await ctx2.close();

  // The committed v1 fixture loads with no migration.
  const ctx3 = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, bypassCSP: true });
  await ctx3.addInitScript((v) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('btm-runbooks-v1', v);
      sessionStorage.setItem('seeded', '1');
    }
  }, fixture);
  const p3 = await ctx3.newPage();
  const errors3 = [];
  p3.on('pageerror', (e) => errors3.push(e.message));
  await p3.goto(`${BASE}/runbooks`);
  check(await seen(p3.getByText('Phishing incident 24 Oct 2026')), tag('v1 phishing run listed'));
  check(await seen(p3.getByText('EDR Alert incident 23 Oct 2026')), tag('v1 closed run listed'));
  await p3.goto(`${BASE}/runbooks/k7m2p9qa`);
  check(await seen(p3.locator('#rb-escalate-hosts')), tag('v1 run offers linked runs on escalate'));
  await p3.fill('#rb-escalate-hosts', 'WS-0142');
  await p3.getByRole('button', { name: 'Start 1 EDR Alert run' }).click();
  const stored = await p3.evaluate(() => JSON.parse(localStorage.getItem('btm-runbooks-v1')));
  check(stored.version === 1 && Object.keys(stored.state.runs).length === 3, tag('storage stays version 1 and keeps the v1 runs'));
  check(errors3.length === 0, tag(`no page errors on v1 data ${errors3.join(' | ')}`));
  await ctx3.close();

  // A value captured from a build of main (capture-v1.mjs). Every run lists and opens.
  if (process.env.LIVE_V1) {
    const live = readFileSync(process.env.LIVE_V1, 'utf8');
    const liveRuns = Object.values(JSON.parse(live).state.runs);
    const ctx4 = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, bypassCSP: true });
    await ctx4.addInitScript((v) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('btm-runbooks-v1', v);
        sessionStorage.setItem('seeded', '1');
      }
    }, live);
    const p4 = await ctx4.newPage();
    const errors4 = [];
    p4.on('pageerror', (e) => errors4.push(e.message));
    await p4.goto(`${BASE}/runbooks`);
    for (const r of liveRuns) check(await seen(p4.getByText(r.title, { exact: true })), tag(`live v1 run listed: ${r.title}`));
    for (const r of liveRuns) {
      await p4.goto(`${BASE}/runbooks/${r.id}`);
      check(await seen(p4.getByRole('heading', { name: r.title })), tag(`live v1 run opens: ${r.title}`));
    }
    const ph = liveRuns.find((r) => r.chainId === 'phishing' && r.choices.triage === 'escalate' && r.status === 'active');
    if (ph) {
      await p4.goto(`${BASE}/runbooks/${ph.id}`);
      await p4.fill('#rb-escalate-hosts', 'WS-0142');
      await p4.getByRole('button', { name: 'Start 1 EDR Alert run' }).click();
      await p4.locator(LINKED).first().waitFor();
    }
    const after = await p4.evaluate(() => JSON.parse(localStorage.getItem('btm-runbooks-v1')));
    check(after.version === 1 && liveRuns.every((r) => after.state.runs[r.id]), tag('live v1 runs kept, storage still version 1'));
    check(errors4.length === 0, tag(`no page errors on live v1 data ${errors4.join(' | ')}`));
    await ctx4.close();
  }
  await ctx.close();
}
await browser.close();
console.log(log.join('\n'));
console.log(process.exitCode ? 'BROWSER CHECK FAILED' : 'BROWSER CHECK PASSED');
```

- [ ] **Step 6: Run the browser check**

```bash
mkdir -p $SP/shots && cd <repo> && (npx vite preview --outDir $SP/after-dist --port 4173 --strictPort >$SP/preview-after.log 2>&1 &) ; sleep 3; cd $SP/pw && PLAYWRIGHT_BROWSERS_PATH=$SP/pw/browsers BASE=http://localhost:4173/BlueTeamMapper FIXTURE=<repo>/src/lib/__fixtures__/runbooks-v1.json LIVE_V1=$SP/v1-live.json OUT=$SP/shots timeout 300 node linked-runs-check.mjs; lsof -ti:4173 -sTCP:LISTEN | xargs -r kill
```
Expected: every line `PASS`, ending with `BROWSER CHECK PASSED`. That is 37 checks per viewport, 74 in all.

On a `FAIL`, fix the cause in the task that owns the code and commit it there. Do not loosen the check.

Look at the eight screenshots in `$SP/shots` (desktop and phone: parent, child, left the path, list). The user reviews changes visually, so share them, for example as a private review page.

- [ ] **Step 7: Changelog**

In `README.md` under `### v4.2 (unreleased)`, add:
```
- Linked runbooks: on a phishing run that took "Execution found", the Escalate to P1 incident step starts one
  EDR Alert run per affected host (typed or pasted, duplicates skipped, at most 50 at a time). Each linked run
  has its own checklist and timeline, a "Linked from" line and the host; the parent lists its linked runs with
  status, progress and current step
- The runbooks list nests linked runs under their parent when both are open or both are closed; the close
  confirmation counts open linked runs; changing a branch warns when linked runs were started from a step that
  leaves the path, and that step keeps its record and its runs under "Left the path"
- Incident exports: Copy or Download the incident Markdown (the parent then each linked run) and Download
  incident JSON; Import JSON reads either format and keeps the links when IDs change
- Tests: Vitest over the pure helpers in src/lib, run in CI on every pull request
```
Then run `cd <repo> && grep -nP '[\x{2013}\x{2014}]' README.md docs/superpowers/plans/2026-10-27-linked-runbooks.md src -r`.
Expected: no output.

- [ ] **Step 8: Commit and hand off**

```bash
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git add README.md && GIT_CONFIG_GLOBAL=/dev/null git commit -m "Add linked runbooks to the changelog"
cd <repo> && GIT_CONFIG_GLOBAL=/dev/null git log --oneline main..HEAD
```
Expected: 14 commits.

Then:
1. Give the user one-line `!` commands to push `feat/linked-runbooks` and open the PR. Use the `GH_TOKEN=$(gh auth token --user umbrasec-labs)` pattern, and remove `.git/config.lock` first if present. The PR body has a "Beyond the spec" list with the spawn-tick lock and the 50-host cap (see "Beyond the spec" above), and says whether the user agreed to each one.
2. The new `ci` workflow runs on the PR. Merge only when it and `gitleaks` are green.
3. After the merge, update the workspace `START-HERE.md` task list and the `CLAUDE.md` State section. Both sit in the workspace root, not in this repo.
