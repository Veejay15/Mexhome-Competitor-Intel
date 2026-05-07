import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Sitemap fetch proxy. GitHub Actions runners (Azure datacenter IPs) are
// blocked with 403 by some competitor sites (mexicolife.com behind
// istio-envoy). Vercel functions run from a different IP range and are
// usually accepted. The GitHub Actions script falls back to this endpoint
// when a direct fetch returns 403.
//
// Auth: shared secret in the SITEMAP_PROXY_TOKEN env var. The same value
// must be set as a GitHub Actions secret of the same name so the workflow
// can include it as a Bearer token.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  Accept: 'application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

export async function GET(req: NextRequest) {
  const expected = process.env.SITEMAP_PROXY_TOKEN;
  if (!expected) {
    // Diagnostic: list which SITEMAP-prefixed keys ARE in process.env so we
    // can tell whether Vercel is injecting any env vars at all on this build.
    const seen = Object.keys(process.env)
      .filter((k) => k.startsWith('SITEMAP') || k.startsWith('NEXT_'))
      .sort();
    return NextResponse.json(
      {
        error: 'SITEMAP_PROXY_TOKEN is not configured on the server.',
        diagnostic: { sitemapPrefixedKeys: seen, totalEnvKeys: Object.keys(process.env).length },
      },
      { status: 500 }
    );
  }

  const auth = req.headers.get('authorization') || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const target = req.nextUrl.searchParams.get('url');
  if (!target) {
    return NextResponse.json({ error: 'url query param is required' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: `Invalid url: ${target}` }, { status: 400 });
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json(
      { error: `Only http/https URLs are allowed (got ${parsed.protocol})` },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(target, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/xml',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Upstream fetch failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
