import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { checkAdminAuth } from '@/lib/auth';
import { deleteRepoFile, isGithubConfigured } from '@/lib/github';

interface Params {
  params: Promise<{ date: string }>;
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authError = checkAdminAuth(req);
  if (authError) return authError;

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const repoPath = `reports/${date}.md`;

  try {
    if (isGithubConfigured()) {
      await deleteRepoFile(repoPath, `Delete report: ${date}`);
    } else {
      const localPath = path.join(process.cwd(), 'reports', `${date}.md`);
      if (!fs.existsSync(localPath)) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }
      fs.unlinkSync(localPath);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to delete report: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
