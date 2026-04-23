import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { checkAdminAuth } from '@/lib/auth';
import { isGithubConfigured, uploadDataFile } from '@/lib/github';

export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req);
  if (authError) return authError;

  const body = await req.json();
  const { filename, contentBase64, date } = body;

  if (!filename || !contentBase64 || !date) {
    return NextResponse.json(
      { error: 'filename, contentBase64, and date are required' },
      { status: 400 }
    );
  }

  if (!filename.toLowerCase().endsWith('.csv')) {
    return NextResponse.json(
      { error: 'Only .csv files are allowed' },
      { status: 400 }
    );
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const repoPath = `data/csv/${date}/${safeFilename}`;

  try {
    if (isGithubConfigured()) {
      await uploadDataFile(repoPath, contentBase64, `Upload CSV: ${safeFilename}`);
    } else {
      const dir = path.join(process.cwd(), 'data', 'csv', date);
      fs.mkdirSync(dir, { recursive: true });
      const buf = Buffer.from(contentBase64, 'base64');
      fs.writeFileSync(path.join(dir, safeFilename), buf);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, path: repoPath });
}
