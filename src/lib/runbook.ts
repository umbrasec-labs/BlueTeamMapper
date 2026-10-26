import type { FlowChain, FlowStep, Severity } from '@/data/types';
import { stepEdges, type StepEdge } from './graphLayout';

/**
 * Live IR runbooks: one run of a flow chain during a real incident.
 * Types and pure helpers shared by the store, the views and the exporters.
 */

export type StepStatus = 'pending' | 'active' | 'done' | 'skipped';
export type RunStatus = 'active' | 'closed';
export type LogKind = 'run' | 'step' | 'action' | 'note' | 'approval' | 'branch' | 'entry' | 'link';

export interface StepRecord {
  status: StepStatus;
  startedAt?: string;
  /** When the step was marked done or skipped. */
  doneAt?: string;
  /** One flag per entry in the step's `actions`. */
  actions: boolean[];
  notes: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface LogEntry {
  at: string;
  stepId?: string;
  kind: LogKind;
  /** For 'note' entries this is the note itself; an empty string means the notes were cleared. */
  text: string;
}

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

export interface Run {
  id: string;
  chainId: string;
  title: string;
  lead: string;
  severity: Severity;
  startedAt: string;
  closedAt?: string;
  status: RunStatus;
  steps: Record<string, StepRecord>;
  /** Decision step id -> the successor the analyst picked. */
  choices: Record<string, string>;
  log: LogEntry[];
  /** Set on a run started from another run's step. */
  parent?: RunLink;
  /** What this run is about, e.g. the host name. */
  subject?: HostSubject;
}

export const severities: Severity[] = ['critical', 'high', 'medium', 'low'];

export const stepStatusLabel: Record<StepStatus, string> = {
  pending: 'Pending',
  active: 'In progress',
  done: 'Done',
  skipped: 'Skipped',
};

export const logKindLabel: Record<LogKind, string> = {
  run: 'Incident',
  step: 'Step',
  action: 'Action',
  note: 'Note',
  approval: 'Approval',
  branch: 'Branch',
  entry: 'Entry',
  link: 'Linked run',
};

/** Label for any stored kind, including one a later release added: never an inherited method. */
export const kindLabel = (kind: string) => own(logKindLabel, kind) ?? 'Entry';

/** Timeline text for an entry. Notes store the raw note, so give them a readable form. */
export function logText(entry: LogEntry): string {
  if (entry.kind !== 'note') return entry.text;
  return entry.text ? `Note: ${entry.text}` : 'Notes cleared';
}

const edgeCache = new Map<string, StepEdge[]>();

function chainEdges(chain: FlowChain): StepEdge[] {
  let edges = edgeCache.get(chain.id);
  if (!edges) {
    edges = stepEdges(chain.steps);
    edgeCache.set(chain.id, edges);
  }
  return edges;
}

/** Outgoing edges of a step. More than one means the analyst has to pick a branch. */
export function successors(chain: FlowChain, stepId: string): StepEdge[] {
  return chainEdges(chain).filter((e) => e.source === stepId);
}

export const isDecision = (chain: FlowChain, stepId: string) => successors(chain, stepId).length > 1;

export interface BranchRef {
  from: FlowStep;
  label: string;
  to: FlowStep;
}

export interface RunPath {
  /** Steps on the chosen path, in order. */
  steps: FlowStep[];
  /** A decision step on the path with no branch picked yet. The path stops there. */
  awaiting: FlowStep | null;
  /** Steps that depend on the pending decision. */
  undecided: FlowStep[];
  /** Steps no longer reachable on the chosen path. */
  notTaken: FlowStep[];
  taken: BranchRef[];
  branchesNotTaken: BranchRef[];
}

/**
 * Walk the chain from its first step. Single successors are followed; at a decision
 * step the analyst's choice is followed, or the walk stops until one is made.
 */
export function runPath(chain: FlowChain, choices: Record<string, string>): RunPath {
  const byId = Object.fromEntries(chain.steps.map((s) => [s.id, s]));
  const steps: FlowStep[] = [];
  const seen = new Set<string>();
  const taken: BranchRef[] = [];
  const branchesNotTaken: BranchRef[] = [];
  let awaiting: FlowStep | null = null;
  let cursor: FlowStep | undefined = chain.steps[0];

  while (cursor && !seen.has(cursor.id)) {
    const step: FlowStep = cursor;
    seen.add(step.id);
    steps.push(step);
    const out = successors(chain, step.id);
    if (out.length === 0) break;
    if (out.length === 1) {
      cursor = byId[out[0].target];
      continue;
    }
    const pick = out.find((e) => e.target === choices[step.id]);
    if (!pick) {
      awaiting = step;
      break;
    }
    for (const e of out) {
      const ref = { from: step, label: e.label ?? byId[e.target].label, to: byId[e.target] };
      if (e === pick) taken.push(ref);
      else branchesNotTaken.push(ref);
    }
    cursor = byId[pick.target];
  }

  const undecidedIds = new Set<string>();
  if (awaiting) {
    const queue = successors(chain, awaiting.id).map((e) => e.target);
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id) || undecidedIds.has(id)) continue;
      undecidedIds.add(id);
      queue.push(...successors(chain, id).map((e) => e.target));
    }
  }

  return {
    steps,
    awaiting,
    undecided: chain.steps.filter((s) => undecidedIds.has(s.id)),
    notTaken: chain.steps.filter((s) => !seen.has(s.id) && !undecidedIds.has(s.id)),
    taken,
    branchesNotTaken,
  };
}

