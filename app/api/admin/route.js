import { NextResponse } from 'next/server';
import store from '../../../lib/store';
import { refresh, getTeams, nameKey } from '../../../lib/pool';
import { parseTeams, teamsToText } from '../../../lib/teams-text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return request.headers.get('x-admin-password') === expected;
}

export async function POST(request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD is not set on the server.' }, { status: 500 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === 'status' || action === 'load') {
      const teams = await getTeams();
      const snapshot = await store.get('snapshot', null);
      return NextResponse.json({
        message: action === 'load' ? 'Teams loaded into the editor.' : 'Signed in.',
        teamsText: teamsToText(teams),
        info: {
          teams: teams.length,
          updatedAt: snapshot?.updatedAt || null,
          baselineCapturedAt: await store.get('baselineCapturedAt', null),
          storage: store.usingPostgres ? 'Postgres' : 'local file',
        },
      });
    }

    if (action === 'saveTeams') {
      const parsed = parseTeams(body.text);
      if (!parsed.length) return NextResponse.json({ error: 'No teams found in that text.' }, { status: 400 });
      const existing = await getTeams();
      const previousIds = new Map(existing.map((t) => [t.name, t.id]));
      const teams = parsed.map((t) => ({ ...t, id: previousIds.get(t.name) || t.id }));
      await store.set('teams', teams);
      const result = await refresh();
      return NextResponse.json({
        message: `Saved ${teams.length} team(s) and refreshed.`,
        unmatched: result.unmatched,
        warnings: result.warnings,
        teamsText: teamsToText(await getTeams()),
      });
    }

    if (action === 'refresh') {
      const result = await refresh();
      return NextResponse.json({
        message: result.event
          ? `Refreshed — ${result.event.name} (${result.event.status_detail || result.event.status}).`
          : 'Refreshed.',
        unmatched: result.unmatched,
        warnings: result.warnings,
      });
    }

    if (action === 'baseline') {
      const result = await refresh({ captureBaseline: true });
      return NextResponse.json({
        message: 'Baseline re-captured from the current 2026 money list.',
        warnings: result.warnings,
      });
    }

    if (action === 'alias') {
      const aliases = await store.get('aliases', {});
      aliases[nameKey(body.name)] = String(body.id);
      await store.set('aliases', aliases);
      const result = await refresh();
      return NextResponse.json({
        message: `Linked ${body.name} to ESPN id ${body.id}.`,
        unmatched: result.unmatched,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
