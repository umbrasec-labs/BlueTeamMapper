import { memo, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Hand } from 'lucide-react';
import { phaseById, type FlowChain, type FlowStep } from '@/data';
import { hueHex } from '@/lib/hues';
import { icons } from '@/lib/icons';
import { edgeSides, layoutSteps, stepEdges } from '@/lib/graphLayout';

type StepNodeData = {
  step: FlowStep;
  order: number;
  selected: boolean;
  related: boolean;
  dimmed: boolean;
};
type StepNode = Node<StepNodeData, 'step'>;

const NODE_W = 220;

/** Every node exposes a source and target handle on each side; edges pick the sides. */
const handles: [string, Position][] = [
  ['l', Position.Left],
  ['r', Position.Right],
  ['t', Position.Top],
  ['b', Position.Bottom],
];

/** A single flow step: phase-colored, with an approval-gate marker where relevant. */
const StepNodeView = memo(function StepNodeView({ data }: NodeProps<StepNode>) {
  const { step, order, selected, related, dimmed } = data;
  const phase = phaseById[step.phase];
  const color = hueHex[phase.hue];
  const Icon = icons[phase.icon];
  return (
    <div
      className="group relative rounded-xl border bg-ink-850/95 px-3.5 py-3 backdrop-blur transition-all duration-200"
      style={{
        width: NODE_W,
        borderColor: selected ? '#f25623' : related ? `${color}aa` : `${color}55`,
        boxShadow: selected
          ? '0 0 0 1px #f25623, 0 0 28px -4px rgba(242,86,35,0.6)'
          : related
            ? `0 0 20px -8px ${color}`
            : 'none',
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      {handles.map(([id, pos]) => (
        <Handle key={`t-${id}`} id={`t-${id}`} type="target" position={pos} className="!h-1.5 !w-1.5 !min-h-0 !min-w-0 !border-0 !bg-ink-600" />
      ))}
      {handles.map(([id, pos]) => (
        <Handle key={`s-${id}`} id={`s-${id}`} type="source" position={pos} className="!h-1.5 !w-1.5 !min-h-0 !min-w-0 !border-0 !bg-ink-600" />
      ))}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
          <Icon aria-hidden className="h-3 w-3" />
          {phase.short}
        </span>
        <span className="tabular font-mono text-[10px] text-fog-muted">{String(order).padStart(2, '0')}</span>
      </div>
      <div className="mt-1.5 text-[13px] font-medium leading-snug text-fog-bright">{step.label}</div>
      {step.gate && (
        <div className="mt-2 inline-flex items-center gap-1 rounded border border-gold/40 bg-gold/10 px-1.5 py-px font-mono text-[10px] text-gold">
          <Hand aria-hidden className="h-3 w-3" /> Analyst approval
        </div>
      )}
    </div>
  );
});

const nodeTypes = { step: StepNodeView };

interface Props {
  chain: FlowChain;
  selectedStep: string | null;
  onSelectStep: (id: string | null) => void;
}

function Graph({ chain, selectedStep, onSelectStep }: Props) {
  const { fitView } = useReactFlow();
  const measured = useNodesInitialized();

  const { nodes, edges } = useMemo(() => {
    const rawEdges = stepEdges(chain.steps);
    const positioned = layoutSteps(chain.steps, rawEdges);
    const posById = Object.fromEntries(positioned.map((p) => [p.step.id, p]));
    const neighbours = new Set<string>();
    for (const e of rawEdges) {
      if (e.source === selectedStep) neighbours.add(e.target);
      if (e.target === selectedStep) neighbours.add(e.source);
    }

    const nodes: StepNode[] = positioned.map(({ step, x, y }, i) => ({
      id: step.id,
      type: 'step',
      position: { x, y },
      data: {
        step,
        order: i + 1,
        selected: step.id === selectedStep,
        related: neighbours.has(step.id),
        dimmed: selectedStep !== null && step.id !== selectedStep && !neighbours.has(step.id),
      },
      draggable: false,
      ariaLabel: `Step ${i + 1}: ${step.label}`,
    }));

    const edges: Edge[] = rawEdges.map((e) => {
      const active = selectedStep !== null && (e.source === selectedStep || e.target === selectedStep);
      const color = active ? '#f25623' : '#4a4a4a';
      const sides = edgeSides(posById[e.source], posById[e.target], NODE_W);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: `s-${sides.source}`,
        targetHandle: `t-${sides.target}`,
        type: 'smoothstep',
        animated: true,
        label: e.label,
        labelStyle: { fill: active ? '#fb8a5c' : '#959c95', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
        labelBgStyle: { fill: '#141414' },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 6,
        style: { stroke: color, strokeWidth: active ? 2 : 1.4 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      };
    });
    return { nodes, edges };
  }, [chain, selectedStep]);

  // Refit once nodes are measured, and whenever the chain changes.
  useEffect(() => {
    if (!measured) return;
    const t = requestAnimationFrame(() => fitView({ padding: 0.15, duration: 350, maxZoom: 1.1 }));
    return () => cancelAnimationFrame(t);
  }, [chain.id, measured, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => onSelectStep(n.id === selectedStep ? null : n.id)}
      onPaneClick={() => onSelectStep(null)}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.3}
      maxZoom={1.75}
      nodesConnectable={false}
      nodesDraggable={false}
      elementsSelectable
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2a2a2a" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

/** Zoomable, pannable node graph of one flow chain. */
export function FlowGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
