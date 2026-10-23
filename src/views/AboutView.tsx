import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { events, flowChains, layers, phases, sections, techniques, tools } from '@/data';
import { rules, skills } from '@/data/detections';

const shortcuts: [string, string][] = [
  ['⌘K  or  /', 'Open search'],
  ['1 – 7', 'Select a lifecycle phase'],
  ['← →', 'Cycle phases on the lifecycle map'],
  ['Esc', 'Close the detail panel or search'],
  ['g then l / a / f / c', 'Go to lifecycle, architecture, flows, coverage'],
  ['g then m / d / t / e', 'Go to matrix, detections, tools, events'],
];

export default function AboutView() {
  const counts: [string, number][] = [
    ['Lifecycle phases', phases.length],
    ['Architecture layers', layers.length],
    ['Flow chains', flowChains.length],
    ['Reference cards', sections.reduce((n, s) => n + s.cards.length, 0)],
    ['ATT&CK techniques', techniques.length],
    ['Event IDs', events.length],
    ['Tools', tools.length],
    ['UMBRASEC rules', rules.length],
  ];
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <div className="eyebrow text-ember">About</div>
        <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Blue Team Mapper v4</h2>
        <p className="mt-3 text-[14px] leading-relaxed">
          An interactive reimagining of the UMBRASEC Blue Team Mapper. The v3 single-page reference is rebuilt as a
          spatial map: a radial lifecycle, stacked architecture layers, branching response flow chains, and searchable
          reference views. Every piece of content from the original is still here, structured as typed data.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed">
          Red vs blue works best when both sides speak the same language. The{' '}
          <a
            className="text-ember underline-offset-2 hover:underline"
            href="https://umbrasec-labs.github.io/RedTeamMapper/"
            target="_blank"
            rel="noreferrer"
          >
            Red Team Mapper <ExternalLink aria-hidden className="inline h-3 w-3" />
          </a>{' '}
          is the offensive counterpart.
        </p>
      </header>

      <section>
        <h3 className="eyebrow mb-3">What's mapped</h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counts.map(([label, n]) => (
            <div key={label} className="glass p-3">
              <dt className="text-2xs text-fog-muted">{label}</dt>
              <dd className="tabular font-display text-2xl font-bold text-fog-bright">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="eyebrow mb-3">Keyboard</h3>
        <dl className="glass divide-y divide-white/[0.06]">
          {shortcuts.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]">
              <dt>
                <kbd className="kbd">{k}</kbd>
              </dt>
              <dd className="text-right text-fog-dim">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="text-[13px] leading-relaxed">
        <h3 className="eyebrow mb-3">Part of the UMBRASEC toolkit</h3>
        <p>
          Detections come straight from the{' '}
          <a className="text-ember hover:underline" href="https://umbrasec.dev/tools/sigma-pack/" target="_blank" rel="noreferrer">
            UMBRASEC sigma-pack
          </a>{' '}
          and the{' '}
          <a className="text-ember hover:underline" href="https://github.com/umbrasec-labs/umbra-blue" target="_blank" rel="noreferrer">
            umbra-blue
          </a>{' '}
          skill library ({skills.length} skills). They are synced on every deploy, so the rules shown here are always the
          canonical published copies.
        </p>
      </section>

      <section className="text-[13px] leading-relaxed text-fog-dim">
        <h3 className="eyebrow mb-3">Notes</h3>
        <p>
          Runs entirely in your browser as a static site. There's no backend and nothing is fetched at runtime. Your
          coverage assessment is stored only in this browser. ATT&amp;CK
          technique IDs are linked to attack.mitre.org for reference. Content is a practitioner reference, not vendor
          guidance: validate every control and query in your own environment before relying on it.
        </p>
        <p className="mt-3">
          <Link to="/" className="text-ember hover:underline">
            Back to the lifecycle map
          </Link>
        </p>
      </section>
    </article>
  );
}
