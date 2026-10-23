import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Workflow } from 'lucide-react';
import { flowChains, layers, phaseById, phases, techniques, tools, type PhaseId } from '@/data';
import { RadialMap } from '@/components/RadialMap';
import { DetailPanel } from '@/components/DetailPanel';
import { PhaseDetail } from '@/components/PhaseDetail';
import { PhaseCard } from '@/components/PhaseCard';
import { isTyping, useKeydown } from '@/lib/useKeyboard';

/** Landing view: the radial lifecycle map with a phase detail panel. */
export function RadialView() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('phase');
  const selected = raw && raw in phaseById ? (raw as PhaseId) : null;

  const select = useCallback(
    (id: PhaseId | null) => {
      setParams(id ? { phase: id } : {}, { replace: true });
    },
    [setParams],
  );

  useKeydown(
    (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= phases.length) {
        select(phases[n - 1].id);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const i = selected ? phases.findIndex((p) => p.id === selected) : -1;
        const step = e.key === 'ArrowRight' ? 1 : -1;
        const next = (i + step + phases.length) % phases.length;
        select(phases[i < 0 && step < 0 ? phases.length - 1 : next].id);
      }
    },
    [selected, select],
  );

  const phase = selected ? phaseById[selected] : null;

  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1">
        <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="eyebrow text-ember">Architecture · MITRE ATT&amp;CK aligned</div>
            <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Seven phases. Each feeds the next.</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
              A gap in any phase degrades everything downstream. Pick a phase on the ring to see its objectives, tools,
              connected layers and the response chains that run through it.
            </p>
          </div>
          <div className="flex gap-5 font-mono text-2xs uppercase tracking-wider text-fog-muted">
            {(
              [
                ['Layers', layers.length, '/layers'],
                ['Chains', flowChains.length, '/flows'],
                ['Techniques', techniques.length, '/matrix'],
                ['Tools', tools.length, '/tools'],
              ] as const
            ).map(([label, n, to]) => (
              <Link key={label} to={to} className="group text-right">
                <span className="tabular block font-display text-xl font-bold normal-case tracking-normal text-fog-bright group-hover:text-ember">
                  {n}
                </span>
                <span className="block">{label}</span>
              </Link>
            ))}
          </div>
        </header>

        <div className="relative flex justify-center py-2">
          <RadialMap selected={selected} onSelect={(id) => select(id === selected ? null : id)} />
          <div className="pointer-events-none absolute bottom-2 left-0 hidden space-y-1.5 font-mono text-2xs text-fog-muted md:block">
            <div className="flex items-center gap-2">
              <svg width="28" height="6" aria-hidden>
                <line x1="0" y1="3" x2="28" y2="3" stroke="#f25623" strokeWidth="2" />
              </svg>
              Flow to next phase
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="6" aria-hidden>
                <line x1="0" y1="3" x2="28" y2="3" stroke="#5fb3a1" strokeWidth="2" strokeDasharray="3 4" />
              </svg>
              Feedback loop
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-2 right-0 hidden text-right font-mono text-2xs text-fog-muted md:block">
            <kbd className="kbd">1</kbd>–<kbd className="kbd">7</kbd> select · <kbd className="kbd">←</kbd>
            <kbd className="kbd">→</kbd> cycle · <kbd className="kbd">Esc</kbd> close
          </div>
        </div>

        <section aria-label="All phases" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {phases.map((p) => (
            <PhaseCard key={p.id} phase={p} active={p.id === selected} onSelect={() => select(p.id)} />
          ))}
          <Link
            to="/flows"
            className="glass group flex flex-col justify-between gap-3 p-4 transition hover:border-ember/40 sm:col-span-2 xl:col-span-1 2xl:col-span-7 2xl:flex-row 2xl:items-center"
          >
            <span className="flex items-center gap-3">
              <Workflow aria-hidden className="h-5 w-5 text-ember" />
              <span>
                <span className="block font-display font-bold text-fog-bright">Walk a response end to end</span>
                <span className="block text-xs text-fog-dim">
                  {flowChains.length} flow chains from first alert to recovery, with decision branches and approval gates.
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm text-ember">
              Open flow chains <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        </section>
      </div>

      <DetailPanel
        open={phase !== null}
        onClose={() => select(null)}
        label={phase ? `${phase.label} phase details` : 'Phase details'}
        contentKey={phase?.id ?? 'none'}
      >
        {phase && <PhaseDetail phase={phase} />}
      </DetailPanel>
    </div>
  );
}
