import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileDown,
  FileJson,
  GitBranch,
  Hand,
  HardDrive,
  Link2,
  Lock,
  Pencil,
  Play,
  Plus,
  Radar,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Unlock,
} from 'lucide-react';
import { flowChainById, type FlowChain, type FlowStep, type Severity } from '@/data';
import { useRunbooks, type LogKind, type Run } from '@/store/runbooks';
import {
  childRuns,
  childSummary,
  closeWarning,
  formatDuration,
  HOST_MAX,
  hostOf,
  HOSTS_PER_START,
  isFinished,
  isoUtc,
  linkOf,
  localDate,
  localDateTime,
  localTime,
  logText,
  own,
  parseHosts,
  progressCount,
  runElapsed,
  runProgress,
  severities,
  splitNotTaken,
  stepRecord,
  successors,
  type RunProgress,
} from '@/lib/runbook';
import {
  copyText,
  downloadIncidentJson,
  downloadRunJson,
  downloadText,
  incidentToMarkdown,
  runFileName,
  runToMarkdown,
} from '@/lib/runbookExport';
import { canLinkFrom, childrenLeavingPath } from '@/lib/runLinks';
import { evidenceLink } from '@/lib/evidence';
import { useNow } from '@/lib/useNow';
import { hueClass, severityMeta } from '@/lib/hues';
import { icons } from '@/lib/icons';
import { PhasePill, SeverityBadge } from '@/components/Badges';
import { EmptyState } from '@/components/Feedback';
import { DeleteRunButton, RunProgressBar, RunStatusChip, StepStatusChip } from '@/components/Runbook';

const inputCls =
  'h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-fog-bright outline-none placeholder:text-fog-muted focus:border-ember/50 disabled:opacity-50';

const kindDot: Record<LogKind, string> = {
  run: 'bg-ember',
  step: 'bg-teal',
  action: 'bg-fog-muted',
  note: 'bg-slate',
  approval: 'bg-gold',
  branch: 'bg-mauve',
  entry: 'bg-khaki',
  link: 'bg-rose',
};

const store = () => useRunbooks.getState();

type Notice = { tone: 'ok' | 'error'; text: string };

/** A request to open a step card and bring it into view. `n` makes a repeat click count. */
type Reveal = { id: string; n: number };

/** Ids of the controls that focus moves between. */
const ids = {
  card: (stepId: string) => `rb-step-${stepId}`,
  toggle: (stepId: string) => `rb-step-${stepId}-toggle`,
  done: (stepId: string) => `rb-step-${stepId}-done`,
  branch: (stepId: string, i: number) => `rb-step-${stepId}-branch-${i}`,
  approver: (stepId: string) => `rb-${stepId}-approver`,
  withdraw: (stepId: string) => `rb-step-${stepId}-withdraw`,
  hosts: (stepId: string) => `rb-${stepId}-hosts`,
  child: (runId: string) => `rb-linked-${runId}`,
};

/**
 * Focus the first of these elements that exists and is enabled once React has rendered the
 * change. Used when the control that had focus goes away, so keyboard users keep their place.
 */
function focusSoon(...targets: string[]) {
  const from = document.activeElement;
  requestAnimationFrame(() => {
    // Focus already moved somewhere else (the analyst clicked or tabbed on): leave it there.
    const now = document.activeElement;
    if (now && now !== from && now !== document.body) return;
    for (const id of targets) {
      const el = document.getElementById(id);
      if (el && !(el instanceof HTMLButtonElement && el.disabled)) {
        el.focus();
        return;
      }
    }
  });
}

/** What step cards call after a change: announce it, and move focus to where the work goes on. */
interface FollowUp {
  say: (text: string) => void;
  /** Run a change to a step, then say what happened and focus the step that starts next. */
  step: (step: FlowStep, change: () => void, what: string) => void;
}

/* ------------------------------------------------------------------ */
/* Step card                                                           */
/* ------------------------------------------------------------------ */

function StepMarker({ status, index }: { status: string; index: number }) {
  if (status === 'done')
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-sage/50 bg-sage/15 text-sage">
        <Check aria-hidden className="h-3.5 w-3.5" />
      </span>
    );
  if (status === 'skipped')
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-khaki/40 bg-khaki/10 text-khaki">
        <SkipForward aria-hidden className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span
      className={`tabular grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-2xs ${
        status === 'active' ? 'border-ember bg-ember/15 text-ember' : 'border-white/15 text-fog-muted'
      }`}
    >
      {String(index + 1).padStart(2, '0')}
    </span>
  );
}

