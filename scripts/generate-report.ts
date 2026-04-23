import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { CompetitorsData } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];

interface DiffData {
  date: string;
  previousDate: string | null;
  diffs: Array<{
    competitorId: string;
    newUrls: Array<{ url: string; lastmod?: string }>;
    removedUrls: Array<{ url: string; lastmod?: string }>;
    updatedUrls: Array<{ url: string; lastmod?: string }>;
  }>;
}

interface CsvSummariesData {
  date: string;
  summaries: Array<{
    filename: string;
    competitorId: string;
    type: string;
    rowCount: number;
    topRows: Record<string, string>[];
  }>;
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

function loadCompetitors() {
  const p = path.join(ROOT, 'data', 'competitors.json');
  const data: CompetitorsData = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return data.competitors;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  const competitors = loadCompetitors();
  const diffs = loadDiffs();
  const csvSummaries = loadCsvSummaries();

  if (!diffs && !csvSummaries) {
    console.log('No data to report on. Run fetch-sitemaps and process-csvs first.');
    process.exit(0);
  }

  const dataPayload = {
    date: TODAY,
    previousDate: diffs?.previousDate || null,
    competitors: competitors.map((c) => ({ id: c.id, name: c.name, domain: c.domain })),
    sitemapDiffs: diffs?.diffs || [],
    csvSummaries: csvSummaries?.summaries || [],
  };

  const systemPrompt = `You are a senior SEO analyst preparing the weekly competitor intelligence report for MexHome, a Mexico real estate platform.

Your job is to look at competitor sitemap changes and SEMrush data, then write a tight, actionable report that helps the MexHome team make decisions this week.

Tone: confident, direct, no fluff. No emojis. No em dashes (use periods, commas, parentheses, or "and/but" instead).

Structure the report with these sections:
1. Executive Summary (3 to 5 bullet points, what changed and what to do about it)
2. New Pages Built by Competitors (per competitor, with URLs and what they're targeting)
3. Backlink Movements (if CSV data is provided, summarize new high-quality links)
4. Keyword and Ranking Changes (if CSV data is provided)
5. Recommended Actions (numbered list, specific moves MexHome should make this week)

When discussing new pages, infer what topic or keyword the competitor is likely targeting based on the URL slug. Flag any geographic or content gaps where MexHome doesn't have an equivalent page.

Skip sections where there is no data. Do not invent data.`;

  const userPrompt = `Here is this week's data for the report dated ${TODAY}.

${diffs ? '' : '(No sitemap diffs available this week.)'}
${csvSummaries ? '' : '(No SEMrush CSV uploads this week.)'}

DATA:
${JSON.stringify(dataPayload, null, 2)}

Write the full report in markdown. Start with a top-level H1 like "# MexHome Competitor Intelligence: Week of ${TODAY}".`;

  console.log(`Generating report with Claude for ${TODAY}...`);

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in Claude response');
  }
  const reportMarkdown = textBlock.text;

  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, `${TODAY}.md`);
  fs.writeFileSync(outPath, reportMarkdown);

  console.log(`\nReport saved to ${outPath}`);
  console.log(`Tokens used: input ${response.usage.input_tokens}, output ${response.usage.output_tokens}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
