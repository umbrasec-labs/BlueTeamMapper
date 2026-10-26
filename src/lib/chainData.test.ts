import { describe, expect, it } from 'vitest';
import { flowChainById, flowChains, spawnProblems } from '@/data/flowChains';
import type { FlowChain } from '@/data/types';

describe('spawn points', () => {
  it('every spawn point in the shipped chains is valid', () => {
    expect(spawnProblems(flowChains)).toEqual([]);
  });

  it('phishing escalate starts EDR Alert runs and ticks its third action', () => {
    const step = flowChainById['phishing'].steps.find((s) => s.id === 'escalate')!;
    expect(step.spawns).toEqual({ chainId: 'edr-alert', per: 'host', label: 'Start EDR triage on affected hosts', action: 2 });
    expect(step.actions[step.spawns!.action]).toBe('Start EDR triage on affected hosts');
  });

  it('reports an unknown chain and an action index out of range', () => {
    const bad: FlowChain = {
      ...flowChainById['phishing'],
      id: 'fixture-bad-spawn',
      steps: [{ id: 'x', label: 'X', phase: 'response', detail: '', actions: ['one'], spawns: { chainId: 'nope', per: 'host', label: 'L', action: 1 } }],
    };
    expect(spawnProblems([bad])).toEqual([
      'fixture-bad-spawn/x spawns unknown chain "nope"',
      'fixture-bad-spawn/x spawns.action 1 is not an index into its 1 actions',
    ]);
  });
});