function GateBlock({ run, step, readOnly, follow }: { run: Run; step: FlowStep; readOnly: boolean; follow: FollowUp }) {
  const rec = stepRecord(run, step);
  const [name, setName] = useState('');
  const id = ids.approver(step.id);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const who = name.trim();
    if (!who) return;
    store().approveGate(run.id, step.id, who);
    setName('');
    follow.say(`Approval by ${who} recorded for ${step.label}.`);
    // The form gives way to the approval line: carry on at Mark done.
    focusSoon(ids.done(step.id), ids.withdraw(step.id), ids.toggle(step.id));
  };
  const withdraw = () => {
    store().approveGate(run.id, step.id, '');
    follow.say(`Approval withdrawn for ${step.label}.`);
    focusSoon(id);
  };
  return (
    <div className="rounded-lg border border-gold/30 bg-gold/[0.06] p-3">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-gold">
        <Hand aria-hidden className="h-4 w-4" /> Human approval gate
      </div>
      {rec.approvedBy && rec.approvedAt ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px]">
          <span>
            Approved by <b className="font-semibold text-fog-bright">{rec.approvedBy}</b> at{' '}
            <time dateTime={rec.approvedAt} title={isoUtc(rec.approvedAt)}>
              {localDateTime(rec.approvedAt)}
            </time>
            .
          </span>
          {rec.status !== 'done' && !readOnly && (
            <button
              id={ids.withdraw(step.id)}
              type="button"
              className="text-2xs text-fog-muted underline underline-offset-2 hover:text-ember"
              onClick={withdraw}
            >
              Withdraw approval
            </button>
          )}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-48">
            <label htmlFor={id} className="mb-1 block text-2xs text-fog-dim">
              Approved by
            </label>
            <input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name of the person who approved"
              className={inputCls}
            />
          </div>
          <button type="submit" className="btn" disabled={!name.trim()}>
            <ShieldCheck aria-hidden className="h-4 w-4" /> Record approval
          </button>
        </form>
      )}
    </div>
  );
}

