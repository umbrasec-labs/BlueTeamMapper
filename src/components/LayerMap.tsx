import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Wrench } from 'lucide-react';
import {
  cardSlug,
  sectionById,
  toolCategoryById,
  tools,
  type ControlPriority,
  type Layer,
} from '@/data';
import { hueClass, hueHex } from '@/lib/hues';
import { icons } from '@/lib/icons';
import { PhasePill } from './Badges';
import { CalloutBox, MatrixBlock, QueryBlock, SectionCard } from './Reference';

const priorityStyle: Record<ControlPriority, string> = {
  P0: 'text-ember border-ember/40 bg-ember/10',
  P1: 'text-gold border-gold/40 bg-gold/10',
  P2: 'text-slate border-slate/40 bg-slate/10',
};

const priorityHint: Record<ControlPriority, string> = {
  P0: 'Must have',
  P1: 'High value',
  P2: 'Mature programs',
};

function layerContent(layer: Layer) {
  const secs = layer.sections.map((id) => sectionById[id]).filter(Boolean);
  return {
    sections: secs,
    cards: secs.flatMap((s) => s.cards.map((card) => ({ card, sectionId: s.id }))),
    callouts: secs.flatMap((s) => s.callouts),
    matrices: secs.flatMap((s) => s.matrices),
    queries: secs.flatMap((s) => s.queries),
    tools: tools.filter((t) => layer.toolCategories.includes(t.category)),
  };
}

interface BandProps {
  layer: Layer;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

function LayerBand({ layer, index, expanded, onToggle }: BandProps) {
  const ref = useRef<HTMLElement>(null);
  const Icon = icons[layer.icon];
  const c = hueClass[layer.hue];
  const content = layerContent(layer);
  const panelId = `layer-panel-${layer.id}`;
  const p0 = layer.keyControls.filter((k) => k.priority === 'P0').length;

  useEffect(() => {
    if (expanded) {
      const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      return () => clearTimeout(t);
    }
  }, [expanded]);

  return (
    <section
      ref={ref}
      aria-labelledby={`layer-h-${layer.id}`}
      className={`relative scroll-mt-20 rounded-2xl border transition-all duration-300 ${
        expanded
          ? 'border-ember/60 bg-ink-800/80 shadow-glow'
          : 'border-white/[0.07] bg-ink-850/60 hover:border-white/15 hover:bg-ink-800/60'
      }`}
    >
      {/* Strata stripe in the layer's hue. */}
      <span
        aria-hidden
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: hueHex[layer.hue], opacity: expanded ? 1 : 0.55 }}
      />
      <h2 id={`layer-h-${layer.id}`} className="m-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-5 py-4 text-left"
        >
          <span className="tabular w-6 font-mono text-2xs text-fog-muted">{String(index + 1).padStart(2, '0')}</span>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${c.border} ${c.bg}`}>
            <Icon aria-hidden className={`h-5 w-5 ${c.text}`} />
          </span>
          <span className="min-w-0 flex-1 basis-48">
            <span className="block font-display text-lg font-bold text-fog-bright">{layer.label}</span>
            <span className="block text-[13px] font-normal text-fog-dim">{layer.tagline}</span>
          </span>
          <span className="hidden items-center gap-1.5 md:flex">
            {layer.phases.map((p) => (
              <PhasePill key={p} id={p} link={false} />
            ))}
          </span>
          <span className="flex items-center gap-4 font-mono text-2xs text-fog-muted">
            <span title="Reference cards">
              <span className="tabular text-fog-bright">{content.cards.length}</span> cards
            </span>
            <span title="Tools">
              <span className="tabular text-fog-bright">{content.tools.length}</span> tools
            </span>
            <span title="P0 controls" className="text-ember">
              <span className="tabular">{p0}</span> P0
            </span>
            <ChevronDown
              aria-hidden
              className={`h-4 w-4 text-fog-dim transition-transform duration-300 group-hover:text-ember ${
                expanded ? 'rotate-180 text-ember' : ''
              }`}
            />
          </span>
        </button>
      </h2>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-6 border-t border-white/[0.07] px-5 pb-6 pt-5">
              {content.sections.map((s) => (
                <p key={s.id} className="max-w-3xl text-[13px] leading-relaxed">
                  <span className="eyebrow mr-2 text-teal">{s.eyebrow}</span>
                  {s.description}
                </p>
              ))}

              <div>
                <h3 className="eyebrow mb-2">Key controls</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {layer.keyControls.map((k) => (
                    <div key={k.label} className="glass flex flex-col gap-2 p-3">
                      <span className="flex items-center justify-between">
                        <span className={`rounded border px-1.5 py-px font-mono text-2xs font-medium ${priorityStyle[k.priority]}`}>
                          {k.priority}
                        </span>
                        <span className="text-2xs text-fog-muted">{priorityHint[k.priority]}</span>
                      </span>
                      <span className="text-[13px] leading-snug text-fog-bright">{k.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {content.callouts.map((co) => (
                <CalloutBox key={co.title} callout={co} />
              ))}

              {content.matrices.map((m) => (
                <MatrixBlock key={m.title} matrix={m} />
              ))}

              {content.cards.length > 0 && (
                <div>
                  <h3 className="eyebrow mb-2">Reference cards · select to expand</h3>
                  <div className="grid items-start gap-3 lg:grid-cols-2">
                    {content.cards.map(({ card, sectionId }) => (
                      <SectionCard key={`${sectionId}-${card.title}`} card={card} id={`card-${cardSlug(card.title)}`} />
                    ))}
                  </div>
                </div>
              )}

              {content.queries.length > 0 && (
                <div>
                  <h3 className="eyebrow mb-2">Hunt queries</h3>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {content.queries.map((q) => (
                      <QueryBlock key={q.title} query={q} />
                    ))}
                  </div>
                </div>
              )}

              {content.tools.length > 0 && (
                <div>
                  <h3 className="eyebrow mb-2 flex items-center gap-1.5">
                    <Wrench aria-hidden className="h-3 w-3" /> Tools
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {content.tools.map((t) => (
                      <Link key={t.id} to={`/tools?focus=${t.id}`} className="chip" title={t.description}>
                        {t.label}
                      </Link>
                    ))}
                  </div>
                  <p className="mt-2 text-2xs text-fog-muted">
                    From {layer.toolCategories.map((id) => toolCategoryById[id]?.label).join(' and ')} in the arsenal.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {content.sections.map((s) => (
                  <Link key={s.id} to={`/sections/${s.id}`} className="btn">
                    Open {s.title} <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Stacked architecture bands; one expands at a time. */
export function LayerMap({
  layers,
  expandedId,
  onToggle,
}: {
  layers: Layer[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      {layers.map((layer, i) => (
        <LayerBand
          key={layer.id}
          layer={layer}
          index={i}
          expanded={layer.id === expandedId}
          onToggle={() => onToggle(layer.id)}
        />
      ))}
    </div>
  );
}
