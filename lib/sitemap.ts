import { XMLParser } from 'fast-xml-parser';
import { SitemapEntry } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// Some competitor sites (e.g. mexicolife.com behind istio-envoy) return 403 to
// non-browser User-Agents. Use a current Chrome string with full Accept headers
// to look like a normal browser request.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const BROWSER_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

export async function parseSitemapXml(xml: string): Promise<SitemapEntry[]> {
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
        const childEntries = await parseSitemapXml(childXml);
        entries.push(...childEntries);
      } catch {
        // Skip child sitemap on failure
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

export async function fetchSitemap(sitemapUrl: string): Promise<SitemapEntry[]> {
  const xml = await fetchText(sitemapUrl);
  return parseSitemapXml(xml);
}

const NOISE_PATTERNS = [
  /\/property\//i,
  /\/listing\//i,
  /\/listings?\/[a-z0-9-]+\//i,
  /\/mls-?\d+/i,
  /\/properties\/\d+/i,
  /\?/,
];

export function isListingNoise(url: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(url));
}
