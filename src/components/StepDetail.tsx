import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Hand, Radar } from 'lucide-react';
import { phaseById, type FlowChain, type FlowStep } from '@/data';
import { evidenceLink } from '@/lib/evidence';
import { stepEdges } from '@/lib/graphLayout';
import { PanelSection } from './DetailPanel';
import { PhasePill } from './Badges';

export function StepDetail({
  chain,
  step,
  onSelect,
}: {
  chain: FlowChain;
  step: FlowStep;
  onSelect: (id: string) => void;
}) {
  const index = chain.steps.findIndex((s) => s.id === step.id);
  const edges = stepEdges(chain.steps);
  const next = edges.filter((e) => e.source === step.id);
  const prev = edges.filter((e) => e.target === step.id);
  const byId = Object.fromEntries(chain.steps.map((s) => [s.id, s]));

  return (
    <div>
      <div className="font-mono text-2xs uppercase tracking-[0.16em] text-fog-muted">
        {chain.title} · step {index + 1} of {chain.steps.length}
      </div>
      <h2 className="mt-1 font-display text-xl font-extrabold">{step.label}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PhasePill id={step.phase} />
        {step.gate && (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-2xs text-gold">
            <Hand aria-hidden className="h-3 w-3" /> Human approval gate
          </span>
        )}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed">{step.detail}</p>

      <PanelSection title="Actions">
        <ul className="space-y-2">
          {step.actions.map((a) => (
            <li key={a} className="flex gap-2 text-[13px] leading-snug">
              <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
              {a}
            </li>
          ))}
        </ul>
      </PanelSection>

      {step.evidence && (
        <PanelSection title="Evidence & telemetry">
          <div className="flex flex-wrap gap-1.5">
            {step.evidence.map((e) => {
              const to = evidenceLink(e);
              return to ? (
                <Link key={e} to={to} className="chip text-teal">
                  <Radar aria-hidden className="h-3 w-3" />
                  {e}
                </Link>
              ) : (
                <span key={e} className="chip">
                  {e}
                </span>
              );
            })}
          </div>
        </PanelSection>
      )}

      {step.tools && (
        <PanelSection title="Tools">
          <div className="flex flex-wrap gap-1.5">
            {step.tools.map((t) => (
              <Link key={t} to={`/tools?q=${encodeURIComponent(t.split(/[ /(]/)[0])}`} className="chip">
                {t}
              </Link>
            ))}
          </div>
        </PanelSection>
      )}

      {step.pitfall && (
        <div className="mt-5 flex gap-2 rounded-lg border border-ember/30 bg-ember/5 p-3 text-[13px] leading-snug">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
          <span>
            <span className="font-medium text-fog-bright">Common mistake. </span>
            {step.pitfall}
          </span>
        </div>
      )}

      <PanelSection title="Path">
        <div className="space-y-1.5">
          {prev.map((e) => (
            <button key={e.id} type="button" onClick={() => onSelect(e.source)} className="chip w-full justify-start py-1.5">
              ← {byId[e.source].label}
            </button>
          ))}
          {next.map((e) => (
            <button key={e.id} type="button" onClick={() => onSelect(e.target)} className="chip w-full justify-start py-1.5">
              <ArrowRight aria-hidden className="h-3 w-3 text-ember" />
              {e.label && <span className="text-ember">{e.label}:</span>} {byId[e.target].label}
            </button>
          ))}
          {next.length === 0 && <p className="text-2xs text-fog-muted">End of chain.</p>}
        </div>
      </PanelSection>

      <p className="mt-5 text-2xs text-fog-muted">
        Phase focus: {phaseById[step.phase].tagline}
      </p>
    </div>
  );
}
