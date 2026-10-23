import Fuse, { type IFuseOptions } from 'fuse.js';
import {
  cardSlug,
  eventKey,
  events,
  flowChains,
  layerForSection,
  layers,
  phases,
  sections,
  techniques,
  toolCategoryById,
  tools,
} from '@/data';

export type SearchKind =
  | 'phase'
  | 'layer'
  | 'chain'
  | 'step'
  | 'technique'
  | 'tool'
  | 'event'
  | 'section'
  | 'card';

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  body: string;
  /** Router location to jump to. */
  to: string;
}

export const kindLabel: Record<SearchKind, string> = {
  phase: 'Phase',
  layer: 'Layer',
  chain: 'Flow chain',
  step: 'Flow step',
  technique: 'Technique',
  tool: 'Tool',
  event: 'Event ID',
  section: 'Section',
  card: 'Reference card',
};

/** Order result groups appear in. */
export const kindOrder: SearchKind[] = [
  'phase',
  'layer',
  'chain',
  'technique',
  'event',
  'tool',
  'step',
  'section',
  'card',
];

function buildDocs(): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const p of phases) {
    docs.push({
      id: `phase:${p.id}`,
      kind: 'phase',
      title: p.label,
      subtitle: p.tagline,
      body: [p.description, ...p.capabilities, ...p.objectives, ...p.keyTools].join(' '),
      to: `/?phase=${p.id}`,
    });
  }

  for (const l of layers) {
    docs.push({
      id: `layer:${l.id}`,
      kind: 'layer',
      title: `${l.label} layer`,
      subtitle: l.tagline,
      body: l.keyControls.map((c) => c.label).join(' '),
      to: `/layers/${l.id}`,
    });
  }

  for (const c of flowChains) {
    docs.push({
      id: `chain:${c.id}`,
      kind: 'chain',
      title: c.title,
      subtitle: c.route,
      body: c.summary,
      to: `/flows/${c.id}`,
    });
    for (const s of c.steps) {
      docs.push({
        id: `step:${c.id}:${s.id}`,
        kind: 'step',
        title: s.label,
        subtitle: `${c.title} chain`,
        body: [s.detail, ...s.actions, ...(s.evidence ?? []), ...(s.tools ?? [])].join(' '),
        to: `/flows/${c.id}?step=${s.id}`,
      });
    }
  }

  for (const t of techniques) {
    docs.push({
      id: `technique:${t.id}`,
      kind: 'technique',
      title: t.name,
      subtitle: `${t.attackId} · ${t.tactic}`,
      body: `${t.attackId} ${t.detection} ${t.response}`,
      to: `/matrix?focus=${t.id}`,
    });
  }

  for (const e of events) {
    docs.push({
      id: `event:${eventKey(e)}`,
      kind: 'event',
      title: `${e.id} · ${e.name}`,
      subtitle: e.source === 'sysmon' ? 'Sysmon' : `Security · ${e.category}`,
      body: `${e.id} ${e.description}`,
      to: `/events?focus=${eventKey(e)}`,
    });
  }

  for (const t of tools) {
    docs.push({
      id: `tool:${t.id}`,
      kind: 'tool',
      title: t.label,
      subtitle: toolCategoryById[t.category]?.label ?? t.category,
      body: `${t.names.join(' ')} ${t.description}`,
      to: `/tools?focus=${t.id}`,
    });
  }

  for (const s of sections) {
    docs.push({
      id: `section:${s.id}`,
      kind: 'section',
      title: s.title,
      subtitle: s.eyebrow,
      body: s.description,
      to: `/sections/${s.id}`,
    });
    for (const card of s.cards) {
      const layer = layerForSection(s.id);
      docs.push({
        id: `card:${s.id}:${cardSlug(card.title)}`,
        kind: 'card',
        title: card.title,
        subtitle: `${s.title}${layer ? ` · ${layer.label} layer` : ''}`,
        body: [card.summary, ...card.items.map((i) => `${i.lead} ${i.text} ${i.note ?? ''}`)].join(' '),
        to: `/sections/${s.id}?card=${cardSlug(card.title)}`,
      });
    }
  }

  return docs;
}

const options: IFuseOptions<SearchDoc> = {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'subtitle', weight: 1.2 },
    { name: 'body', weight: 1 },
  ],
  threshold: 0.34,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeMatches: false,
};

let fuse: Fuse<SearchDoc> | null = null;
let allDocs: SearchDoc[] | null = null;

/** Lazily build the index the first time search is used. */
function index() {
  if (!fuse) {
    allDocs = buildDocs();
    fuse = new Fuse(allDocs, options);
  }
  return { fuse, docs: allDocs! };
}

export function search(query: string, limit = 40): SearchDoc[] {
  const q = query.trim();
  const { fuse: f, docs } = index();
  if (!q) return docs.filter((d) => d.kind === 'phase' || d.kind === 'chain');
  return f.search(q, { limit }).map((r) => r.item);
}
