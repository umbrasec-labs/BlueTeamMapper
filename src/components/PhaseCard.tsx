import type { Phase } from '@/data/types';
import { hueClass } from '@/lib/hues';
import { icons } from '@/lib/icons';

/** Compact phase summary used below the radial map (and as the tablet entry point). */
export function PhaseCard({ phase, active, onSelect }: { phase: Phase; active: boolean; onSelect: () => void }) {
  const Icon = icons[phase.icon];
  const c = hueClass[phase.hue];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`glass group flex flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:border-white/20 ${
        active ? `${c.border} shadow-glow` : ''
      }`}
    >
      <span className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-lg border ${c.border} ${c.bg}`}>
          <Icon aria-hidden className={`h-4 w-4 ${c.text}`} />
        </span>
        <span className="tabular font-mono text-2xs text-fog-muted">{String(phase.order).padStart(2, '0')}</span>
      </span>
      <span className="font-display font-bold text-fog-bright">{phase.label}</span>
      <span className="font-mono text-2xs leading-relaxed text-fog-dim">{phase.capabilities.join(' · ')}</span>
    </button>
  );
}
