import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import {
  attackPath,
  attackUrl,
  chainsForTechniques,
  knownAttackIds,
  normaliseAttackId,
  parentAttackId,
  related,
  rulesForTechnique,
  skillsForTechnique,
  techniquesForIds,
} from '@/data/detections';
import { EmptyState } from '@/components/Feedback';
import { ChainList, LinkSection, NoneYet, RuleList, SkillList, TechniqueList } from '@/components/DetectionLinks';

function InvalidId({ raw }: { raw: string }) {
  return (
    <div className="mx-auto max-w-xl py-10 [overflow-wrap:anywhere]">
      <EmptyState
        title={raw ? `“${raw.slice(0, 80)}” isn’t a technique ID` : 'Add a technique ID to the link'}
        hint="Use an ATT&CK ID such as T1558 or T1558.003, or an ATLAS ID such as AML.T0051. Case doesn’t matter, and t1558-003 or T1558/003 work too."
        action={
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link to={attackPath('T1558.003')} className="btn btn-primary">
              Try T1558.003
            </Link>
            <Link to="/matrix" className="btn">
              Open the detection matrix
            </Link>
          </div>
        }
      />
    </div>
  );
}

/**
 * Permalink page for one ATT&CK or ATLAS technique: /attack/<id>. Gathers the matrix
 * techniques, UMBRASEC rules, umbra-blue skills and flow chains for the ID, its parent
 * and its sub-techniques.
 */
export default function AttackView() {
  const raw = useParams()['*'] ?? '';
  const id = normaliseAttackId(raw);
  if (!id) return <InvalidId raw={raw} />;
  if (id !== raw) return <Navigate to={attackPath(id)} replace />;

  const atlas = id.startsWith('AML.');
  const site = atlas ? 'atlas.mitre.org' : 'attack.mitre.org';
  const via = (ids: string[]) => (ids.includes(id) ? undefined : ids.filter((x) => related(x, id)).join(', '));
  const exactFirst = (ids: string[]) => (ids.includes(id) ? 0 : 1);

  const matched = techniquesForIds([id]).map((t) => ({ technique: t }));
  const ruleList = rulesForTechnique(id).sort(
    (a, b) => exactFirst(a.attackIds) - exactFirst(b.attackIds) || a.title.localeCompare(b.title),
  );
  const skillList = skillsForTechnique(id, Infinity);
  const chains = chainsForTechniques(matched.map((m) => m.technique));
  const parent = parentAttackId(id);
  const children = knownAttackIds.filter((k) => k.startsWith(`${id}.`));
  const name = matched.find((m) => m.technique.attackId === id)?.technique.name;

  if (matched.length + ruleList.length + skillList.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <EmptyState
          title={`Nothing in the mapper covers ${id} yet`}
          hint="No matrix technique, UMBRASEC rule or umbra-blue skill lists this ID, its parent or its sub-techniques."
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <a href={attackUrl(id)} target="_blank" rel="noreferrer" className="btn btn-primary">
                <ExternalLink aria-hidden className="h-4 w-4" /> View {id} on {site}
              </a>
              {parent && (
                <Link to={attackPath(parent)} className="btn">
                  Try the parent, {parent}
                </Link>
              )}
            </div>
          }
        />
      </div>
    );
  }

  const counts: [string, string, number][] = [
    ['Matrix techniques', 'attack-matrix', matched.length],
    ['UMBRASEC rules', 'attack-rules', ruleList.length],
    ['umbra-blue skills', 'attack-skills', skillList.length],
    ['Flow chains', 'attack-chains', chains.length],
  ];

  return (
    <article className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 font-mono text-2xs text-fog-muted">
        <Link to="/matrix" className="hover:text-fog-bright">
          Detection matrix
        </Link>
        <ChevronRight aria-hidden className="h-3 w-3" />
        {parent && (
          <>
            <Link to={attackPath(parent)} className="hover:text-fog-bright">
              {parent}
            </Link>
            <ChevronRight aria-hidden className="h-3 w-3" />
          </>
        )}
        <span aria-current="page" className="text-fog">
          {id}
        </span>
      </nav>

      <header className="mb-6 max-w-3xl">
        <div className="eyebrow text-ember">
          {atlas ? 'MITRE ATLAS' : 'MITRE ATT&CK'} {parent ? 'sub-technique' : 'technique'}
        </div>
        <h2 className="mt-1 font-mono text-2xl font-medium sm:text-3xl">{id}</h2>
        {name && <p className="mt-1 font-display text-lg font-bold text-fog-bright">{name}</p>}
        <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
          Everything the mapper has on this ID. Matches include its parent technique and its sub-techniques.
        </p>
        <ul aria-label="On this page" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {counts.map(([label, anchor, n]) => (
            <li key={label}>
              <a href={`#${anchor}-section`} className="group flex items-baseline gap-1.5">
                <span className="text-fog-dim group-hover:text-ember">{label}</span>
                <span className="tabular font-medium text-fog-bright">{n}</span>
              </a>
            </li>
          ))}
        </ul>
        {(parent || children.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="eyebrow">{parent ? 'Parent' : 'Sub-techniques in the mapper'}</span>
            {(parent ? [parent] : children).map((k) => (
              <Link key={k} to={attackPath(k)} className="chip text-ember/90">
                {k}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={attackUrl(id)} target="_blank" rel="noreferrer" className="btn btn-primary">
            <ExternalLink aria-hidden className="h-4 w-4" /> View on {site}
          </a>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <LinkSection id="attack-matrix" title="In the matrix" count={matched.length}>
          {matched.length > 0 ? (
            <TechniqueList items={matched} />
          ) : (
            <NoneYet>
              {atlas ? 'The matrix covers ATT&CK Enterprise only.' : 'Not one of the 22 techniques in the matrix yet.'}
            </NoneYet>
          )}
        </LinkSection>

        <LinkSection id="attack-rules" title="UMBRASEC rules" count={ruleList.length}>
          {ruleList.length > 0 ? (
            <RuleList rules={ruleList} />
          ) : (
            <NoneYet>No sigma-pack rule maps to this ID yet.</NoneYet>
          )}
        </LinkSection>

        <div className="min-w-0 lg:col-span-2">
          <LinkSection
            id="attack-skills"
            title="umbra-blue skills"
            count={skillList.length}
            hint="Exact matches first, then parent and sub-technique matches. Tier 1 before Tier 2."
          >
            {skillList.length > 0 ? (
              <SkillList skills={skillList} via={(s) => via(s.attackIds)} />
            ) : (
              <NoneYet>No umbra-blue skill lists this ID yet.</NoneYet>
            )}
          </LinkSection>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <LinkSection id="attack-chains" title="Flow chains" count={chains.length}>
            {chains.length > 0 ? (
              <ChainList chains={chains} />
            ) : (
              <NoneYet>
                {matched.length > 0
                  ? 'No response chain covers this technique yet. Follow the immediate response in the matrix.'
                  : 'Chains link through matrix techniques, and none match this ID.'}
              </NoneYet>
            )}
          </LinkSection>
        </div>
      </div>
    </article>
  );
}
