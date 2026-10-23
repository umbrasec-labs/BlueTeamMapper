import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { layers, toolCategoryById, type Tool } from '@/data';
import { hueClass } from '@/lib/hues';
import { icons } from '@/lib/icons';

/** One arsenal entry. A single entry can name several interchangeable products. */
export const ToolCard = forwardRef<HTMLElement, { tool: Tool; highlight?: boolean }>(function ToolCard(
  { tool, highlight = false },
  ref,
) {
  const cat = toolCategoryById[tool.category];
  const Icon = icons[cat?.icon ?? 'wrench'];
  const c = hueClass[cat?.hue ?? 'slate'];
  const layer = layers.find((l) => l.toolCategories.includes(tool.category));
  return (
    <article
      ref={ref}
      id={`tool-${tool.id}`}
      className={`glass group flex scroll-mt-24 flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:border-white/20 ${
        highlight ? 'border-ember/60 shadow-glow' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${c.border} ${c.bg}`}>
          <Icon aria-hidden className={`h-4 w-4 ${c.text}`} />
        </span>
        <div className="min-w-0">
          <h3 className="font-sans text-[14px] font-semibold leading-snug text-fog-bright">
            {tool.names.length > 1 ? tool.names.join(' · ') : tool.label}
          </h3>
          <div className={`mt-0.5 font-mono text-2xs uppercase tracking-wider ${c.text}`}>{cat?.label}</div>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-fog-dim">{tool.description}</p>
      {layer && (
        <Link to={`/layers/${layer.id}`} className="chip mt-auto self-start">
          {layer.label} layer
        </Link>
      )}
    </article>
  );
});
