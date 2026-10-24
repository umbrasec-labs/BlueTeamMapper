/**
 * Renderers for the v3 reference content: cards, tree matrices, callouts and hunt queries.
 * Shared by the layer map and the full-section reader.
 */
import { useState, forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronDown, Copy, Info, ShieldAlert, Sparkles } from 'lucide-react';
import type { Callout, HuntQuery, Matrix, SectionCard as Card } from '@/data/types';
import { calloutHue, hueClass, toneHue } from '@/lib/hues';
import { alignComments } from '@/lib/alignComments';
import { RichText } from './RichText';

export const SectionCard = forwardRef<
  HTMLElement,
  { card: Card; id?: string; defaultOpen?: boolean; highlight?: boolean }
>(function SectionCard({ card, id, defaultOpen = false, highlight = false }, ref) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${id ?? card.title}-body`;
  return (
    <article
      ref={ref}
      id={id}
      className={`glass scroll-mt-24 transition-shadow ${highlight ? 'shadow-glow' : ''} ${open ? 'border-white/[0.12]' : ''}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="group flex w-full items-start gap-3 rounded-xl p-4 text-left transition hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1 text-teal/80">{card.tag}</div>
          <h3 className="font-display text-[15px] font-bold leading-snug">{card.title}</h3>
          <p className="mt-1 text-sm text-fog-dim">{card.summary}</p>
        </div>
        <span className="mt-1 flex shrink-0 items-center gap-2">
          <span className="tabular font-mono text-2xs text-fog-muted">{card.items.length}</span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 text-fog-dim transition-transform group-hover:text-ember ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <ul className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3">
              {card.items.map((item, i) => (
                <li key={i} className="text-[13px] leading-relaxed">
                  {item.lead && <span className="font-semibold text-fog-bright">{item.lead}</span>}
                  {item.lead && item.text && <span className="text-fog-muted"> — </span>}
                  <RichText text={item.text} />
                  {item.note && (
                    <div className="mt-1.5 rounded-md border-l-2 border-teal/40 bg-teal/[0.04] px-2.5 py-1.5 text-xs text-fog-dim">
                      <RichText text={item.note} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
});

export function MatrixBlock({ matrix }: { matrix: Matrix }) {
  return (
    <figure className="glass overflow-hidden">
      <figcaption className="border-b border-white/[0.06] px-4 py-2.5 font-mono text-2xs uppercase tracking-[0.14em] text-ember">
        {matrix.title}
      </figcaption>
      <div className="grid gap-px bg-white/[0.04] sm:grid-cols-2">
        {matrix.groups.map((g) => (
          <div key={g.heading} className="min-w-0 bg-ink-850 p-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-2xs font-medium uppercase tracking-wider text-fog-bright">
                {g.heading}
              </span>
              {g.note && <span className="text-2xs text-fog-muted">{g.note}</span>}
            </div>
            <dl className="space-y-1.5">
              {g.rows.map((r) => {
                const hue = r.tone ? hueClass[toneHue[r.tone]].text : 'text-slate';
                return (
                  <div key={r.label} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-3 text-xs">
                    <dt className={`font-mono ${hue} [overflow-wrap:anywhere]`}>{r.label}</dt>
                    <dd className="text-fog-dim">{r.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </figure>
  );
}

const calloutIcon = { warn: AlertTriangle, success: Sparkles, info: Info, danger: ShieldAlert };

export function CalloutBox({ callout }: { callout: Callout }) {
  const hue = calloutHue[callout.tone];
  const c = hueClass[hue];
  const Icon = calloutIcon[callout.tone];
  return (
    <aside className={`flex gap-3 rounded-xl border ${c.border} ${c.bg} p-4`}>
      <Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${c.text}`} />
      <div className="min-w-0">
        <div className={`font-display font-bold ${c.text}`}>{callout.title}</div>
        <p className="mt-1 text-[13px] leading-relaxed">{callout.body}</p>
      </div>
    </aside>
  );
}

export function QueryBlock({ query }: { query: HuntQuery }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(query.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <figure className="glass min-w-0 overflow-hidden">
      <figcaption className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
        <span className="text-sm font-medium text-fog-bright">{query.title}</span>
        <span className="flex items-center gap-2">
          <span className="chip uppercase">{query.language}</span>
          <button type="button" onClick={copy} className="chip" aria-label={`Copy ${query.title} query`}>
            {copied ? <Check aria-hidden className="h-3 w-3 text-sage" /> : <Copy aria-hidden className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </figcaption>
      <pre className="overflow-x-auto bg-ink-950/60 p-4 font-mono text-xs leading-relaxed text-teal">
        {/* Display only: Copy keeps the query exactly as written, ready to paste and run. */}
        <code>{alignComments(query.code)}</code>
      </pre>
    </figure>
  );
}
