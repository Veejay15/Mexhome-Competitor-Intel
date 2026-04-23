import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

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

function inferCompetitorFromFilename(name: string): string {
  const base = path.basename(name, '.csv').toLowerCase();
  return base.split(/[-_]/)[0] || 'unknown';
}

function summarizeCsv(filePath: string): CsvSummary {
  const filename = path.basename(filePath);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  return {
    filename,
    competitorId: inferCompetitorFromFilename(filename),
    type: inferTypeFromFilename(filename),
    rowCount: parsed.data.length,
    topRows: parsed.data.slice(0, 25),
  };
}

async function main() {
  const csvDir = path.join(ROOT, 'data', 'csv', TODAY);
  if (!fs.existsSync(csvDir)) {
    console.log(`No CSV folder for ${TODAY}, nothing to process.`);
    process.exit(0);
  }

  const files = fs.readdirSync(csvDir).filter((f) => f.endsWith('.csv'));
  console.log(`Processing ${files.length} CSVs in ${csvDir}\n`);

  const summaries: CsvSummary[] = files.map((f) => {
    const fp = path.join(csvDir, f);
    const s = summarizeCsv(fp);
    console.log(`  ${f}: ${s.rowCount} rows (${s.type}, ${s.competitorId})`);
    return s;
  });

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
