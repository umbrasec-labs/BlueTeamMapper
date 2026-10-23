/**
 * Linked lists shared by the skill and technique permalink pages: matrix techniques,
 * UMBRASEC rules, umbra-blue skills and flow chains, each pointing at its home view.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileCode2, Sparkles } from 'lucide-react';
import type { FlowChain, Technique } from '@/data';
import { coverageMeta, type CoverageLevel } from '@/data/coverage';
import { skillPath, type BlueSkill, type DetectionRule } from '@/data/detections';
import { useCoverage } from '@/store/coverage';
import { hueClass } from '@/lib/hues';
import { icons } from '@/lib/icons';
import { ClaimsBadge, SeverityBadge, TierBadge } from './Badges';

/** Sigma rule levels. Written out in full so the JIT compiler can see them. */
export const ruleLevelClass: Record<string, string> = {
  critical: 'text-ember border-ember/40 bg-ember/10',
  high: 'text-ember border-ember/40 bg-ember/10',
  medium: 'text-gold border-gold/40 bg-gold/10',
  low: 'text-sage border-sage/40 bg-sage/10',
  informational: 'text-slate border-slate/40 bg-slate/10',
};

const coverageClass: Record<CoverageLevel, string> = {
  alert: 'border-sage/40 bg-sage/10 text-sage',
  logged: 'border-gold/40 bg-gold/10 text-gold',
  blind: 'border-ember/40 bg-ember/10 text-ember',
};

const rowCls =
  'group flex rounded-lg border border-white/[0.06] bg-ink-850/60 px-3 py-2.5 transition hover:border-white/20 hover:bg-ink-850';

export function LinkSection({
  id,
  title,
  count,
  hint,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} id={`${id}-section`} className="glass min-w-0 scroll-mt-20 p-4">
      <h3 id={id} className="eyebrow flex items-center gap-2 text-fog-bright">
        {title}
        {count !== undefined && <span className="tabular text-fog-muted">{count}</span>}
      </h3>
      {hint && <p className="mt-1 text-xs text-fog-dim">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function NoneYet({ children }: { children: ReactNode }) {
  return <p className="text-xs text-fog-muted">{children}</p>;
}

/** Matrix techniques with severity, tactic and the viewer's own coverage rating. */
export function TechniqueList({ items }: { items: { technique: Technique; via?: string }[] }) {
  const levels = useCoverage((s) => s.levels);
  return (
    <ul className="space-y-1.5">
      {items.map(({ technique: t, via }) => {
        const level = levels[t.id];
        return (
          <li key={t.id}>
            <Link to={`/matrix?focus=${t.id}`} className={`${rowCls} flex-wrap items-center gap-x-3 gap-y-1.5`}>
              <span className="min-w-0 flex-1 basis-48">
                <span className="block text-[13px] font-medium text-fog-bright group-hover:text-ember">{t.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-2xs text-fog-muted">
                  <span className="text-ember/80">{t.attackId}</span>
                  <span>{t.tactic}</span>
                  {via && <span>via {via}</span>}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                {level && (
                  <span
                    className={`rounded border px-1.5 py-px font-mono text-2xs ${coverageClass[level]}`}
                    title="Your rating on the Coverage page"
                  >
                    Coverage: {coverageMeta[level].label}
                  </span>
                )}
                <SeverityBadge severity={t.severity} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RuleList({ rules }: { rules: DetectionRule[] }) {
  return (
    <ul className="space-y-1.5">
      {rules.map((r) => (
        <li key={r.id}>
          <Link to={`/detections?focus=${r.id}`} className={`${rowCls} items-start gap-2.5`}>
            <FileCode2
              aria-hidden
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${r.kind === 'kql' ? 'text-slate' : 'text-teal'}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-fog-bright group-hover:text-ember">{r.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-2xs text-fog-muted">
                <span className="uppercase">{r.kind}</span>
                <span aria-hidden>·</span>
                <span>{r.attackIds.join(' · ')}</span>
                {r.level && <span className={`rounded border px-1 ${ruleLevelClass[r.level] ?? ''}`}>{r.level}</span>}
                {r.claims && <ClaimsBadge claims={r.claims} />}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SkillList({ skills, via }: { skills: BlueSkill[]; via?: (s: BlueSkill) => string | undefined }) {
  return (
    <ul className="grid gap-1.5 md:grid-cols-2">
      {skills.map((s) => {
        const v = via?.(s);
        return (
          <li key={s.name} className="min-w-0">
            <Link to={skillPath(s.name)} className={`${rowCls} h-full items-start gap-2.5`}>
              <Sparkles aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 font-mono text-[13px] text-fog-bright [overflow-wrap:anywhere] group-hover:text-ember">
                    {s.name}
                  </span>
                  <TierBadge tier={s.tier} />
                </span>
                <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-fog-dim">{s.description}</span>
                <span className="mt-1 flex flex-wrap gap-x-2 font-mono text-2xs text-fog-muted">
                  <span>{s.category}</span>
                  {v && <span>via {v}</span>}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ChainList({ chains }: { chains: FlowChain[] }) {
  return (
    <ul className="space-y-1.5">
      {chains.map((c) => {
        const Icon = icons[c.icon];
        const hue = hueClass[c.hue];
        return (
          <li key={c.id}>
            <Link to={`/flows/${c.id}`} className={`${rowCls} items-center gap-3`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${hue.border} ${hue.bg}`}>
                <Icon aria-hidden className={`h-4 w-4 ${hue.text}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-fog-bright group-hover:text-ember">{c.title}</span>
                <span className="block truncate font-mono text-2xs text-fog-muted">{c.route}</span>
              </span>
              <SeverityBadge severity={c.severity} />
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-fog-muted group-hover:text-ember" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
