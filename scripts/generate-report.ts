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
  fetchError?: string;
  isBaseline?: boolean;
  totalCurrentUrls?: number;
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

// Generates sections 1-4 for a single competitor. Recommendations are handled
// separately in generateCombinedRecommendations() after all competitors run.
async function generateForCompetitor(
  client: Anthropic,
  competitor: Competitor,
  diff: CompetitorDiff | null,
  csvs: CsvSummary[],
  previousDate: string | null
): Promise<{ markdown: string; inputTokens: number; outputTokens: number }> {
  const sitemapFetchError = diff?.fetchError;
  const isBaseline = !!diff?.isBaseline;
  const dataPayload = {
    date: TODAY,
    previousDate,
    competitor: {
      id: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
    },
    sitemapDiff: diff || { newUrls: [], removedUrls: [], updatedUrls: [] },
    sitemapFetchStatus: sitemapFetchError
      ? { ok: false, error: sitemapFetchError }
      : diff
      ? { ok: true, isBaseline, totalCurrentUrls: diff.totalCurrentUrls }
      : { ok: false, error: 'No sitemap snapshot was produced this week.' },
    csvData: csvs,
  };

  const systemPrompt = `You are a senior SEO analyst preparing a focused weekly competitor intelligence report for MexHome, a Mexico real estate platform.

This report covers ONE competitor: ${competitor.name} (${competitor.domain}).

Tone: confident, direct, no fluff. No emojis. No em dashes (use periods, commas, parentheses, or "and/but" instead).

ABSOLUTE GROUNDING RULE (read first):
You may ONLY use facts that appear in the DATA payload. You must NOT invent URLs, ranking positions, backlink domains, traffic numbers, or page slugs. If the data payload doesn't contain the information for a section, you write a one-line note that the data is unavailable, and you do not fabricate. Specifically:
- If sitemapDiff.newUrls is empty, you DO NOT list any URLs as new pages — not even ones you happen to know exist on the site.
- If csvData is empty or missing for a section, you DO NOT cite any specific keywords, positions, traffic figures, or backlink domains. You write "No SEMrush CSV data uploaded for this competitor this week. <Section name> analysis is not available." and stop.
- Hallucinating data in any section is a critical failure of this report.

Structure:
1. Executive Summary (2 to 4 bullet points, ONLY about what's actually in the data this week)
2. New Pages Built by ${competitor.name}
   - If sitemapDiff.newUrls has entries, list them with inferred targeting based on URL slug.
   - If sitemapDiff.newUrls is empty AND sitemapFetchStatus.isBaseline is true, write a single short paragraph stating this is the first successful sitemap capture (cite sitemapFetchStatus.totalCurrentUrls), real week-over-week diffs start next cycle. DO NOT list any URLs.
   - If sitemapDiff.newUrls is empty AND sitemapFetchStatus.ok is false, write that the sitemap could not be retrieved (cite the error). DO NOT list any URLs.
   - If sitemapDiff.newUrls is empty AND none of the above, write that no new pages were detected this week.
3. Backlink Movements
   - If csvData has a backlinks-type entry for this competitor, output MUST be a markdown table (not bullets). The table MUST have these columns in this exact order: | Source Domain | Source URL | Anchor Text | Domain Authority | Followed | New/Lost |. One row per backlink, up to 15 rows max. Below the table you may add 2-3 sentences of interpretation, no more. Group "New" rows first, then "Lost". If a field is missing in the data, write "—" in the cell. DO NOT use bullet points for the per-link data.
   - DOMAIN AUTHORITY FILTER: Only include rows where Domain Authority (DA) is 30 or higher. Skip every row where DA is below 30, zero, or missing. If no rows pass the DA 30+ threshold, write "No high-authority backlink movements this week (all links were below DA 30)." and do not create a table.
   - DIRECTORY OPPORTUNITY: If a competitor gained a link from a DA 30+ directory or industry listing site, add a sentence below the table flagging it as a potential listing opportunity for MexHome.
   - If csvData has no backlinks-type entry: "No backlink data available for this competitor this week." Do not write anything else for this section. DO NOT invent backlink domains.
4. Keyword and Ranking Changes
   - If csvData has a positions or keywords entry for this competitor, produce two separate tables under bold subheadings **Notable ranking gains** and **Notable ranking declines**. Each table MUST have these columns in this exact order: | Keyword | Previous Position | Current Position | Change | Search Volume | Landing Page |. One row per keyword, up to 12 rows per table. Compute "Change" as (current minus previous) with a + or - sign; for new entries write "new" and for lost entries write "lost". If the landing page is a full URL, keep the pathname only. If a field is missing, write "—". Below each table you may add 2-3 sentences of interpretation, no more. DO NOT use bullets for keyword data.
   - KEYWORD FILTER: Only include keywords that mention a specific Mexico location (e.g. Puerto Vallarta, Bucerias, Los Cabos, Playa del Carmen, Tulum, Sayulita, Punta Mita, Nuevo Vallarta, Riviera Maya, Cabo, Cancun, Mazatlan, San Miguel de Allende, Merida, Oaxaca) OR a specific real estate service or property type (e.g. condos for sale, beachfront homes, vacation rental, luxury villas, investment property, oceanfront, expat homes, Mexico real estate). Remove any keyword that is generic, informational, or brand-agnostic and does not reference a location or named service. If no keywords pass this filter, write "No location- or service-specific keyword movements this week." and do not create a table.
   - EMPTY TABLE RULE: If there are no qualifying gains, do NOT create an empty table. Write "No notable ranking gains this week." Same rule for declines.
   - You may include a short Overview paragraph above the tables (1-2 lines) citing totals if the numbers appear in the data. Do not invent them.
   - If csvData has neither positions nor keywords entries: "No keyword and ranking data available for this competitor this week." Do not write anything else. DO NOT invent keywords or positions.

Do NOT include a Section 5 or any recommendations. Recommended actions are generated separately after all competitors are analyzed.

Skip sections where there is no data. Do not invent data. Keep this report focused and specific to ${competitor.name} only, do not discuss other competitors.

CRITICAL RULE FOR SITEMAP FETCH FAILURES:
The "sitemapFetchStatus" field tells you whether we were actually able to read ${competitor.name}'s sitemap this week.
- If sitemapFetchStatus.ok is false, you MUST NOT write "no new pages were detected" or any phrasing that implies we looked and found nothing. Instead, in the "New Pages Built" section, state plainly that the sitemap could not be retrieved this week (include the error from sitemapFetchStatus.error in plain English) and that new-page detection is unavailable for this competitor until the fetch issue is resolved. Mention this in the Executive Summary too.
- If sitemapFetchStatus.ok is true and the diff arrays are empty, then it is correct to say no new pages were detected.

CRITICAL RULE FOR BASELINE WEEKS:
If sitemapFetchStatus.ok is true AND sitemapFetchStatus.isBaseline is true, this is the FIRST successful sitemap snapshot for this competitor. There is no prior week to compare against. The "newUrls" array will be empty by design.
- You MUST NOT list, summarize, or describe any of the URLs from sitemapDiff.totalCurrentUrls as "new pages built this week" or "pages they shipped this week". Those are existing site URLs, not new construction.
- In the "New Pages Built" section, state that this is the first successful sitemap capture for this competitor (mention the URL count from sitemapFetchStatus.totalCurrentUrls as their current site footprint), that real week-over-week new-page detection starts from the next cycle, and DO NOT enumerate URLs in this section.
- The Executive Summary should reflect that this is a baseline week with no week-over-week page-build signal yet.`;

  const userPrompt = `Here is this week's data for ${competitor.name} for the report dated ${TODAY}.

${sitemapFetchError ? `(Sitemap fetch FAILED for this competitor this week: ${sitemapFetchError}. Do not claim "no changes" — say the fetch failed.)` : isBaseline ? `(BASELINE WEEK for this competitor: first successful sitemap capture. Their site has ${diff?.totalCurrentUrls} URLs total. Do NOT list these as "new pages built this week". Real diffs start next cycle.)` : diff ? '' : '(No sitemap diff available for this competitor this week.)'}
${csvs.length === 0 ? '(No SEMrush CSV data uploaded for this competitor this week.)' : ''}

DATA:
${JSON.stringify(dataPayload, null, 2)}

Write sections 1-4 only in markdown. Start with a top-level H1 like "# ${competitor.name}: Week of ${TODAY}". Do not include a Section 5 or any recommended actions.`;

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

// After all per-competitor reports are generated, this produces a single
// combined recommendations section (top 3-4 actions) appended to every report.
async function generateCombinedRecommendations(
  client: Anthropic,
  competitorReports: { competitor: Competitor; markdown: string }[],
  mexhomePages: string[]
): Promise<{ markdown: string; inputTokens: number; outputTokens: number }> {
  const competitorCount = competitorReports.length;

  const systemPrompt = `You are a senior SEO analyst advising the marketing team at MexHome, a Mexico real estate platform. You have just reviewed ${competitorCount} competitor(s) this week. Your job is to select the top 3 to 4 highest-impact content actions MexHome should take, drawn from the combined activity across ALL competitors reviewed.

VOICE AND AUDIENCE RULES
Plain English. No jargon. No data references. Tone: confident, direct, no fluff. No emojis. No em dashes.

OUTPUT FORMAT
- Start with this exact note on its own line in italics:
  "*These are combined recommended actions based on a review of all ${competitorCount} competitor(s) monitored this week.*"
- Then output exactly 3 to 4 numbered recommendations.
- Each recommendation must follow this format:
  "[Action]. Trigger: [which competitor did what]. Why this fits MexHome: [the market or property segment this builds on]."
- For a NEW page recommendation: state the proposed URL slug and confirm the topic does not already exist on MexHome's site.
- For an UPDATE recommendation: cite the existing MexHome page path.

SELECTION CRITERIA - rank and keep only the actions that are:
1. Highest signal (multiple competitors pointing to the same gap, or one unusually significant move)
2. Most immediately actionable (MexHome can build or update this now)
3. Most aligned with MexHome's actual Mexico markets and property segments:
   - Destination markets: Puerto Vallarta, Bucerias, Sayulita, Punta Mita, Nuevo Vallarta, Los Cabos, Cabo San Lucas, Playa del Carmen, Tulum, Cancun, Riviera Maya, Mazatlan, San Miguel de Allende, Merida, Oaxaca
   - Property types: condos for sale, beachfront homes, luxury villas, vacation rentals, investment properties, oceanfront, expat homes
   - Buyer segments: expats, vacation home buyers, real estate investors, retirees relocating to Mexico

MARKET RELEVANCE: Only draw recommendations from competitor activity that overlaps with MexHome's actual Mexico markets. If a competitor made a move targeting a market or audience that MexHome does not serve, skip it. Every recommendation must link to something a competitor did this week in a location or property segment where MexHome operates.

DO NOT recommend pages MexHome already has. MexHome's existing pages are provided below.
DO NOT pad with generic SEO advice. Every recommendation must link to something a competitor did this week.
A focused list of 3 actions beats a padded list of 6. If only 2 actions are genuinely justified, output 2.

Do not include an H1, H2, or section title in your output. Start directly with the italics note.`;

  const competitorSummaries = competitorReports
    .map((r, i) => `--- COMPETITOR ${i + 1}: ${r.competitor.name} (${r.competitor.domain}) ---\n${r.markdown}`)
    .join('\n\n');

  const userPrompt = `Date: ${TODAY}

MexHome's existing ${mexhomePages.length} content pages (cross-reference — do not recommend pages already covered):
${JSON.stringify(mexhomePages)}

COMPETITOR ANALYSES THIS WEEK:
${competitorSummaries}

Output the combined recommended actions now.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in Claude response for combined recommendations');
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
  const succeededReports: { filePath: string; competitor: Competitor; markdown: string }[] = [];

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
      succeededReports.push({ filePath: outPath, competitor, markdown: result.markdown });
    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}`);
      failed.push(competitor.name);
    }
  }

  // Generate one combined recommendations section across all competitors and
  // append it to every report so the client sees a single prioritised list.
  if (succeededReports.length > 0) {
    console.log(`\nGenerating combined recommended actions (${succeededReports.length} competitor(s))...`);
    try {
      const combined = await generateCombinedRecommendations(
        client,
        succeededReports.map((r) => ({ competitor: r.competitor, markdown: r.markdown })),
        mexhomePages
      );
      const combinedSection = `\n\n---\n\n## 5. Recommended Actions for MexHome\n\n${combined.markdown}`;
      for (const report of succeededReports) {
        fs.appendFileSync(report.filePath, combinedSection);
      }
      totalInput += combined.inputTokens;
      totalOutput += combined.outputTokens;
      console.log(`  ✓ Combined recommendations appended to ${succeededReports.length} report(s)`);
      console.log(`    Tokens: input ${combined.inputTokens}, output ${combined.outputTokens}`);
    } catch (err) {
      console.error(`  ✗ Combined recommendations failed: ${(err as Error).message}`);
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
