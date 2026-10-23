import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Download, EyeOff, FileCheck2, FlaskConical, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { techniques, type Technique } from '@/data';
import { coverageMeta, logSources, techniqueSources, type CoverageLevel } from '@/data/coverage';
import { provedBlindSpots, rulesForTechnique, skillPath, skillsForTechnique } from '@/data/detections';
import { useCoverage } from '@/store/coverage';
import { SeverityBadge } from '@/components/Badges';
import { buildLayer, downloadLayer, parseLayer } from '@/lib/navigator';
import { severityMeta } from '@/lib/hues';

const levels: CoverageLevel[] = ['alert', 'logged', 'blind'];

const levelStyle: Record<CoverageLevel, { on: string; dot: string }> = {
  alert: { on: 'border-sage/60 bg-sage/15 text-sage', dot: 'bg-sage' },
  logged: { on: 'border-gold/60 bg-gold/15 text-gold', dot: 'bg-gold' },
  blind: { on: 'border-ember/60 bg-ember/15 text-ember', dot: 'bg-ember' },
};

/** A plausible mid-maturity SOC, for exploring the view. Clearly labelled as an example in the UI. */
const EXAMPLE_LEVELS: Record<string, CoverageLevel> = {
  kerberoasting: 'alert',
  'lsass-credential-dump': 'alert',
  'process-injection': 'alert',
  'spear-phishing-html-smuggling': 'alert',
  'scheduled-task-persistence': 'logged',
  'psexec-lateral-movement': 'logged',
  'registry-run-key-persistence': 'logged',
  'pass-the-hash': 'logged',
  dcsync: 'logged',
  'cloud-token-theft-device-code': 'logged',
  'dns-exfiltration': 'blind',
  'adcs-esc1-exploitation': 'blind',
  'https-c2-beaconing': 'blind',
};
const EXAMPLE_SOURCES = [
  'Windows Security Event Log',
  'Windows Sysmon',
  'EDR Telemetry',
  'Network Firewall / IDS',
  'Identity Provider',
  'Email Security Gateway',
  'Proxy / Web Filter',
];

type Row = {
  t: Technique;
  level: CoverageLevel | null;
  missing: string[];
  /** Set when no level is chosen and none of the technique's sources is collected. */
  inferredBlind: boolean;
};

