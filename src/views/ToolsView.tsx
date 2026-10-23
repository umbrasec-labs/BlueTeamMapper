import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import { Search, X } from 'lucide-react';
import { toolCategories, tools } from '@/data';
import { ToolCard } from '@/components/ToolCard';
import { EmptyState } from '@/components/Feedback';
import { hueClass } from '@/lib/hues';
import { icons } from '@/lib/icons';

const fuse = new Fuse(tools, {
  keys: [
    { name: 'label', weight: 3 },
    { name: 'names', weight: 3 },
    { name: 'description', weight: 1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
});

/** Tool arsenal: categorized, searchable cards. Accepts ?q= and ?focus= from other views. */
export default function ToolsView() {
  const [params, setParams] = useSearchParams();
  const focus = params.get('focus');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState<string>('all');

  useEffect(() => {
    const q = params.get('q');
    if (q !== null) setQuery(q);
  }, [params]);

  useEffect(() => {
    if (!focus) return;
    setQuery('');
    setCategory('all');
    const t = setTimeout(
      () => document.getElementById(`tool-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      80,
    );
    return () => clearTimeout(t);
  }, [focus]);

  const visible = useMemo(() => {
    const q = query.trim();
    const matched = q ? fuse.search(q).map((r) => r.item) : tools;
    return matched.filter((t) => category === 'all' || t.category === category);
  }, [query, category]);

  const grouped = toolCategories
    .map((c) => ({ cat: c, list: visible.filter((t) => t.category === c.id) }))
    .filter((g) => g.list.length > 0);

  const reset = () => {
    setQuery('');
    setCategory('all');
    setParams({}, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 max-w-3xl">
        <div className="eyebrow text-ember">Reference</div>
        <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Blue team tool arsenal</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
          Essential defensive tools by function. The best tools are the ones your team uses consistently, so invest in
          training and process, not just licenses.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 basis-64 items-center">
          <span className="sr-only">Search tools</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 h-4 w-4 text-fog-muted" />
          <input
            id="tools-filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, e.g. Velociraptor, sandbox, KQL"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-fog-bright outline-none placeholder:text-fog-muted focus:border-ember/50"
          />
        </label>
        {(query || category !== 'all') && (
          <button type="button" onClick={reset} className="chip py-1">
            <X aria-hidden className="h-3 w-3" /> Clear
          </button>
        )}
        <span className="tabular ml-auto font-mono text-2xs text-fog-muted">
          {visible.length} / {tools.length}
        </span>
      </div>

      <div role="group" aria-label="Tool categories" className="mb-6 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory('all')}
          aria-pressed={category === 'all'}
          className={`chip py-1 ${category === 'all' ? 'border-ember/60 bg-ember/10 text-fog-bright' : ''}`}
        >
          All categories
        </button>
        {toolCategories.map((c) => {
          const Icon = icons[c.icon];
          const on = category === c.id;
          const hc = hueClass[c.hue];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(on ? 'all' : c.id)}
              aria-pressed={on}
              className={`chip py-1 ${on ? `${hc.border} ${hc.bg} text-fog-bright` : ''}`}
            >
              <Icon aria-hidden className={`h-3 w-3 ${hc.text}`} />
              {c.label}
              <span className="tabular text-fog-muted">{tools.filter((t) => t.category === c.id).length}</span>
            </button>
          );
        })}
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title={`No tools match “${query}”`}
          hint="Try a product name or a function such as “memory”, “sandbox” or “PAM”."
          action={
            <button type="button" className="btn mt-2" onClick={reset}>
              Show all tools
            </button>
          }
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(({ cat, list }) => (
            <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
              <h3 id={`cat-${cat.id}`} className="eyebrow mb-3">
                {cat.label} <span className="tabular">· {list.length}</span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((t) => (
                  <ToolCard key={t.id} tool={t} highlight={t.id === focus} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
