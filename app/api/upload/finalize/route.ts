import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
import {
  commitCsvManifest,
  isGithubConfigured,
  readCsvManifestFromRepo,
} from '@/lib/github';
import { CsvManifest, CsvManifestEntry } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface FinalizeBody {
  date?: string;
  filename?: string;
  blobUrl?: string;
  competitorId?: string;
  type?: string;
  size?: number;
}

// Synchronous manifest write triggered by the upload client AFTER the blob upload
// itself completes. The Vercel-Blob onUploadCompleted webhook is unreliable in
// some environments (it is a server-to-server callback that can fail silently),
// so we do the manifest write here too and surface the result back to the
// client. The route is idempotent: it deduplicates by filename within the day's
// manifest.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!isGithubConfigured()) {
    return NextResponse.json(
      {
        error:
          'GitHub is not configured on the server (missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO). The CSV uploaded to Blob but the manifest could not be written. Ask your administrator to set those environment variables in Vercel.',
      },
      { status: 500 }
    );
  }

  let body: FinalizeBody;
  try {
    body = (await req.json()) as FinalizeBody;
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid request body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const { date, filename, blobUrl, competitorId, type, size } = body;
  if (!date || !filename || !blobUrl) {
    return NextResponse.json(
      { error: 'date, filename, and blobUrl are required' },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: `Invalid date format (expected YYYY-MM-DD): ${date}` },
      { status: 400 }
    );
  }

  try {
    const existing = await readCsvManifestFromRepo(date);
    const manifest: CsvManifest = existing || { date, files: [] };

    const entry: CsvManifestEntry = {
      filename,
      blobUrl,
      uploadedAt: new Date().toISOString(),
      size: size || 0,
      competitorId,
      type,
    };

    manifest.files = manifest.files.filter((f) => f.filename !== filename);
    manifest.files.push(entry);

    await commitCsvManifest(date, manifest, `Upload CSV: ${filename}`);

    return NextResponse.json({
      ok: true,
      manifestPath: `data/csv/${date}/manifest.json`,
      fileCount: manifest.files.length,
    });
  } catch (err) {
    console.error('[upload/finalize] failed:', err);
    return NextResponse.json(
      {
        error: `Could not write manifest to GitHub: ${(err as Error).message}`,
      },
      { status: 500 }
    );
  }
}
