import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Gauge, Workflow } from 'lucide-react';
import { chainsForPhase, layerById, phaseLinks, sectionById, type Phase } from '@/data';
import { hueClass } from '@/lib/hues';
import { icons } from '@/lib/icons';
import { PanelSection } from './DetailPanel';
import { PhasePill, SeverityBadge } from './Badges';

/** Contents of the detail panel for a selected lifecycle phase. */
export function PhaseDetail({ phase }: { phase: Phase }) {
  const Icon = icons[phase.icon];
  const c = hueClass[phase.hue];
  const chains = chainsForPhase(phase.id);
  const feedsFrom = phaseLinks.filter((l) => l.to === phase.id);
  const feedsTo = phaseLinks.filter((l) => l.from === phase.id);
  const primarySection = phase.sections[0];

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl border ${c.border} ${c.bg}`}>
          <Icon aria-hidden className={`h-5 w-5 ${c.text}`} />
        </span>
        <div>
          <div className={`font-mono text-2xs uppercase tracking-[0.16em] ${c.text}`}>
            Phase {String(phase.order).padStart(2, '0')} of 07
          </div>
          <h2 className="font-display text-xl font-extrabold">{phase.label}</h2>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-fog-bright">{phase.tagline}</p>
      <p className="mt-2 text-[13px] leading-relaxed">{phase.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {phase.capabilities.map((cap) => (
          <span key={cap} className="chip">
            {cap}
          </span>
        ))}
      </div>

      <PanelSection title="Key objectives">
        <ul className="space-y-2">
          {phase.objectives.map((o) => (
            <li key={o} className="flex gap-2 text-[13px] leading-snug">
              <CheckCircle2 aria-hidden className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.text}`} />
              {o}
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection title="Key tools">
        <div className="flex flex-wrap gap-1.5">
          {phase.keyTools.map((t) => (
            <Link key={t} to={`/tools?q=${encodeURIComponent(t.split(/[ /]/)[0])}`} className="chip">
              {t}
            </Link>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="How you know it's working">
        <ul className="space-y-1.5">
          {phase.measures.map((m) => (
            <li key={m} className="flex items-center gap-2 text-[13px]">
              <Gauge aria-hidden className="h-3.5 w-3.5 shrink-0 text-fog-muted" />
              {m}
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection title="Connections">
        <div className="space-y-1.5 text-[13px]">
          {feedsFrom.map((l) => (
            <div key={`in-${l.from}`} className="flex flex-wrap items-center gap-2">
              <PhasePill id={l.from} />
              <ArrowRight aria-hidden className="h-3 w-3 text-fog-muted" />
              <span className={l.kind === 'feedback' ? 'text-teal' : 'text-fog'}>{l.label}</span>
            </div>
          ))}
          {feedsTo.map((l) => (
            <div key={`out-${l.to}`} className="flex flex-wrap items-center gap-2">
              <span className={l.kind === 'feedback' ? 'text-teal' : 'text-fog'}>{l.label}</span>
              <ArrowRight aria-hidden className="h-3 w-3 text-fog-muted" />
              <PhasePill id={l.to} />
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Architecture layers">
        <div className="flex flex-wrap gap-1.5">
          {phase.layers.map((id) => {
            const layer = layerById[id];
            const LIcon = icons[layer.icon];
            return (
              <Link key={id} to={`/layers/${id}`} className="chip">
                <LIcon aria-hidden className={`h-3 w-3 ${hueClass[layer.hue].text}`} />
                {layer.label}
              </Link>
            );
          })}
        </div>
      </PanelSection>

      {chains.length > 0 && (
        <PanelSection title="Related flow chains">
          <ul className="space-y-1.5">
            {chains.map((chain) => (
              <li key={chain.id}>
                <Link
                  to={`/flows/${chain.id}`}
                  className="group flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2 transition hover:border-ember/40 hover:bg-ember/5"
                >
                  <Workflow aria-hidden className="h-3.5 w-3.5 shrink-0 text-fog-dim group-hover:text-ember" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fog-bright">{chain.title}</span>
                  <SeverityBadge severity={chain.severity} />
                </Link>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      <PanelSection title="Reference sections">
        <div className="flex flex-wrap gap-1.5">
          {phase.sections.map((id) => (
            <Link key={id} to={id === 'technique-detect' ? '/matrix' : id === 'event-ids' ? '/events' : `/sections/${id}`} className="chip">
              <BookOpen aria-hidden className="h-3 w-3" />
              {sectionById[id]?.title ?? id}
            </Link>
          ))}
        </div>
      </PanelSection>

      <Link to={`/sections/${primarySection}`} className="btn btn-primary mt-6 w-full justify-center">
        View full section: {sectionById[primarySection]?.title}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
      <p className="mt-3 text-center text-2xs text-fog-muted">
        Next phase: <PhasePill id={phaseLinks.find((l) => l.from === phase.id && l.kind === 'flow')!.to} />{' '}
        <span className="ml-1">
          or press <kbd className="kbd">→</kbd>
        </span>
      </p>
    </div>
  );
}
