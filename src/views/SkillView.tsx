import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronRight, ExternalLink, Sparkles, Swords } from 'lucide-react';
import {
  attackPath,
  chainsForTechniques,
  related,
  ruleById,
  rules,
  skillByName,
  skillPath,
  skills,
  techniquesForIds,
  tierMeta,
  type BlueSkill,
  type DetectionRule,
} from '@/data/detections';
import { TierBadge } from '@/components/Badges';
import { EmptyState } from '@/components/Feedback';
import { ChainList, LinkSection, NoneYet, RuleList, TechniqueList } from '@/components/DetectionLinks';

/** Words too common in skill names to suggest a match on their own. */
const STOP = new Set(['detect', 'defend', 'monitor', 'hunt', 'harden', 'and', 'the']);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));

/** Up to three skills whose name shares a word (or a word's start) with the one asked for. */
function closeMatches(name: string): BlueSkill[] {
  const want = tokens(name);
  if (want.length === 0) return [];
  const score = (s: BlueSkill) =>
    tokens(s.name).filter((u) => want.some((w) => u === w || (w.length >= 4 && (u.startsWith(w) || w.startsWith(u))))).length;
  return skills
    .map((s) => ({ s, n: score(s) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.s.name.localeCompare(b.s.name))
    .slice(0, 3)
    .map((x) => x.s);
}

function UnknownSkill({ name }: { name: string }) {
  const close = closeMatches(name);
  return (
    <div className="mx-auto max-w-xl py-10 [overflow-wrap:anywhere]">
      <EmptyState
        title={`No umbra-blue skill called “${name.slice(0, 80)}”`}
        hint="It may have been renamed, or not synced into the mapper yet."
        action={
          <div className="mt-2 flex flex-col items-center gap-3">
            {close.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-fog-dim">Did you mean</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {close.map((s) => (
                    <Link key={s.name} to={skillPath(s.name)} className="chip">
                      <Sparkles aria-hidden className="h-3 w-3 text-teal" /> {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <Link to="/detections?tab=skills" className="btn btn-primary">
              Browse all {skills.length} skills
            </Link>
          </div>
        }
      />
    </div>
  );
}

/**
 * Permalink page for one umbra-blue skill: /skills/<name>. Linked from the umbra-blue
 * README skill index, COVERAGE.md and the `mapper` field in claude-skills.json.
 */
export default function SkillView() {
  const { name = '' } = useParams();
  const skill = skillByName.get(name) ?? skillByName.get(name.trim().toLowerCase());
  if (!skill) return <UnknownSkill name={name} />;
  if (skill.name !== name) return <Navigate to={skillPath(skill.name)} replace />;

  const ids = skill.attackIds;
  const matched = techniquesForIds(ids).map((t) => ({
    technique: t,
    via: ids.includes(t.attackId) ? undefined : ids.find((id) => related(id, t.attackId)),
  }));
  const inlined = skill.rules.map((id) => ruleById[id]).filter((r): r is DetectionRule => !!r);
  const others = rules.filter((r) => !skill.rules.includes(r.id) && r.attackIds.some((a) => ids.some((b) => related(a, b))));
  const chains = chainsForTechniques(matched.map((m) => m.technique));
  const tier = tierMeta[skill.tier];

  return (
    <article className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 font-mono text-2xs text-fog-muted">
        <Link to="/detections?tab=skills" className="hover:text-fog-bright">
          umbra-blue skills
        </Link>
        <ChevronRight aria-hidden className="h-3 w-3" />
        <span aria-current="page" className="text-fog">
          {skill.name}
        </span>
      </nav>

      <header className="mb-6 max-w-3xl">
        <div className="eyebrow text-ember">umbra-blue skill</div>
        <h2 className="mt-1 font-mono text-xl font-medium [overflow-wrap:anywhere] sm:text-2xl">{skill.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          <TierBadge tier={skill.tier} />
          <span className="text-fog-dim">
            <b className="font-medium text-fog-bright">{tier.label}.</b> {tier.hint}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="eyebrow">Category</span>
          <Link to={`/detections?tab=skills&q=${encodeURIComponent(skill.category)}`} className="chip">
            {skill.category}
          </Link>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed">{skill.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={skill.url} target="_blank" rel="noreferrer" className="btn btn-primary">
            <ExternalLink aria-hidden className="h-4 w-4" /> Open SKILL.md on GitHub
          </a>
          <Link to="/detections?tab=skills" className="btn">
            All skills
          </Link>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <aside className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-1">
          <LinkSection
            id="skill-techniques"
            title="Techniques"
            count={ids.length}
            hint="Open an ID to see every rule, skill and chain for it."
          >
            <div className="flex flex-wrap gap-1.5">
              {ids.map((id) => (
                <Link key={id} to={attackPath(id)} className="chip text-ember/90">
                  {id}
                </Link>
              ))}
            </div>
          </LinkSection>
          <LinkSection
            id="skill-answers"
            title="Answers claude-red"
            count={skill.answers.length}
            hint="The claude-red offensive skills this one counters."
          >
            <ul className="space-y-1">
              {skill.answers.map((a) => (
                <li key={a} className="flex items-center gap-2 font-mono text-xs text-fog-bright">
                  <Swords aria-hidden className="h-3.5 w-3.5 shrink-0 text-rose" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{a}</span>
                </li>
              ))}
            </ul>
          </LinkSection>
        </aside>

        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
          <LinkSection
            id="skill-matrix"
            title="In the matrix"
            count={matched.length}
            hint="Matrix techniques with the same ATT&CK ID, or its parent or sub-technique."
          >
            {matched.length > 0 ? (
              <TechniqueList items={matched} />
            ) : (
              <NoneYet>None of this skill’s techniques are in the 22-technique matrix yet.</NoneYet>
            )}
          </LinkSection>

          <LinkSection id="skill-rules" title="UMBRASEC rules" count={inlined.length + others.length}>
            {inlined.length === 0 && others.length === 0 ? (
              <NoneYet>
                {skill.tier === 1
                  ? 'This skill’s detections live in SKILL.md. None are in the sigma-pack yet.'
                  : 'No UMBRASEC rule yet. SKILL.md points to public rule sources such as SigmaHQ.'}
              </NoneYet>
            ) : (
              <div className="space-y-4">
                {inlined.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-medium text-fog-dim">Ships with this skill</h4>
                    <RuleList rules={inlined} />
                  </div>
                )}
                {others.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-medium text-fog-dim">Other rules for these techniques</h4>
                    <RuleList rules={others} />
                  </div>
                )}
              </div>
            )}
          </LinkSection>

          <LinkSection
            id="skill-chains"
            title="Flow chains"
            count={chains.length}
            hint="Response chains reached through the matrix techniques above."
          >
            {chains.length > 0 ? (
              <ChainList chains={chains} />
            ) : (
              <NoneYet>
                {matched.length > 0
                  ? 'No response chain covers these techniques yet. Follow the immediate response in the matrix.'
                  : 'Chains link through matrix techniques, and none match this skill.'}
              </NoneYet>
            )}
          </LinkSection>
        </div>
      </div>
    </article>
  );
}
