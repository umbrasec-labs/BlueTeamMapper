#!/usr/bin/env node
/**
 * Pull UMBRASEC detections into the mapper.
 *
 * Reads the canonical rules and queries in the UMBRASEC sigma-pack (umbrasec.dev repo)
 * and the umbra-blue skill manifest, and writes src/data/external/detections.json.
 * Rule bodies are copied byte for byte; nothing here writes or edits a rule.
 *
 *   npm run sync:detections -- --sigma-pack ../umbrasec.dev/tools/sigma-pack --umbra-blue ../umbra-blue
 *
 * Both paths default to sibling checkouts. CI checks out both repos and runs this
 * before every build, so the deployed mapper always matches the published rules.
 *
 * Optional: --claims PATH reads a claims.json written by the umbrasec-labs/detections
 * harness and attaches each rule's Claims Ledger status. A rule whose bytes differ from
 * the bytes the harness proved shows as "mismatch". A claims file that cannot be read
 * or does not match the schema is skipped with a warning, so it never breaks the sync.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data/external/detections.json');

const SIGMA_REPO = 'https://github.com/umbrasec-labs/umbrasec.dev/blob/master/tools/sigma-pack';
const SKILLS_REPO = 'https://github.com/umbrasec-labs/umbra-blue/blob/main';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return resolve(i > -1 ? process.argv[i + 1] : fallback);
}

const sigmaPack = arg('sigma-pack', join(ROOT, '../umbrasec.dev/tools/sigma-pack'));
const umbraBlue = arg('umbra-blue', join(ROOT, '../umbra-blue'));

const warn = (msg) => console.error(`sync-detections: warning: ${msg}`);

// ---------------------------------------------------------------- Claims Ledger

const DETECTIONS_REPO = 'umbrasec-labs/detections';
const CLAIMS_SCHEMA = 'umbrasec.claims/v1';
const CLAIM_STATUSES = new Set(['verified', 'not-executed', 'stale', 'failing', 'unclaimed']);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const httpsOrNull = (v) => (typeof v === 'string' && v.startsWith('https://') ? v : null);

/** The parsed claims.json, or null when --claims is absent or the file is unusable. */
function loadLedger() {
  const i = process.argv.indexOf('--claims');
  if (i === -1) return null;
  const value = process.argv[i + 1];
  if (!value || value.startsWith('--')) {
    warn('--claims needs a path; skipping claims');
    return null;
  }
  const path = resolve(value);
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    warn(`cannot read ${path} (${err.message}); skipping claims`);
    return null;
  }
  if (!isObject(data) || data.schema !== CLAIMS_SCHEMA || !isObject(data.rules)) {
    warn(`${path} is not a ${CLAIMS_SCHEMA} record; skipping claims`);
    return null;
  }
  return data;
}

const ledger = loadLedger();

/** A ledger rule record has the fields the mapper reads, with the types it expects. */
function validRecord(rec) {
  return (
    isObject(rec) &&
    typeof rec.sha256 === 'string' &&
    CLAIM_STATUSES.has(rec.status) &&
    (rec.engine === 'sigma' || rec.engine === 'kusto') &&
    isObject(rec.counts) &&
    Object.values(rec.counts).every(isCount) &&
    Array.isArray(rec.claims) &&
    rec.claims.every(isObject) &&
    Array.isArray(rec.findings) &&
    rec.findings.every(isObject)
  );
}

/** Claims that passed for one kind, as {id, quote}. */
function proved(rec, kind) {
  return rec.claims
    .filter((c) => c.kind === kind && c.result === 'pass' && typeof c.id === 'string' && typeof c.quote === 'string')
    .map((c) => ({ id: c.id, quote: c.quote }));
}

/**
 * The Claims Ledger entry for one rule, or undefined to attach nothing. `file` is the rule's
 * path on disk: its raw bytes must hash to the digest the harness proved.
 */
