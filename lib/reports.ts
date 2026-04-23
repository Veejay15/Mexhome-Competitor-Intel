import fs from 'fs';
import path from 'path';
import { Report } from './types';
import {
  isGithubConfigured,
  listReportsFromRepo,
  readReportFromRepo,
} from './github';

const REPORTS_DIR = path.join(process.cwd(), 'reports');

function summarize(date: string, raw: string): Report {
  const titleLine = raw.split('\n').find((l) => l.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^# /, '').trim() : date;
  const excerpt = raw
    .split('\n')
    .find((l) => l.trim() && !l.startsWith('#'))
    ?.slice(0, 240);
  return { date, filename: `${date}.md`, title, excerpt };
}

function listReportsLocal(): Report[] {
  if (!fs.existsSync(REPORTS_DIR)) {
    return [];
  }
  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .reverse();

  return files.map((filename) => {
    const date = filename.replace('.md', '');
    const fullPath = path.join(REPORTS_DIR, filename);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    return summarize(date, raw);
  });
}

function readReportLocal(date: string): string | null {
  const filePath = path.join(REPORTS_DIR, `${date}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

export async function listReports(): Promise<Report[]> {
  if (isGithubConfigured()) {
    try {
      const filenames = await listReportsFromRepo();
      const dates = filenames
        .map((f) => f.replace('.md', ''))
        .sort()
        .reverse();
      const reports = await Promise.all(
        dates.map(async (date) => {
          const raw = await readReportFromRepo(date);
          if (!raw) return null;
          return summarize(date, raw);
        })
      );
      return reports.filter((r): r is Report => r !== null);
    } catch {
      return listReportsLocal();
    }
  }
  return listReportsLocal();
}

export async function readReport(date: string): Promise<string | null> {
  if (isGithubConfigured()) {
    try {
      const fromRepo = await readReportFromRepo(date);
      if (fromRepo !== null) return fromRepo;
    } catch {
      // fall through to local
    }
  }
  return readReportLocal(date);
}
