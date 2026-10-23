import { flowChainById, type FlowChain, type FlowStep } from '@/data';
import {
  formatDuration,
  isoUtc,
  localDateTime,
  logText,
  logKindLabel,
  runElapsed,
  runPath,
  severities,
  splitNotTaken,
  stepRecord,
  stepStatusLabel,
  successors,
  timeZoneName,
  type LogEntry,
  type LogKind,
  type Run,
  type StepRecord,
  type StepStatus,
} from './runbook';
import { severityMeta } from './hues';

/**
 * Runbook exports: a Markdown timeline for the ticket or RCA, and a JSON copy of the
 * run that the runbooks page can import again (in this or another browser).
 */

export const RUNBOOK_FORMAT = 'blue-team-mapper/runbook';

/** Keep table cells on one line and stop user text from breaking the table. */
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const oneLine = (s: string) => s.replace(/\s*\r?\n\s*/g, ' ').trim();
const when = (iso: string) => `${isoUtc(iso)} (${localDateTime(iso)} ${timeZoneName()})`;

export function runToMarkdown(run: Run, chain: FlowChain, now = Date.now()): string {
  const path = runPath(chain, run.choices);
  const label = Object.fromEntries(chain.steps.map((s) => [s.id, s.label]));
  const duration = formatDuration(runElapsed(run, now));
  const out: string[] = [];

  out.push(`# ${oneLine(run.title)}`, '');
  out.push('| Field | Value |', '| --- | --- |');
  out.push(`| Runbook | ${cell(`${chain.title} (${chain.route})`)} |`);
  out.push(`| Severity | ${severityMeta[run.severity].label} |`);
  out.push(`| Lead | ${cell(run.lead || 'Not set')} |`);
  out.push(`| Status | ${run.status === 'closed' ? 'Closed' : 'Open'} |`);
  out.push(`| Started | ${cell(when(run.startedAt))} |`);
  out.push(`| Closed | ${run.closedAt ? cell(when(run.closedAt)) : 'Still open'} |`);
  out.push(`| Duration | ${duration}${run.closedAt ? '' : ' so far'} |`);
  out.push(`| Run ID | \`${run.id}\` |`, '');

  out.push('## Timeline', '', '| Time (UTC) | Step | Event |', '| --- | --- | --- |');
  for (const e of run.log) {
    out.push(`| ${isoUtc(e.at)} | ${cell(e.stepId ? label[e.stepId] ?? e.stepId : logKindLabel[e.kind])} | ${cell(logText(e))} |`);
  }
  out.push('');

  const { worked, notRun } = splitNotTaken(run, path);
  const stepBlock = (step: FlowStep, heading: string) => {
    const rec = stepRecord(run, step);
    out.push(`### ${heading}${step.gate ? ' (approval gate)' : ''}`, '');
    const facts = [`- Status: ${stepStatusLabel[rec.status]}`];
    if (rec.startedAt) facts.push(`- Started: ${isoUtc(rec.startedAt)}`);
    if (rec.doneAt) facts.push(`- ${rec.status === 'skipped' ? 'Skipped' : 'Finished'}: ${isoUtc(rec.doneAt)}`);
    const branch = path.taken.find((b) => b.from.id === step.id);
    if (branch) facts.push(`- Branch taken: **${branch.label}** → ${branch.to.label}`);
    if (path.awaiting?.id === step.id) facts.push('- Branch taken: not chosen yet');
    if (step.gate) {
      facts.push(
        rec.approvedBy && rec.approvedAt
          ? `- Approval: approved by ${oneLine(rec.approvedBy)} at ${isoUtc(rec.approvedAt)}`
          : '- Approval: not recorded',
      );
    }
    out.push(...facts, '', 'Actions:', '');
    step.actions.forEach((a, j) => out.push(`- [${rec.actions[j] ? 'x' : ' '}] ${a}`));
    out.push('');
    if (rec.notes.trim()) {
      out.push('Notes:', '', ...rec.notes.trim().split(/\r?\n/).map((l) => `> ${l}`), '');
    }
  };

  out.push('## Steps on the path taken', '');
  path.steps.forEach((step, i) => stepBlock(step, `${i + 1}. ${step.label}`));

  if (worked.length) {
    out.push(
      '## Steps worked before the branch changed',
      '',
      'A later branch choice took these steps off the path. Their record stays here and in the timeline.',
      '',
    );
    worked.forEach((step) => stepBlock(step, step.label));
  }

  out.push('## Branches not taken', '');
  if (path.branchesNotTaken.length) {
    for (const b of path.branchesNotTaken) out.push(`- At ${b.from.label}: **${b.label}** → ${b.to.label}`);
  } else {
    out.push(path.taken.length ? '- None' : '- No decision points on this path');
  }
  if (path.awaiting) {
    const options = successors(chain, path.awaiting.id).map((e) => e.label ?? label[e.target]);
    out.push(`- Still open at ${path.awaiting.label}: ${options.join(' or ')}`);
  }
  if (notRun.length) out.push('', `Steps not run: ${notRun.map((s) => s.label).join(', ')}.`);
  out.push('');

  out.push('---', '', `Exported from Blue Team Mapper on ${isoUtc(new Date(now).toISOString())}.`, '');
  return out.join('\n');
}

