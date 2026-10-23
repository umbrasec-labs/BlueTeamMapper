import { useNavigate, useParams } from 'react-router-dom';
import { layerById, layers } from '@/data';
import { LayerMap } from '@/components/LayerMap';
import { EmptyState } from '@/components/Feedback';

/** Architecture layers, telemetry at the top through intelligence at the bottom. */
export default function LayersView() {
  const { layerId } = useParams();
  const navigate = useNavigate();
  const unknown = layerId !== undefined && !layerById[layerId];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 max-w-3xl">
        <div className="eyebrow text-ember">Defense architecture</div>
        <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Ten layers, telemetry to intelligence</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
          Each band is one layer of the defensive stack. Open a layer to see its priority controls, reference matrices,
          detailed cards and the tools that run it. P0 controls are the ones to have in place before anything else.
        </p>
      </header>
      {unknown ? (
        <EmptyState
          title={`No layer called “${layerId}”`}
          hint="Pick one of the layers from the architecture list."
          action={
            <button type="button" className="btn mt-2" onClick={() => navigate('/layers')}>
              Show all layers
            </button>
          }
        />
      ) : (
        <LayerMap
          layers={layers}
          expandedId={layerId ?? null}
          onToggle={(id) => navigate(id === layerId ? '/layers' : `/layers/${id}`, { replace: true })}
        />
      )}
    </div>
  );
}
