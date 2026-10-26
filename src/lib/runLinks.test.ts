import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import { childRuns, HOSTS_PER_START, type Run } from './runbook';
import {
  assignImportIds,
  buildLinkedRuns,
  closeRunIn,
  deleteRunIn,
  freeId,
  newRun,
  reopenRunIn,
  spawnTickLocked,
} from './runLinks';
import { fixtureRun, ids } from './__fixtures__/runs';

const chains = flowChainById;
const phishing = chains['phishing'];
const edr = chains['edr-alert'];
const T0 = '2026-10-24T10:00:00.000Z';
const T1 = '2026-10-24T11:00:00.000Z';

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
