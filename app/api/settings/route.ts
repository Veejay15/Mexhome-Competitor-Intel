import { NextRequest, NextResponse } from 'next/server';
import { readSettings, writeSettingsLocal } from '@/lib/settings';
import { commitSettingsFile, isGithubConfigured } from '@/lib/github';
import { requireAuth } from '@/lib/auth';
import { AppSettings } from '@/lib/types';

export async function GET() {
  const settings = readSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();
  const current = readSettings();

  const updated: AppSettings = {
    scheduledReports:
      typeof body.scheduledReports === 'boolean'
        ? body.scheduledReports
        : current.scheduledReports,
    scheduleDescription: current.scheduleDescription,
  };

  try {
    if (isGithubConfigured()) {
      await commitSettingsFile(
        updated,
        `Update settings: scheduled reports ${updated.scheduledReports ? 'enabled' : 'disabled'}`
      );
    } else {
      writeSettingsLocal(updated);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save settings: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ settings: updated });
}