function ruleClaims(id, kind, file) {
  const engine = kind === 'kql' ? 'kusto' : 'sigma';
  if (!Object.hasOwn(ledger.rules, id)) {
    const none = { blindSpots: [], falsePositives: [], findings: [] };
    return { status: 'unclaimed', counts: {}, passed: 0, total: 0, ...none, claimsUrl: null, engine };
  }
  const rec = ledger.rules[id];
  if (!validRecord(rec)) {
    warn(`claims for ${id} do not match the ${CLAIMS_SCHEMA} schema; skipping this rule's claims`);
    return undefined;
  }
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  const mismatch = sha256 !== rec.sha256;
  if (mismatch) warn(`${id}: the rule bytes (${sha256.slice(0, 12)}) differ from the proved bytes (${rec.sha256.slice(0, 12)})`);
  return {
    status: mismatch ? 'mismatch' : rec.status,
    counts: rec.counts,
    passed: rec.claims.filter((c) => c.result === 'pass').length,
    total: rec.claims.length,
    // Proofs only apply to the bytes they ran on, so a mismatch shows none of them.
    blindSpots: mismatch ? [] : proved(rec, 'blind-spot'),
    falsePositives: mismatch ? [] : proved(rec, 'false-positive'),
    findings: mismatch
      ? []
      : rec.findings
          .filter((f) => f.result === 'pass' && typeof f.claim === 'string' && typeof f.summary === 'string')
          .map((f) => ({
            id: f.claim,
            summary: f.summary,
            confidence: typeof f.confidence === 'string' ? f.confidence : null,
            upstream: typeof f.upstream === 'string' ? f.upstream : null,
          })),
    claimsUrl: httpsOrNull(rec.claims_url),
    engine: rec.engine,
  };
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/**
 * Normalize technique IDs from Sigma tags (attack.t1558.003) or free text (T1558.003).
 * MITRE ATLAS IDs (AML.T0051) keep their prefix so they are never mistaken for ATT&CK.
 */
function attackIds(text) {
  const ids = new Set();
  for (const m of text.matchAll(/\b(AML\.)?[Tt](\d{4})(?:\.(\d{3}))?\b/g)) {
    ids.add(`${m[1] ?? ''}T${m[2]}${m[3] ? `.${m[3]}` : ''}`);
  }
  return [...ids].sort();
}

function commit(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function writeupOf(refs) {
  return refs.find((r) => /umbrasec\.dev\/research\//.test(r)) ?? null;
}

function sigmaRule(file) {
  const content = readFileSync(file, 'utf8');
  const docs = parseAllDocuments(content).map((d) => d.toJS() ?? {});
  const main = docs.find((d) => d.title) ?? {};
  const tags = docs.flatMap((d) => d.tags ?? []);
  const logsource = docs.map((d) => d.logsource).find(Boolean);
  const refs = main.references ?? [];
  return {
    kind: 'sigma',
    title: main.title,
    description: String(main.description ?? '').replace(/\s+/g, ' ').trim(),
    status: main.status ?? null,
    level: main.level ?? null,
    correlation: docs.some((d) => d.correlation),
    attackIds: attackIds(tags.join(' ')),
    tactics: tags.filter((t) => /^attack\.[a-z-]+$/.test(t)).map((t) => t.slice(7)),
    logsource: logsource ? [logsource.product, logsource.service ?? logsource.category].filter(Boolean).join(' / ') : null,
    falsepositives: main.falsepositives ?? [],
    writeup: writeupOf(refs),
    content,
  };
}

function kqlQuery(file) {
  const content = readFileSync(file, 'utf8');
  const comments = content
    .split('\n')
    .filter((l) => l.startsWith('//'))
    .map((l) => l.replace(/^\/\/\s?/, ''));
  // First comment line: "UMBRASEC sigma-pack - <topic> (T1528), detection 1 of 3"; second: what it catches.
  const topic = (comments[0] ?? '').replace(/^UMBRASEC sigma-pack\s*-\s*/, '');
  const writeup = comments.join(' ').match(/https:\/\/umbrasec\.dev\/research\/\S+/)?.[0] ?? null;
  return {
    kind: 'kql',
    title: comments[1] || topic,
    description: topic,
    status: 'query',
    level: null,
    correlation: false,
    attackIds: attackIds(comments.slice(0, 2).join(' ')),
    tactics: [],
    logsource: 'Microsoft Sentinel / Log Analytics',
    falsepositives: [],
    writeup,
    content,
  };
}

function rules() {
  return walk(sigmaPack)
    .filter((f) => ['.yml', '.yaml', '.kql'].includes(extname(f)))
    .sort()
    .map((f) => {
      const rel = relative(sigmaPack, f);
      const parsed = extname(f) === '.kql' ? kqlQuery(f) : sigmaRule(f);
      const rule = {
        id: basename(f, extname(f)),
        file: basename(f),
        path: rel,
        url: `${SIGMA_REPO}/${rel}`,
        ...parsed,
      };
      if (ledger) {
        const claims = ruleClaims(rule.id, rule.kind, f);
        if (claims) rule.claims = claims;
      }
      return rule;
    });
}

function skills(ruleFiles) {
  const manifest = JSON.parse(readFileSync(join(umbraBlue, 'claude-skills.json'), 'utf8'));
  return manifest.skills
    .map((s) => {
      const body = readFileSync(join(umbraBlue, s.path), 'utf8');
      // Tier 1 skills inline sigma-pack rules; each block opens with "<file> (canonical copy: ...)".
      const inlined = [...body.matchAll(/([\w.-]+\.(?:yml|yaml|kql)) \(canonical copy/g)]
        .map((m) => m[1].replace(/\.(yml|yaml|kql)$/, ''))
        .filter((id) => ruleFiles.has(id));
      return {
        name: s.name,
        category: s.category,
        tier: s.tier,
        description: s.description,
        attackIds: attackIds(s.description),
        answers: s.answers ?? [],
        rules: [...new Set(inlined)],
        url: `${SKILLS_REPO}/${s.path}`,
      };
    })
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}

const ruleList = rules();
if (ruleList.length === 0) {
  console.error(`No rules found under ${sigmaPack}`);
  process.exit(2);
}
const skillList = skills(new Set(ruleList.map((r) => r.id)));

const out = {
  sources: {
    sigmaPack: { repo: 'umbrasec-labs/umbrasec.dev', commit: commit(sigmaPack), url: 'https://umbrasec.dev/tools/sigma-pack/' },
    umbraBlue: { repo: 'umbrasec-labs/umbra-blue', commit: commit(umbraBlue), url: 'https://github.com/umbrasec-labs/umbra-blue' },
  },
  rules: ruleList,
  skills: skillList,
};

if (ledger) {
  const harness = isObject(ledger.harness) ? ledger.harness : {};
  const repo = typeof harness.repo === 'string' ? harness.repo : DETECTIONS_REPO;
  out.sources.detections = {
    repo,
    // Short, like the other two sources.
    commit: typeof harness.commit === 'string' ? harness.commit.slice(0, 7) : null,
    url: `https://github.com/${repo}`,
  };
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
const claimed = ledger ? `, claims for ${ruleList.filter((r) => r.claims && r.claims.status !== 'unclaimed').length} rules` : '';
console.log(`Synced ${ruleList.length} rules and ${skillList.length} skills${claimed} → ${relative(ROOT, OUT)}`);
