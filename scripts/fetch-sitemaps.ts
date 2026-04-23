import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { Competitor, CompetitorsData, SitemapEntry } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];
const OUT_DIR = path.join(ROOT, 'data', 'sitemaps', TODAY);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'MexHome-CompetitorIntel/1.0 (+https://mexhome.com)',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

async function parseSitemap(xml: string, baseUrl: string): Promise<SitemapEntry[]> {
  const parsed = parser.parse(xml);
  const entries: SitemapEntry[] = [];

  if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
    const children = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];

    for (const child of children) {
      const childUrl = child.loc;
      if (!childUrl) continue;
      try {
        const childXml = await fetchText(childUrl);
        const childEntries = await parseSitemap(childXml, baseUrl);
        entries.push(...childEntries);
      } catch (err) {
        console.warn(`  Skipped child sitemap ${childUrl}: ${(err as Error).message}`);
      }
    }
    return entries;
  }

  if (parsed.urlset && parsed.urlset.url) {
    const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    for (const u of urls) {
      if (u.loc) {
        entries.push({
          url: typeof u.loc === 'string' ? u.loc : String(u.loc),
          lastmod: u.lastmod ? String(u.lastmod) : undefined,
        });
      }
    }
  }

  return entries;
}

async function fetchCompetitor(c: Competitor): Promise<void> {
  console.log(`Fetching ${c.name} (${c.sitemapUrl})`);
  try {
    const xml = await fetchText(c.sitemapUrl);
    const entries = await parseSitemap(xml, c.sitemapUrl);
    const outPath = path.join(OUT_DIR, `${c.id}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          competitorId: c.id,
          fetchedAt: new Date().toISOString(),
          sourceUrl: c.sitemapUrl,
          entryCount: entries.length,
          entries,
        },
        null,
        2
      )
    );
    console.log(`  ✓ ${entries.length} URLs saved to ${outPath}`);
  } catch (err) {
    console.error(`  ✗ Failed: ${(err as Error).message}`);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const competitorsPath = path.join(ROOT, 'data', 'competitors.json');
  const data: CompetitorsData = JSON.parse(fs.readFileSync(competitorsPath, 'utf-8'));
  const active = data.competitors.filter((c) => c.active);

  console.log(`Fetching ${active.length} active competitor sitemaps for ${TODAY}\n`);

  for (const c of active) {
    await fetchCompetitor(c);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
