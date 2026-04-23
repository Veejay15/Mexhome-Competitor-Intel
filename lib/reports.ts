import fs from 'fs';
import path from 'path';
import { Report } from './types';

const REPORTS_DIR = path.join(process.cwd(), 'reports');

export function listReports(): Report[] {
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
    const titleLine = raw.split('\n').find((l) => l.startsWith('# '));
    const title = titleLine ? titleLine.replace(/^# /, '').trim() : date;
    const excerpt = raw
      .split('\n')
      .find((l) => l.trim() && !l.startsWith('#'))
      ?.slice(0, 240);
    return { date, filename, title, excerpt };
  });
}

export function readReport(date: string): string | null {
  const filePath = path.join(REPORTS_DIR, `${date}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}