export const isFinished = (s: StepStatus | undefined) => s === 'done' || s === 'skipped';

/** `rec[key]` only when it is the object's own key, so "constructor" or "toString" never match. */
export const own = <T>(rec: Record<string, T>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(rec, key) ? rec[key] : undefined;

/** A step's record, or a blank pending one if the chain gained the step after the run started. */
export function stepRecord(run: Run, step: FlowStep): StepRecord {
  return run.steps[step.id] ?? { status: 'pending', actions: step.actions.map(() => false), notes: '' };
}

/** Anything recorded on a step: started, finished, a ticked action, notes or an approval. */
export const hasActivity = (r: StepRecord) =>
  !!r.startedAt || isFinished(r.status) || r.actions.some(Boolean) || !!r.notes.trim() || !!r.approvedBy;

/**
 * Split the steps off the path. `worked` left the path when a branch changed, but have a record
 * that the ticket needs. `notRun` were never touched.
 */
export function splitNotTaken(run: Run, path: RunPath): { worked: FlowStep[]; notRun: FlowStep[] } {
  const worked = path.notTaken.filter((s) => hasActivity(stepRecord(run, s)));
  return { worked, notRun: path.notTaken.filter((s) => !worked.includes(s)) };
}

/** Fewest steps from `stepId` (inclusive) to the end of the chain, following branches already picked. */
function minSteps(chain: FlowChain, choices: Record<string, string>, stepId: string, seen: Set<string>): number {
  if (seen.has(stepId)) return 0;
  const out = successors(chain, stepId);
  if (out.length === 0) return 1;
  const picked = out.length === 1 ? out[0] : out.find((e) => e.target === choices[stepId]);
  const next = new Set(seen).add(stepId);
  return 1 + Math.min(...(picked ? [picked] : out).map((e) => minSteps(chain, choices, e.target, next)));
}

export interface RunProgress {
  path: RunPath;
  done: number;
  /** Steps on the path. While a branch is still to be picked, the shortest way to the end. */
  total: number;
  /** True while `total` is a lower bound because a branch is still to be picked. */
  estimated: boolean;
  pct: number;
  /** Every step on a fully decided path is done or skipped. */
  complete: boolean;
  /** The step to work on now: the first one in progress, else the first pending one. */
  current: FlowStep | null;
}

export function runProgress(run: Run, chain: FlowChain): RunProgress {
  const path = runPath(chain, run.choices);
  const done = path.steps.filter((s) => isFinished(run.steps[s.id]?.status)).length;
  // While a decision is open, count the shortest way to the end through its branches. Picking a
  // branch then adds only the extra steps that branch needs, instead of the whole rest of the path.
  let rest = 0;
  if (path.awaiting) {
    const seen = new Set(path.steps.map((s) => s.id));
    const options = successors(chain, path.awaiting.id).map((e) => minSteps(chain, run.choices, e.target, seen));
    rest = Math.max(1, Math.min(...options));
  }
  const total = path.steps.length + rest;
  const current =
    path.steps.find((s) => run.steps[s.id]?.status === 'active') ??
    path.steps.find((s) => run.steps[s.id]?.status === 'pending') ??
    null;
  return {
    path,
    done,
    total,
    estimated: !!path.awaiting,
    pct: Math.round((done / total) * 100),
    complete: !path.awaiting && done === path.steps.length,
    current,
  };
}

/** "3 of 7" or, while a branch is still to be picked, "2 of at least 6". */
export const progressCount = (p: RunProgress) => `${p.done} of ${p.estimated ? 'at least ' : ''}${p.total}`;

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Short random id, 8 characters from a 32-symbol alphabet (40 bits). */
export function newRunId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ID_ALPHABET[b & 31]).join('');
}