export function runToJson(run: Run): string {
  return JSON.stringify({ format: RUNBOOK_FORMAT, version: 1, exportedAt: new Date().toISOString(), run }, null, 2);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'incident';

export const runFileName = (run: Run, ext: 'md' | 'json') => `runbook-${slug(run.title)}-${run.startedAt.slice(0, 10)}.${ext}`;

/** Save text as a file (works on the deployed site; browsers handle the download). */
export function downloadText(fileName: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Download JSON": a copy of the run that the runbooks page can import again. */
export const downloadRunJson = (run: Run) => downloadText(runFileName(run, 'json'), runToJson(run), 'application/json');

/** Clipboard API first; a hidden textarea and execCommand where it is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const validIso = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

const statuses: StepStatus[] = ['pending', 'active', 'done', 'skipped'];
const kinds = Object.keys(logKindLabel) as LogKind[];

/**
 * Parse a file saved with "Download JSON". Checks the shape and the chain, keeps only
 * fields this version understands, and throws an Error with a readable message otherwise.
 */
export function parseRunJson(text: string): Run {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON. Use a file saved with "Download JSON" on a runbook.');
  }
  const raw = isObj(data) && isObj(data.run) ? data.run : data;
  if (!isObj(raw) || typeof raw.chainId !== 'string' || !isObj(raw.steps)) {
    throw new Error('That JSON is not a runbook export. It needs a chainId and steps. Use "Download JSON" on a runbook to make one.');
  }
  const chain = flowChainById[raw.chainId];
  if (!chain) {
    throw new Error(`That runbook uses the chain "${raw.chainId}", which this version of the mapper does not have.`);
  }
  const title = str(raw.title)?.trim();
  if (!title) throw new Error('That runbook has no title.');
  const startedAt = validIso(raw.startedAt);
  if (!startedAt) throw new Error('That runbook has no valid start time (startedAt).');

  const rawSteps = raw.steps;
  if (!chain.steps.some((s) => isObj(rawSteps[s.id]))) {
    throw new Error(`None of the steps in that file belong to the ${chain.title} chain.`);
  }
  const steps: Record<string, StepRecord> = {};
  for (const step of chain.steps) {
    const rs = isObj(rawSteps[step.id]) ? (rawSteps[step.id] as Obj) : {};
    const status = statuses.includes(rs.status as StepStatus) ? (rs.status as StepStatus) : 'pending';
    const rec: StepRecord = {
      status,
      actions: step.actions.map((_, i) => Array.isArray(rs.actions) && rs.actions[i] === true),
      notes: str(rs.notes) ?? '',
    };
    const s = validIso(rs.startedAt);
    const d = validIso(rs.doneAt);
    const who = str(rs.approvedBy)?.trim();
    const wa = validIso(rs.approvedAt);
    if (s) rec.startedAt = s;
    if (d && (status === 'done' || status === 'skipped')) rec.doneAt = d;
    if (step.gate && who && wa) {
      rec.approvedBy = who;
      rec.approvedAt = wa;
    }
    // A gate cannot be done without an approval.
    if (step.gate && rec.status === 'done' && !rec.approvedBy) rec.status = 'active';
    steps[step.id] = rec;
  }

  const choices: Record<string, string> = {};
  if (isObj(raw.choices)) {
    for (const [from, to] of Object.entries(raw.choices)) {
      const out = successors(chain, from);
      if (out.length > 1 && out.some((e) => e.target === to)) choices[from] = to as string;
    }
  }

  const stepIds = new Set(chain.steps.map((s) => s.id));
  const log: LogEntry[] = [];
  if (Array.isArray(raw.log)) {
    for (const e of raw.log) {
      if (!isObj(e)) continue;
      const at = validIso(e.at);
      const t = str(e.text);
      if (!at || t === undefined) continue;
      const entry: LogEntry = { at, kind: kinds.includes(e.kind as LogKind) ? (e.kind as LogKind) : 'entry', text: t };
      if (typeof e.stepId === 'string' && stepIds.has(e.stepId)) entry.stepId = e.stepId;
      log.push(entry);
    }
  }

  const closed = raw.status === 'closed';
  const severity = severities.find((s) => s === raw.severity) ?? chain.severity;
  return {
    id: str(raw.id) ?? '',
    chainId: chain.id,
    title,
    lead: str(raw.lead)?.trim() ?? '',
    severity,
    startedAt,
    ...(closed ? { closedAt: validIso(raw.closedAt) ?? log[log.length - 1]?.at ?? startedAt } : {}),
    status: closed ? 'closed' : 'active',
    steps,
    choices,
    log,
  };
}
