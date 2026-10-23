import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { eventKey, events, techniques, type EventRef } from '@/data';
import { EmptyState } from '@/components/Feedback';
import { hueClass, toneHue } from '@/lib/hues';

type Source = 'all' | EventRef['source'];

const signalLabel = { good: 'Baseline', warn: 'Investigate', bad: 'High signal' } as const;

/** Windows Security and Sysmon event IDs, grouped by category. */
export default function EventsView() {
  const [params] = useSearchParams();
  const focus = params.get('focus');
  const [source, setSource] = useState<Source>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!focus) return;
    setSource('all');
    setQuery('');
    const t = setTimeout(
      () => document.getElementById(`ev-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      80,
    );
    return () => clearTimeout(t);
  }, [focus]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = events.filter(
      (e) =>
        (source === 'all' || e.source === source) &&
        (!q || `${e.id} ${e.name} ${e.description} ${e.category}`.toLowerCase().includes(q)),
    );
    const map = new Map<string, EventRef[]>();
    for (const e of list) {
      const key = e.source === 'sysmon' ? 'Sysmon' : e.category;
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [source, query]);

  const usedBy = (e: EventRef) => techniques.filter((t) => t.events.includes(e.id));

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 max-w-3xl">
        <div className="eyebrow text-ember">Quick reference</div>
        <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Event IDs every analyst should know</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
          Windows Security events and Sysmon events form the backbone of Windows detection. Each card links to the
          techniques that rely on it.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Event source" className="flex rounded-lg border border-white/10 p-0.5">
          {(['all', 'security', 'sysmon'] as Source[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={source === s}
              onClick={() => setSource(s)}
              className={`rounded-md px-3 py-1 text-xs capitalize transition ${
                source === s ? 'bg-ember/15 text-fog-bright' : 'text-fog-dim hover:text-fog-bright'
              }`}
            >
              {s === 'all' ? 'All' : s === 'security' ? 'Security log' : 'Sysmon'}
            </button>
          ))}
        </div>
        <label className="relative flex min-w-0 flex-1 basis-56 items-center">
          <span className="sr-only">Filter events</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 h-4 w-4 text-fog-muted" />
          <input
            id="events-filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by ID or meaning, e.g. 4769 or LSASS"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-fog-bright outline-none placeholder:text-fog-muted focus:border-ember/50"
          />
        </label>
        <span className="flex gap-3 font-mono text-2xs text-fog-muted">
          {(['good', 'warn', 'bad'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span aria-hidden className={`h-2 w-2 rounded-full ${hueClass[toneHue[s]].dot}`} />
              {signalLabel[s]}
            </span>
          ))}
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No events match" hint="Try a numeric ID like 4624, or a word like “Kerberos”." />
      ) : (
        <div className="space-y-6">
          {groups.map(([group, list]) => (
            <section key={group} aria-labelledby={`evg-${group}`}>
              <h3 id={`evg-${group}`} className="eyebrow mb-2">
                {group} <span className="tabular text-fog-muted">· {list.length}</span>
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((e) => {
                  const key = eventKey(e);
                  const c = hueClass[toneHue[e.signal]];
                  const related = usedBy(e);
                  return (
                    <article
                      key={key}
                      id={`ev-${key}`}
                      className={`glass flex scroll-mt-24 gap-3 p-3.5 ${focus === key ? 'border-ember/60 shadow-glow' : ''}`}
                    >
                      <span
                        className={`tabular grid h-11 min-w-[3.25rem] shrink-0 place-items-center rounded-lg border px-1.5 font-mono text-sm font-medium ${c.border} ${c.bg} ${c.text}`}
                      >
                        {e.id}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-fog-bright">{e.name}</div>
                        <p className="mt-0.5 text-xs leading-relaxed text-fog-dim">{e.description}</p>
                        {related.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {related.map((t) => (
                              <Link key={t.id} to={`/matrix?focus=${t.id}`} className="chip">
                                {t.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
