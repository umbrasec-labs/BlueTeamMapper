import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import {
  childRuns,
  childSummary,
  closeWarning,
  defaultChildTitle,
  formatDuration,
  HOST_MAX,
  hostOf,
  HOSTS_PER_START,
  kindLabel,
  linkOf,
  parseHosts,
  runPath,
  type HostSubject,
  type RunLink,
} from './runbook';
import { fixtureRun } from './__fixtures__/runs';

describe('formatDuration', () => {
  it('formats minutes, hours and days', () => {
    expect(formatDuration(30_000)).toBe('<1m');
    expect(formatDuration(12 * 60_000)).toBe('12m');
    expect(formatDuration(65 * 60_000)).toBe('1h 05m');
    expect(formatDuration(51 * 3_600_000)).toBe('2d 3h');
  });
});

describe('runPath', () => {
  it('stops at the phishing triage decision until a branch is picked', () => {
    const chain = flowChainById['phishing'];
    expect(runPath(chain, {}).awaiting?.id).toBe('triage');
    expect(runPath(chain, { triage: 'escalate' }).steps.map((s) => s.id)).toEqual([
      'received', 'gateway', 'triage', 'escalate', 'block', 'hunt', 'purge',
    ]);
  });
});

describe('kindLabel', () => {
  it('labels link entries and falls back to Entry for kinds it does not know', () => {
    expect(kindLabel('link')).toBe('Linked run');
    expect(kindLabel('handoff')).toBe('Entry');
    expect(kindLabel('toString')).toBe('Entry');
  });
});

describe('parseHosts', () => {
  it('splits on new lines, commas and spaces, trims and drops empties', () => {
    expect(parseHosts(' WS-0142,WS-0187\n\n  srv-db01  ws-0200 ,').hosts).toEqual(['WS-0142', 'WS-0187', 'srv-db01', 'ws-0200']);
  });

  it('drops case-insensitive duplicates, keeps the first spelling and counts them', () => {
    const r = parseHosts('WS-0142 ws-0142 Ws-0142 WS-0187');
    expect(r.hosts).toEqual(['WS-0142', 'WS-0187']);
    expect(r.dupes).toBe(2);
  });

  it('leaves out hosts longer than HOST_MAX and counts them', () => {
    const r = parseHosts(`ok-1 ${'a'.repeat(HOST_MAX + 1)} ${'b'.repeat(HOST_MAX)}`);
    expect(r.hosts).toEqual(['ok-1', 'b'.repeat(HOST_MAX)]);
    expect(r.tooLong).toBe(1);
  });

  it('keeps at most HOSTS_PER_START hosts and counts the rest', () => {
    const many = Array.from({ length: HOSTS_PER_START + 7 }, (_, i) => `host-${i}`).join('\n');
    const r = parseHosts(`${many}\nhost-0`);
    expect(r.hosts).toHaveLength(HOSTS_PER_START);
    expect(r.hosts[0]).toBe('host-0');
    expect(r.extra).toBe(7);
    expect(r.dupes).toBe(1);
  });

  it('sets aside hosts already linked before the cap applies', () => {
    const linked = Array.from({ length: HOSTS_PER_START }, (_, i) => `host-${i}`);
    const fresh = ['new-1', 'new-2', 'new-3', 'new-4', 'new-5'];
    const r = parseHosts([...linked.map((h) => h.toUpperCase()), ...fresh].join('\n'), new Set(linked));
    expect(r.hosts).toEqual(fresh);
    expect(r.already).toEqual(linked.map((h) => h.toUpperCase()));
    expect(r.extra).toBe(0);
  });

  it('gives nothing for blank input', () => {
    expect(parseHosts(' \n , ')).toEqual({ hosts: [], already: [], tooLong: 0, dupes: 0, extra: 0 });
  });
});

