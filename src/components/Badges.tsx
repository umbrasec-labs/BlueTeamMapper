import { Link } from 'react-router-dom';
import { CircleDashed, CircleHelp, FileDiff, History, ShieldCheck, ShieldX, type LucideIcon } from 'lucide-react';
import { phaseById, type PhaseId, type Severity } from '@/data';
import {
  claimStatusMeta,
  claimsHint,
  claimsLabel,
  tierMeta,
  type BlueSkill,
  type ClaimStatus,
  type RuleClaims,
} from '@/data/detections';
import { hueClass, severityMeta } from '@/lib/hues';
import { icons } from '@/lib/icons';

const claimIcon: Record<ClaimStatus, LucideIcon> = {
  verified: ShieldCheck,
  'not-executed': CircleDashed,
  stale: History,
  failing: ShieldX,
  mismatch: FileDiff,
  unclaimed: CircleHelp,
};

/**
 * Claims Ledger status for one rule. The icon differs per status, so the chip never
 * relies on colour alone. `compact` shows a short label and keeps the full one for
 * screen readers.
 */
export function ClaimsBadge({
  claims,
  compact = false,
  className = '',
}: {
  claims: RuleClaims;
  compact?: boolean;
  className?: string;
}) {
  const meta = claimStatusMeta[claims.status];
  const Icon = claimIcon[claims.status];
  const tone = meta.hue
    ? `${hueClass[meta.hue].text} ${hueClass[meta.hue].bg} ${hueClass[meta.hue].border}`
    : 'border-white/10 text-fog-dim';
  const label = claimsLabel(claims);
  // Every compact label carries a word, so a verified rule never reads as a bare "12/12".
  const short = claims.status === 'verified' ? `${meta.short} ${claims.passed}/${claims.total}` : meta.short;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px font-mono text-2xs ${tone} ${className}`}
      title={`${label}. ${claimsHint(claims)}`}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {compact ? (
        <>
          <span aria-hidden>{short}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        label
      )}
    </span>
  );
}

/** umbra-blue tier. Tier 1 ships a sourced detection; Tier 2 is methodology only. */
export function TierBadge({ tier, className = '' }: { tier: BlueSkill['tier']; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-px font-mono text-2xs ${
        tier === 1 ? 'border-teal/50 bg-teal/10 text-teal' : 'border-white/10 text-fog-dim'
      } ${className}`}
      title={`${tierMeta[tier].label}: ${tierMeta[tier].hint}`}
    >
      Tier {tier}
    </span>
  );
}

export function SeverityBadge({ severity, className = '' }: { severity: Severity; className?: string }) {
  const meta = severityMeta[severity];
  const c = hueClass[meta.hue];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-px font-mono text-2xs font-medium tracking-wider ${c.text} ${c.bg} ${c.border} ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.short}
      <span className="sr-only"> severity</span>
    </span>
  );
}

export function PhasePill({ id, link = true }: { id: PhaseId; link?: boolean }) {
  const p = phaseById[id];
  const Icon = icons[p.icon];
  const c = hueClass[p.hue];
  const body = (
    <>
      <Icon aria-hidden className="h-3 w-3" />
      {p.short}
    </>
  );
  const cls = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium ${c.text} ${c.bg} ${c.border}`;
  return link ? (
    <Link to={`/?phase=${id}`} className={`${cls} transition hover:brightness-125`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
