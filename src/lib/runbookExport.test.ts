import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import stored from './__fixtures__/runbooks-v1.json';
import { childRuns, HOST_MAX, type Run } from './runbook';
import { buildLinkedRuns, newRun } from './runLinks';
import {
  parseImport,
  parseRunJson,
  RUNBOOK_FORMAT,
  RUNBOOK_TREE_FORMAT,
  runFileName,
  runToJson,
  runToMarkdown,
  runTreeToJson,
} from './runbookExport';
import { fixtureRun, ids } from './__fixtures__/runs';

const chains = flowChainById;
const phishing = chains['phishing'];
const NOW = Date.parse('2026-10-24T12:00:00.000Z');
/** The `btm-runbooks-v1` value the current release (before linked runs) writes. */
const v1Runs = stored.state.runs as unknown as Record<string, Run>;
const v1Run = v1Runs.k7m2p9qa;
const exportOf = (run: unknown) => JSON.stringify({ format: RUNBOOK_FORMAT, version: 1, exportedAt: '2026-10-24T12:00:00.000Z', run });

/** A phishing parent on "Execution found" with linked runs for two hosts. */
function tree() {
  const parent = newRun(phishing, 'parent01', '2026-10-24T09:00:00.000Z', { title: 'Phishing incident', lead: 'on-call', severity: 'high' });
  parent.choices = { triage: 'escalate' };
  for (const id of ['received', 'gateway', 'triage']) parent.steps[id].status = 'done';
  parent.steps.escalate.status = 'active';
  const out = buildLinkedRuns({ parent01: parent }, chains, 'parent01', 'escalate', ['WS-0142', 'WS-0187'], '2026-10-24T10:00:00.000Z', ids('child001', 'child002'))!;
  return out.runs;
}

describe('runs saved by the current release', () => {
  it('a v1 export parses to the same run, with no parent or subject', () => {
    const run = parseRunJson(exportOf(v1Run));
    expect(run).toEqual(v1Run);
    expect('parent' in run || 'subject' in run).toBe(false);
  });

  it('drops a malformed parent or subject on import', () => {
    const run = parseRunJson(exportOf({ ...v1Run, parent: { runId: 5 }, subject: { kind: 'user', value: 'x' } }));
    expect('parent' in run || 'subject' in run).toBe(false);
    const long = parseRunJson(exportOf({ ...v1Run, subject: { kind: 'host', value: 'a'.repeat(HOST_MAX + 1) } }));
    expect('subject' in long).toBe(false);
  });

  it('labels a timeline entry of a kind it does not know as Entry, even "toString"', () => {
    const run = { ...v1Run, log: [...v1Run.log, { at: '2026-10-24T09:40:00.000Z', kind: 'toString', text: 'From a newer release' }] } as Run;
    expect(runToMarkdown(run, phishing, NOW)).toContain('| 2026-10-24T09:40:00Z | Entry | From a newer release |');
  });
});

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