describe('links read from storage', () => {
  const link = { runId: 'parent01', stepId: 'escalate', title: 'Phishing incident', chainId: 'phishing' };

  it('accepts a well-formed parent and host', () => {
    const r = fixtureRun('child001', 'edr-alert', { parent: link, subject: { kind: 'host', value: ' WS-0142 ' } });
    expect(linkOf(r)).toEqual(link);
    expect(hostOf(r)).toBe('WS-0142');
  });

  it('ignores malformed values that skipped import checks', () => {
    const bad = [
      fixtureRun('a0000001', 'edr-alert', { parent: 'x' as unknown as RunLink }),
      fixtureRun('a0000002', 'edr-alert', { parent: { ...link, runId: 5 } as unknown as RunLink }),
      fixtureRun('a0000003', 'edr-alert', { parent: { ...link, runId: '' } }),
      fixtureRun('a0000004', 'edr-alert', { subject: { kind: 'user', value: 'x' } as unknown as HostSubject }),
      fixtureRun('a0000005', 'edr-alert', { subject: { kind: 'host', value: '   ' } }),
      fixtureRun('a0000006', 'edr-alert', { subject: { kind: 'host', value: 'a'.repeat(HOST_MAX + 1) } }),
    ];
    expect(bad.map(linkOf)).toEqual(bad.map(() => undefined));
    expect(bad.map(hostOf)).toEqual(bad.map(() => undefined));
  });
});

describe('childRuns and childSummary', () => {
  const at = (s: number) => `2026-10-24T10:00:0${s}.000Z`;
  const link = (stepId: string) => ({ runId: 'parent01', stepId, title: 'P', chainId: 'phishing' });
  const runs = Object.fromEntries(
    [
      fixtureRun('parent01', 'phishing'),
      fixtureRun('zzzz0001', 'edr-alert', { parent: link('escalate'), startedAt: at(2), status: 'closed' }),
      fixtureRun('aaaa0002', 'edr-alert', { parent: link('escalate'), startedAt: at(1) }),
      fixtureRun('bbbb0003', 'edr-alert', { parent: link('hunt'), startedAt: at(1) }),
      fixtureRun('cccc0004', 'edr-alert', { parent: { ...link('escalate'), runId: 'other001' } }),
      fixtureRun('22222222', 'edr-alert', { parent: link('escalate'), startedAt: at(3) }),
    ].map((r) => [r.id, r]),
  );

  it('lists runs linked from a run in start order, all steps or one', () => {
    expect(childRuns(runs, 'parent01').map((r) => r.id)).toEqual(['aaaa0002', 'bbbb0003', 'zzzz0001', '22222222']);
    expect(childRuns(runs, 'parent01', 'escalate').map((r) => r.id)).toEqual(['aaaa0002', 'zzzz0001', '22222222']);
    expect(childRuns(runs, 'nobody01')).toEqual([]);
  });

  it('counts open and closed', () => {
    expect(childSummary(childRuns(runs, 'parent01', 'escalate'))).toEqual({ total: 3, open: 2, closed: 1, text: '3 linked runs, 2 open' });
    expect(childSummary([runs.aaaa0002]).text).toBe('1 linked run, 1 open');
  });
});

describe('defaultChildTitle', () => {
  it('names the chain, the host and the parent', () => {
    const parent = fixtureRun('parent01', 'phishing', { title: 'Phishing incident 24 Oct 2026' });
    expect(defaultChildTitle(flowChainById['edr-alert'], 'WS-0142', parent)).toBe('EDR Alert on WS-0142 (Phishing incident 24 Oct 2026)');
  });
});

describe('closeWarning', () => {
  it('covers open steps, open linked runs, or both', () => {
    expect(closeWarning(2, false, 0)).toBe('2 steps are still open.');
    expect(closeWarning(1, true, 0)).toBe('At least 1 step is still open.');
    expect(closeWarning(0, false, 1)).toBe('1 linked run is still open.');
    expect(closeWarning(0, false, 3)).toBe('3 linked runs are still open.');
    expect(closeWarning(2, true, 1)).toBe('At least 2 steps and 1 linked run are still open.');
    expect(closeWarning(0, false, 0)).toBe('');
  });
});
