import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { phaseLinks, phases, type PhaseId, type PhaseLink } from '@/data';
import { hueHex } from '@/lib/hues';
import { icons } from '@/lib/icons';

/*
 * Geometry. Angles are degrees clockwise from 12 o'clock; the SVG is centered on 0,0.
 * Rings from the inside out: hub, phase segments, flow orbit, feedback orbits.
 */
const R_HUB = 118;
const R_IN = 168;
const R_OUT = 286;
const R_FLOW = 318;
const R_FEEDBACK = [344, 360, 376];
const GAP = 1.6;
const SPAN = 360 / phases.length;
const VIEW = 405;

const toXY = (r: number, deg: number): [number, number] => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
};

function sectorPath(a0: number, a1: number, ri: number, ro: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = toXY(ro, a0);
  const [x1, y1] = toXY(ro, a1);
  const [x2, y2] = toXY(ri, a1);
  const [x3, y3] = toXY(ri, a0);
  return `M${x0} ${y0} A${ro} ${ro} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${ri} ${ri} 0 ${large} 0 ${x3} ${y3}Z`;
}

/** Arc along radius r from a0 to a1, clockwise or counter-clockwise. */
function arcPath(r: number, a0: number, a1: number, clockwise: boolean) {
  const sweep = clockwise ? 1 : 0;
  const delta = clockwise ? (a1 - a0 + 360) % 360 : (a0 - a1 + 360) % 360;
  const large = delta > 180 ? 1 : 0;
  const [x0, y0] = toXY(r, a0);
  const [x1, y1] = toXY(r, a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}

const mid = (index: number) => index * SPAN + SPAN / 2;
const indexOf = Object.fromEntries(phases.map((p, i) => [p.id, i])) as Record<PhaseId, number>;

interface LinkGeometry {
  link: PhaseLink;
  d: string;
  labelAt: [number, number];
}

function linkGeometry(): LinkGeometry[] {
  let feedbackLane = 0;
  return phaseLinks.map((link) => {
    const a0 = mid(indexOf[link.from]);
    const a1 = mid(indexOf[link.to]);
    if (link.kind === 'flow') {
      // Start/end inset so the arrowhead lands just before the next segment's center.
      const s = a0 + 7;
      const e = a1 - 7;
      const m = a0 + SPAN / 2;
      return { link, d: arcPath(R_FLOW, s, e, true), labelAt: toXY(R_FLOW, m) };
    }
    const r = R_FEEDBACK[feedbackLane++ % R_FEEDBACK.length];
    const s = a0 - 4;
    const e = a1 + 4;
    const span = (s - e + 360) % 360;
    return { link, d: arcPath(r, s, e, false), labelAt: toXY(r + 10, s - span / 2) };
  });
}

interface Props {
  selected: PhaseId | null;
  onSelect: (id: PhaseId) => void;
}

/**
 * Radial lifecycle map: seven clickable phase segments around a hub, with animated
 * flow arrows between consecutive phases and feedback loops on the outer orbits.
 * Each segment is a focusable button; arrow keys and 1-7 are handled by the parent view.
 */
export function RadialMap({ selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<PhaseId | null>(null);
  const links = useMemo(linkGeometry, []);
  const focus = hovered ?? selected;
  const focusPhase = phases.find((p) => p.id === focus) ?? null;

  const isLinkActive = (l: PhaseLink) => focus !== null && (l.from === focus || l.to === focus);

  return (
    <svg
      viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
      className="h-auto w-full max-w-[min(100%,760px)] select-none"
      role="group"
      aria-label="Defense lifecycle: seven phases. Use arrow keys or number keys 1 to 7 to select a phase."
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="hub-fill" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#262626" />
          <stop offset="100%" stopColor="#141414" />
        </radialGradient>
        {(
          [
            ['arrow-idle', '#525252'],
            ['arrow-active', '#f25623'],
            ['arrow-feedback', '#3f6f64'],
            ['arrow-feedback-active', '#5fb3a1'],
          ] as const
        ).map(([id, color]) => (
          <marker
            key={id}
            id={id}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 1 L9 5 L0 9 z" fill={color} />
          </marker>
        ))}
      </defs>

      {/* Outer tick ring */}
      <g aria-hidden>
        {Array.from({ length: 84 }, (_, i) => {
          const a = (i * 360) / 84;
          const [x0, y0] = toXY(R_OUT + 8, a);
          const [x1, y1] = toXY(R_OUT + (i % 12 === 0 ? 16 : 12), a);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#2e2e2e" strokeWidth={1} />;
        })}
        <circle r={R_IN - 8} fill="none" stroke="#242424" strokeDasharray="2 6" />
      </g>

      {/* Links */}
      <g aria-hidden>
        {links.map(({ link, d }) => {
          const active = isLinkActive(link);
          const feedback = link.kind === 'feedback';
          const color = feedback ? (active ? '#5fb3a1' : '#2f4f48') : active ? '#f25623' : '#3a3a3a';
          const marker = feedback
            ? active
              ? 'arrow-feedback-active'
              : 'arrow-feedback'
            : active
              ? 'arrow-active'
              : 'arrow-idle';
          return (
            <g key={`${link.from}-${link.to}`}>
              <motion.path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={active ? 2.2 : 1.4}
                strokeLinecap="round"
                markerEnd={`url(#${marker})`}
                strokeDasharray={feedback ? '3 6' : undefined}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
              />
              {active && !feedback && (
                <path
                  d={d}
                  fill="none"
                  stroke="#fb8a5c"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeDasharray="4 20"
                  className="animate-dash"
                />
              )}
            </g>
          );
        })}
      </g>

      {/* Phase segments */}
      {phases.map((p, i) => {
        const a0 = i * SPAN + GAP;
        const a1 = (i + 1) * SPAN - GAP;
        const color = hueHex[p.hue];
        const isSel = selected === p.id;
        const isHover = hovered === p.id;
        const dim = focus !== null && focus !== p.id;
        const Icon = icons[p.icon];
        // Icon, label and capability stack vertically around the segment's centroid.
        const [cx, cy] = toXY((R_IN + R_OUT) / 2, mid(i));
        const [ix, iy] = [cx, cy - 22];
        const [lx, ly] = [cx, cy + 6];
        const [nx, ny] = toXY(R_OUT + 30, mid(i));
        // Selected and hovered segments slide outward along their bisector.
        const pop = toXY(isSel ? 10 : isHover ? 5 : 0, mid(i));
        return (
          <motion.g
            key={p.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSel}
            aria-label={`Phase ${p.order}: ${p.label}. ${p.tagline}`}
            onClick={() => onSelect(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(p.id);
              }
            }}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(p.id)}
            onBlur={() => setHovered(null)}
            className="cursor-pointer outline-none [&:focus-visible>path.seg]:stroke-[#f25623] [&:focus-visible>path.seg]:[stroke-width:2.5]"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: dim ? 0.62 : 1, scale: 1, x: pop[0], y: pop[1] }}
            transition={{ type: 'spring', stiffness: 300, damping: 26, opacity: { duration: 0.2 } }}
          >
            {isSel && (
              <path
                d={sectorPath(a0, a1, R_OUT + 2, R_OUT + 7)}
                fill={color}
                filter="url(#glow)"
                aria-hidden
              />
            )}
            <path
              className="seg"
              d={sectorPath(a0, a1, R_IN, R_OUT)}
              fill={color}
              fillOpacity={isSel ? 0.2 : isHover ? 0.14 : 0.07}
              stroke={color}
              strokeOpacity={isSel ? 0.9 : isHover ? 0.6 : 0.32}
              strokeWidth={isSel ? 1.6 : 1}
            />
            <g transform={`translate(${ix - 12} ${iy - 12})`} aria-hidden>
              <Icon width={24} height={24} color={color} strokeWidth={1.75} />
            </g>
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-display"
              fontSize={15}
              fontWeight={700}
              fill={isSel || isHover ? '#ffffff' : '#ccd0cf'}
              aria-hidden
            >
              {p.short}
            </text>
            <text
              x={lx}
              y={ly + 17}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-mono"
              fontSize={9.5}
              fill="#7d837d"
              aria-hidden
            >
              {p.capabilities[0]}
            </text>
            <text
              x={nx}
              y={ny}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-mono"
              fontSize={10}
              fill={isSel ? color : '#525252'}
              aria-hidden
            >
              {String(p.order).padStart(2, '0')}
            </text>
          </motion.g>
        );
      })}

      {/* Labels for highlighted links */}
      <g aria-hidden pointerEvents="none">
        {links
          .filter(({ link }) => isLinkActive(link))
          .map(({ link, labelAt: [x, y] }) => {
            const feedback = link.kind === 'feedback';
            const w = link.label.length * 6 + 16;
            return (
              <motion.g
                key={`label-${link.from}-${link.to}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transform={`translate(${x} ${y})`}
              >
                <rect
                  x={-w / 2}
                  y={-10}
                  width={w}
                  height={20}
                  rx={10}
                  fill="#141414"
                  stroke={feedback ? '#5fb3a1' : '#f25623'}
                  strokeOpacity={0.6}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  className="font-mono"
                  fill={feedback ? '#5fb3a1' : '#fb8a5c'}
                >
                  {link.label}
                </text>
              </motion.g>
            );
          })}
      </g>

      {/* Hub */}
      <g aria-hidden>
        {selected && (
          <circle
            r={R_HUB + 6}
            fill="none"
            stroke={hueHex[phases[indexOf[selected]].hue]}
            strokeOpacity={0.5}
            className="animate-pulse-ring [transform-box:fill-box] [transform-origin:center]"
          />
        )}
        <circle r={R_HUB} fill="url(#hub-fill)" stroke="#2f2f2f" />
        <foreignObject x={-R_HUB + 14} y={-R_HUB + 14} width={(R_HUB - 14) * 2} height={(R_HUB - 14) * 2}>
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            {focusPhase ? (
              <>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: hueHex[focusPhase.hue] }}>
                  Phase {String(focusPhase.order).padStart(2, '0')} / 07
                </span>
                <span className="mt-1 font-display text-[22px] font-extrabold leading-tight text-white">
                  {focusPhase.label}
                </span>
                <span className="mt-1.5 text-[11px] leading-snug text-fog">{focusPhase.tagline}</span>
              </>
            ) : (
              <>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ember">Defense lifecycle</span>
                <span className="mt-1 font-display text-[22px] font-extrabold leading-tight text-white">
                  7 phases
                </span>
                <span className="mt-1.5 text-[11px] leading-snug text-fog">
                  Each phase feeds the next. Select one to see what it takes.
                </span>
              </>
            )}
          </div>
        </foreignObject>
      </g>
    </svg>
  );
}
