import fs from 'fs';
import path from 'path';
import { CompetitorsData, SitemapDiff, SitemapEntry } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];

function listSnapshotDates(): string[] {
  const dir = path.join(ROOT, 'data', 'sitemaps');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
}

interface LoadedSnapshot {
  entries: SitemapEntry[];
  fetchError?: string;
}

function loadSnapshot(date: string, competitorId: string): LoadedSnapshot | null {
  const p = path.join(ROOT, 'data', 'sitemaps', date, `${competitorId}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return {
    entries: raw.entries || [],
    fetchError: typeof raw.fetchError === 'string' ? raw.fetchError : undefined,
  };
}

const NOISE_PATTERNS = [
  /\/property\//i,
  /\/listing\//i,
  /\/listings?\/[a-z0-9-]+\//i,
  /\/mls-?\d+/i,
  /\/properties\/\d+/i,
  /\?/,
];

function isNoise(url: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(url));
}

function diff(
  competitorId: string,
  prev: SitemapEntry[] | null,
  curr: SitemapEntry[]
): SitemapDiff {
  if (!prev) {
    // First successful snapshot for this competitor. The current URLs are
    // their existing site, NOT pages they built this week. Mark as baseline
    // and emit zero "new" URLs so the report doesn't falsely claim they
    // shipped hundreds of pages.
    const meaningful = curr.filter((e) => !isNoise(e.url));
    return {
      competitorId,
      newUrls: [],
      removedUrls: [],
      updatedUrls: [],
      isBaseline: true,
      totalCurrentUrls: meaningful.length,
    };
  }
  const prevMap = new Map(prev.map((e) => [e.url, e]));
  const currMap = new Map(curr.map((e) => [e.url, e]));

  const newUrls: SitemapEntry[] = [];
  const removedUrls: SitemapEntry[] = [];
  const updatedUrls: SitemapEntry[] = [];

  for (const [url, entry] of currMap) {
    if (isNoise(url)) continue;
    const prevEntry = prevMap.get(url);
    if (!prevEntry) {
      newUrls.push(entry);
    } else if (
      entry.lastmod &&
      prevEntry.lastmod &&
      entry.lastmod !== prevEntry.lastmod
    ) {
      updatedUrls.push(entry);
    }
  }

  for (const [url, entry] of prevMap) {
    if (isNoise(url)) continue;
    if (!currMap.has(url)) {
      removedUrls.push(entry);
    }
  }

  return { competitorId, newUrls, removedUrls, updatedUrls };
}

async function main() {
  const competitorsPath = path.join(ROOT, 'data', 'competitors.json');
  const data: CompetitorsData = JSON.parse(fs.readFileSync(competitorsPath, 'utf-8'));
  const active = data.competitors.filter((c) => c.active);

  const snapshotDates = listSnapshotDates();
  const today = TODAY;
  const previous = snapshotDates.filter((d) => d < today).slice(-1)[0] || null;

  console.log(`Diffing sitemaps. Today: ${today}. Previous: ${previous || 'none'}\n`);

  const diffs: SitemapDiff[] = [];

  for (const c of active) {
    const curr = loadSnapshot(today, c.id);
    if (!curr) {
      console.log(`Skip ${c.name}: no snapshot for today`);
      continue;
    }

    if (curr.fetchError) {
      // Don't compute a diff against an empty snapshot: that would falsely
      // report every previously-known URL as removed. Instead, surface the
      // fetch error so the report can explain why no analysis is available.
      diffs.push({
        competitorId: c.id,
        newUrls: [],
        removedUrls: [],
        updatedUrls: [],
        fetchError: curr.fetchError,
      });
      console.log(`${c.name}: fetch failed (${curr.fetchError})`);
      continue;
    }

    const prev = previous ? loadSnapshot(previous, c.id) : null;
    // If the previous snapshot also failed, there's nothing meaningful to diff
    // against. Treat as first-run: report all current URLs as new.
    const prevEntries = prev && !prev.fetchError ? prev.entries : null;
    const d = diff(c.id, prevEntries, curr.entries);
    diffs.push(d);
    if (d.isBaseline) {
      console.log(
        `${c.name}: baseline snapshot established (${d.totalCurrentUrls} URLs). No "new pages" reported this cycle. Real diffs start next cycle.`
      );
    } else {
      console.log(
        `${c.name}: +${d.newUrls.length} new, -${d.removedUrls.length} removed, ~${d.updatedUrls.length} updated`
      );
    }
  }

  const outDir = path.join(ROOT, 'data', 'diffs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ date: today, previousDate: previous, diffs }, null, 2));
  console.log(`\nSaved diff to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
