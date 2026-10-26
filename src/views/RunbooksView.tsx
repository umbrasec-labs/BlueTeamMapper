import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, FileJson, GitBranch, Hand, HardDrive, Link2, Play, Upload } from 'lucide-react';
import { flowChainById, flowChains, type Severity } from '@/data';
import { sortRuns, useRunbooks, type Run } from '@/store/runbooks';
import {
  childRuns,
  childSummary,
  defaultRunTitle,
  formatDuration,
  isDecision,
  linkOf,
  localDateTime,
  own,
  progressCount,
  runElapsed,
  runProgress,
  severities,
} from '@/lib/runbook';
import { downloadRunJson, parseImport } from '@/lib/runbookExport';
import { groupRuns, type RunGroup } from '@/lib/runLinks';
import { useNow } from '@/lib/useNow';
import { hueClass, severityMeta } from '@/lib/hues';
import { icons } from '@/lib/icons';
import { SeverityBadge } from '@/components/Badges';
import { EmptyState } from '@/components/Feedback';
import { DeleteRunButton, RunProgressBar, RunStatusChip } from '@/components/Runbook';

const inputCls =
  'h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-fog-bright outline-none placeholder:text-fog-muted focus:border-ember/50';

type Notice = { tone: 'ok' | 'error'; text: string; to?: string };

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

/** A run whose chain a later release renamed or removed. It can still be saved or deleted. */
function OrphanRow({ run, runs, nested = false }: RowProps) {
  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/40 bg-gold/10">
        <AlertTriangle aria-hidden className="h-4 w-4 text-gold" />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 text-[14px] font-medium text-fog-bright [overflow-wrap:anywhere]">{run.title}</span>
          <SeverityBadge severity={run.severity} />
          <RunStatusChip status={run.status} />
          <LinkInfo run={run} runs={runs} nested={nested} />
        </div>
        <p className="mt-0.5 text-xs text-gold">
          This run uses the chain <span className="font-mono">{run.chainId}</span>, which is no longer in the mapper.
          Download the JSON to keep the record.
        </p>
        <p className="text-xs text-fog-muted">Started {localDateTime(run.startedAt)}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" className="btn" onClick={() => downloadRunJson(run)}>
          <FileJson aria-hidden className="h-4 w-4" /> Download JSON
        </button>
        <DeleteRunButton run={run} />
      </div>
    </div>
  );
}

function RunRow({ run, runs, nested = false, now }: RowProps & { now: number }) {
  const chain = flowChainById[run.chainId];
  if (!chain) return <OrphanRow run={run} runs={runs} nested={nested} />;
  const p = runProgress(run, chain);
  const Icon = icons[chain.icon];
  const closed = run.status === 'closed';
  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${hueClass[chain.hue].border} ${hueClass[chain.hue].bg}`}
      >
        <Icon aria-hidden className={`h-4 w-4 ${hueClass[chain.hue].text}`} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/runbooks/${run.id}`}
            className="min-w-0 text-[14px] font-medium text-fog-bright [overflow-wrap:anywhere] hover:text-ember"
          >
            {run.title}
          </Link>
          <SeverityBadge severity={run.severity} />
          <RunStatusChip status={run.status} />
          <LinkInfo run={run} runs={runs} nested={nested} />
        </div>
        <p className="mt-0.5 text-xs text-fog-dim">
          {chain.title} · Started {localDateTime(run.startedAt)}
          {run.lead && ` · Lead ${run.lead}`}
        </p>
        {!closed && p.current && <p className="text-xs text-fog-muted">Now: {p.current.label}</p>}
      </div>
      <div className="w-full sm:w-48">
        <div className="mb-1 flex justify-between gap-2 text-2xs text-fog-muted">
          <span>{progressCount(p)} steps</span>
          <span className="tabular" title={closed ? 'Duration' : 'Elapsed'}>
            {formatDuration(runElapsed(run, now))}
          </span>
        </div>
        <RunProgressBar pct={p.pct} closed={closed} label={`${run.title}: ${progressCount(p)} steps done`} />
      </div>
      <div className="flex items-center gap-1.5">
        <Link to={`/runbooks/${run.id}`} className="btn">
          {closed ? 'View' : 'Resume'} <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
        <DeleteRunButton run={run} />
      </div>
    </div>
  );
}

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

