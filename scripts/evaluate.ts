// Evaluation of the on-device engine.
//   npm run eval:dev  -> development half of the corpora + our fixtures. For tuning. Writes nothing.
//   npm run eval      -> held-out half. Writes docs/EVALUATION.md and docs/evaluation.json.
// Run the held-out mode once, after the rules are frozen. Do not tune after reading it.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../src/engine/analyze';
import { normalise, parseCsv, side } from './corpus';
import type { Level } from '../src/engine/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const dev = process.argv.includes('--dev');
const LEVELS: Level[] = ['stop', 'caution', 'none', 'unsupported', 'too_short'];

const UCI_URL = 'https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip';
const SMISH_URL =
  'https://data.mendeley.com/public-files/datasets/f45bkkt8pr/files/edb361de-918d-469f-9106-e84823830665/file_downloaded';

async function download(url: string, zip: string, dir: string, file: string) {
  const path = join(dir, file);
  if (existsSync(path)) return path;
  mkdirSync(dir, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  if (!existsSync(path)) throw new Error(`expected ${path} after unzip`);
  return path;
}

interface Metric {
  count: number;
  total: number;
  rate: number;
  wilson95: [number, number];
}
function wilson(count: number, total: number): Metric {
  if (!total) return { count, total, rate: 0, wilson95: [0, 0] };
  const z = 1.959963984540054,
    p = count / total,
    d = 1 + (z * z) / total,
    centre = (p + (z * z) / (2 * total)) / d,
    half = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / d;
  return {
    count,
    total,
    rate: p,
    wilson95: [Math.max(0, centre - half), Math.min(1, centre + half)],
  };
}
type Group = { total: number } & Record<Level | 'stopOrCaution', Metric>;
function score(texts: string[]): { group: Group; levels: Level[] } {
  const levels = texts.map((t) => analyze(t).level);
  const n = (l: Level) => levels.filter((x) => x === l).length;
  const group = { total: texts.length } as Group;
  for (const l of LEVELS) group[l] = wilson(n(l), texts.length);
  group.stopOrCaution = wilson(n('stop') + n('caution'), texts.length);
  return { group, levels };
}

const pct = (m: Metric) =>
  `${m.count} / ${m.total} (${(m.rate * 100).toFixed(2)}%, 95% interval ${(m.wilson95[0] * 100).toFixed(2)}–${(m.wilson95[1] * 100).toFixed(2)}%)`;
function table(title: string, g: Group) {
  const lines = [
    `**${title}** (n = ${g.total})`,
    '',
    '| Outcome | Count / total | Rate | Wilson 95% interval |',
    '| --- | --- | --- | --- |',
  ];
  for (const l of [...LEVELS, 'stopOrCaution' as const]) {
    const m = g[l];
    lines.push(
      `| ${l === 'stopOrCaution' ? 'stop or caution' : l.replace('_', ' ')} | ${m.count} / ${m.total} | ${(m.rate * 100).toFixed(2)}% | ${(m.wilson95[0] * 100).toFixed(2)}–${(m.wilson95[1] * 100).toFixed(2)}% |`,
    );
  }
  return lines.join('\n');
}

async function main() {
  // --- Corpora -------------------------------------------------------------------------------
  const uciFile = await download(
    UCI_URL,
    join(dataDir, 'sms.zip'),
    join(dataDir, 'sms'),
    'SMSSpamCollection',
  );
  const uci = readFileSync(uciFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const tab = l.indexOf('\t');
      return { label: l.slice(0, tab), text: l.slice(tab + 1) };
    })
    .filter((r) => r.label === 'ham' || r.label === 'spam');

  let smish: { label: 'ham' | 'smishing' | 'spam'; text: string }[] | null = null;
  let smishSkipped = '';
  try {
    const f = await download(
      SMISH_URL,
      join(dataDir, 'smish.zip'),
      join(dataDir, 'smish'),
      'Dataset_5971.csv',
    );
    const rows = parseCsv(readFileSync(f, 'utf8'));
    const header = rows[0];
    const li = header.indexOf('LABEL'),
      ti = header.indexOf('TEXT');
    const seen = new Set(uci.map((r) => normalise(r.text)));
    let overlap = 0;
    smish = [];
    for (const r of rows.slice(1)) {
      if (r.length <= Math.max(li, ti) || !r[ti]) continue;
      const lab = r[li].toLowerCase();
      if (lab !== 'ham' && lab !== 'smishing' && lab !== 'spam') continue;
      if (seen.has(normalise(r[ti]))) {
        overlap++;
        continue; // Already scored through the UCI collection.
      }
      smish.push({ label: lab, text: r[ti] });
    }
    console.log(`Smishing set: ${smish.length} usable rows, ${overlap} already in UCI skipped.`);
    (globalThis as { __overlap?: number }).__overlap = overlap;
  } catch (e) {
    smishSkipped = `Not used: ${(e as Error).message}`;
    console.log(smishSkipped);
  }

  const want = dev ? 'dev' : 'held';
  const pick = <T extends { text: string }>(rows: T[]) => rows.filter((r) => side(r.text) === want);

  const ucis = pick(uci);
  const ham = score(ucis.filter((r) => r.label === 'ham').map((r) => r.text));
  const spam = score(ucis.filter((r) => r.label === 'spam').map((r) => r.text));

  let extra: null | { ham: Group; smishing: Group; spam: Group } = null;
  if (smish) {
    const s = pick(smish);
    extra = {
      ham: score(s.filter((r) => r.label === 'ham').map((r) => r.text)).group,
      smishing: score(s.filter((r) => r.label === 'smishing').map((r) => r.text)).group,
      spam: score(s.filter((r) => r.label === 'spam').map((r) => r.text)).group,
    };
  }

  // --- Author-written fixtures (never held out; used for tuning) --------------------------------
  const fixtures = JSON.parse(readFileSync(join(root, 'tests/fixtures/messages.json'), 'utf8')) as {
    label: 'scam' | 'genuine';
    text: string;
  }[];
  const synthetic = {
    genuine: score(fixtures.filter((f) => f.label === 'genuine').map((f) => f.text)).group,
    scam: score(fixtures.filter((f) => f.label === 'scam').map((f) => f.text)).group,
  };

  // Written by a separate agent that never saw the rules. Scored once, never used for tuning.
  const independent = JSON.parse(
    readFileSync(join(root, 'tests/fixtures/independent.json'), 'utf8'),
  ) as { label: 'scam' | 'genuine'; text: string }[];
  const blind = {
    genuine: score(independent.filter((f) => f.label === 'genuine').map((f) => f.text)).group,
    scam: score(independent.filter((f) => f.label === 'scam').map((f) => f.text)).group,
  };

  if (dev) {
    console.log('DEVELOPMENT SPLIT (for tuning; nothing is written)\n');
    console.log(
      `ham  n=${ham.group.total}  stop ${pct(ham.group.stop)}  stop|caution ${pct(ham.group.stopOrCaution)}`,
    );
    console.log(
      `spam n=${spam.group.total}  ` +
        LEVELS.map((l) => `${l} ${spam.group[l].count}`).join('  ') +
        `  stop|caution ${pct(spam.group.stopOrCaution)}`,
    );
    if (extra) {
      console.log(
        `smish-set ham n=${extra.ham.total} stop ${pct(extra.ham.stop)} stop|caution ${pct(extra.ham.stopOrCaution)}`,
      );
      console.log(
        `smish-set smishing n=${extra.smishing.total} stop ${pct(extra.smishing.stop)} stop|caution ${pct(extra.smishing.stopOrCaution)}`,
      );
    }
    console.log(
      `fixtures genuine ${pct(synthetic.genuine.stopOrCaution)} flagged; scam ${pct(synthetic.scam.stopOrCaution)} flagged`,
    );
    const show = process.argv.find((a) => a.startsWith('--show='))?.slice(7);
    if (show) {
      const rows = show.startsWith('ham')
        ? ucis.filter((r) => r.label === 'ham')
        : ucis.filter((r) => r.label === 'spam');
      const res = rows.map((r) => ({ r, a: analyze(r.text) }));
      const want2 = show.endsWith('stop') ? ['stop'] : ['stop', 'caution'];
      for (const { r, a } of res)
        if (want2.includes(a.level))
          console.log(
            `[${a.level}] ${a.findings.map((f) => f.id).join(',')} :: ${r.text.slice(0, 150)}`,
          );
    }
    return;
  }

  // --- Held-out: write the report ----------------------------------------------------------
  const engineFiles = [
    ...readdirSync(join(root, 'src/engine')).map((f) => join('src/engine', f)),
    'src/data/brands.ts',
  ].sort();
  const engineHash = createHash('sha256')
    .update(engineFiles.map((f) => readFileSync(join(root, f))).join('\n'))
    .digest('hex');
  const fixtureHash = createHash('sha256')
    .update(readFileSync(join(root, 'tests/fixtures/messages.json')))
    .digest('hex');

  const overlap = (globalThis as { __overlap?: number }).__overlap ?? 0;
  const extraDataset = extra
    ? `A second public labelled set was also scored: the SMS Phishing Dataset for Machine Learning and Pattern Recognition (Mishra and Soni, 2022, Mendeley Data, CC BY 4.0, doi 10.17632/f45bkkt8pr.1). Rows already in the UCI collection (${overlap}) were removed so no message is counted twice. The same hash split was used.`
    : `A second public labelled smishing set was not used. ${smishSkipped}`;

  const out = {
    status: 'complete',
    blind,
    generated: new Date().toISOString(),
    split:
      'SHA-256 of the lower-cased, whitespace-collapsed message; first 32 bits even = development, odd = held-out',
    engineHash,
    fixtureHash,
    primaryDataset:
      'UCI SMS Spam Collection (Almeida and Hidalgo, 2011; UCI Machine Learning Repository, 2012), CC BY 4.0',
    heldOut: { ham: ham.group, spam: spam.group },
    extraHeldOut: extra,
    extraDataset,
    synthetic,
  };
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs/evaluation.json'), JSON.stringify(out, null, 2) + '\n');

  const md = [
    '# Evaluation',
    '',
    `Generated by \`npm run eval\`. Engine hash (SHA-256 of src/engine and src/data/brands.ts): \`${engineHash}\`.`,
    '',
    '## How the numbers were produced',
    '',
    '- Corpus: the UCI SMS Spam Collection (5,574 labelled English text messages, CC BY 4.0), downloaded by the script into the git-ignored `data/` folder.',
    '- Split: a deterministic hash of each message puts roughly half in a development set and half in a held-out set. Identical messages always land on the same side.',
    '- Rules were tuned only on the development half and on our own fixtures, and were then frozen.',
    '- The held-out half has been scored twice. The first run used an earlier, narrower rule set and gave 52 of 160 smishing messages flagged. Those low numbers prompted the broader problem-then-ask rules, tuned on development data only. The tables below are from the second run. Treat them as possibly optimistic, because we knew the first result.',
    '- The blind set was written by a separate AI agent that had no access to the rules. It was scored once and no rule changed afterward.',
    '- Intervals are Wilson 95% intervals.',
    '- Caveats: the collection dates from 2012, and its "spam" label includes ordinary marketing, not only scams. The spam catch rate therefore understates or muddies scam detection. The goal was few false alarms on genuine messages.',
    '',
    '## Blind set: 120 modern messages written without sight of the rules',
    '',
    'Synthetic, not real user data, but written by an author who could not see the rules. It is the closest thing here to how the tool handles wording it has not met.',
    '',
    table('Genuine messages', blind.genuine),
    '',
    table('Scam messages', blind.scam),
    '',
    '## A model we rejected',
    '',
    'We also trained a small on-device word model on the development half. Cross-validated on that half it flagged 82% of spam and smishing with 0.5% false alarms, which looked excellent. On 30 modern genuine messages we wrote ourselves, it raised 9 false alarms, including a plain card receipt, and it caught only 6 of 15 modern scams. The 2012 corpus has almost no business messages among its genuine texts, so the model had learned that a commercial tone means spam. We removed it. Corpus scores alone would have hidden this.',
    '',
    '## Held-out: UCI SMS Spam Collection',
    '',
    table('Genuine messages ("ham")', ham.group),
    '',
    table('Spam', spam.group),
    '',
  ];
  if (extra)
    md.push(
      '## Held-out: SMS Phishing Dataset (Mishra and Soni, CC BY 4.0)',
      '',
      extraDataset,
      '',
      table('Genuine messages ("ham")', extra.ham),
      '',
      table('Smishing', extra.smishing),
      '',
      table('Spam', extra.spam),
      '',
    );
  else md.push('## Second dataset', '', extraDataset, '');
  md.push(
    '## Our synthetic fixtures (written by the authors)',
    '',
    `These ${synthetic.scam.total} scam and ${synthetic.genuine.total} genuine messages were written by the authors, with hard genuine cases, and were used to tune the rules. They show that the rules do what we meant. They are not an independent benchmark. Fixture file hash: \`${fixtureHash}\`.`,
    '',
    table('Synthetic scam messages', synthetic.scam),
    '',
    table('Synthetic genuine messages', synthetic.genuine),
    '',
  );
  writeFileSync(join(root, 'docs/EVALUATION.md'), md.join('\n'));
  console.log('Held-out results written to docs/EVALUATION.md and docs/evaluation.json');
  console.log(`ham stop ${pct(ham.group.stop)}; stop|caution ${pct(ham.group.stopOrCaution)}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
