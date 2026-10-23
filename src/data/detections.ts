import raw from './external/detections.json';
import { flowChains } from './flowChains';
import { techniques } from './techniques';
import type { FlowChain, Technique } from './types';

/**
 * UMBRASEC detections, synced from the sigma-pack (umbrasec.dev) and the umbra-blue
 * skill library by scripts/sync-detections.mjs. Rule content is the canonical copy,
 * byte for byte. Never edit external/detections.json by hand; re-run the sync.
 */

export interface DetectionRule {
  id: string;
  file: string;
  path: string;
  url: string;
  kind: 'sigma' | 'kql';
  title: string;
  description: string;
  /** Sigma status (experimental, test, stable) or "query" for KQL. */
  status: string | null;
  level: 'informational' | 'low' | 'medium' | 'high' | 'critical' | null;
  correlation: boolean;
  attackIds: string[];
  tactics: string[];
  logsource: string | null;
  falsepositives: string[];
  writeup: string | null;
  content: string;
}

export interface BlueSkill {
  name: string;
  category: string;
  /** 1 = sourced, ships a tuned UMBRASEC rule. 2 = methodology only. */
  tier: 1 | 2;
  description: string;
  attackIds: string[];
  answers: string[];
  /** Ids of sigma-pack rules this skill inlines. */
  rules: string[];
  url: string;
}

interface DetectionsFile {
  sources: Record<'sigmaPack' | 'umbraBlue', { repo: string; commit: string | null; url: string }>;
  rules: DetectionRule[];
  skills: BlueSkill[];
}

const data = raw as DetectionsFile;

export const detectionSources = data.sources;
export const rules = data.rules;
export const skills = data.skills;
export const ruleById: Record<string, DetectionRule> = Object.fromEntries(rules.map((r) => [r.id, r]));
/** Skill by name. A Map, because names come from the URL and /skills/toString must miss. */
export const skillByName = new Map<string, BlueSkill>(skills.map((s) => [s.name, s]));

/** What each tier means, worded as in the umbra-blue README. */
export const tierMeta: Record<BlueSkill['tier'], { label: string; hint: string }> = {
  1: { label: 'Sourced', hint: 'Built from a published UMBRASEC writeup. Ships a runnable detection or hunt.' },
  2: { label: 'Methodology', hint: 'The defender’s method, signals and hunt. No bespoke UMBRASEC rule ships yet.' },
};

/**
 * Permalink routes other UMBRASEC repos link to. Public contract: keep these stable.
 * /skills/<umbra-blue skill name> and /attack/<ATT&CK or ATLAS technique id>.
 */
export const skillPath = (name: string) => `/skills/${encodeURIComponent(name)}`;
export const attackPath = (id: string) => `/attack/${id}`;

/** True when one technique ID equals the other or is its parent (T1048 ↔ T1048.003). */
export function related(a: string, b: string) {
  return a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

const ATTACK_ID = /^(AML[./_-]?)?T(\d{4})(?:[./_-](\d{3}))?$/;

/**
 * Canonical form of an ATT&CK or ATLAS technique ID, or null if it isn't one.
 * Case-insensitive; accepts ".", "/", "-" or "_" before the sub-technique:
 * t1558-003 → T1558.003, T1558/003 → T1558.003, aml.t0051 → AML.T0051.
 */
export function normaliseAttackId(raw: string): string | null {
  const m = raw.trim().replace(/\/+$/, '').toUpperCase().match(ATTACK_ID);
  if (!m) return null;
  return `${m[1] ? 'AML.' : ''}T${m[2]}${m[3] ? `.${m[3]}` : ''}`;
}

/** T1558.003 → T1558, AML.T0051.001 → AML.T0051, T1558 → null. */
export function parentAttackId(id: string): string | null {
  return /\.\d{3}$/.test(id) ? id.slice(0, -4) : null;
}

/** Every technique ID the mapper, the sigma-pack or umbra-blue mentions. */
export const knownAttackIds: string[] = [
  ...new Set([
    ...techniques.map((t) => t.attackId),
    ...rules.flatMap((r) => r.attackIds),
    ...skills.flatMap((s) => s.attackIds),
  ]),
].sort();

const SEVERITY_ORDER: Technique['severity'][] = ['critical', 'high', 'medium', 'low'];

/**
 * Mapper techniques whose ATT&CK ID equals, or is a parent or child of, any of `ids`.
 * Exact matches come first, then the most severe.
 */
export function techniquesForIds(ids: string[]): Technique[] {
  const rank = (t: Technique) => (ids.includes(t.attackId) ? 0 : 10) + SEVERITY_ORDER.indexOf(t.severity);
  return techniques
    .filter((t) => ids.some((id) => related(id, t.attackId)))
    .sort((a, b) => rank(a) - rank(b));
}

/** Flow chains a set of techniques leads to: each technique's own chain, then chains that list it. */
export function chainsForTechniques(list: Technique[]): FlowChain[] {
  const out: FlowChain[] = [];
  const add = (c: FlowChain | undefined) => c && !out.includes(c) && out.push(c);
  for (const t of list) {
    add(flowChains.find((c) => c.id === t.chain));
    flowChains.filter((c) => c.techniques.includes(t.id)).forEach(add);
  }
  return out;
}

export function rulesForTechnique(attackId: string): DetectionRule[] {
  return rules.filter((r) => r.attackIds.some((id) => related(id, attackId)));
}

/**
 * Skills that address a technique: exact ID matches first, then parent/child matches,
 * Tier 1 before Tier 2. Capped so broad skills don't drown specific ones; pass
 * Infinity for the full list.
 */
export function skillsForTechnique(attackId: string, limit = 4): BlueSkill[] {
  const rank = (s: BlueSkill) => (s.attackIds.includes(attackId) ? 0 : 1) * 10 + s.tier;
  return skills
    .filter((s) => s.attackIds.some((id) => related(id, attackId)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function skillsForRule(ruleId: string): BlueSkill[] {
  return skills.filter((s) => s.rules.includes(ruleId));
}

/** MITRE's page for a technique. ATLAS keeps the AML. prefix in its URLs (atlas.mitre.org/techniques/AML.T0051). */
export const attackUrl = (id: string) =>
  id.startsWith('AML.')
    ? `https://atlas.mitre.org/techniques/${id}`
    : `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`;
