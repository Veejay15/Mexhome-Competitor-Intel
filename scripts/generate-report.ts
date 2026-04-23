import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { Competitor, CompetitorsData } from '../lib/types';
import { fetchSitemap, isListingNoise } from '../lib/sitemap';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];

const MEXHOME_SITEMAP_URL = 'https://mexhome.com/sitemap.xml';

interface DiffEntry {
  url: string;
  lastmod?: string;
}
interface CompetitorDiff {
  competitorId: string;
  newUrls: DiffEntry[];
  removedUrls: DiffEntry[];
  updatedUrls: DiffEntry[];
}
interface DiffData {
  date: string;
  previousDate: string | null;
  diffs: CompetitorDiff[];
}

interface CsvSummary {
  filename: string;
  competitorId: string;
  type: string;
  rowCount: number;
  topRows: Record<string, string>[];
}
interface CsvSummariesData {
  date: string;
  summaries: CsvSummary[];
}

function loadDiffs(): DiffData | null {
  const p = path.join(ROOT, 'data', 'diffs', `${TODAY}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadCsvSummaries(): CsvSummariesData | null {
  const p = path.join(ROOT, 'data', 'csv-summaries', `${TODAY}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadCompetitors(): Competitor[] {
  const p = path.join(ROOT, 'data', 'competitors.json');
  const data: CompetitorsData = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return data.competitors.filter((c) => c.active);
}

async function fetchMexHomePages(): Promise<string[]> {
  try {
    console.log(`Fetching MexHome's own sitemap for cross-reference...`);
    const entries = await fetchSitemap(MEXHOME_SITEMAP_URL);
    const paths = entries
      .map((e) => e.url)
      .filter((url) => !isListingNoise(url))
      .map((url) => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .sort();
    console.log(`  Found ${paths.length} content pages on mexhome.com`);
    return paths;
  } catch (err) {
    console.warn(`  Could not fetch MexHome sitemap: ${(err as Error).message}`);
    return [];
  }
}

async function generateForCompetitor(
  client: Anthropic,
  competitor: Competitor,
  diff: CompetitorDiff | null,
  csvs: CsvSummary[],
  mexhomePages: string[],
  previousDate: string | null
): Promise<{ markdown: string; inputTokens: number; outputTokens: number }> {
  const dataPayload = {
    date: TODAY,
    previousDate,
    competitor: {
      id: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
    },
    mexhomeExistingPages: mexhomePages,
    sitemapDiff: diff || { newUrls: [], removedUrls: [], updatedUrls: [] },
    csvData: csvs,
  };

  const systemPrompt = `You are a senior SEO analyst preparing a focused weekly competitor intelligence report for MexHome, a Mexico real estate platform.

This report covers ONE competitor: ${competitor.name} (${competitor.domain}).

Tone: confident, direct, no fluff. No emojis. No em dashes (use periods, commas, parentheses, or "and/but" instead).

Structure:
1. Executive Summary (2 to 4 bullet points, what this competitor did this week and what to do about it)
2. New Pages Built by ${competitor.name} (list URLs and infer what they're targeting based on URL slugs)
3. Backlink Movements (only if CSV data is provided for this competitor)
4. Keyword and Ranking Changes (only if CSV data is provided for this competitor)
5. Recommended Actions for MexHome (numbered list, specific moves to make this week in response to ${competitor.name}'s activity)

CRITICAL RULE FOR RECOMMENDATIONS:
Before recommending that MexHome build any new page (destination page, location page, property-type page, guide, etc.), you MUST cross-reference the "mexhomeExistingPages" list in the data payload. That list contains every content URL path that currently exists on mexhome.com.

- If MexHome ALREADY has an equivalent page, do NOT recommend building it. Instead, you may recommend updating, expanding, or strengthening that existing page (and reference the existing URL).
- If MexHome does NOT have an equivalent page, you may recommend building it as a genuine content gap.
- When in doubt, search the list for keywords (e.g., "bucerias", "condos-for-sale") to check before suggesting a new build.
- Acceptable equivalence checks: URL path contains the location name AND the property type or intent. Slight wording differences are fine (e.g., "condos-for-sale" vs "condos").

Skip sections where there is no data. Do not invent data. Never recommend a page MexHome already has. Keep this report focused and specific to ${competitor.name} only, do not discuss other competitors.`;

  const userPrompt = `Here is this week's data for ${competitor.name} for the report dated ${TODAY}.

${diff ? '' : '(No sitemap diff available for this competitor this week.)'}
${csvs.length === 0 ? '(No SEMrush CSV data uploaded for this competitor this week.)' : ''}
${mexhomePages.length === 0 ? '(Warning: could not fetch MexHome existing pages this run. Be extra careful recommending new pages.)' : `(MexHome's existing ${mexhomePages.length} content pages are listed in "mexhomeExistingPages" for cross-reference.)`}

DATA:
${JSON.stringify(dataPayload, null, 2)}

Write the full report in markdown. Start with a top-level H1 like "# ${competitor.name}: Week of ${TODAY}".`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in Claude response');
  }
  return {
    markdown: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  const competitors = loadCompetitors();
  if (competitors.length === 0) {
    console.log('No active competitors. Skipping report generation.');
    process.exit(0);
  }

  const diffs = loadDiffs();
  const csvSummaries = loadCsvSummaries();
  const mexhomePages = await fetchMexHomePages();

  if (!diffs && !csvSummaries) {
    console.log('No data to report on. Run fetch-sitemaps and process-csvs first.');
    process.exit(0);
  }

  const client = new Anthropic({ apiKey });
  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  let totalInput = 0;
  let totalOutput = 0;
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const competitor of competitors) {
    console.log(`\nGenerating report for ${competitor.name}...`);
    const diff = diffs?.diffs.find((d) => d.competitorId === competitor.id) || null;
    const csvs = csvSummaries?.summaries.filter((s) => s.competitorId === competitor.id) || [];

    try {
      const result = await generateForCompetitor(
        client,
        competitor,
        diff,
        csvs,
        mexhomePages,
        diffs?.previousDate || null
      );
      const filename = `${TODAY}-${competitor.id}.md`;
      const outPath = path.join(reportsDir, filename);
      fs.writeFileSync(outPath, result.markdown);
      console.log(`  ✓ Saved ${outPath}`);
      console.log(`    Tokens: input ${result.inputTokens}, output ${result.outputTokens}`);
      totalInput += result.inputTokens;
      totalOutput += result.outputTokens;
      succeeded.push(competitor.name);
    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}`);
      failed.push(competitor.name);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Succeeded: ${succeeded.length} (${succeeded.join(', ') || 'none'})`);
  console.log(`Failed: ${failed.length} (${failed.join(', ') || 'none'})`);
  console.log(`Total tokens: input ${totalInput}, output ${totalOutput}`);

  if (succeeded.length === 0) {
    console.error('All competitor reports failed.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
