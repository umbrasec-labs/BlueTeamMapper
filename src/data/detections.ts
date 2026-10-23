import raw from './external/detections.json';

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

/** True when one technique ID equals the other or is its parent (T1048 ↔ T1048.003). */
function related(a: string, b: string) {
  return a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

export function rulesForTechnique(attackId: string): DetectionRule[] {
  return rules.filter((r) => r.attackIds.some((id) => related(id, attackId)));
}

/**
 * Skills that address a technique: exact ID matches first, then parent/child matches,
 * Tier 1 before Tier 2. Capped so broad skills don't drown specific ones.
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

export const attackUrl = (id: string) =>
  id.startsWith('AML.')
    ? `https://atlas.mitre.org/techniques/${id.slice(4)}`
    : `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`;
