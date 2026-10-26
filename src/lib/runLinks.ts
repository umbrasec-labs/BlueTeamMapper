import type { FlowChain, FlowStep, Severity } from '@/data/types';
import {
  byStart,
  childRuns,
  defaultChildTitle,
  HOST_MAX,
  HOSTS_PER_START,
  hostOf,
  linkOf,
  newRunId,
  own,
  RUN_ID_RE,
  runPath,
  type HostSubject,
  type LogKind,
  type Run,
  type RunLink,
} from './runbook';

/**
 * Pure run edits that the runbooks store wraps in one `set()` each: building runs, starting
 * linked runs, and the writes that touch more than one run. Chains come in as a parameter.
 */

export type Chains = Record<string, FlowChain>;

/** A run being changed, with a logger that stamps every entry with the same time. */
export type Draft = { run: Run; chain: FlowChain; at: string; log: (kind: LogKind, text: string, stepId?: string) => void };

export function draft(run: Run, chain: FlowChain, at: string): Draft {
  return { run, chain, at, log: (kind, text, stepId) => run.log.push({ at, kind, text, ...(stepId ? { stepId } : {}) }) };
}

export function activate(d: Draft, stepId: string) {
  const s = d.run.steps[stepId];
  if (!s || s.status !== 'pending') return;
  s.status = 'active';
  s.startedAt ??= d.at;
  d.log('step', 'Started', stepId);
}

/** Runs outlive data edits: give every chain step a record with one flag per action. */
export function normalize(run: Run, chain: FlowChain) {
  for (const step of chain.steps) {
    const rec = (run.steps[step.id] ??= { status: 'pending', actions: [], notes: '' });
    rec.actions = step.actions.map((_, i) => rec.actions[i] === true);
  }
}

/** A new id that none of `runs` uses. */
export function freeId(runs: Record<string, Run>, gen: () => string = newRunId): string {
  let id = gen();
  while (own(runs, id)) id = gen();
  return id;
}

export interface NewRunFields {
  title: string;
  lead: string;
  severity: Severity;
  parent?: RunLink;
  subject?: HostSubject;
}

/** A fresh run: first step in progress, every other step pending. A linked run's timeline opens with its parent. */
export function newRun(chain: FlowChain, id: string, at: string, f: NewRunFields): Run {
  return {
    id,
    chainId: chain.id,
    title: f.title,
    lead: f.lead,
    severity: f.severity,
    startedAt: at,
    status: 'active',
    steps: Object.fromEntries(
      chain.steps.map((s, i) => [
        s.id,
        { status: i === 0 ? 'active' : 'pending', ...(i === 0 ? { startedAt: at } : {}), actions: s.actions.map(() => false), notes: '' },
      ]),
    ),
    choices: {},
    log: [
      ...(f.parent ? [{ at, kind: 'run' as const, text: `Linked from ${f.parent.title}` }] : []),
      { at, kind: 'run', text: `Incident opened on the ${chain.title} runbook` },
      { at, kind: 'step', text: 'Started', stepId: chain.steps[0].id },
    ],
    ...(f.parent ? { parent: f.parent } : {}),
    ...(f.subject ? { subject: f.subject } : {}),
  };
}

/** "EDR Alert on WS-0142" for a host run, else the run's title. */
export const linkName = (run: Run, chains: Chains) => {
  const host = hostOf(run);
  return host ? `${own(chains, run.chainId)?.title ?? run.chainId} on ${host}` : run.title;
};

/** True when linked runs can start from this step: an open parent, a spawn point, and the step on the path. */
export function canLinkFrom(runs: Record<string, Run>, chains: Chains, parentId: string, stepId: string): boolean {
  const parent = own(runs, parentId);
  const chain = parent && own(chains, parent.chainId);
  if (!parent || !chain || parent.status !== 'active') return false;
  const spawns = chain.steps.find((s) => s.id === stepId)?.spawns;
  if (!spawns || !own(chains, spawns.chainId)) return false;
  return runPath(chain, parent.choices).steps.some((s) => s.id === stepId);
}

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
  if (!canLinkFrom(runs, chains, parentId, stepId)) return null;
  const parent = own(runs, parentId);
  const chain = parent && own(chains, parent.chainId);
  const step = chain?.steps.find((s) => s.id === stepId);
  const spawns = step?.spawns;
  const childChain = spawns && own(chains, spawns.chainId);
  if (!parent || !chain || !step || !spawns || !childChain) return null;

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

/** Close an open run; tell its parent. Unchanged (same object) when there is nothing to do. */
export function closeRunIn(runs: Record<string, Run>, chains: Chains, runId: string, at: string): Record<string, Run> {
  const cur = own(runs, runId);
  const chain = cur && own(chains, cur.chainId);
  if (!cur || !chain || cur.status === 'closed') return runs;
  const run: Run = structuredClone(cur);
  normalize(run, chain);
  run.status = 'closed';
  run.closedAt = at;
  draft(run, chain, at).log('run', 'Incident closed');
  return noteParent({ ...runs, [runId]: run }, chains, run, 'Linked run closed', at);
}

export function reopenRunIn(runs: Record<string, Run>, chains: Chains, runId: string, at: string): Record<string, Run> {
  const cur = own(runs, runId);
  const chain = cur && own(chains, cur.chainId);
  if (!cur || !chain || cur.status !== 'closed') return runs;
  const run: Run = structuredClone(cur);
  normalize(run, chain);
  run.status = 'active';
  delete run.closedAt;
  draft(run, chain, at).log('run', 'Incident reopened');
  return noteParent({ ...runs, [runId]: run }, chains, run, 'Linked run reopened', at);
}

/** Delete a run. Its own linked runs stay; an open parent gets an entry. */
export function deleteRunIn(runs: Record<string, Run>, chains: Chains, runId: string, at: string): Record<string, Run> {
  const cur = own(runs, runId);
  if (!cur) return runs;
  const next = { ...runs };
  delete next[runId];
  return noteParent(next, chains, cur, 'Linked run deleted', at);
}

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
