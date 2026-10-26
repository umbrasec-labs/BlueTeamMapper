import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import { freeId, newRun } from './runLinks';
import { fixtureRun, ids } from './__fixtures__/runs';

const chains = flowChainById;
const edr = chains['edr-alert'];
const T0 = '2026-10-24T10:00:00.000Z';

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
