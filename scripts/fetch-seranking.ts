import fs from 'fs';
import path from 'path';
import { Competitor, CompetitorsData } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];
const API_BASE = process.env.SE_RANKING_API_BASE || 'https://api4.seranking.com';
const API_KEY = process.env.SE_RANKING_API_KEY || '';
const COUNTRY = process.env.SE_RANKING_COUNTRY || 'us';

// Output is identical in shape to what scripts/process-csvs.ts produces, so
// scripts/generate-report.ts can consume it without any changes.
interface CsvSummary {
  filename: string;
  competitorId: string;
  type: 'backlinks' | 'positions' | 'keywords' | 'overview' | 'unknown';
  rowCount: number;
  topRows: Record<string, string>[];
}

// SE Ranking's Research-Hub endpoints expect the bare domain (no protocol,
// no path, no www).
function normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

interface FetchOpts {
  competitor: Competitor;
  pathname: string;
  query: Record<string, string | number>;
  type: CsvSummary['type'];
}

async function callSeRanking({
  competitor,
  pathname,
  query,
  type,
}: FetchOpts): Promise<CsvSummary | null> {
  const url = new URL(pathname, API_BASE);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${API_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(
      `  [${type}] ${competitor.name}: HTTP ${res.status} from ${url.pathname} — ${body.slice(0, 200)}`
    );
    return null;
  }

  const json: unknown = await res.json();

  // SE Ranking responses vary by endpoint. Some return arrays, some return
  // { data: [...] }, some return { results: [...] }. Normalize to an array
  // of plain objects.
  const rows = extractRows(json);
  if (rows.length === 0) {
    console.log(`  [${type}] ${competitor.name}: 0 rows (empty response)`);
    return null;
  }

  console.log(`  [${type}] ${competitor.name}: ${rows.length} rows`);
  return {
    filename: `seranking-${type}-${normalizeDomain(competitor.domain)}.json`,
    competitorId: competitor.id,
    type,
    rowCount: rows.length,
    topRows: rows.slice(0, 25).map(coerceStringValues),
  };
}

function extractRows(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
    if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
    // Some endpoints (e.g. domain overview) return a single object.
    return [obj];
  }
  return [];
}

function coerceStringValues(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}

async function fetchCompetitor(competitor: Competitor): Promise<CsvSummary[]> {
  const domain = normalizeDomain(competitor.domain);
  console.log(`\nFetching SE Ranking data for ${competitor.name} (${domain})`);

  const results: CsvSummary[] = [];

  // Backlinks — new links in the last week.
  // SE Ranking Backlink API endpoints commonly used for competitor research.
  const backlinks = await callSeRanking({
    competitor,
    pathname: '/research/backlinks/new/',
    query: { domain, mode: 'domain', limit: 100 },
    type: 'backlinks',
  });
  if (backlinks) results.push(backlinks);

  // Keyword position changes (movers) over the last week.
  const positionChanges = await callSeRanking({
    competitor,
    pathname: `/research/${COUNTRY}/keywords/changes/`,
    query: { domain, period: 'week', limit: 100 },
    type: 'positions',
  });
  if (positionChanges) results.push(positionChanges);

  // Top organic keywords currently ranked.
  const topKeywords = await callSeRanking({
    competitor,
    pathname: `/research/${COUNTRY}/keywords/`,
    query: { domain, limit: 100, sort: 'traffic', order: 'desc' },
    type: 'keywords',
  });
  if (topKeywords) results.push(topKeywords);

  // Domain overview (DA, traffic estimate, ref domain count).
  const overview = await callSeRanking({
    competitor,
    pathname: `/research/${COUNTRY}/overview/`,
    query: { domain },
    type: 'overview',
  });
  if (overview) results.push(overview);

  return results;
}

async function main() {
  if (!API_KEY) {
    console.error('SE_RANKING_API_KEY is not set. Skipping SE Ranking fetch.');
    process.exit(0);
  }

  const competitorsPath = path.join(ROOT, 'data', 'competitors.json');
  if (!fs.existsSync(competitorsPath)) {
    console.log('No competitors.json found. Skipping SE Ranking fetch.');
    process.exit(0);
  }
  const data: CompetitorsData = JSON.parse(fs.readFileSync(competitorsPath, 'utf-8'));
  const active = data.competitors.filter((c) => c.active);
  if (active.length === 0) {
    console.log('No active competitors. Skipping SE Ranking fetch.');
    process.exit(0);
  }

  console.log(`Fetching SE Ranking data for ${active.length} competitor(s) for ${TODAY}`);
  console.log(`API base: ${API_BASE}, country: ${COUNTRY}`);

  const allSummaries: CsvSummary[] = [];
  for (const c of active) {
    try {
      const summaries = await fetchCompetitor(c);
      allSummaries.push(...summaries);
    } catch (err) {
      console.error(`  Failed for ${c.name}: ${(err as Error).message}`);
    }
  }

  if (allSummaries.length === 0) {
    console.log('\nNo SE Ranking data fetched for any competitor.');
    process.exit(0);
  }

  // Merge with any existing CSV summaries from manual uploads. The CSV pipeline
  // can still run alongside this if the user wants to upload raw exports.
  const outDir = path.join(ROOT, 'data', 'csv-summaries');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${TODAY}.json`);

  let combined: CsvSummary[] = allSummaries;
  if (fs.existsSync(outPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf-8')) as {
        summaries?: CsvSummary[];
      };
      if (Array.isArray(existing.summaries)) {
        // Dedup by filename: SE Ranking writes deterministic filenames, manual
        // uploads have their own filenames, so this won't collide.
        const seen = new Set(allSummaries.map((s) => s.filename));
        for (const s of existing.summaries) {
          if (!seen.has(s.filename)) {
            combined.push(s);
            seen.add(s.filename);
          }
        }
      }
    } catch (err) {
      console.warn(`Could not read existing summaries: ${(err as Error).message}`);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify({ date: TODAY, summaries: combined }, null, 2));
  console.log(`\nSaved ${combined.length} summaries to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
