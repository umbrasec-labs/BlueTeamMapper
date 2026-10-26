import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import { formatDuration, runPath } from './runbook';

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
