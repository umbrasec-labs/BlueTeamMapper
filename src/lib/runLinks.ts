import type { FlowChain, Severity } from '@/data/types';
import { newRunId, own, type HostSubject, type LogKind, type Run, type RunLink } from './runbook';

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
