import { coverageMeta, logSources, type CoverageLevel } from '@/data/coverage';
import { rulesForTechnique } from '@/data/detections';
import { techniques } from '@/data/techniques';

/**
 * ATT&CK Navigator layer export/import. Scores: Alert 100, Logged 50, Blind 0.
 * The collected log sources ride along in the layer's metadata so a round trip
 * through Navigator and back restores the full assessment.
 */

interface NavigatorTechnique {
  techniqueID: string;
  score?: number;
  color?: string;
  comment?: string;
  enabled?: boolean;
  metadata?: { name: string; value: string }[];
}

interface NavigatorLayer {
  name: string;
  versions: { attack: string; navigator: string; layer: string };
  domain: string;
  description: string;
  techniques: NavigatorTechnique[];
  gradient: { colors: string[]; minValue: number; maxValue: number };
  legendItems: { label: string; color: string }[];
  metadata: { name: string; value: string }[];
  showTechniqueCount?: boolean;
}

const SOURCES_KEY = 'btm:sources';
const SOURCE_TAG = 'btm:technique';

export function buildLayer(levels: Record<string, CoverageLevel>, sources: Record<string, boolean>): NavigatorLayer {
  const assessed = techniques.filter((t) => levels[t.id]);
  return {
    name: 'Blue Team Mapper coverage',
    versions: { attack: '17', navigator: '5.1.0', layer: '4.5' },
    domain: 'enterprise-attack',
    description: `Coverage self-assessment exported from Blue Team Mapper. ${assessed.length} of ${techniques.length} techniques assessed.`,
    techniques: assessed.map((t) => {
      const level = levels[t.id];
      const umbrasec = rulesForTechnique(t.attackId).map((r) => r.file);
      return {
        techniqueID: t.attackId,
        score: coverageMeta[level].score,
        color: coverageMeta[level].color,
        enabled: true,
        comment: [`${coverageMeta[level].label}: ${t.name}`, `Detection: ${t.detection}`, umbrasec.length ? `UMBRASEC rules: ${umbrasec.join(', ')}` : '']
          .filter(Boolean)
          .join('\n'),
        metadata: [{ name: SOURCE_TAG, value: `${t.id}=${level}` }],
      };
    }),
    gradient: { colors: [coverageMeta.blind.color, coverageMeta.logged.color, coverageMeta.alert.color], minValue: 0, maxValue: 100 },
    legendItems: (Object.keys(coverageMeta) as CoverageLevel[]).map((k) => ({ label: coverageMeta[k].label, color: coverageMeta[k].color })),
    metadata: [
      { name: SOURCES_KEY, value: logSources.filter((s) => sources[s.label]).map((s) => s.label).join('|') },
    ],
    showTechniqueCount: false,
  };
}

/** Save the layer as a .json file (works on the deployed site; browsers handle the download). */
export function downloadLayer(layer: NavigatorLayer) {
  const blob = new Blob([JSON.stringify(layer, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `blue-team-coverage-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const levelFromScore = (score: number | undefined): CoverageLevel | null =>
  score === undefined ? null : score >= 75 ? 'alert' : score >= 25 ? 'logged' : 'blind';

/**
 * Parse a layer exported here (or edited in Navigator). Techniques without our
 * metadata tag are matched by ATT&CK ID, and their score decides the level.
 */
export function parseLayer(text: string): { levels: Record<string, CoverageLevel>; sources: Record<string, boolean>; matched: number } {
  let layer: Partial<NavigatorLayer>;
  try {
    layer = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON. Export a layer from this page or from ATT&CK Navigator and try again.');
  }
  if (!Array.isArray(layer.techniques)) {
    throw new Error('That JSON is not an ATT&CK Navigator layer (it has no "techniques" list).');
  }
  const levels: Record<string, CoverageLevel> = {};
  for (const nt of layer.techniques) {
    const tagged = nt.metadata?.find((m) => m.name === SOURCE_TAG)?.value.split('=');
    if (tagged && techniques.some((t) => t.id === tagged[0]) && tagged[1] in coverageMeta) {
      levels[tagged[0]] = tagged[1] as CoverageLevel;
      continue;
    }
    const level = levelFromScore(nt.score);
    if (!level) continue;
    for (const t of techniques) if (t.attackId === nt.techniqueID) levels[t.id] = level;
  }
  const sourceList = layer.metadata?.find((m) => m.name === SOURCES_KEY)?.value.split('|').filter(Boolean) ?? [];
  const known = new Set(logSources.map((s) => s.label));
  const sources = Object.fromEntries(sourceList.filter((s) => known.has(s)).map((s) => [s, true]));
  return { levels, sources, matched: Object.keys(levels).length };
}
