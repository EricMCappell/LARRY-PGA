import { NextResponse } from 'next/server';
import { refresh } from '../../../lib/pool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The scheduled refresh. Point a cron service at:
 *   https://your-app/api/refresh?key=YOUR_CRON_SECRET
 *
 * Every 10–15 minutes during tournament rounds is plenty; once a day is fine
 * the rest of the week.
 */
export async function GET(request) {
  const key = new URL(request.url).searchParams.get('key');
  const expected = process.env.CRON_SECRET;
  const fromVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');

  if (expected && key !== expected && !fromVercelCron) {
    return NextResponse.json({ error: 'Bad key.' }, { status: 401 });
  }

  try {
    const result = await refresh();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
