import type { EventRef } from './types';
import raw from './legacy/events.json';

/** Windows Security and Sysmon event IDs from the v3 Event ID Reference. */
export const events = raw as EventRef[];

export const eventKey = (e: Pick<EventRef, 'source' | 'id'>) => `${e.source}-${e.id}`;

export function findEvent(source: EventRef['source'], id: number): EventRef | undefined {
  return events.find((e) => e.source === source && e.id === id);
}
