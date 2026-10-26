import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { flowChainById, type Severity } from '@/data';
import { defaultRunTitle, isFinished, own, RUN_ID_RE, runPath, successors, type Run, type StepRecord, type StepStatus } from '@/lib/runbook';
import { activate, draft, freeId, newRun, normalize, type Draft } from '@/lib/runLinks';
import { severityMeta } from '@/lib/hues';

export type { LogEntry, LogKind, Run, StepRecord, StepStatus } from '@/lib/runbook';

/**
 * Live IR runbook runs. Like the coverage assessment, these live only in this
 * browser (localStorage). Export a run as Markdown or JSON to keep it anywhere else.
 */
export interface NewRun {
  chainId: string;
  title?: string;
  lead?: string;
  severity?: Severity;
}

/** Why an imported run kept its ID or got a new one. */
export type ImportIdReason = 'kept' | 'duplicate' | 'invalid';

interface RunbooksState {
  runs: Record<string, Run>;
  /** Returns the new run's id, or null for an unknown chain. */
  createRun: (input: NewRun) => string | null;
  setStepStatus: (runId: string, stepId: string, status: StepStatus) => void;
  toggleAction: (runId: string, stepId: string, index: number) => void;
  /** Saves on every call; adds a timeline entry only when `commit` is true (on blur) and the note changed. */
  setNotes: (runId: string, stepId: string, notes: string, commit?: boolean) => void;
  /** An empty name withdraws the approval (only before the step is done). */
  approveGate: (runId: string, stepId: string, name: string) => void;
  chooseBranch: (runId: string, stepId: string, nextStepId: string) => void;
  /** A free-text timeline entry, e.g. "Called the on-call lawyer". */
  addEntry: (runId: string, text: string) => void;
  /** Rename the incident or change its lead or severity. Each change is logged. */
  updateDetails: (runId: string, patch: { title?: string; lead?: string; severity?: Severity }) => void;
  closeRun: (runId: string) => void;
  reopenRun: (runId: string) => void;
  deleteRun: (runId: string) => void;
  /** Adds a validated run. The id is new if the file's id is taken or not valid. */
  importRun: (run: Run) => { id: string; reason: ImportIdReason };
}

const STORE_KEY = 'btm-runbooks-v1';

type SyncStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// localStorage can throw (private windows, blocked storage); fall back to memory.
function pickStorage(): SyncStorage {
  try {
    const probe = '__btm_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
}

const backing = pickStorage();

/**
 * The stored JSON as this tab last read or wrote it. If storage holds anything else,
 * another tab saved since, and this tab's copy of the runs is out of date.
 */
let lastRaw: string | null = null;

const tracked: SyncStorage = {
  getItem: (k) => {
    const v = backing.getItem(k);
    if (k === STORE_KEY) lastRaw = v;
    return v;
  },
  setItem: (k, v) => {
    backing.setItem(k, v);
    if (k === STORE_KEY) lastRaw = v;
  },
  removeItem: (k) => {
    backing.removeItem(k);
    if (k === STORE_KEY) lastRaw = null;
  },
};

const safeStorage = createJSONStorage<{ runs: Record<string, Run> }>(() => tracked);

/**
 * The runs to change: this tab's copy, or the stored runs when another tab saved after this
 * tab last read them. Every write starts from the latest runs, so one tab never overwrites
 * runs or edits that another tab saved a moment earlier.
 */
function latestRuns(current: Record<string, Run>): Record<string, Run> {
  let raw: string | null;
  try {
    raw = backing.getItem(STORE_KEY);
  } catch {
    return current;
  }
  // Nothing stored (site data cleared elsewhere): keep this tab's copy rather than lose it.
  if (raw === null || raw === lastRaw) return current;
  try {
    const runs: unknown = (JSON.parse(raw) as { state?: { runs?: unknown } }).state?.runs;
    if (runs && typeof runs === 'object' && !Array.isArray(runs)) return runs as Record<string, Run>;
  } catch {
    // Unreadable JSON: keep this tab's copy.
  }
  return current;
}

/**
 * After a step finishes, start the next unfinished step: follow the only successor, or the
 * branch already chosen, past any steps that are already done or skipped.
 */
function advance(d: Draft, stepId: string) {
  const seen = new Set([stepId]);
  let from = stepId;
  for (;;) {
    const out = successors(d.chain, from);
    const target = out.length === 1 ? out[0].target : d.run.choices[from];
    if (!target || seen.has(target)) return;
    const s = d.run.steps[target];
    if (!s) return;
    if (!isFinished(s.status)) return activate(d, target);
    seen.add(target);
    from = target;
  }
}

function finish(d: Draft, stepId: string, status: 'done' | 'skipped') {
  const s = d.run.steps[stepId];
  const step = d.chain.steps.find((x) => x.id === stepId);
  if (!s || !step || s.status === status) return;
  if (status === 'done' && step.gate && !s.approvedBy) return;
  s.status = status;
  s.startedAt ??= d.at;
  s.doneAt = d.at;
  d.log('step', status === 'done' ? 'Marked done' : step.gate && !s.approvedBy ? 'Skipped (no approval recorded)' : 'Skipped', stepId);
  advance(d, stepId);
}

/** In progress, but nothing ticked, noted or approved yet. */
const untouched = (s: StepRecord) => !s.notes.trim() && !s.approvedBy && !s.actions.some(Boolean);

/**
 * After a branch changes, a step the old branch started can be left in progress with no work
 * on it: off the new path, or further down it than the new branch has reached (for example
 * after a gate that is not approved yet). Put those back to pending. Steps with work keep it.
 */
function resetStranded(d: Draft, newTarget: string) {
  const path = runPath(d.chain, d.run.choices);
  const at = path.steps.findIndex((s) => s.id === newTarget);
  const keep = new Set(path.steps.slice(0, at + 1).map((s) => s.id));
  for (const step of d.chain.steps) {
    const s = d.run.steps[step.id];
    if (!s || s.status !== 'active' || keep.has(step.id) || !untouched(s)) continue;
    s.status = 'pending';
    delete s.startedAt;
    delete s.doneAt;
    d.log('step', 'Reset to pending after the branch changed', step.id);
  }
}

const lastNote = (run: Run, stepId: string) =>
  [...run.log].reverse().find((e) => e.kind === 'note' && e.stepId === stepId)?.text ?? '';

export const useRunbooks = create<RunbooksState>()(
  persist(
    (set) => {
      /** Apply a change to one run. Closed runs only accept `allowClosed` changes. */
      const mutate = (runId: string, fn: (d: Draft) => void, { allowClosed = false } = {}) =>
        set((state) => {
          const runs = latestRuns(state.runs);
          const current = own(runs, runId);
          const chain = current && flowChainById[current.chainId];
          // No change to make; still adopt runs another tab saved, so the write keeps them.
          if (!current || !chain || (current.status === 'closed' && !allowClosed)) return runs === state.runs ? state : { runs };
          const run: Run = structuredClone(current);
          normalize(run, chain);
          fn(draft(run, chain, new Date().toISOString()));
          return { runs: { ...runs, [runId]: run } };
        });

      return {
        runs: {},

        createRun: ({ chainId, title, lead, severity }) => {
          const chain = flowChainById[chainId];
          if (!chain) return null;
          let id: string | null = null;
          set((state) => {
            const runs = latestRuns(state.runs);
            const newId = freeId(runs);
            const run = newRun(chain, newId, new Date().toISOString(), {
              title: title?.trim() || defaultRunTitle(chain),
              lead: lead?.trim() ?? '',
              severity: severity ?? chain.severity,
            });
            id = newId;
            return { runs: { ...runs, [newId]: run } };
          });
          return id;
        },

        setStepStatus: (runId, stepId, status) =>
          mutate(runId, (d) => {
            const s = d.run.steps[stepId];
            if (!s) return;
            if (status === 'done' || status === 'skipped') return finish(d, stepId, status);
            if (status === 'active') {
              if (s.status === 'pending') return activate(d, stepId);
              if (s.status === 'done' || s.status === 'skipped') {
                s.status = 'active';
                delete s.doneAt;
                d.log('step', 'Reopened', stepId);
              }
              return;
            }
            if (s.status !== 'pending') {
              s.status = 'pending';
              delete s.startedAt;
              delete s.doneAt;
              d.log('step', 'Reset to pending', stepId);
            }
          }),

        toggleAction: (runId, stepId, index) =>
          mutate(runId, (d) => {
            const s = d.run.steps[stepId];
            const text = d.chain.steps.find((x) => x.id === stepId)?.actions[index];
            if (!s || text === undefined) return;
            activate(d, stepId);
            s.actions[index] = !s.actions[index];
            d.log('action', `${s.actions[index] ? 'Checked' : 'Unchecked'}: ${text}`, stepId);
          }),

        setNotes: (runId, stepId, notes, commit = false) =>
          mutate(runId, (d) => {
            const s = d.run.steps[stepId];
            if (!s) return;
            s.notes = notes;
            if (!commit) return;
            const text = notes.trim();
            if (text !== lastNote(d.run, stepId)) d.log('note', text, stepId);
          }),

        approveGate: (runId, stepId, name) =>
          mutate(runId, (d) => {
            const s = d.run.steps[stepId];
            const step = d.chain.steps.find((x) => x.id === stepId);
            if (!s || !step?.gate) return;
            const who = name.trim();
            if (who) {
              activate(d, stepId);
              s.approvedBy = who;
              s.approvedAt = d.at;
              d.log('approval', `Approved by ${who}`, stepId);
            } else if (s.approvedBy && s.status !== 'done') {
              delete s.approvedBy;
              delete s.approvedAt;
              d.log('approval', 'Approval withdrawn', stepId);
            }
          }),

        chooseBranch: (runId, stepId, nextStepId) =>
          mutate(runId, (d) => {
            const out = successors(d.chain, stepId);
            const edge = out.find((e) => e.target === nextStepId);
            const s = d.run.steps[stepId];
            if (!s || !edge || out.length < 2 || d.run.choices[stepId] === nextStepId) return;
            const target = d.chain.steps.find((x) => x.id === nextStepId)!;
            const changed = stepId in d.run.choices;
            d.run.choices[stepId] = nextStepId;
            d.log('branch', `${changed ? 'Changed branch to' : 'Took branch'} "${edge.label ?? target.label}" → ${target.label}`, stepId);
            if (changed) resetStranded(d, nextStepId);
            // Picking the outcome finishes the decision step, unless its gate still needs approval.
            if (s.status === 'done' || s.status === 'skipped') advance(d, stepId);
            else finish(d, stepId, 'done');
          }),

        addEntry: (runId, text) =>
          mutate(runId, (d) => {
            const t = text.trim();
            if (t) d.log('entry', t);
          }),

        updateDetails: (runId, { title, lead, severity }) =>
          mutate(runId, (d) => {
            const t = title?.trim();
            if (t && t !== d.run.title) {
              d.run.title = t;
              d.log('run', `Title set to "${t}"`);
            }
            const l = lead?.trim();
            if (l !== undefined && l !== d.run.lead) {
              d.run.lead = l;
              d.log('run', l ? `Lead set to ${l}` : 'Lead cleared');
            }
            if (severity && severity !== d.run.severity) {
              d.run.severity = severity;
              d.log('run', `Severity set to ${severityMeta[severity].label}`);
            }
          }),

        closeRun: (runId) =>
          mutate(runId, (d) => {
            d.run.status = 'closed';
            d.run.closedAt = d.at;
            d.log('run', 'Incident closed');
          }),

        reopenRun: (runId) =>
          mutate(
            runId,
            (d) => {
              if (d.run.status !== 'closed') return;
              d.run.status = 'active';
              delete d.run.closedAt;
              d.log('run', 'Incident reopened');
            },
            { allowClosed: true },
          ),

        deleteRun: (runId) =>
          set((state) => {
            const runs = { ...latestRuns(state.runs) };
            delete runs[runId];
            return { runs };
          }),

        importRun: (incoming) => {
          let result: { id: string; reason: ImportIdReason } = { id: '', reason: 'kept' };
          set((state) => {
            const runs = latestRuns(state.runs);
            const valid = RUN_ID_RE.test(incoming.id);
            const taken = valid && own(runs, incoming.id) !== undefined;
            const id = valid && !taken ? incoming.id : freeId(runs);
            result = { id, reason: !valid ? 'invalid' : taken ? 'duplicate' : 'kept' };
            return { runs: { ...runs, [id]: { ...incoming, id } } };
          });
          return result;
        },
      };
    },
    { name: STORE_KEY, storage: safeStorage, version: 1, partialize: (s) => ({ runs: s.runs }) },
  ),
);

// Another tab saved: load its runs here too. Rehydrating sets state without writing it back,
// so this cannot loop between tabs. A null key means that tab cleared all of storage.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY || e.key === null) void useRunbooks.persist.rehydrate();
  });
}

/** Runs newest first. */
export const sortRuns = (runs: Record<string, Run>) =>
  Object.values(runs).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
