import type { Tool, ToolCategory } from './types';
import raw from './legacy/tools.json';

type RawTool = Omit<Tool, 'id' | 'category'> & { category: string };

/** Display metadata for each arsenal category, keyed by its v3 heading. */
const CATEGORY_META: Record<string, Omit<ToolCategory, 'id'>> = {
  'SIEM / LOG MANAGEMENT': { label: 'SIEM & Log Management', icon: 'database', hue: 'slate' },
  'EDR / ENDPOINT DETECTION': { label: 'EDR & Endpoint', icon: 'cpu', hue: 'teal' },
  'NETWORK DETECTION & RESPONSE': { label: 'Network Detection', icon: 'network', hue: 'sage' },
  'IDENTITY & ACCESS': { label: 'Identity & Access', icon: 'fingerprint', hue: 'mauve' },
  'THREAT INTELLIGENCE': { label: 'Threat Intelligence', icon: 'brain', hue: 'khaki' },
  'THREAT HUNTING': { label: 'Threat Hunting', icon: 'crosshair', hue: 'gold' },
  'FORENSICS & INCIDENT RESPONSE': { label: 'Forensics & IR', icon: 'microscope', hue: 'rose' },
  DECEPTION: { label: 'Deception', icon: 'ghost', hue: 'teal' },
  'VULNERABILITY MANAGEMENT': { label: 'Vulnerability Mgmt', icon: 'bug', hue: 'gold' },
  'DETECTION ENGINEERING': { label: 'Detection Engineering', icon: 'target', hue: 'sage' },
  'SOAR PLATFORMS': { label: 'SOAR Platforms', icon: 'bot', hue: 'ember' },
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const toolCategories: ToolCategory[] = Object.entries(CATEGORY_META).map(
  ([heading, meta]) => ({ id: slug(heading), ...meta }),
);

const categoryIdByHeading = Object.fromEntries(
  Object.keys(CATEGORY_META).map((h) => [h, slug(h)]),
);

export const tools: Tool[] = (raw as RawTool[]).map((t) => ({
  ...t,
  id: slug(t.label),
  category: categoryIdByHeading[t.category] ?? slug(t.category),
}));

export const toolCategoryById: Record<string, ToolCategory> = Object.fromEntries(
  toolCategories.map((c) => [c.id, c]),
);
