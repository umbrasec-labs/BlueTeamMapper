import type { FlowChain, FlowStep, Severity } from '@/data/types';
import {
  childRuns,
  defaultChildTitle,
  HOST_MAX,
  HOSTS_PER_START,
  hostOf,
  newRunId,
  own,
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