/** Start an incident runbook from any flow chain, and list the runs kept in this browser. */
export default function RunbooksView() {
  const runs = useRunbooks((s) => s.runs);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = flowChainById[params.get('chain') ?? ''] ?? flowChains[0];
  const [chainId, setChainId] = useState(initial.id);
  const [severity, setSeverity] = useState<Severity>(initial.severity);
  const [title, setTitle] = useState('');
  const [lead, setLead] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // The run page loads in a transition, so a double click could reach this form twice.
  const starting = useRef(false);
  const now = useNow(30_000);

  const chain = flowChainById[chainId];
  const all = sortRuns(runs);
  const active = all.filter((r) => r.status === 'active');
  const closed = all.filter((r) => r.status === 'closed');
  const gates = chain.steps.filter((s) => s.gate).length;
  const decisions = chain.steps.filter((s) => isDecision(chain, s.id)).length;

  const start = (e: FormEvent) => {
    e.preventDefault();
    if (starting.current) return;
    const id = useRunbooks.getState().createRun({ chainId, title, lead, severity });
    if (!id) return;
    starting.current = true;
    navigate(`/runbooks/${id}`);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseImport(await file.text());
      if (parsed.kind === 'run') {
        const { run } = parsed;
        const { id, reason } = useRunbooks.getState().importRun(run);
        const text = {
          kept: `Imported "${run.title}" from ${file.name}.`,
          duplicate: `Imported "${run.title}" as a new copy, because a run with the same ID is already in this browser.`,
          invalid: `Imported "${run.title}" from ${file.name} with a new ID, because the file had no valid one.`,
        }[reason];
        setNotice({ tone: 'ok', text, to: `/runbooks/${id}` });
      } else {
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
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Could not read that file.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="eyebrow text-ember">Respond</div>
          <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Run a flow chain during a live incident</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
            Pick the chain that fits, then work it as a checklist. Tick actions, record approvals at the gates, pick the
            branch you take and write notes as you go. Every step lands on a timestamped timeline you can export as
            Markdown for the ticket or the RCA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden className="h-4 w-4" /> Import JSON
          </button>
          <input
            ref={fileRef}
            id="runbook-import"
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import a runbook JSON export"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </div>
      </header>

      <p className="mb-5 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[13px] text-gold">
        <HardDrive aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Runs are stored only in this browser. Nothing is sent anywhere, and clearing site data deletes them. Export each
          run as Markdown or JSON before you close the incident.
        </span>
      </p>

      {notice && (
        <p
          role="status"
          className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-[13px] ${
            notice.tone === 'ok' ? 'border-sage/40 bg-sage/10 text-sage' : 'border-ember/40 bg-ember/10 text-ember'
          }`}
        >
          {notice.text}
          {notice.to && (
            <Link to={notice.to} className="font-medium underline underline-offset-2 hover:text-fog-bright">
              Open it
            </Link>
          )}
        </p>
      )}

      {/* Open incidents first: resuming one is the usual reason to come back mid-incident. */}
      {active.length > 0 && (
        <section aria-labelledby="rb-active-h" className="mb-8">
          <h3 id="rb-active-h" className="eyebrow mb-2">
            Open incidents · {active.length}
          </h3>
          <ul className="space-y-2">
            {groupRuns(active, runs).map((g) => (
              <RunItem key={g.run.id} group={g} runs={runs} now={now} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="rb-start-h" className="glass mb-8 p-5">
        <h3 id="rb-start-h" className="font-display text-base font-bold">
          Start a runbook
        </h3>
        <form onSubmit={start} className="mt-3 space-y-4">
          <fieldset className="min-w-0">
            <legend className="eyebrow mb-2">Flow chain</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {flowChains.map((c) => {
                const Icon = icons[c.icon];
                const on = c.id === chainId;
                return (
                  <label
                    key={c.id}
                    htmlFor={`rb-chain-${c.id}`}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ember ${
                      on ? 'border-ember/60 bg-ember/10 shadow-glow' : 'border-white/[0.07] bg-ink-850/60 hover:border-white/20'
                    }`}
                  >
                    <input
                      id={`rb-chain-${c.id}`}
                      type="radio"
                      name="rb-chain"
                      value={c.id}
                      checked={on}
                      onChange={() => {
                        setChainId(c.id);
                        setSeverity(c.severity);
                      }}
                      className="sr-only"
                    />
                    <Icon aria-hidden className={`h-4 w-4 shrink-0 ${hueClass[c.hue].text}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-fog-bright">{c.title}</span>
                      <span className="block text-2xs text-fog-muted">{c.steps.length} steps</span>
                    </span>
                    <SeverityBadge severity={c.severity} />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <p className="text-xs text-fog-dim">
            <span className="font-mono text-fog-muted">{chain.route}</span>
            <span className="ml-2 inline-flex items-center gap-1 text-gold">
              <Hand aria-hidden className="h-3 w-3" /> {gates} approval {gates === 1 ? 'gate' : 'gates'}
            </span>
            <span className="ml-2 inline-flex items-center gap-1 text-mauve">
              <GitBranch aria-hidden className="h-3 w-3" /> {decisions} {decisions === 1 ? 'decision' : 'decisions'}
            </span>
          </p>

          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,11rem)]">
            <div className="min-w-0">
              <label htmlFor="rb-title" className="mb-1 block text-xs text-fog-dim">
                Incident title
              </label>
              <input
                id="rb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={defaultRunTitle(chain)}
                className={inputCls}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="rb-lead" className="mb-1 block text-xs text-fog-dim">
                Incident lead <span className="text-fog-muted">(optional)</span>
              </label>
              <input id="rb-lead" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="Name" className={inputCls} />
            </div>
            <div className="min-w-0">
              <label htmlFor="rb-severity" className="mb-1 block text-xs text-fog-dim">
                Severity
              </label>
              <select
                id="rb-severity"
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
          </div>
          <button type="submit" className="btn btn-primary">
            <Play aria-hidden className="h-4 w-4" /> Start runbook
          </button>
        </form>
      </section>

      {closed.length > 0 && (
        <section aria-labelledby="rb-closed-h">
          <h3 id="rb-closed-h" className="eyebrow mb-2">
            Closed · {closed.length}
          </h3>
          <ul className="space-y-2">
            {groupRuns(closed, runs).map((g) => (
              <RunItem key={g.run.id} group={g} runs={runs} now={now} />
            ))}
          </ul>
        </section>
      )}

      {all.length === 0 && (
        <EmptyState
          title="No runbooks in this browser yet"
          hint="Start one above, or use Import JSON to open a run exported from another browser."
        />
      )}
    </div>
  );
}
