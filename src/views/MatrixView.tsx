import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, ChevronRight, FileCode2, Search, Sparkles, Workflow, X } from 'lucide-react';
import { findEvent, flowChainById, tactics, techniques, type Severity, type Tactic } from '@/data';
import { SeverityBadge } from '@/components/Badges';
import { EmptyState } from '@/components/Feedback';
import { rulesForTechnique, skillsForTechnique } from '@/data/detections';
import { coverageMeta } from '@/data/coverage';
import { useCoverage } from '@/store/coverage';
import { hueClass, severityMeta } from '@/lib/hues';

const severities: Severity[] = ['critical', 'high', 'medium', 'low'];
type SortKey = 'severity' | 'name' | 'tactic';

/** Technique Detection Matrix: filterable, sortable, color-coded by severity. */
export default function MatrixView() {
  const [params, setParams] = useSearchParams();
  const focus = params.get('focus');
  const [query, setQuery] = useState('');
  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set());
  const [tactic, setTactic] = useState<Tactic | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('severity');
  const [open, setOpen] = useState<string | null>(focus);
  const coverage = useCoverage((s) => s.levels);

  useEffect(() => {
    if (!focus) return;
    setOpen(focus);
    setQuery('');
    setSevFilter(new Set());
    setTactic('all');
    const t = setTimeout(
      () => document.getElementById(`tech-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      80,
    );
    return () => clearTimeout(t);
  }, [focus]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = techniques.filter(
      (t) =>
        (sevFilter.size === 0 || sevFilter.has(t.severity)) &&
        (tactic === 'all' || t.tactic === tactic) &&
        (!q || `${t.name} ${t.attackId} ${t.detection} ${t.response} ${t.tactic}`.toLowerCase().includes(q)),
    );
    const cmp: Record<SortKey, (a: (typeof techniques)[number], b: (typeof techniques)[number]) => number> = {
      severity: (a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      tactic: (a, b) => tactics.indexOf(a.tactic) - tactics.indexOf(b.tactic) || a.name.localeCompare(b.name),
    };
    return [...filtered].sort(cmp[sort]);
  }, [query, sevFilter, tactic, sort]);

  const toggleSev = (s: Severity) =>
    setSevFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const clear = () => {
    setQuery('');
    setSevFilter(new Set());
    setTactic('all');
    if (focus) setParams({}, { replace: true });
  };

  const filtersOn = query !== '' || sevFilter.size > 0 || tactic !== 'all';
  const usedTactics = tactics.filter((t) => techniques.some((x) => x.tactic === t));

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => setSort(k)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider ${sort === k ? 'text-ember' : 'hover:text-fog-bright'}`}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <ArrowUpDown aria-hidden className="h-3 w-3" />
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 max-w-3xl">
        <div className="eyebrow text-ember">Detection reference</div>
        <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Technique → detection → response</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
          Attacker techniques mapped to ATT&amp;CK, their primary detection source and the immediate response. Use it as a
          first-response reference card. Open a row for the event IDs to pull and the flow chain to run.
        </p>
      </header>

      {/* Tactic × severity strip, doubling as a filter. */}
      <div className="mb-4 overflow-x-auto">
        <div className="grid min-w-[720px] grid-flow-col gap-1.5" style={{ gridTemplateColumns: `repeat(${usedTactics.length}, minmax(0,1fr))` }}>
          {usedTactics.map((tac) => {
            const list = techniques.filter((t) => t.tactic === tac);
            const active = tactic === tac;
            return (
              <button
                key={tac}
                type="button"
                onClick={() => setTactic(active ? 'all' : tac)}
                aria-pressed={active}
                className={`glass flex flex-col gap-2 p-2.5 text-left transition hover:border-white/20 ${active ? 'border-ember/60 shadow-glow' : ''}`}
              >
                <span className="text-2xs leading-tight text-fog-bright">{tac}</span>
                <span className="flex flex-wrap gap-1" aria-label={`${list.length} techniques`}>
                  {list.map((t) => (
                    <span
                      key={t.id}
                      title={t.name}
                      className={`h-2.5 w-2.5 rounded-sm ${hueClass[severityMeta[t.severity].hue].fill}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 basis-64 items-center">
          <span className="sr-only">Filter techniques</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 h-4 w-4 text-fog-muted" />
          <input
            id="matrix-filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by technique, T-ID, log source or action…"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-fog-bright outline-none placeholder:text-fog-muted focus:border-ember/50"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Severity filter">
          {severities.map((s) => {
            const count = techniques.filter((t) => t.severity === s).length;
            if (!count) return null;
            const c = hueClass[severityMeta[s].hue];
            const on = sevFilter.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSev(s)}
                aria-pressed={on}
                className={`chip py-1 ${on ? `${c.border} ${c.bg} ${c.text}` : ''}`}
              >
                <span aria-hidden className={`h-2 w-2 rounded-full ${c.dot}`} />
                {severityMeta[s].label}
                <span className="tabular text-fog-muted">{count}</span>
              </button>
            );
          })}
        </div>
        {filtersOn && (
          <button type="button" onClick={clear} className="chip py-1">
            <X aria-hidden className="h-3 w-3" /> Clear
          </button>
        )}
        <span className="tabular ml-auto font-mono text-2xs text-fog-muted">
          {rows.length} / {techniques.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No techniques match these filters"
          hint="Loosen the severity or tactic filter, or search for a log source like “Sysmon 10”."
          action={
            <button type="button" className="btn mt-2" onClick={clear}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.07] font-mono text-2xs text-fog-muted">
                <th scope="col" className="w-8 px-3 py-2.5" />
                <th scope="col" className="px-3 py-2.5">
                  <SortButton k="name" label="Technique" />
                </th>
                <th scope="col" className="px-3 py-2.5">
                  <SortButton k="tactic" label="Tactic" />
                </th>
                <th scope="col" className="px-3 py-2.5 uppercase tracking-wider">Primary detection</th>
                <th scope="col" className="px-3 py-2.5">
                  <SortButton k="severity" label="Severity" />
                </th>
                <th scope="col" className="px-3 py-2.5 uppercase tracking-wider">Immediate response</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const expanded = open === t.id;
                const chain = t.chain ? flowChainById[t.chain] : undefined;
                const stripe = hueClass[severityMeta[t.severity].hue].dot;
                return (
                  <Fragment key={t.id}>
                    <tr
                      id={`tech-${t.id}`}
                      className={`cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.025] ${
                        expanded ? 'bg-ember/[0.05]' : ''
                      } ${focus === t.id ? 'outline outline-1 outline-ember/50' : ''}`}
                      onClick={() => setOpen(expanded ? null : t.id)}
                    >
                      <td className="relative px-3 py-2.5">
                        <span aria-hidden className={`absolute inset-y-1.5 left-0 w-[3px] rounded-full ${stripe}`} />
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${t.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(expanded ? null : t.id);
                          }}
                          className="rounded p-0.5 text-fog-dim hover:text-ember"
                        >
                          <ChevronRight aria-hidden className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </button>
                      </td>
                      <th scope="row" className="px-3 py-2.5 font-medium text-fog-bright">
                        {t.name}
                        <span className="ml-2 font-mono text-2xs font-normal text-ember/80">{t.attackId}</span>
                        {rulesForTechnique(t.attackId).length > 0 && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 rounded border border-teal/40 px-1 font-mono text-2xs font-normal text-teal"
                            title="UMBRASEC rules available"
                          >
                            <FileCode2 aria-hidden className="h-3 w-3" />
                            {rulesForTechnique(t.attackId).length}
                          </span>
                        )}
                        {coverage[t.id] && (
                          <span
                            className="ml-2 rounded px-1 font-mono text-2xs font-normal"
                            style={{ color: coverageMeta[coverage[t.id]].color }}
                            title="Your coverage assessment"
                          >
                            {coverageMeta[coverage[t.id]].label}
                          </span>
                        )}
                      </th>
                      <td className="px-3 py-2.5 text-fog-dim">{t.tactic}</td>
                      <td className="px-3 py-2.5">{t.detection}</td>
                      <td className="px-3 py-2.5">
                        <SeverityBadge severity={t.severity} />
                      </td>
                      <td className="px-3 py-2.5 text-fog-dim">{t.response}</td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-white/[0.06] bg-ink-900/60">
                        <td />
                        <td colSpan={5} className="px-3 pb-4 pt-2">
                          <div className="flex flex-wrap gap-6">
                            <div>
                              <div className="eyebrow mb-1.5">Event IDs to pull</div>
                              <div className="flex flex-wrap gap-1.5">
                                {t.events.length === 0 && <span className="text-2xs text-fog-muted">Cloud / gateway telemetry, no Windows event</span>}
                                {t.events.map((id) => {
                                  const ev = findEvent(id < 100 ? 'sysmon' : 'security', id);
                                  if (!ev) return null;
                                  return (
                                    <Link key={id} to={`/events?focus=${ev.source}-${id}`} className="chip text-teal" title={ev.description}>
                                      {ev.source === 'sysmon' ? 'Sysmon ' : ''}
                                      {id} · {ev.name}
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <div className="eyebrow mb-1.5">Run the chain</div>
                              {chain ? (
                                <Link to={`/flows/${chain.id}`} className="chip">
                                  <Workflow aria-hidden className="h-3 w-3 text-ember" /> {chain.title}
                                </Link>
                              ) : (
                                <span className="text-2xs text-fog-muted">Follow the immediate response above</span>
                              )}
                            </div>
                            <div>
                              <div className="eyebrow mb-1.5">UMBRASEC rules</div>
                              <div className="flex flex-wrap gap-1.5">
                                {rulesForTechnique(t.attackId).map((r) => (
                                  <Link key={r.id} to={`/detections?focus=${r.id}`} className="chip border-teal/40 text-teal">
                                    <FileCode2 aria-hidden className="h-3 w-3" /> {r.file}
                                  </Link>
                                ))}
                                {rulesForTechnique(t.attackId).length === 0 && (
                                  <span className="text-2xs text-fog-muted">None published yet</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="eyebrow mb-1.5">umbra-blue skills</div>
                              <div className="flex flex-wrap gap-1.5">
                                {skillsForTechnique(t.attackId, 3).map((sk) => (
                                  <a key={sk.name} href={sk.url} target="_blank" rel="noreferrer" className="chip" title={sk.description}>
                                    <Sparkles aria-hidden className="h-3 w-3 text-teal" /> {sk.name}
                                    <span className="text-fog-muted">T{sk.tier}</span>
                                  </a>
                                ))}
                                {skillsForTechnique(t.attackId).length === 0 && (
                                  <span className="text-2xs text-fog-muted">No paired skill yet</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="eyebrow mb-1.5">ATT&amp;CK</div>
                              <a
                                className="chip"
                                href={`https://attack.mitre.org/techniques/${t.attackId.replace('.', '/')}/`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t.attackId} on attack.mitre.org
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
