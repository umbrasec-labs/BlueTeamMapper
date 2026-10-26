import type { Run } from '../runbook';

/** A bare run for tests. Step records are optional: helpers treat a missing one as pending. */
export function fixtureRun(id: string, chainId: string, over: Partial<Run> = {}): Run {
  return {
    id,
    chainId,
    title: `Run ${id}`,
    lead: '',
    severity: 'high',
    startedAt: '2026-10-24T09:00:00.000Z',
    status: 'active',
    steps: {},
    choices: {},
    log: [],
    ...over,
  };
}

/** Ids from a fixed list, so tests know every new run's id. */
export const ids = (...list: string[]) => () => {
  const id = list.shift();
  if (!id) throw new Error('fixture id list ran out');
  return id;
};
