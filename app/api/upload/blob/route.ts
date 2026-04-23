import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { isAuthenticated } from '@/lib/session';
import { isGithubConfigured, uploadDataFile } from '@/lib/github';

export const runtime = 'nodejs';

const MAX_BYTES = 50 * 1024 * 1024; // 50MB cap, well under Vercel Blob's 4.5GB limit

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          'Vercel Blob is not configured. Please ask your administrator to enable Blob storage in the Vercel project settings.',
      },
      { status: 500 }
    );
  }

  // Auth gate: only signed-in users can upload
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid request body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // pathname format expected: csv/YYYY-MM-DD/filename.csv
        const parts = pathname.split('/');
        if (
          parts.length !== 3 ||
          parts[0] !== 'csv' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(parts[1]) ||
          !parts[2].toLowerCase().endsWith('.csv')
        ) {
          throw new Error(
            `Invalid upload path. Expected format: csv/YYYY-MM-DD/filename.csv (got: ${pathname})`
          );
        }
        return {
          allowedContentTypes: [
            'text/csv',
            'application/csv',
            'application/octet-stream',
            'application/vnd.ms-excel',
          ],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // pathname is from upload (with random suffix). Decode our intended layout from it.
        const parts = blob.pathname.split('/');
        if (parts.length < 3) return;
        const date = parts[1];
        // Strip the random suffix Vercel adds (e.g., filename-abc123.csv → filename.csv)
        const filename = parts[2].replace(/-[a-zA-Z0-9]+(\.csv)$/i, '$1');
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const repoPath = `data/csv/${date}/${safeFilename}`;

        try {
          if (isGithubConfigured()) {
            const response = await fetch(blob.url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            await uploadDataFile(repoPath, base64, `Upload CSV: ${safeFilename}`);
          }
        } finally {
          // Clean up the Blob since we've stored it in the repo
          try {
            await del(blob.url);
          } catch {
            // best-effort cleanup
          }
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
