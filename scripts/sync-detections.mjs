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
 */
import { execFileSync } from 'node:child_process';
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
      return {
        id: basename(f, extname(f)),
        file: basename(f),
        path: rel,
        url: `${SIGMA_REPO}/${rel}`,
        ...parsed,
      };
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

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Synced ${ruleList.length} rules and ${skillList.length} skills → ${relative(ROOT, OUT)}`);
