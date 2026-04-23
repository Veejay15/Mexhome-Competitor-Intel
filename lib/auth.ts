import { NextRequest, NextResponse } from 'next/server';

export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_PASSWORD;
  const provided = req.headers.get('x-admin-password');

  if (!expected) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD is not configured on the server.' },
      { status: 500 }
    );
  }

  if (!provided || provided !== expected) {
    return NextResponse.json(
      { error: 'Invalid or missing admin password.' },
      { status: 401 }
    );
  }

  return null;
}
