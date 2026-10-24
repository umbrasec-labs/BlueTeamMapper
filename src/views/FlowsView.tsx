import { useCallback, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Hand, ListChecks, MousePointerClick } from 'lucide-react';
import { flowChainById, flowChains, phaseById, techniques } from '@/data';
import { FlowGraph } from '@/components/FlowGraph';
import { DetailPanel } from '@/components/DetailPanel';
import { StepDetail } from '@/components/StepDetail';
import { PhasePill, SeverityBadge } from '@/components/Badges';
import { hueClass, hueHex } from '@/lib/hues';
import { defaultRunTitle } from '@/lib/runbook';
import { useRunbooks } from '@/store/runbooks';
import { icons } from '@/lib/icons';

/**
 * Returns to the page that opened the flow chains. Chain tabs replace history, so one step
 * back always leaves this view; on a fresh visit there is no history, so it goes to the map.
 */
function BackLink() {
  const navigate = useNavigate();
  const { key } = useLocation();
  const cls = 'mb-4 inline-flex items-center gap-1.5 text-[13px] text-fog-muted transition hover:text-ember';
  if (key === 'default') {
    return (
      <Link to="/" className={cls}>
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Lifecycle map
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => navigate(-1)} className={cls}>
      <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back
    </button>
  );
}

/** Defense flow chains: chain picker, React Flow graph, step detail panel. */
export default function FlowsView() {
  const { chainId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const openRuns = useRunbooks(
    (s) => Object.values(s.runs).filter((r) => r.status === 'active' && r.chainId === chainId).length,
  );
  // The run page loads in a transition, so this button stays on screen for a moment and can
  // take a second click. One run per click.
  const starting = useRef(false);

  const selectStep = useCallback(
    (id: string | null) => setParams(id ? { step: id } : {}, { replace: true }),
    [setParams],
  );

  if (!chainId) return <Navigate to={`/flows/${flowChains[0].id}`} replace />;
  const chain = flowChainById[chainId];
  if (!chain) return <Navigate to={`/flows/${flowChains[0].id}`} replace />;

  const stepId = params.get('step');
  const step = chain.steps.find((s) => s.id === stepId) ?? null;
  const chainTechniques = techniques.filter((t) => chain.techniques.includes(t.id));
  const ChainIcon = icons[chain.icon];

  // One click to get going: a run with a dated default title. Rename it on the run page.
  const startRunbook = () => {
    if (starting.current) return;
    const id = useRunbooks.getState().createRun({ chainId: chain.id, title: defaultRunTitle(chain) });
    if (!id) return;
    starting.current = true;
    navigate(`/runbooks/${id}`);
  };

  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1">
        <BackLink />
        <nav aria-label="Flow chains" className="-mx-1 mb-5 overflow-x-auto pb-1">
          <ul className="flex min-w-max gap-1.5 px-1">
            {flowChains.map((c) => {
              const Icon = icons[c.icon];
              const active = c.id === chain.id;
              return (
                <li key={c.id}>
                  <Link
                    to={`/flows/${c.id}`}
                    replace
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition ${
                      active
                        ? 'border-ember/60 bg-ember/10 text-fog-bright shadow-glow'
                        : 'border-white/[0.07] bg-ink-850/60 text-fog hover:border-white/20 hover:text-fog-bright'
                    }`}
                  >
                    <Icon aria-hidden className={`h-4 w-4 ${hueClass[c.hue].text}`} />
                    {c.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <header className="mb-4 flex flex-wrap items-start gap-4">
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${hueClass[chain.hue].border} ${hueClass[chain.hue].bg}`}
          >
            <ChainIcon aria-hidden className={`h-6 w-6 ${hueClass[chain.hue].text}`} />
          </span>
          <div className="min-w-0 flex-1 basis-80">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-extrabold">{chain.title}</h2>
              <SeverityBadge severity={chain.severity} />
            </div>
            <p className="mt-0.5 font-mono text-xs text-fog-muted">{chain.route}</p>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed">{chain.summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {chain.phases.map((p) => (
                <PhasePill key={p} id={p} />
              ))}
              {chainTechniques.map((t) => (
                <Link key={t.id} to={`/matrix?focus=${t.id}`} className="chip">
                  <span className="text-ember">{t.attackId}</span> {t.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1.5">
            <button type="button" className="btn btn-primary" onClick={startRunbook}>
              <ListChecks aria-hidden className="h-4 w-4" /> Start runbook
            </button>
            {openRuns > 0 && (
              <Link to="/runbooks" className="text-2xs text-fog-muted hover:text-ember">
                {openRuns} open {openRuns === 1 ? 'run' : 'runs'} of this chain
              </Link>
            )}
          </div>
        </header>

        <div className="glass relative h-[min(520px,62vh)] overflow-hidden">
          <FlowGraph chain={chain} selectedStep={step?.id ?? null} onSelectStep={selectStep} />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-3 font-mono text-2xs text-fog-muted">
            <span className="flex items-center gap-1">
              <MousePointerClick aria-hidden className="h-3 w-3" /> Click a step · scroll to zoom · drag to pan
            </span>
            <span className="flex items-center gap-1 text-gold">
              <Hand aria-hidden className="h-3 w-3" /> approval gate
            </span>
          </div>
        </div>

        {/* Keyboard- and screen-reader-friendly list of the same steps. */}
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`${chain.title} steps`}>
          {chain.steps.map((s, i) => {
            const phase = phaseById[s.phase];
            const active = s.id === step?.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => selectStep(active ? null : s.id)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-[13px] transition ${
                    active ? 'border-ember/60 bg-ember/10' : 'border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <span className="tabular font-mono text-2xs text-fog-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: hueHex[phase.hue] }} />
                  <span className="min-w-0 flex-1 truncate text-fog-bright">{s.label}</span>
                  {s.gate && <Hand aria-label="Approval gate" className="h-3.5 w-3.5 shrink-0 text-gold" />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <DetailPanel
        open={step !== null}
        onClose={() => selectStep(null)}
        label={step ? `${step.label} step details` : 'Step details'}
        contentKey={`${chain.id}-${step?.id ?? 'none'}`}
      >
        {step && <StepDetail chain={chain} step={step} onSelect={selectStep} />}
      </DetailPanel>
    </div>
  );
}
