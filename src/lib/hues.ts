import type { CalloutTone, EventSignal, Hue, MatrixTone, Severity } from '@/data/types';

/** Raw hex values, for SVG and React Flow where Tailwind classes can't reach. */
export const hueHex: Record<Hue, string> = {
  ember: '#f25623',
  gold: '#d9a441',
  khaki: '#aeab94',
  sage: '#88a57d',
  teal: '#5fb3a1',
  slate: '#8fa3b8',
  mauve: '#b48ead',
  rose: '#cf8a78',
};

/**
 * Tailwind class sets per hue. Written out in full so the JIT compiler can see them.
 */
export const hueClass: Record<
  Hue,
  { text: string; bg: string; border: string; ring: string; dot: string; fill: string }
> = {
  ember: { text: 'text-ember', bg: 'bg-ember/10', border: 'border-ember/40', ring: 'ring-ember/50', dot: 'bg-ember', fill: 'bg-ember/80' },
  gold: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/40', ring: 'ring-gold/50', dot: 'bg-gold', fill: 'bg-gold/80' },
  khaki: { text: 'text-khaki', bg: 'bg-khaki/10', border: 'border-khaki/40', ring: 'ring-khaki/50', dot: 'bg-khaki', fill: 'bg-khaki/80' },
  sage: { text: 'text-sage', bg: 'bg-sage/10', border: 'border-sage/40', ring: 'ring-sage/50', dot: 'bg-sage', fill: 'bg-sage/80' },
  teal: { text: 'text-teal', bg: 'bg-teal/10', border: 'border-teal/40', ring: 'ring-teal/50', dot: 'bg-teal', fill: 'bg-teal/80' },
  slate: { text: 'text-slate', bg: 'bg-slate/10', border: 'border-slate/40', ring: 'ring-slate/50', dot: 'bg-slate', fill: 'bg-slate/80' },
  mauve: { text: 'text-mauve', bg: 'bg-mauve/10', border: 'border-mauve/40', ring: 'ring-mauve/50', dot: 'bg-mauve', fill: 'bg-mauve/80' },
  rose: { text: 'text-rose', bg: 'bg-rose/10', border: 'border-rose/40', ring: 'ring-rose/50', dot: 'bg-rose', fill: 'bg-rose/80' },
};

export const severityMeta: Record<Severity, { label: string; short: string; hue: Hue; rank: number }> = {
  critical: { label: 'Critical', short: 'CRIT', hue: 'ember', rank: 0 },
  high: { label: 'High', short: 'HIGH', hue: 'gold', rank: 1 },
  medium: { label: 'Medium', short: 'MED', hue: 'khaki', rank: 2 },
  low: { label: 'Low', short: 'LOW', hue: 'sage', rank: 3 },
};

export const toneHue: Record<MatrixTone | EventSignal, Hue> = {
  good: 'sage',
  warn: 'gold',
  bad: 'ember',
};

export const calloutHue: Record<CalloutTone, Hue> = {
  warn: 'gold',
  success: 'sage',
  info: 'mauve',
  danger: 'ember',
};
