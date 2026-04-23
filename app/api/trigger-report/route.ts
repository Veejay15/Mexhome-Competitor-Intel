import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { dispatchWorkflow, isGithubConfigured } from '@/lib/github';

export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req);
  if (authError) return authError;

  if (!isGithubConfigured()) {
    return NextResponse.json(
      {
        error:
          'The reporting service is not yet configured. Please contact your administrator.',
      },
      { status: 500 }
    );
  }

  try {
    await dispatchWorkflow('weekly-report.yml');
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to start the report. ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      'Report started. It typically takes 1 to 3 minutes. The new report will appear in the Reports tab when ready.',
  });
}