function BranchBlock({
  run,
  chain,
  step,
  linkedRuns,
  follow,
}: {
  run: Run;
  chain: FlowChain;
  step: FlowStep;
  /** Every run linked from this run. */
  linkedRuns: Run[];
  follow: FollowUp;
}) {
  const chosen = run.choices[step.id];
  const byId = Object.fromEntries(chain.steps.map((s) => [s.id, s]));
  return (
    <div>
      <div className="eyebrow mb-1.5">{chosen ? 'Branch taken' : 'Which branch?'}</div>
      <div role="group" aria-label={`Branch after ${step.label}`} className="flex flex-wrap gap-2">
        {successors(chain, step.id).map((e, i) => {
          const on = chosen === e.target;
          const label = e.label ?? byId[e.target].label;
          // Linked runs whose step this branch takes off the path. The open ones keep running; say so before the click.
          const leavingRuns = on ? [] : childrenLeavingPath(chain, run.choices, step.id, e.target, linkedRuns);
          const leaving = leavingRuns.length;
          const stillOpen = leavingRuns.filter((c) => c.status === 'active').length;
          const moved = leaving === 1 ? '1 linked run is now' : `${leaving} linked runs are now`;
          const keepRunning =
            stillOpen === 0
              ? ''
              : stillOpen === leaving
                ? ` ${leaving === 1 ? 'It keeps' : 'They keep'} running.`
                : ` ${stillOpen === 1 ? 'The open one keeps' : `The ${stillOpen} open ones keep`} running.`;
          return (
            <button
              key={e.id}
              id={ids.branch(step.id, i)}
              type="button"
              aria-pressed={on}
              // No aria-describedby: the warning span sits inside the button, so it is already in the accessible name.
              onClick={() => {
                if (!on)
                  follow.step(
                    step,
                    () => store().chooseBranch(run.id, step.id, e.target),
                    `Took “${label}” at ${step.label}${leaving ? `. ${moved} under Left the path` : ''}`,
                  );
              }}
              className={`flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition disabled:cursor-default ${
                on
                  ? 'border-mauve/60 bg-mauve/15 text-fog-bright'
                  : chosen
                    ? 'border-white/[0.06] text-fog-muted hover:border-white/20 hover:text-fog'
                    : 'border-white/10 bg-white/[0.03] text-fog-bright hover:border-ember/60 hover:bg-ember/10'
              }`}
            >
              {on ? (
                <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-mauve" />
              ) : (
                <GitBranch aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-fog-muted" />
              )}
              <span className="min-w-0">
                <span className="block font-medium">{label}</span>
                <span className="block text-2xs text-fog-muted">
                  → {byId[e.target].label}
                  {chosen && !on && ' · Not taken'}
                </span>
                {leaving > 0 && (
                  <span className="mt-1 block text-2xs text-gold">
                    {leaving === 1 ? '1 linked run was' : `${leaving} linked runs were`} started from a step that leaves the
                    path on this branch.{keepRunning}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
    // Nothing started because another tab closed the run or took this step off the path: say so, keep the list.
    if (!started.length && !canLinkFrom(store().runs, flowChainById, run.id, step.id)) {
      follow.say(`Could not start ${runs(fresh.length)}: this run is closed or ${step.label} is no longer on its path.`);
      return;
    }
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
              <ul aria-label="Hosts entered" className="flex flex-wrap gap-1.5">
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

function StepCard({
  run,
  chain,
  step,
  index,
  readOnly,
  offPath = false,
  linkedRuns,
  reveal,
  follow,
}: {
  run: Run;
  chain: FlowChain;
  step: FlowStep;
  index: number;
  /** Every run linked from this run, in start order. */
  linkedRuns: Run[];
  /** Closed incident, or a step that left the path: show the record, allow no changes. */
  readOnly: boolean;
  offPath?: boolean;
  reveal: Reveal | null;
  follow: FollowUp;
}) {
  const rec = stepRecord(run, step);
  const status = rec.status;
  const decision = successors(chain, step.id).length > 1;
  const chosen = run.choices[step.id];
  // Open the step being worked on; collapse it once finished. The analyst can override either way.
  const [override, setOverride] = useState<boolean | null>(null);
  useEffect(() => setOverride(null), [status]);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // A timeline link or a #rb-step-… URL points here: open the card and bring it into view.
  useEffect(() => {
    if (reveal?.id !== step.id) return;
    setOverride(true);
    document.getElementById(ids.card(step.id))?.scrollIntoView({ block: 'start' });
    toggleRef.current?.focus({ preventScroll: true });
  }, [reveal, step.id]);

  const open = override ?? (!offPath && (status === 'active' || (decision && !chosen && status !== 'pending')));
  const finished = isFinished(status);
  const needsApproval = !!step.gate && !rec.approvedBy;
  const ticked = rec.actions.filter(Boolean).length;
  const bodyId = `rb-step-${step.id}-body`;
  const hintId = `rb-step-${step.id}-hint`;
  const chosenEdge = chosen ? successors(chain, step.id).find((e) => e.target === chosen) : undefined;
  const stepLinked = linkedRuns.filter((c) => linkOf(c)?.stepId === step.id);

  const start = (verb: 'started' | 'reopened') => {
    store().setStepStatus(run.id, step.id, 'active');
    follow.say(`${step.label} ${verb}.`);
    focusSoon(ids.done(step.id), ids.toggle(step.id));
  };

  return (
    <li id={ids.card(step.id)} className="scroll-mt-20">
      <article
        className={`glass transition-shadow ${status === 'active' && !readOnly ? 'border-ember/40 shadow-glow' : ''} ${
          finished || offPath ? 'bg-ink-850/60' : ''
        }`}
      >
        <h3>
          <button
            ref={toggleRef}
            id={ids.toggle(step.id)}
            type="button"
            onClick={() => setOverride(!open)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="group flex w-full items-start gap-3 rounded-xl p-4 text-left transition hover:bg-white/[0.02]"
          >
            <StepMarker status={status} index={index} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`font-display text-[15px] font-bold leading-snug ${
                    finished || offPath ? 'text-fog' : 'text-fog-bright'
                  }`}
                >
                  {step.label}
                </span>
                <StepStatusChip status={status} />
                {offPath && (
                  <span className="inline-flex items-center rounded border border-white/15 px-1.5 py-px font-mono text-2xs text-fog-dim">
                    Left the path
                  </span>
                )}
                {step.gate && (
                  <span className="inline-flex items-center gap-1 rounded border border-gold/40 bg-gold/10 px-1.5 py-px font-mono text-2xs text-gold">
                    <Hand aria-hidden className="h-3 w-3" /> Gate
                  </span>
                )}
                {decision && (
                  <span className="inline-flex items-center gap-1 rounded border border-mauve/40 bg-mauve/10 px-1.5 py-px font-mono text-2xs text-mauve">
                    <GitBranch aria-hidden className="h-3 w-3" /> Decision
                  </span>
                )}
                {stepLinked.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-rose/40 bg-rose/10 px-1.5 py-px font-mono text-2xs text-rose">
                    <Link2 aria-hidden className="h-3 w-3" /> {stepLinked.length} linked
                  </span>
                )}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-2xs font-normal text-fog-muted">
                <PhasePill id={step.phase} link={false} />
                <span className="tabular">
                  {ticked}/{step.actions.length} actions
                </span>
                {rec.startedAt && <span>Started {localTime(rec.startedAt)}</span>}
                {rec.doneAt && (
                  <span>
                    {status === 'skipped' ? 'Skipped' : 'Done'} {localTime(rec.doneAt)}
                  </span>
                )}
                {rec.approvedBy && <span className="text-gold">Approved by {rec.approvedBy}</span>}
                {chosenEdge && <span className="text-mauve">Took “{chosenEdge.label}”</span>}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className={`mt-1 h-4 w-4 shrink-0 text-fog-dim transition-transform group-hover:text-ember ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </h3>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={bodyId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <fieldset disabled={readOnly} className="min-w-0 space-y-4 border-t border-white/[0.06] px-4 pb-4 pt-3 sm:pl-14">
                <legend className="sr-only">{step.label}</legend>
                {offPath && (
                  <p className="text-2xs text-fog-muted">
                    A later branch choice took this step off the path. Its record stays here, in the timeline and in the
                    export.
                  </p>
                )}
                <p className="text-[13px] leading-relaxed">{step.detail}</p>

                {step.pitfall && (
                  <div className="flex gap-2 rounded-lg border border-ember/30 bg-ember/5 p-3 text-[13px] leading-snug">
                    <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
                    <span>
                      <span className="font-medium text-fog-bright">Common mistake. </span>
                      {step.pitfall}
                    </span>
                  </div>
                )}

                <div>
                  <div className="eyebrow mb-1.5">Actions</div>
                  <ul className="space-y-0.5">
                    {step.actions.map((a, i) => {
                      const id = `rb-${step.id}-a${i}`;
                      const on = rec.actions[i] ?? false;
                      // Unticking would let a branch change reset the step and hide its linked runs.
                      const locked = on && i === step.spawns?.action && stepLinked.length > 0;
                      return (
                        <li key={id}>
                          <label
                            htmlFor={id}
                            className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 hover:bg-white/[0.03]"
                          >
                            <input
                              id={id}
                              type="checkbox"
                              checked={on}
                              onChange={() => store().toggleAction(run.id, step.id, i)}
                              disabled={locked}
                              aria-describedby={locked ? `${id}-lock` : undefined}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-[#f25623] disabled:opacity-60"
                            />
                            <span
                              className={`text-[13px] leading-snug ${
                                on ? 'text-fog-dim line-through decoration-fog-muted/60' : 'text-fog-bright'
                              }`}
                            >
                              {a}
                            </span>
                          </label>
                          {locked && (
                            <p id={`${id}-lock`} className="pl-8 text-2xs text-fog-muted">
                              Linked runs started here, so this stays ticked.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {(step.evidence || step.tools) && (
                  <div className="flex flex-wrap gap-1.5">
                    {step.evidence?.map((e) => {
                      const to = evidenceLink(e);
                      return to ? (
                        <Link key={e} to={to} className="chip text-teal">
                          <Radar aria-hidden className="h-3 w-3" />
                          {e}
                        </Link>
                      ) : (
                        <span key={e} className="chip">
                          {e}
                        </span>
                      );
                    })}
                    {step.tools?.map((t) => (
                      <Link key={t} to={`/tools?q=${encodeURIComponent(t.split(/[ /(]/)[0])}`} className="chip">
                        {t}
                      </Link>
                    ))}
                  </div>
                )}

                {step.gate && <GateBlock run={run} step={step} readOnly={readOnly} follow={follow} />}
                {step.spawns && <LinkedRunsBlock run={run} step={step} linked={stepLinked} readOnly={readOnly} follow={follow} />}
                {decision && <BranchBlock run={run} chain={chain} step={step} linkedRuns={linkedRuns} follow={follow} />}

                <div>
                  <label htmlFor={`rb-${step.id}-notes`} className="eyebrow mb-1.5 block">
                    Notes
                  </label>
                  <textarea
                    id={`rb-${step.id}-notes`}
                    value={rec.notes}
                    rows={3}
                    onChange={(e) => store().setNotes(run.id, step.id, e.target.value)}
                    onBlur={(e) => store().setNotes(run.id, step.id, e.target.value, true)}
                    placeholder="Findings, hosts, ticket numbers, who you called."
                    className="block w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-fog-bright outline-none placeholder:text-fog-muted focus:border-ember/50 disabled:opacity-50"
                  />
                  {!readOnly && (
                    <p className="mt-1 text-2xs text-fog-muted">Saved as you type. Added to the timeline when you leave the field.</p>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    {status === 'pending' && (
                      <button type="button" className="btn" onClick={() => start('started')}>
                        <Play aria-hidden className="h-4 w-4" /> Start step
                      </button>
                    )}
                    {!finished && (
                      <>
                        <button
                          id={ids.done(step.id)}
                          type="button"
                          className="btn btn-primary"
                          disabled={needsApproval}
                          aria-describedby={needsApproval ? hintId : undefined}
                          onClick={() =>
                            follow.step(step, () => store().setStepStatus(run.id, step.id, 'done'), `${step.label} marked done`)
                          }
                        >
                          <Check aria-hidden className="h-4 w-4" /> Mark done
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() =>
                            follow.step(step, () => store().setStepStatus(run.id, step.id, 'skipped'), `${step.label} skipped`)
                          }
                        >
                          <SkipForward aria-hidden className="h-4 w-4" /> Skip
                        </button>
                      </>
                    )}
                    {finished && (
                      <button type="button" className="btn" onClick={() => start('reopened')}>
                        <RotateCcw aria-hidden className="h-4 w-4" /> Reopen step
                      </button>
                    )}
                    {needsApproval && !finished && (
                      <span id={hintId} className="text-2xs text-gold">
                        Record who approved before you mark this step done.
                      </span>
                    )}
                    {decision && !chosen && !finished && !needsApproval && (
                      <span className="text-2xs text-fog-muted">Picking a branch also marks this step done.</span>
                    )}
                  </div>
                )}
              </fieldset>
            </motion.div>
          )}
        </AnimatePresence>
      </article>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

function Timeline({
  run,
  chain,
  onPath,
  leftPath,
  onReveal,
}: {
  run: Run;
  chain: FlowChain;
  /** Steps with a card on the page. */
  onPath: Set<string>;
  /** Of those, the ones that left the path when a branch changed. */
  leftPath: Set<string>;
  onReveal: (stepId: string) => void;
}) {
  const [text, setText] = useState('');
  const closed = run.status === 'closed';
  const label = Object.fromEntries(chain.steps.map((s) => [s.id, s.label]));
  const entries = run.log.map((e, i) => ({ e, key: i })).reverse();

  const add = (ev: FormEvent) => {
    ev.preventDefault();
    if (!text.trim()) return;
    store().addEntry(run.id, text);
    setText('');
  };

  return (
    <aside aria-labelledby="rb-timeline-h" className="glass p-4 xl:sticky xl:top-[4.5rem]">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="rb-timeline-h" className="font-display text-base font-bold">
          Timeline
        </h3>
        <span className="text-2xs text-fog-muted">{run.log.length} events · newest first</span>
      </div>
      {!closed && (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <label htmlFor="rb-entry" className="sr-only">
            Add a timeline entry
          </label>
          <input
            id="rb-entry"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add an entry"
            className={inputCls}
          />
          <button type="submit" className="btn shrink-0" disabled={!text.trim()}>
            <Plus aria-hidden className="h-4 w-4" /> Add
          </button>
        </form>
      )}
      <ol aria-label="Timeline events, newest first" className="mt-3 max-h-[calc(100vh-15rem)] overflow-y-auto pr-1">
        {entries.map(({ e, key }, i) => {
          const prev = entries[i - 1]?.e;
          const newDay = !prev || localDate(prev.at) !== localDate(e.at);
          return (
            <li key={key}>
              {newDay && <div className="eyebrow mb-1 mt-2 first:mt-0">{localDate(e.at)}</div>}
              <div className="flex gap-2.5 border-l border-white/[0.06] py-1.5 pl-2.5">
                <time
                  dateTime={e.at}
                  title={isoUtc(e.at)}
                  className="tabular w-14 shrink-0 pt-px font-mono text-2xs text-fog-muted"
                >
                  {localTime(e.at)}
                </time>
                <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${own(kindDot, e.kind) ?? kindDot.entry}`} />
                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                  <p className="whitespace-pre-line text-fog-bright [overflow-wrap:anywhere]">{logText(e)}</p>
                  {e.stepId &&
                    (onPath.has(e.stepId) ? (
                      <a
                        href={`#${ids.card(e.stepId)}`}
                        onClick={() => onReveal(e.stepId!)}
                        className="text-2xs text-fog-muted hover:text-ember"
                      >
                        {label[e.stepId]}
                        {leftPath.has(e.stepId) && ' (left the path)'}
                      </a>
                    ) : (
                      <span className="text-2xs text-fog-muted">{label[e.stepId]} (not on the path)</span>
                    ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function DetailsForm({ run, onDone }: { run: Run; onDone: () => void }) {
  const [title, setTitle] = useState(run.title);
  const [lead, setLead] = useState(run.lead);
  const [severity, setSeverity] = useState<Severity>(run.severity);
  const titleRef = useRef<HTMLInputElement>(null);
  // The Edit details button gives way to this form: start in the first field.
  useEffect(() => titleRef.current?.focus(), []);
  const save = (e: FormEvent) => {
    e.preventDefault();
    store().updateDetails(run.id, { title, lead, severity });
    onDone();
  };
  return (
    <form onSubmit={save} className="mt-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,10rem)_auto] md:items-end">
      <div className="min-w-0">
        <label htmlFor="rb-edit-title" className="mb-1 block text-xs text-fog-dim">
          Incident title
        </label>
        <input
          ref={titleRef}
          id="rb-edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          required
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="rb-edit-lead" className="mb-1 block text-xs text-fog-dim">
          Incident lead
        </label>
        <input id="rb-edit-lead" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="Name" className={inputCls} />
      </div>
      <div className="min-w-0">
        <label htmlFor="rb-edit-severity" className="mb-1 block text-xs text-fog-dim">
          Severity
        </label>
        <select
          id="rb-edit-severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          className="h-9 w-full rounded-lg border border-white/10 bg-ink-850 px-2 text-sm text-fog-bright outline-none focus:border-ember/50"
        >
          {severities.map((s) => (
            <option key={s} value={s}>
              {severityMeta[s].label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">
          Save
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RunHeader({
  run,
  chain,
  progress,
  now,
  runs,
  linked,
  follow,
}: {
  run: Run;
  chain: FlowChain;
  progress: RunProgress;
  now: number;
  /** Every run in this browser, for the parent link and the exports. */
  runs: Record<string, Run>;
  /** Runs linked from this run, in start order. */
  linked: Run[];
  follow: FollowUp;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const closed = run.status === 'closed';
  const Icon = icons[chain.icon];
  const open = progress.total - progress.done;
  const warning = closeWarning(open, progress.estimated, linked.filter((c) => c.status === 'active').length);
  const link = linkOf(run);
  const parent = link ? own(runs, link.runId) : undefined;
  const parentStep = link ? flowChainById[link.chainId]?.steps.find((s) => s.id === link.stepId)?.label : undefined;
  const host = hostOf(run);

  const close = () => {
    if (warning && !confirmClose) {
      setConfirmClose(true);
      focusSoon('rb-close-confirm');
      return;
    }
    store().closeRun(run.id);
    setConfirmClose(false);
    follow.say('Incident closed. Reopen it to make more changes.');
    focusSoon('rb-reopen');
  };
  const reopen = () => {
    store().reopenRun(run.id);
    follow.say('Incident reopened.');
    focusSoon('rb-close');
  };
  const doneEditing = () => {
    setEditing(false);
    focusSoon('rb-edit');
  };
  const copy = async (incident: boolean) => {
    const ok = await copyText(incident ? incidentToMarkdown(run, runs) : runToMarkdown(run, chain, Date.now(), { runs }));
    const what = incident ? `Incident Markdown copied, with ${linked.length} linked ${linked.length === 1 ? 'run' : 'runs'}.` : 'Markdown copied.';
    setNotice(
      ok
        ? { tone: 'ok', text: `${what} Paste it into the ticket or the RCA.` }
        : { tone: 'error', text: `The browser blocked the clipboard. Use Download ${incident ? 'incident ' : ''}.md instead.` },
    );
  };

  return (
    <header className="glass mb-5 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${hueClass[chain.hue].border} ${hueClass[chain.hue].bg}`}
        >
          <Icon aria-hidden className={`h-6 w-6 ${hueClass[chain.hue].text}`} />
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <div className="eyebrow">
            IR runbook ·{' '}
            <Link to={`/flows/${chain.id}`} className="hover:text-ember">
              {chain.title} chain
            </Link>
          </div>
          <h2 className="mt-1 font-display text-2xl font-extrabold [overflow-wrap:anywhere]">{run.title}</h2>
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
          <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Severity</dt>
              <dd>
                <SeverityBadge severity={run.severity} />
              </dd>
              <dt className="sr-only">Status</dt>
              <dd>
                <RunStatusChip status={run.status} />
              </dd>
            </div>
            {host && (
              <div className="flex gap-1.5">
                <dt className="text-fog-muted">Host</dt>
                <dd className="font-mono text-fog-bright [overflow-wrap:anywhere]">{host}</dd>
              </div>
            )}
            <div className="flex gap-1.5">
              <dt className="text-fog-muted">Lead</dt>
              <dd className="text-fog-bright">{run.lead || 'Not set'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-fog-muted">Started</dt>
              <dd className="text-fog-bright">
                <time dateTime={run.startedAt} title={isoUtc(run.startedAt)}>
                  {localDateTime(run.startedAt)}
                </time>
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-fog-muted">{closed ? 'Duration' : 'Elapsed'}</dt>
              <dd className="tabular font-medium text-fog-bright">{formatDuration(runElapsed(run, now))}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!closed && !editing && (
            <button id="rb-edit" type="button" className="btn" onClick={() => setEditing(true)}>
              <Pencil aria-hidden className="h-4 w-4" /> Edit details
            </button>
          )}
          {closed ? (
            <button id="rb-reopen" type="button" className="btn" onClick={reopen}>
              <Unlock aria-hidden className="h-4 w-4" /> Reopen incident
            </button>
          ) : confirmClose ? (
            <span className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2 py-1 text-xs text-gold">
              {warning} Close anyway?
              <button
                id="rb-close-confirm"
                type="button"
                className="rounded px-2 py-0.5 font-medium text-fog-bright hover:bg-gold/20"
                onClick={close}
              >
                Close incident
              </button>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-fog hover:bg-white/10"
                onClick={() => {
                  setConfirmClose(false);
                  focusSoon('rb-close');
                }}
              >
                Keep working
              </button>
            </span>
          ) : (
            <button id="rb-close" type="button" className={`btn ${progress.complete ? 'btn-primary' : ''}`} onClick={close}>
              <Lock aria-hidden className="h-4 w-4" /> Close incident
            </button>
          )}
        </div>
      </div>

      {editing && !closed && <DetailsForm run={run} onDone={doneEditing} />}

      <div className="mt-4">
        <div className="mb-1 flex justify-between gap-2 text-2xs text-fog-muted">
          <span>
            {progressCount(progress)} steps on this path
            {progress.path.awaiting && ' · branch choice needed'}
          </span>
          <span className="tabular">{progress.pct}%</span>
        </div>
        <RunProgressBar pct={progress.pct} closed={closed} label={`${progressCount(progress)} steps done`} />
        {linked.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-fog-muted">
            <Link2 aria-hidden className="h-3 w-3 shrink-0 text-rose" /> {childSummary(linked).text}. Their steps are not in this bar.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
        <span className="eyebrow mr-1">Export</span>
        <button type="button" className="btn" onClick={() => copy(false)}>
          <Copy aria-hidden className="h-4 w-4" /> Copy Markdown
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => downloadText(runFileName(run, 'md'), runToMarkdown(run, chain, Date.now(), { runs }), 'text/markdown')}
        >
          <FileDown aria-hidden className="h-4 w-4" /> Download .md
        </button>
        <button type="button" className="btn" onClick={() => downloadRunJson(run)}>
          <FileJson aria-hidden className="h-4 w-4" /> Download JSON
        </button>
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
        <span className="flex basis-full items-center gap-1.5 text-2xs text-fog-muted sm:ml-auto sm:basis-auto">
          <HardDrive aria-hidden className="h-3 w-3 shrink-0" /> Stored only in this browser. Export before you clear site data.
        </span>
      </div>
      {notice && (
        <p
          role="status"
          className={`mt-3 rounded-lg border px-3 py-2 text-[13px] ${
            notice.tone === 'ok' ? 'border-sage/40 bg-sage/10 text-sage' : 'border-ember/40 bg-ember/10 text-ember'
          }`}
        >
          {notice.text}
        </p>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

const hashStep = () => {
  const m = /^#rb-step-(.+)$/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]) : null;
};

function RunView({ run, chain, now }: { run: Run; chain: FlowChain; now: number }) {
  const progress = useMemo(() => runProgress(run, chain), [run, chain]);
  const { path } = progress;
  const closed = run.status === 'closed';
  const { worked, notRun } = useMemo(() => splitNotTaken(run, path), [run, path]);
  const leftPath = useMemo(() => new Set(worked.map((s) => s.id)), [worked]);
  const withCard = useMemo(() => new Set([...path.steps, ...worked].map((s) => s.id)), [path, worked]);
  // The whole map, then derive: a selector that builds a new array each call loops under zustand 5.
  const runs = useRunbooks((s) => s.runs);
  const linked = useMemo(() => childRuns(runs, run.id), [runs, run.id]);

  // Screen reader announcements for actions whose control goes away (Mark done, branch, close).
  const [said, setSaid] = useState('');
  // Open a step from a timeline link, or from a #rb-step-… URL when the page loads.
  const [reveal, setReveal] = useState<Reveal | null>(() => {
    const id = hashStep();
    return id ? { id, n: 0 } : null;
  });
  const onReveal = useCallback((id: string) => setReveal((r) => ({ id, n: (r?.n ?? 0) + 1 })), []);

  const runId = run.id;
  const follow = useMemo<FollowUp>(
    () => ({
      say: setSaid,
      step: (step, change, what) => {
        const before = own(store().runs, runId);
        change();
        const after = own(store().runs, runId);
        if (!before || !after) return;
        const p = runProgress(after, chain);
        const started = p.path.steps.find(
          (s) => s.id !== step.id && after.steps[s.id]?.status === 'active' && before.steps[s.id]?.status !== 'active',
        );
        const parts = [`${what}.`];
        let focus: string[] = [];
        if (started) {
          parts.push(`${started.label} started.`);
          focus = [ids.toggle(started.id)];
        } else if (p.path.awaiting) {
          parts.push(`Pick a branch at ${p.path.awaiting.label}.`);
          focus = [ids.branch(p.path.awaiting.id, 0), ids.toggle(p.path.awaiting.id)];
        } else if (p.complete) {
          parts.push('That was the last step on this path.');
        }
        // The card collapses when its status changes, taking the focused button with it.
        if (!focus.length && before.steps[step.id]?.status !== after.steps[step.id]?.status) focus = [ids.toggle(step.id)];
        setSaid(parts.join(' '));
        if (focus.length) focusSoon(...focus);
      },
    }),
    [runId, chain],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/runbooks" className="mb-3 inline-flex items-center gap-1.5 text-xs text-fog-dim hover:text-ember">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> All runbooks
      </Link>

      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>

      <RunHeader run={run} chain={chain} progress={progress} now={now} runs={runs} linked={linked} follow={follow} />

      {closed && run.closedAt && (
        <p className="mb-5 flex items-start gap-2 rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-[13px] text-sage">
          <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Closed {localDateTime(run.closedAt)}. The checklist is read-only until you reopen the incident.
        </p>
      )}
      {!closed && progress.complete && (
        <p className="mb-5 flex items-start gap-2 rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-[13px] text-sage">
          <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Every step on this path is finished. Export the timeline for the ticket, then close the incident.
        </p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Runbook steps" className="min-w-0">
          <ol className="space-y-3">
            {path.steps.map((s, i) => (
              <StepCard
                key={s.id}
                run={run}
                chain={chain}
                step={s}
                index={i}
                readOnly={closed}
                linkedRuns={linked}
                reveal={reveal}
                follow={follow}
              />
            ))}
          </ol>

          {path.awaiting && (
            <div className="mt-3 rounded-xl border border-dashed border-white/15 p-4 text-[13px] text-fog-dim">
              <p>
                Pick a branch at{' '}
                <a
                  href={`#${ids.card(path.awaiting.id)}`}
                  onClick={() => path.awaiting && onReveal(path.awaiting.id)}
                  className="text-fog-bright hover:text-ember"
                >
                  {path.awaiting.label}
                </a>{' '}
                to see the next steps.
              </p>
              {path.undecided.length > 0 && (
                <p className="mt-1 text-2xs text-fog-muted">Depends on it: {path.undecided.map((s) => s.label).join(', ')}.</p>
              )}
            </div>
          )}

          {worked.length > 0 && (
            <div className="mt-5">
              <h3 className="eyebrow mb-1">Left the path</h3>
              <p className="mb-2 text-2xs text-fog-muted">
                Work recorded on these steps before a branch changed. It stays in the timeline and the export.
              </p>
              <ol aria-label="Steps that left the path" className="space-y-3">
                {worked.map((s) => (
                  <StepCard
                    key={s.id}
                    run={run}
                    chain={chain}
                    step={s}
                    index={chain.steps.indexOf(s)}
                    readOnly
                    offPath
                    linkedRuns={linked}
                    reveal={reveal}
                    follow={follow}
                  />
                ))}
              </ol>
            </div>
          )}

          {(notRun.length > 0 || path.branchesNotTaken.length > 0) && (
            <div className="mt-5 space-y-3 rounded-xl border border-white/[0.06] p-4">
              <h3 className="eyebrow">Not taken</h3>
              {path.branchesNotTaken.length > 0 && (
                <ul aria-label="Branches not taken" className="space-y-1 text-[13px] text-fog-dim">
                  {path.branchesNotTaken.map((b) => (
                    <li key={`${b.from.id}-${b.to.id}`} className="flex items-start gap-2">
                      <GitBranch aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fog-muted" />
                      <span>
                        At {b.from.label}: <span className="text-fog">“{b.label}”</span> → {b.to.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {notRun.length > 0 && (
                <ul aria-label="Steps not taken" className="flex flex-wrap gap-1.5">
                  {notRun.map((s) => (
                    <li key={s.id} className="chip text-fog-muted">
                      <span className="line-through decoration-fog-muted/60">{s.label}</span>
                      <span className="text-2xs">Not taken</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <Timeline run={run} chain={chain} onPath={withCard} leftPath={leftPath} onReveal={onReveal} />
      </div>
    </div>
  );
}

/** A stored run whose chain this version of the mapper no longer has. Keep it or delete it. */
function MissingChain({ run }: { run: Run }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl py-16">
      <EmptyState
        title="This run's chain is no longer in the mapper"
        hint={`"${run.title}" uses the chain "${run.chainId}", which this version does not have, so the checklist cannot open. Download the JSON to keep the record and its timeline.`}
        action={
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => downloadRunJson(run)}>
              <FileJson aria-hidden className="h-4 w-4" /> Download JSON
            </button>
            <DeleteRunButton run={run} withLabel onDeleted={() => navigate('/runbooks')} />
            <Link to="/runbooks" className="btn">
              All runbooks
            </Link>
          </div>
        }
      />
    </div>
  );
}

/** One live incident: the chain as a checklist, a running timeline, and exports. */
export default function RunbookRunView() {
  const { runId = '' } = useParams();
  const run = useRunbooks((s) => own(s.runs, runId));
  const chain = run ? flowChainById[run.chainId] : undefined;
  const now = useNow(30_000, run?.status === 'active');

  // The router keeps the scroll position; a run starts at its header unless a step anchor is in the URL.
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0 });
  }, [runId]);

  if (run && !chain) return <MissingChain run={run} />;
  if (!run || !chain) {
    return (
      <div className="mx-auto max-w-xl py-16">
        <EmptyState
          title="No runbook with that ID in this browser"
          hint="Runs live only in the browser that started them. To open one from somewhere else, import its JSON export on the runbooks page."
          action={
            <Link to="/runbooks" className="btn btn-primary mt-2">
              All runbooks
            </Link>
          }
        />
      </div>
    );
  }
  // Keyed by run: following a link to another run starts fresh (edit form, close confirmation, notices, the #rb-step reveal).
  return <RunView key={run.id} run={run} chain={chain} now={now} />;
}
