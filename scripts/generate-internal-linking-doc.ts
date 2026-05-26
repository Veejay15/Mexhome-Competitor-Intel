/**
 * One-off generator for the "Internal Linking Strategy for MexHome" doc.
 *
 * Pulls MexHome's organic keywords from SE Ranking, filters to landing
 * pages currently ranking on Google page 2 (positions 8 to 20), picks the
 * top 10 pages by aggregate traffic, fetches each page's current <title>
 * tag from mexhome.com, and asks Claude to write the recommendations doc
 * in the same format as the existing client doc.
 *
 * Output: reports/internal-linking-{date}.md
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { fetchSitemap, isListingNoise } from '../lib/sitemap';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];
const API_BASE = process.env.SE_RANKING_API_BASE || 'https://api.seranking.com';
const API_KEY = process.env.SE_RANKING_API_KEY || '';
const COUNTRY = process.env.SE_RANKING_COUNTRY || 'us';
const TARGET_DOMAIN = process.env.INTERNAL_LINKING_DOMAIN || 'mexhome.com';

const REQUEST_DELAY_MS = 1200;
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface KeywordRow {
  keyword: string;
  position: number;
  prev_position?: number;
  volume?: number;
  traffic?: number;
  landing_url: string;
}

interface PageBundle {
  url: string;
  pathname: string;
  currentTitle: string | null;
  totalTraffic: number;
  totalVolume: number;
  topKeywords: KeywordRow[];
}

async function callSeRanking(
  pathname: string,
  query: Record<string, string | number>
): Promise<Record<string, unknown>[]> {
  const url = new URL(pathname, API_BASE);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Token ${API_KEY}`, Accept: 'application/json' },
    });
    if (res.status !== 429) break;
    console.warn(`  429 on ${pathname}, backing off ${(attempt + 1) * 5}s...`);
    await sleep((attempt + 1) * 5000);
  }
  if (!res || !res.ok) {
    const body = res ? await res.text() : '(no response)';
    throw new Error(`SE Ranking ${pathname} returned ${res?.status}: ${body.slice(0, 200)}`);
  }
  const json: unknown = await res.json();
  await sleep(REQUEST_DELAY_MS);
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
    if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
  }
  return [];
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '';
}

// Fetch enough keyword data to cover the page-2 range. SE Ranking paginates.
async function fetchPage2Keywords(): Promise<KeywordRow[]> {
  const rows: KeywordRow[] = [];
  for (let page = 1; page <= 5; page++) {
    const result = await callSeRanking('/v1/domain/keywords', {
      source: COUNTRY,
      domain: TARGET_DOMAIN,
      type: 'organic',
      limit: 100,
      page,
      order_field: 'traffic',
      order_type: 'desc',
      position_from: 8,
      position_to: 20,
    });
    if (result.length === 0) break;
    for (const r of result) {
      const keyword = pickString(r, ['keyword', 'phrase', 'query']);
      const position = pickNumber(r, ['position', 'pos', 'current_position']);
      const landing_url = pickString(r, ['url', 'landing_page', 'landing_url', 'page']);
      if (!keyword || position === undefined || !landing_url) continue;
      if (position < 8 || position > 20) continue;
      rows.push({
        keyword,
        position,
        prev_position: pickNumber(r, ['prev_position', 'previous_position']),
        volume: pickNumber(r, ['volume', 'search_volume']),
        traffic: pickNumber(r, ['traffic', 'estimated_traffic']),
        landing_url,
      });
    }
    if (result.length < 100) break;
  }
  console.log(`Pulled ${rows.length} keywords in positions 8-20 from SE Ranking`);
  return rows;
}

function groupByLandingPage(rows: KeywordRow[]): Map<string, KeywordRow[]> {
  const map = new Map<string, KeywordRow[]>();
  for (const r of rows) {
    const list = map.get(r.landing_url) || [];
    list.push(r);
    map.set(r.landing_url, list);
  }
  return map;
}

async function fetchTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

async function fetchMexHomePages(): Promise<string[]> {
  try {
    const entries = await fetchSitemap(`https://${TARGET_DOMAIN}/sitemap.xml`);
    const paths = entries
      .map((e) => e.url)
      .filter((url) => !isListingNoise(url))
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .sort();
    console.log(`Found ${paths.length} content pages on ${TARGET_DOMAIN}`);
    return paths;
  } catch (err) {
    console.warn(`Could not fetch ${TARGET_DOMAIN} sitemap: ${(err as Error).message}`);
    return [];
  }
}

async function buildPageBundles(): Promise<PageBundle[]> {
  const rows = await fetchPage2Keywords();
  if (rows.length === 0) return [];

  const grouped = groupByLandingPage(rows);
  const bundles: PageBundle[] = [];
  for (const [url, list] of grouped) {
    const totalTraffic = list.reduce((s, r) => s + (r.traffic || 0), 0);
    const totalVolume = list.reduce((s, r) => s + (r.volume || 0), 0);
    list.sort((a, b) => (b.traffic || 0) - (a.traffic || 0));
    let pathname = url;
    try {
      pathname = new URL(url).pathname;
    } catch {}
    bundles.push({
      url,
      pathname,
      currentTitle: null,
      totalTraffic,
      totalVolume,
      topKeywords: list.slice(0, 5),
    });
  }
  bundles.sort((a, b) => b.totalTraffic - a.totalTraffic || b.totalVolume - a.totalVolume);
  return bundles.slice(0, 10);
}

async function attachTitles(bundles: PageBundle[]): Promise<void> {
  for (const b of bundles) {
    b.currentTitle = await fetchTitle(b.url);
    console.log(`  ${b.url} → ${b.currentTitle || '(no title found)'}`);
    await sleep(500);
  }
}

async function generateDoc(
  client: Anthropic,
  bundles: PageBundle[],
  sitemapPaths: string[]
): Promise<string> {
  const dataPayload = {
    targetDomain: TARGET_DOMAIN,
    generatedAt: TODAY,
    pages: bundles.map((b, i) => ({
      rank: i + 1,
      url: b.url,
      pathname: b.pathname,
      currentTitle: b.currentTitle,
      totalEstimatedTraffic: b.totalTraffic,
      totalKeywordVolume: b.totalVolume,
      topKeywordsInPage2: b.topKeywords,
    })),
    mexhomeSitemapPaths: sitemapPaths,
  };

  const systemPrompt = `You are an SEO consultant writing a client-facing "Internal Linking Strategy" document for MexHome (mexhome.com), a Mexico real estate platform.

The document recommends, for each top page currently ranking in Google positions 8 to 20, a stronger title tag and a set of internal-linking actions that will push the page into the top 10.

ABSOLUTE GROUNDING RULE:
- Only reference pages that appear in the data payload's "mexhomeSitemapPaths" list. NEVER invent URLs.
- When choosing a page to link FROM, it must be a real path in mexhomeSitemapPaths.
- The page you're recommending links TO is the page being audited in that section.
- Anchor text ideas should be natural-sounding phrases a reader would actually click on, grounded in the keywords that page is ranking for (from topKeywordsInPage2).

Tone: professional, direct, client-facing. No emojis. No em dashes. Match the structure below EXACTLY.

OUTPUT FORMAT:

Title at top: # Internal Linking Strategy for MexHome
Subtitle paragraph: one or two sentences explaining the doc covers the top 10 page-2 ranking pages, with title upgrades and internal-link plans.
Horizontal rule, then "Here are the top 10 positions 8 to 20 pages by traffic, with title upgrades and an internal link plan."

For EACH of the 10 pages, produce this exact block:

{N}. {URL}

Current: {currentTitle or "(no title found)"}
New title: {a stronger SEO title following the pattern "Primary Keyword | Secondary Keyword | Brand" — keep under 60 chars where possible, mention MexHome only if it fits}

Queries to reinforce: {comma-separated list of 2-4 keywords from topKeywordsInPage2 that this title is targeting}

Internal links to add (pointing to {pathname}):
- {source page URL from mexhomeSitemapPaths} (anchor ideas: {2-3 comma-separated natural anchor phrases})
- {another source URL} (anchor ideas: {2-3 anchors})
- {3 to 6 total bullet points, all source URLs MUST be in mexhomeSitemapPaths}

Notes:
- {one specific, actionable on-page recommendation}
- {another specific recommendation, e.g. about FAQs, intro copy, related-searches blocks, H3 structure, removing duplicate links, etc.}
- {2-4 notes total per page, no more}

Horizontal rule between page blocks.

After the 10 pages, add a final section:

## Additional Blogs to Add Internal Links

Brief intro sentence. Then list 3-4 high-traffic blog posts from mexhomeSitemapPaths (paths starting with /blog/) that would benefit from internal links, with the same "Internal links to add" bullet format under each.

CONSTRAINTS:
- Source pages chosen for internal links should be topically relevant to the destination (e.g., a Bucerias page links FROM Riviera Nayarit, Puerto Vallarta, Sayulita pages, NOT from Cabo pages).
- Each source URL in your output must be findable in mexhomeSitemapPaths. If you can't find a good real source, write fewer bullets rather than invent one.
- Anchors must vary across the bullets (don't repeat the exact same anchor twice for the same destination).`;

  const userPrompt = `Generate the Internal Linking Strategy document for ${TARGET_DOMAIN} for ${TODAY}.

DATA:
${JSON.stringify(dataPayload, null, 2)}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in Claude response');
  console.log(
    `Claude tokens: input ${response.usage.input_tokens}, output ${response.usage.output_tokens}`
  );
  return textBlock.text;
}

async function main() {
  if (!API_KEY) {
    console.error('SE_RANKING_API_KEY is not set');
    process.exit(1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  console.log(`Generating internal linking doc for ${TARGET_DOMAIN} (country=${COUNTRY})`);

  const bundles = await buildPageBundles();
  if (bundles.length === 0) {
    console.error('No page-2 keywords returned from SE Ranking. Aborting.');
    process.exit(1);
  }
  console.log(`\nTop ${bundles.length} page-2 landing pages by traffic:`);
  for (const b of bundles) {
    console.log(`  ${b.totalTraffic.toFixed(0)} traffic, ${b.topKeywords.length} kw → ${b.url}`);
  }

  console.log(`\nFetching current titles...`);
  await attachTitles(bundles);

  console.log(`\nFetching MexHome sitemap for internal link source candidates...`);
  const sitemapPaths = await fetchMexHomePages();

  console.log(`\nAsking Claude to write the doc...`);
  const client = new Anthropic({ apiKey });
  const markdown = await generateDoc(client, bundles, sitemapPaths);

  const outDir = path.join(ROOT, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `internal-linking-${TODAY}.md`);
  fs.writeFileSync(outPath, markdown);
  console.log(`\nSaved doc to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
