import { NextRequest, NextResponse } from 'next/server';
import { isGithubConfigured, readReportFromRepo } from '@/lib/github';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  let exists = false;
  try {
    if (isGithubConfigured()) {
      const content = await readReportFromRepo(date);
      exists = !!content;
    } else {
      const localPath = path.join(process.cwd(), 'reports', `${date}.md`);
      exists = fs.existsSync(localPath);
    }
  } catch {
    exists = false;
  }

  return NextResponse.json({ date, exists });
}
