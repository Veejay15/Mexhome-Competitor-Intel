import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { Competitor, CompetitorsData } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];

interface CsvSummary {
  filename: string;
  competitorId: string;
  type: string;
  rowCount: number;
  topRows: Record<string, string>[];
}

function inferTypeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('backlink')) return 'backlinks';
  if (lower.includes('position') || lower.includes('rankings')) return 'positions';
  if (lower.includes('keyword')) return 'keywords';
  if (lower.includes('pages')) return 'pages';
  return 'unknown';
}

function inferCompetitorFromFilename(filename: string, competitors: Competitor[]): string {
  const base = path.basename(filename, '.csv').toLowerCase();

  // Try matching by full competitor ID, full domain, or domain-without-TLD.
  // Pick the longest match (so "diamanterealtors-com" beats "diamanterealtors").
  let bestMatch = '';
  let bestMatchLength = 0;

  for (const c of competitors) {
    const candidates: string[] = [c.id.toLowerCase()];

    const cleanDomain = c.domain
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '')
      .toLowerCase();
    candidates.push(cleanDomain);

    // Also include a dashed version of the domain for filenames like
    // "diamanterealtors-com-backlinks.csv"
    candidates.push(cleanDomain.replace(/[^a-z0-9]+/g, '-'));

    // And the domain without TLD as a fallback ("diamanterealtors")
    const domainNoTld = cleanDomain.replace(/\.[a-z]{2,}$/i, '');
    if (domainNoTld.length >= 5) candidates.push(domainNoTld);

    for (const candidate of candidates) {
      if (candidate.length === 0) continue;
      if (base.includes(candidate) && candidate.length > bestMatchLength) {
        bestMatch = c.id;
        bestMatchLength = candidate.length;
      }
    }
  }

  return bestMatch || 'unknown';
}

function summarizeCsv(filePath: string, competitors: Competitor[]): CsvSummary {
  const filename = path.basename(filePath);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  return {
    filename,
    competitorId: inferCompetitorFromFilename(filename, competitors),
    type: inferTypeFromFilename(filename),
    rowCount: parsed.data.length,
    topRows: parsed.data.slice(0, 25),
  };
}

function loadCompetitors(): Competitor[] {
  const p = path.join(ROOT, 'data', 'competitors.json');
  if (!fs.existsSync(p)) return [];
  const data: CompetitorsData = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return data.competitors || [];
}

async function main() {
  const csvDir = path.join(ROOT, 'data', 'csv', TODAY);
  if (!fs.existsSync(csvDir)) {
    console.log(`No CSV folder for ${TODAY}, nothing to process.`);
    process.exit(0);
  }

  const competitors = loadCompetitors();
  const files = fs.readdirSync(csvDir).filter((f) => f.endsWith('.csv'));
  console.log(`Processing ${files.length} CSVs in ${csvDir}\n`);

  const summaries: CsvSummary[] = files.map((f) => {
    const fp = path.join(csvDir, f);
    const s = summarizeCsv(fp, competitors);
    console.log(`  ${f}: ${s.rowCount} rows (type=${s.type}, competitor=${s.competitorId})`);
    return s;
  });

  // Warn about any CSVs that didn't match a competitor
  const unmatched = summaries.filter((s) => s.competitorId === 'unknown');
  if (unmatched.length > 0) {
    console.warn(`\nWarning: ${unmatched.length} CSV(s) could not be matched to any competitor:`);
    for (const u of unmatched) {
      console.warn(`  - ${u.filename}`);
    }
    console.warn(`Tracked competitor IDs:`);
    for (const c of competitors) {
      console.warn(`  - ${c.id} (${c.domain})`);
    }
  }

  const outDir = path.join(ROOT, 'data', 'csv-summaries');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${TODAY}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ date: TODAY, summaries }, null, 2));
  console.log(`\nSaved CSV summaries to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