export const RUN_ID_RE = /^[a-z0-9]{4,32}$/;

export function defaultRunTitle(chain: FlowChain, at = new Date()): string {
  return `${chain.title} incident ${at.toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
}

/* Linked runs ------------------------------------------------------- */

/** Longest host name kept (a DNS name is at most 253 characters). */
export const HOST_MAX = 253;
/** Most hosts one "Start" creates runs for, so a pasted asset export cannot fill storage. */
export const HOSTS_PER_START = 50;

export interface ParsedHosts {
  /** New hosts to start, in the order typed, at most HOSTS_PER_START. */
  hosts: string[];
  /** Hosts in `skip` (already linked), in the order typed. They do not count toward the cap. */
  already: string[];
  /** Entries longer than HOST_MAX, left out. */
  tooLong: number;
  /** Repeats inside the text (case-insensitive), left out. */
  dupes: number;
  /** Further new hosts past HOSTS_PER_START, left out for a later start. */
  extra: number;
}

/**
 * Hosts typed or pasted one per line, or separated by commas or spaces. Duplicates match
 * case-insensitively and keep the first spelling. `skip` holds lower-cased hosts already linked.
 */
export function parseHosts(text: string, skip: ReadonlySet<string> = new Set()): ParsedHosts {
  const seen = new Set<string>();
  const out: ParsedHosts = { hosts: [], already: [], tooLong: 0, dupes: 0, extra: 0 };
  for (const token of text.split(/[\s,]+/)) {
    if (!token) continue;
    if (token.length > HOST_MAX) {
      out.tooLong++;
      continue;
    }
    const key = token.toLowerCase();
    if (seen.has(key)) {
      out.dupes++;
      continue;
    }
    seen.add(key);
    if (skip.has(key)) out.already.push(token);
    else if (out.hosts.length < HOSTS_PER_START) out.hosts.push(token);
    else out.extra++;
  }
  return out;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shortStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** A well-formed parent link. Runs loaded from storage skip import checks, so readers go through this. */
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

/** Runs linked from run `id` (from one of its steps if `stepId` is given), in start order. */
export function childRuns(runs: Record<string, Run>, id: string, stepId?: string): Run[] {
  return Object.values(runs)
    .filter((r) => {
      const l = linkOf(r);
      return !!l && l.runId === id && r.id !== id && (!stepId || l.stepId === stepId);
    })
    .sort(byStart);
}

export interface ChildSummary {
  total: number;
  open: number;
  closed: number;
  /** "3 linked runs, 1 open". */
  text: string;
}

export function childSummary(children: Run[]): ChildSummary {
  const open = children.filter((c) => c.status === 'active').length;
  const total = children.length;
  return { total, open, closed: total - open, text: `${total} linked ${total === 1 ? 'run' : 'runs'}, ${open} open` };
}

/** "EDR Alert on WS-0142 (Phishing incident 24 Oct 2026)". */
export const defaultChildTitle = (chain: FlowChain, host: string, parent: Run) => `${chain.title} on ${host} (${parent.title})`;

/** How the close confirmation counts what is still open; empty when nothing is. */
export function closeWarning(openSteps: number, estimated: boolean, openChildren: number): string {
  const atLeast = estimated ? 'At least ' : '';
  const steps = (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`;
  const kids = (n: number) => `${n} linked ${n === 1 ? 'run' : 'runs'}`;
  if (openSteps > 0 && openChildren > 0) return `${atLeast}${steps(openSteps)} and ${kids(openChildren)} are still open.`;
  if (openSteps > 0) return `${atLeast}${steps(openSteps)} ${openSteps === 1 ? 'is' : 'are'} still open.`;
  if (openChildren > 0) return `${kids(openChildren)} ${openChildren === 1 ? 'is' : 'are'} still open.`;
  return '';
}

/** "<1m", "12m", "1h 05m", "2d 3h". */
export function formatDuration(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${String(mins % 60).padStart(2, '0')}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Run length so far, or in total once closed. */
export function runElapsed(run: Run, now: number): number {
  const end = run.closedAt ? Date.parse(run.closedAt) : now;
  return end - Date.parse(run.startedAt);
}

/** ISO 8601 in UTC without milliseconds: 2026-10-23T14:05:09Z. */
export const isoUtc = (iso: string) => new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z');

export const localDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const localTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const localDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

export function timeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  } catch {
    return 'local time';
  }
}
