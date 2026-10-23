import { useEffect } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Layers } from 'lucide-react';
import { cardSlug, layerForSection, phases, sectionById, sections } from '@/data';
import { CalloutBox, MatrixBlock, QueryBlock, SectionCard } from '@/components/Reference';
import { PhasePill } from '@/components/Badges';
import { EmptyState } from '@/components/Feedback';

/** v3 sections whose content is rendered by a dedicated view. */
const dedicated: Record<string, string> = {
  lifecycle: '/',
  flows: '/flows',
  'technique-detect': '/matrix',
  'event-ids': '/events',
  tools: '/tools',
};

const readable = sections.filter((s) => !dedicated[s.id]);

/** Full reader for one reference section: callouts, matrices, every card expanded on demand. */
export default function SectionView() {
  const { sectionId = '' } = useParams();
  const [params] = useSearchParams();
  const focusCard = params.get('card');

  useEffect(() => {
    if (!focusCard) return;
    const t = setTimeout(
      () => document.getElementById(`card-${focusCard}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      100,
    );
    return () => clearTimeout(t);
  }, [focusCard, sectionId]);

  if (dedicated[sectionId]) return <Navigate to={dedicated[sectionId]} replace />;
  const section = sectionById[sectionId];
  if (!section) {
    return (
      <EmptyState
        title={`No section called “${sectionId}”`}
        hint="Pick a section from the sidebar or search for a topic."
        action={
          <Link to="/" className="btn mt-2">
            Back to the lifecycle map
          </Link>
        }
      />
    );
  }

  const layer = layerForSection(section.id);
  const relatedPhases = phases.filter((p) => p.sections.includes(section.id));
  const i = readable.findIndex((s) => s.id === section.id);
  const prev = readable[i - 1];
  const next = readable[i + 1];

  return (
    <article className="mx-auto max-w-6xl">
      <header className="mb-6 max-w-3xl">
        <div className="eyebrow text-ember">{section.eyebrow}</div>
        <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{section.title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">{section.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {relatedPhases.map((p) => (
            <PhasePill key={p.id} id={p.id} />
          ))}
          {layer && (
            <Link to={`/layers/${layer.id}`} className="chip">
              <Layers aria-hidden className="h-3 w-3" /> {layer.label} layer
            </Link>
          )}
        </div>
      </header>

      <div className="space-y-5">
        {section.callouts.map((c) => (
          <CalloutBox key={c.title} callout={c} />
        ))}
        {section.matrices.map((m) => (
          <MatrixBlock key={m.title} matrix={m} />
        ))}
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {section.cards.map((card) => {
            const slug = cardSlug(card.title);
            return (
              <SectionCard
                key={`${section.id}-${slug}-${focusCard === slug}`}
                card={card}
                id={`card-${slug}`}
                defaultOpen={focusCard === slug}
                highlight={focusCard === slug}
              />
            );
          })}
        </div>
        {section.queries.length > 0 && (
          <div>
            <h3 className="eyebrow mb-2">Sample hunt queries · Splunk SPL</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {section.queries.map((q) => (
                <QueryBlock key={q.title} query={q} />
              ))}
            </div>
          </div>
        )}
      </div>

      <nav aria-label="Section navigation" className="mt-10 flex flex-wrap justify-between gap-3 border-t border-white/[0.06] pt-5">
        {prev ? (
          <Link to={`/sections/${prev.id}`} className="btn">
            <ArrowLeft aria-hidden className="h-4 w-4" /> {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/sections/${next.id}`} className="btn">
            {next.title} <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        )}
      </nav>
    </article>
  );
}