export default function CoverageView() {
  const { levels: chosen, sources, isExample, setLevel, toggleSource, setSources, replace, reset } = useCoverage();
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows: Row[] = useMemo(
    () =>
      [...techniques]
        .sort((a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank || a.name.localeCompare(b.name))
        .map((t) => {
          const needed = techniqueSources[t.id];
          const missing = needed.filter((s) => !sources[s]);
          const level = chosen[t.id] ?? null;
          return { t, level, missing, inferredBlind: !level && missing.length === needed.length };
        }),
    [chosen, sources],
  );

  const counts = {
    alert: rows.filter((r) => r.level === 'alert').length,
    logged: rows.filter((r) => r.level === 'logged').length,
    blind: rows.filter((r) => r.level === 'blind' || r.inferredBlind).length,
  };
  const open = rows.length - counts.alert - counts.logged - counts.blind;
  const score = Math.round(((counts.alert + counts.logged * 0.5) / rows.length) * 100);
  const anyInput = Object.keys(chosen).length > 0 || Object.values(sources).some(Boolean);
  const gaps = rows.filter(
    (r) => (r.level === 'blind' || r.inferredBlind) && (r.t.severity === 'critical' || r.t.severity === 'high'),
  );
  const contradictions = rows.filter((r) => r.level === 'alert' && r.missing.length === techniqueSources[r.t.id].length);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { levels, sources: srcs, matched } = parseLayer(await file.text());
      if (matched === 0) throw new Error('No techniques in that layer match the 22 in this matrix.');
      replace(levels, srcs);
      setNotice({ tone: 'ok', text: `Imported ${matched} technique assessments from ${file.name}.` });
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Could not read that file.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const byTier = [1, 2, 3].map((tier) => logSources.filter((s) => s.tier === tier));

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="eyebrow text-ember">Assess</div>
          <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Where are you blind?</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
            Tick the log sources you actually collect, then rate each technique: <b className="text-sage">Alert</b> if a
            tuned rule fires, <b className="text-gold">Logged</b> if it's visible but nothing alerts,{' '}
            <b className="text-ember">Blind</b> if you can't see it. Your answers stay in this browser. Export them as an
            ATT&amp;CK Navigator layer to share or track over time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!anyInput}
            onClick={() => {
              downloadLayer(buildLayer(chosen, sources));
              setNotice({ tone: 'ok', text: 'Exported. Open it in ATT&CK Navigator with "Open Existing Layer".' });
            }}
          >
            <Download aria-hidden className="h-4 w-4" /> Export Navigator layer
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden className="h-4 w-4" /> Import
          </button>
          <input
            ref={fileRef}
            id="coverage-import"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
          {!anyInput && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                replace(EXAMPLE_LEVELS, Object.fromEntries(EXAMPLE_SOURCES.map((s) => [s, true])), true);
                setNotice(null);
              }}
            >
              <FlaskConical aria-hidden className="h-4 w-4" /> Load example
            </button>
          )}
          {anyInput &&
            (confirmReset ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-2 py-1 text-xs">
                Clear every answer?
                <button
                  type="button"
                  className="rounded px-2 py-0.5 font-medium text-ember hover:bg-ember/20"
                  onClick={() => {
                    reset();
                    setConfirmReset(false);
                    setNotice(null);
                  }}
                >
                  Clear
                </button>
                <button type="button" className="rounded px-2 py-0.5 hover:bg-white/10" onClick={() => setConfirmReset(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="btn" onClick={() => setConfirmReset(true)}>
                <RotateCcw aria-hidden className="h-4 w-4" /> Reset
              </button>
            ))}
        </div>
      </header>

      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-lg border px-3 py-2 text-[13px] ${
            notice.tone === 'ok' ? 'border-sage/40 bg-sage/10 text-sage' : 'border-ember/40 bg-ember/10 text-ember'
          }`}
        >
          {notice.text}
        </p>
      )}
      {isExample && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[13px] text-gold">
          <FlaskConical aria-hidden className="h-4 w-4 shrink-0" />
          Example data, not your environment. Change any answer to make it yours, or reset to start clean.
        </p>
      )}

      {/* Summary */}
      <section aria-label="Coverage summary" className="glass mb-6 grid gap-5 p-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24">
            <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90" aria-hidden>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2a2a2a" strokeWidth="3.2" />
              <motion.circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke={score >= 66 ? '#88a57d' : score >= 33 ? '#d9a441' : '#f25623'}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="100 100"
                initial={false}
                animate={{ strokeDashoffset: 100 - score }}
                transition={{ duration: 0.6 }}
              />
            </svg>
            <span className="tabular absolute inset-0 grid place-items-center font-display text-2xl font-bold text-fog-bright">
              {score}
            </span>
          </div>
          <div>
            <div className="eyebrow">Coverage score</div>
            <p className="mt-1 max-w-[14rem] text-xs text-fog-dim">Alert counts fully, Logged counts half, out of all 22 techniques.</p>
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex h-3 overflow-hidden rounded-full bg-ink-700" role="img" aria-label={`${counts.alert} alert, ${counts.logged} logged, ${counts.blind} blind, ${open} not assessed`}>
            {(['alert', 'logged', 'blind'] as const).map((k) => (
              <motion.div
                key={k}
                className={levelStyle[k].dot}
                initial={false}
                animate={{ width: `${(counts[k] / rows.length) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            ))}
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {levels.map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-2 w-2 rounded-full ${levelStyle[k].dot}`} />
                <dt className="text-fog-dim">{coverageMeta[k].label}</dt>
                <dd className="tabular font-medium text-fog-bright">{counts[k]}</dd>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-ink-500" />
              <dt className="text-fog-dim">Not assessed</dt>
              <dd className="tabular font-medium text-fog-bright">{open}</dd>
            </div>
          </dl>
          {gaps.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <AlertTriangle aria-hidden className="h-3.5 w-3.5 text-ember" />
              <span className="text-fog-bright">Critical and high gaps:</span>
              {gaps.map((r) => (
                <a key={r.t.id} href={`#cov-${r.t.id}`} className="chip border-ember/30 text-ember">
                  {r.t.name}
                </a>
              ))}
            </div>
          ) : (
            anyInput && (
              <p className="flex items-center gap-1.5 text-xs text-sage">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> No critical or high technique is marked blind.
              </p>
            )
          )}
          {contradictions.length > 0 && (
            <p className="text-xs text-gold">
              {contradictions.length} technique{contradictions.length > 1 ? 's are' : ' is'} marked Alert, but you don't
              collect any of the log sources {contradictions.length > 1 ? 'they depend' : 'it depends'} on. Check the
              source list.
            </p>
          )}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Log sources */}
        <aside aria-labelledby="sources-h" className="glass p-4 lg:sticky lg:top-[4.5rem]">
          <h3 id="sources-h" className="font-display text-base font-bold">
            Log sources you collect
          </h3>
          <p className="mt-1 text-xs text-fog-dim">From the Log Source Priority Matrix. Tier 1 comes before anything else.</p>
          <div className="mt-3 space-y-4">
            {byTier.map((list, i) => {
              const allOn = list.every((s) => sources[s.label]);
              return (
                <fieldset key={i}>
                  <legend className="flex w-full items-center justify-between">
                    <span className="eyebrow text-fog-bright">Tier {i + 1}</span>
                    <button
                      type="button"
                      className="text-2xs text-fog-muted hover:text-ember"
                      onClick={() => setSources(list.map((s) => s.label), !allOn)}
                    >
                      {allOn ? 'Clear tier' : 'Select tier'}
                    </button>
                  </legend>
                  <ul className="mt-1.5 space-y-1">
                    {list.map((s) => {
                      const id = `src-${s.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
                      const used = techniques.filter((t) => techniqueSources[t.id].includes(s.label)).length;
                      return (
                        <li key={s.label}>
                          <label htmlFor={id} className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-white/[0.03]">
                            <input
                              id={id}
                              type="checkbox"
                              checked={!!sources[s.label]}
                              onChange={() => toggleSource(s.label)}
                              className="mt-0.5 h-3.5 w-3.5 accent-[#f25623]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] leading-snug text-fog-bright">{s.label}</span>
                              <span className="block text-2xs text-fog-muted">{s.note}</span>
                            </span>
                            {used > 0 && (
                              <span className="tabular shrink-0 font-mono text-2xs text-fog-muted" title={`${used} techniques depend on it`}>
                                {used}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })}
          </div>
        </aside>

        {/* Techniques */}
        <section aria-label="Technique coverage" className="space-y-2">
          {rows.map(({ t, level, missing, inferredBlind }) => {
            const umbrasec = rulesForTechnique(t.attackId);
            const skill = skillsForTechnique(t.attackId, 1)[0];
            const needed = techniqueSources[t.id];
            // Only under Alert: that is the "we're covered" claim the proved blind spots qualify.
            const caveats = level === 'alert' ? provedBlindSpots(t.attackId) : [];
            const caveatRules = new Set(caveats.map((c) => c.rule.id)).size;
            return (
              <article
                key={t.id}
                id={`cov-${t.id}`}
                className={`glass scroll-mt-24 p-3.5 ${inferredBlind || level === 'blind' ? 'border-ember/25' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/matrix?focus=${t.id}`} className="text-[14px] font-medium text-fog-bright hover:text-ember">
                        {t.name}
                      </Link>
                      <span className="font-mono text-2xs text-ember/80">{t.attackId}</span>
                      <SeverityBadge severity={t.severity} />
                    </div>
                    <div className="mt-0.5 text-xs text-fog-dim">{t.detection}</div>
                  </div>
                  <div role="radiogroup" aria-label={`Coverage for ${t.name}`} className="flex rounded-lg border border-white/10 p-0.5">
                    {levels.map((k) => {
                      const on = level === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          title={coverageMeta[k].hint}
                          onClick={() => setLevel(t.id, on ? null : k)}
                          className={`rounded-md border px-2.5 py-1 text-xs transition ${
                            on ? levelStyle[k].on : 'border-transparent text-fog-dim hover:text-fog-bright'
                          }`}
                        >
                          {coverageMeta[k].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-2xs">
                  {needed.map((s) => (
                    <span
                      key={s}
                      className={`chip ${missing.includes(s) ? 'border-ember/30 text-ember/90 line-through decoration-ember/50' : 'border-sage/30 text-sage'}`}
                      title={missing.includes(s) ? 'Not collected' : 'Collected'}
                    >
                      {s}
                    </span>
                  ))}
                  {umbrasec.length > 0 && (
                    <Link to={`/detections?focus=${umbrasec[0].id}`} className="chip border-teal/40 text-teal">
                      <FileCheck2 aria-hidden className="h-3 w-3" />
                      {umbrasec.length} UMBRASEC {umbrasec.length > 1 ? 'rules' : 'rule'}
                    </Link>
                  )}
                  {skill && (
                    <Link to={skillPath(skill.name)} className="chip" title={skill.description}>
                      umbra-blue · {skill.name} <span className="text-fog-muted">T{skill.tier}</span>
                    </Link>
                  )}
                  {inferredBlind && (
                    <span className="ml-auto text-ember">Likely blind: none of its log sources are collected</span>
                  )}
                </div>
                {caveats.length > 0 && (
                  <div className="mt-2.5 rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-gold">
                      <EyeOff aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      The UMBRASEC {caveatRules > 1 ? 'rules are' : 'rule is'} proved to miss:
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {caveats.map((c) => (
                        <li key={`${c.rule.id}/${c.id}`} className="text-xs leading-relaxed">
                          <span className="text-fog-bright">“{c.quote}”</span>{' '}
                          <span className="text-fog-muted">
                            ·{' '}
                            <Link to={`/detections?focus=${c.rule.id}`} className="hover:text-ember">
                              {c.rule.title}
                            </Link>
                            {c.rule.claims?.claimsUrl && (
                              <>
                                {' · '}
                                <a href={c.rule.claims.claimsUrl} target="_blank" rel="noreferrer" className="text-teal hover:text-ember">
                                  proof
                                </a>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
