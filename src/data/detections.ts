import raw from './external/detections.json';
import { flowChains } from './flowChains';
import { techniques } from './techniques';
import type { FlowChain, Hue, Technique } from './types';

/**
 * UMBRASEC detections, synced from the sigma-pack (umbrasec.dev) and the umbra-blue
 * skill library by scripts/sync-detections.mjs. Rule content is the canonical copy,
 * byte for byte. Never edit external/detections.json by hand; re-run the sync.
 */

/**
 * Claims Ledger status for one rule, from the umbrasec-labs/detections harness.
 * "mismatch" is the mapper's own: the rule shown here is not the bytes the harness proved.
 */
export type ClaimStatus = 'verified' | 'not-executed' | 'stale' | 'failing' | 'mismatch' | 'unclaimed';

/** What the Claims Ledger proved about one rule. Attached only when the sync ran with --claims. */
export interface RuleClaims {
  status: ClaimStatus;
  /** Claims per kind (catches, false-positive, blind-spot, excluded, near-miss, undocumented). */
  counts: Record<string, number>;
  /** Claims that passed in the harness run the sync read, out of `total`. */
  passed: number;
  total: number;
  /** Blind-spot claims that passed: the rule stayed quiet, so the limitation is real. */
  blindSpots: { id: string; quote: string }[];
  /** False-positive claims that passed: the harmless activity does trip the rule. */
  falsePositives: { id: string; quote: string }[];
  /** Behaviour the rule text does not mention, each linked to an upstream issue or "pending". */
  findings: { id: string; summary: string; confidence: string | null; upstream: string | null }[];
  claimsUrl: string | null;
  engine: 'sigma' | 'kusto';
}

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
  claims?: RuleClaims;
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

interface DetectionSource {
  repo: string;
  commit: string | null;
  url: string;
}

interface DetectionsFile {
  /** `detections` is present only when the sync ran with --claims. */
  sources: Record<'sigmaPack' | 'umbraBlue', DetectionSource> & Partial<Record<'detections', DetectionSource>>;
  rules: DetectionRule[];
  skills: BlueSkill[];
}

const data = raw as DetectionsFile;

export const detectionSources = data.sources;
export const rules = data.rules;
export const skills = data.skills;
// Null prototype: ids from a URL such as "toString" find nothing instead of an inherited method.
export const ruleById: Record<string, DetectionRule> = Object.assign(
  Object.create(null),
  Object.fromEntries(rules.map((r) => [r.id, r])),
);
/** Skill by name. A Map, because names come from the URL and /skills/toString must miss. */
export const skillByName = new Map<string, BlueSkill>(skills.map((s) => [s.name, s]));

/** What each tier means, worded as in the umbra-blue README. */
export const tierMeta: Record<BlueSkill['tier'], { label: string; hint: string }> = {
  1: { label: 'Sourced', hint: 'Built from a published UMBRASEC writeup. Ships a runnable detection or hunt.' },
  2: { label: 'Methodology', hint: 'The defender’s method, signals and hunt. No bespoke UMBRASEC rule ships yet.' },
};

/** Where the Claims Ledger's signed records live. */
export const attestationsUrl = 'https://github.com/umbrasec-labs/detections/attestations';

/**
 * Chip tone and one-line meaning per Claims Ledger status. A null hue is neutral.
 * The harness checks "stale" and "failing" before it checks the engine, so a KQL query can
 * have either status while none of its claims ran. `kustoHint` covers that case.
 * The status comes from the harness run inside the site build. That run is unsigned, so
 * the copy names it and never reads as the attested run.
 */
export const claimStatusMeta: Record<ClaimStatus, { short: string; hue: Hue | null; hint: string; kustoHint?: string }> = {
  verified: {
    short: 'Verified',
    hue: 'sage',
    hint: 'Every claim passed when this site was built, and every false-positive note and writeup limitation is accounted for.',
  },
  'not-executed': {
    short: 'Not executed',
    hue: 'slate',
    hint: 'The claims passed schema and quote checks when this site was built. No Kusto engine runs them in CI yet.',
  },
  stale: {
    short: 'Stale',
    hue: 'gold',
    hint: 'The rule changed since its claims were last reviewed. They still ran when this site was built, and need a human re-read.',
    kustoHint:
      'The query changed since its claims were last reviewed. They need a human re-read. No Kusto engine runs them in CI yet.',
  },
  failing: {
    short: 'Failing',
    hue: 'ember',
    hint: 'A claim or a coverage check failed when this site was built.',
    kustoHint:
      'A schema, quote or coverage check failed when this site was built. No Kusto engine runs the claims in CI yet.',
  },
  mismatch: {
    short: 'Mismatch',
    hue: 'ember',
    hint: 'The rule shown here differs from the bytes the claims ran on, so no proofs are shown.',
  },
  unclaimed: {
    short: 'Unclaimed',
    hue: null,
    hint: 'No claims file covers this rule yet.',
  },
};

/** One-line meaning of a rule's status, true for its engine. */
export function claimsHint(c: RuleClaims): string {
  const meta = claimStatusMeta[c.status];
  return (c.engine === 'kusto' && meta.kustoHint) || meta.hint;
}

/** Chip text, e.g. "Claims verified 9/9" or "KQL: not executed". */
export function claimsLabel(c: RuleClaims): string {
  switch (c.status) {
    case 'verified':
      return `Claims verified ${c.passed}/${c.total}`;
    case 'not-executed':
      return c.engine === 'kusto' ? 'KQL: not executed' : 'Claims not executed';
    case 'unclaimed':
      return 'No claims yet';
    default:
      return `Claims ${claimStatusMeta[c.status].short.toLowerCase()}`;
  }
}

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
