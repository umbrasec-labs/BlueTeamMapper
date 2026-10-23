import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, Copy, ExternalLink, FileCode2, GitCommitHorizontal, Search, Sparkles } from 'lucide-react';
import { techniques } from '@/data';
import {
  attackUrl,
  detectionSources,
  rules,
  skills,
  skillsForRule,
  type BlueSkill,
  type DetectionRule,
} from '@/data/detections';
import { EmptyState } from '@/components/Feedback';

type Tab = 'rules' | 'skills';

const levelStyle: Record<string, string> = {
  critical: 'text-ember border-ember/40 bg-ember/10',
  high: 'text-ember border-ember/40 bg-ember/10',
  medium: 'text-gold border-gold/40 bg-gold/10',
  low: 'text-sage border-sage/40 bg-sage/10',
  informational: 'text-slate border-slate/40 bg-slate/10',
};

const related = (a: string, b: string) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
const mapperTechniques = (ids: string[]) => techniques.filter((t) => ids.some((id) => related(id, t.attackId)));

function AttackChips({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <a key={id} href={attackUrl(id)} target="_blank" rel="noreferrer" className="chip text-ember/90">
          {id}
        </a>
      ))}
    </>
  );
}

function RuleDetail({ rule }: { rule: DetectionRule }) {
  const [copied, setCopied] = useState(false);
  const inlinedBy = skillsForRule(rule.id);
  const mapped = mapperTechniques(rule.attackIds);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rule.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <article className="glass min-w-0 overflow-hidden" aria-labelledby={`rule-h-${rule.id}`}>
      <div className="border-b border-white/[0.07] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip uppercase">{rule.kind}</span>
          {rule.level && <span className={`chip uppercase ${levelStyle[rule.level] ?? ''}`}>{rule.level}</span>}
          {rule.status && <span className="chip">{rule.status}</span>}
          {rule.correlation && <span className="chip">correlation</span>}
        </div>
        <h3 id={`rule-h-${rule.id}`} className="mt-2 font-display text-lg font-bold">
          {rule.title}
        </h3>
        {rule.description && rule.description !== rule.title && (
          <p className="mt-1 text-[13px] leading-relaxed">{rule.description}</p>
        )}
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="eyebrow mb-1">ATT&amp;CK</dt>
            <dd className="flex flex-wrap gap-1">
              <AttackChips ids={rule.attackIds} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Log source</dt>
            <dd className="font-mono text-fog-bright">{rule.logsource ?? 'n/a'}</dd>
          </div>
          {mapped.length > 0 && (
            <div>
              <dt className="eyebrow mb-1">In the matrix</dt>
              <dd className="flex flex-wrap gap-1">
                {mapped.map((t) => (
                  <Link key={t.id} to={`/matrix?focus=${t.id}`} className="chip">
                    {t.name}
                  </Link>
                ))}
              </dd>
            </div>
          )}
          {inlinedBy.length > 0 && (
            <div>
              <dt className="eyebrow mb-1">umbra-blue skill</dt>
              <dd className="flex flex-wrap gap-1">
                {inlinedBy.map((s) => (
                  <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="chip">
                    <Sparkles aria-hidden className="h-3 w-3 text-teal" /> {s.name}
                  </a>
                ))}
              </dd>
            </div>
          )}
        </dl>
        {rule.falsepositives.length > 0 && (
          <div className="mt-3">
            <div className="eyebrow mb-1">False positives</div>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-fog-dim">
              {rule.falsepositives.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {rule.writeup && (
            <a href={rule.writeup} target="_blank" rel="noreferrer" className="btn btn-primary">
              <BookOpen aria-hidden className="h-4 w-4" /> Read the writeup first
            </a>
          )}
          <a href={rule.url} target="_blank" rel="noreferrer" className="btn">
            <ExternalLink aria-hidden className="h-4 w-4" /> Canonical copy
          </a>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
        <span className="font-mono text-2xs text-fog-muted">{rule.path}</span>
        <button type="button" onClick={copy} className="chip" aria-label={`Copy ${rule.file}`}>
          {copied ? <Check aria-hidden className="h-3 w-3 text-sage" /> : <Copy aria-hidden className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[60vh] overflow-auto bg-ink-950/60 p-4 font-mono text-xs leading-relaxed text-teal">
        <code>{rule.content}</code>
      </pre>
    </article>
  );
}

function RulesTab({ focus, onFocus }: { focus: string | null; onFocus: (id: string) => void }) {
  const [kind, setKind] = useState<'all' | DetectionRule['kind']>('all');
  const list = rules.filter((r) => kind === 'all' || r.kind === kind);
  const selected = rules.find((r) => r.id === focus) ?? list[0];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-2">
        <div role="group" aria-label="Rule type" className="flex rounded-lg border border-white/10 p-0.5">
          {(['all', 'sigma', 'kql'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`flex-1 rounded-md px-3 py-1 text-xs transition ${
                kind === k ? 'bg-ember/15 text-fog-bright' : 'text-fog-dim hover:text-fog-bright'
              }`}
            >
              {k === 'all' ? `All ${rules.length}` : k === 'sigma' ? 'Sigma' : 'KQL'}
            </button>
          ))}
        </div>
        <ul className="space-y-1.5" aria-label="Rules">
          {list.map((r) => {
            const on = r.id === selected?.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onFocus(r.id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                    on ? 'border-ember/60 bg-ember/10 shadow-glow' : 'border-white/[0.06] bg-ink-850/60 hover:border-white/20'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileCode2 aria-hidden className={`h-3.5 w-3.5 shrink-0 ${r.kind === 'kql' ? 'text-slate' : 'text-teal'}`} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fog-bright">{r.title}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 pl-5 font-mono text-2xs text-fog-muted">
                    {r.attackIds.join(' · ')}
                    {r.level && <span className={`rounded border px-1 ${levelStyle[r.level]}`}>{r.level}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {selected ? <RuleDetail rule={selected} /> : <EmptyState title="No rules of this type yet" />}
    </div>
  );
}

function SkillCard({ skill }: { skill: BlueSkill }) {
  const mapped = mapperTechniques(skill.attackIds.filter((id) => !id.startsWith('AML.')));
  return (
    <article className="glass flex flex-col gap-2.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-[13px] font-medium text-fog-bright">{skill.name}</h3>
          <div className="eyebrow mt-0.5">{skill.category}</div>
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-px font-mono text-2xs ${
            skill.tier === 1 ? 'border-teal/50 bg-teal/10 text-teal' : 'border-white/10 text-fog-dim'
          }`}
          title={skill.tier === 1 ? 'Sourced: ships a tuned UMBRASEC rule' : 'Methodology: no bespoke rule yet'}
        >
          Tier {skill.tier}
        </span>
      </div>
      <p className="line-clamp-4 text-xs leading-relaxed text-fog-dim">{skill.description}</p>
      {skill.attackIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <AttackChips ids={skill.attackIds.slice(0, 6)} />
          {skill.attackIds.length > 6 && <span className="chip">+{skill.attackIds.length - 6}</span>}
        </div>
      )}
      {(skill.rules.length > 0 || mapped.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {skill.rules.map((id) => (
            <Link key={id} to={`/detections?focus=${id}`} className="chip border-teal/30 text-teal">
              <FileCode2 aria-hidden className="h-3 w-3" /> {id}
            </Link>
          ))}
          {mapped.slice(0, 3).map((t) => (
            <Link key={t.id} to={`/matrix?focus=${t.id}`} className="chip">
              {t.name}
            </Link>
          ))}
        </div>
      )}
      <a href={skill.url} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 self-start text-2xs text-fog-muted hover:text-ember">
        SKILL.md <ExternalLink aria-hidden className="h-3 w-3" />
      </a>
    </article>
  );
}

function SkillsTab({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  const [tier, setTier] = useState<0 | 1 | 2>(0);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter(
      (s) =>
        (tier === 0 || s.tier === tier) &&
        (!q || `${s.name} ${s.category} ${s.description} ${s.attackIds.join(' ')}`.toLowerCase().includes(q)),
    );
  }, [query, tier]);
  const tierCount = (t: 1 | 2) => skills.filter((s) => s.tier === t).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 basis-64 items-center">
          <span className="sr-only">Filter skills</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 h-4 w-4 text-fog-muted" />
          <input
            id="skills-filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by threat, category or ATT&CK ID, e.g. T1003 or kerberos"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-fog-bright outline-none placeholder:text-fog-muted focus:border-ember/50"
          />
        </label>
        <div role="group" aria-label="Tier" className="flex rounded-lg border border-white/10 p-0.5">
          {([0, 1, 2] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tier === t}
              onClick={() => setTier(t)}
              className={`rounded-md px-3 py-1 text-xs transition ${
                tier === t ? 'bg-ember/15 text-fog-bright' : 'text-fog-dim hover:text-fog-bright'
              }`}
            >
              {t === 0 ? `All ${skills.length}` : `Tier ${t} · ${tierCount(t)}`}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState title="No skills match" hint="Try a category such as “cloud” or an ATT&CK ID such as T1558." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <SkillCard key={s.name} skill={s} />
          ))}
        </div>
      )}
    </div>
  );
}

/** UMBRASEC sigma-pack rules and umbra-blue skills, synced at build time. */
export default function DetectionsView() {
  const [params, setParams] = useSearchParams();
  const focus = params.get('focus');
  const tab: Tab = params.get('tab') === 'skills' ? 'skills' : 'rules';

  useEffect(() => {
    if (focus) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [focus]);

  const src = detectionSources;
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="eyebrow text-ember">Detections</div>
          <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Rules you can run today</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
            The UMBRASEC sigma-pack, shown as the canonical copy, and the umbra-blue skills that teach Claude to detect, hunt
            and harden against each threat. Every rule comes from a published writeup. Read it, then validate the rule in
            your own environment before alerting on it.
          </p>
        </div>
        <p className="flex flex-col items-end gap-0.5 font-mono text-2xs text-fog-muted">
          <a href={src.sigmaPack.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-fog-bright">
            <GitCommitHorizontal aria-hidden className="h-3 w-3" /> sigma-pack @ {src.sigmaPack.commit ?? 'local'}
          </a>
          <a href={src.umbraBlue.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-fog-bright">
            <GitCommitHorizontal aria-hidden className="h-3 w-3" /> umbra-blue @ {src.umbraBlue.commit ?? 'local'}
          </a>
        </p>
      </header>

      <div role="tablist" aria-label="Detections" className="mb-5 flex gap-1 border-b border-white/[0.07]">
        {(
          [
            ['rules', `Sigma & KQL rules · ${rules.length}`],
            ['skills', `umbra-blue skills · ${skills.length}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'rules' ? {} : { tab: id }, { replace: true })}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] transition ${
              tab === id ? 'border-ember text-fog-bright' : 'border-transparent text-fog-dim hover:text-fog-bright'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'rules' ? (
        <RulesTab focus={focus} onFocus={(id) => setParams({ focus: id }, { replace: true })} />
      ) : (
        <SkillsTab initialQuery={params.get('q') ?? ''} />
      )}
    </div>
  );
}
