import type { Section } from './types';
import raw from './legacy/sections.json';

/** All v3 sections, in page order. Content is extracted by scripts/extract_legacy.py. */
export const sections = raw as Section[];

export const sectionById: Record<string, Section> = Object.fromEntries(
  sections.map((s) => [s.id, s]),
);

/** Stable id for a card, used for deep links (#card-...) and search jumps. */
export function cardSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
