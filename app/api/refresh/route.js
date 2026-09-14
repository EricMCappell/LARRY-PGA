import { NextResponse } from 'next/server';
import { refresh } from '../../../lib/pool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The scheduled refresh.
 *
 *   https://your-app/api/refresh?key=YOUR_CRON_SECRET
 *
 * Vercel's own cron sends `Authorization: Bearer $CRON_SECRET`, which is
 * accepted too. Nothing else gets in: the secret is always required.
 *
 * Note that ESPN blocks requests from datacenter IP ranges, so this endpoint
 * may fail from a cloud host even though the same code works from a laptop.
 * See README — the GitHub Actions workflow writes to the same database without
 * going through this route.
 */
export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not set on the server, so refreshes are disabled.' },
      { status: 503 }
    );
  }

  const key = new URL(request.url).searchParams.get('key');
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (key !== expected && bearer !== expected) {
    return NextResponse.json({ error: 'Bad key.' }, { status: 401 });
  }

  try {
    const result = await refresh();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
