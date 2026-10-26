import { describe, expect, it } from 'vitest';
import { flowChainById } from '@/data/flowChains';
import stored from './__fixtures__/runbooks-v1.json';
import type { Run } from './runbook';
import { parseRunJson, RUNBOOK_FORMAT, runToMarkdown } from './runbookExport';

const phishing = flowChainById['phishing'];
const NOW = Date.parse('2026-10-24T12:00:00.000Z');
/** The `btm-runbooks-v1` value the current release (before linked runs) writes. */
const v1Runs = stored.state.runs as unknown as Record<string, Run>;
const v1Run = v1Runs.k7m2p9qa;
const exportOf = (run: unknown) => JSON.stringify({ format: RUNBOOK_FORMAT, version: 1, exportedAt: '2026-10-24T12:00:00.000Z', run });

describe('runs saved by the current release', () => {
  it('a v1 export parses to the same run, with no parent or subject', () => {
    const run = parseRunJson(exportOf(v1Run));
    expect(run).toEqual(v1Run);
    expect('parent' in run || 'subject' in run).toBe(false);
  });

  it('labels a timeline entry of a kind it does not know as Entry, even "toString"', () => {
    const run = { ...v1Run, log: [...v1Run.log, { at: '2026-10-24T09:40:00.000Z', kind: 'toString', text: 'From a newer release' }] } as Run;
    expect(runToMarkdown(run, phishing, NOW)).toContain('| 2026-10-24T09:40:00Z | Entry | From a newer release |');
  });
});
