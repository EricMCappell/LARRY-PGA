/**
 * ESPN's public golf JSON feeds.
 *
 * These are undocumented but open endpoints — no key, no auth. Field names were
 * verified against live responses in September 2026. Two things to know:
 *
 *  1. The leaderboard endpoint serves a STALE cached response on its plain URL.
 *     Any extra query parameter busts that cache, so every request here adds
 *     `season` and a timestamp.
 *  2. Prize money is only filled in once an event is final. During play we
 *     project it ourselves (see lib/payouts.js).
 *
 * Set ESPN_FIXTURES to a folder of saved responses to run without network
 * access (used for local testing).
 */

const fs = require('fs/promises');
const path = require('path');

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';
const LEADERBOARD = 'https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard';
const BYATHLETE = 'https://site.web.api.espn.com/apis/common/v3/sports/golf/pga/statistics/byathlete';

async function fixture(name) {
  const dir = process.env.ESPN_FIXTURES;
  if (!dir) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, `${name}.json`), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function fetchJson(url, { timeout = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'pga-pool-dashboard/1.0' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`ESPN responded ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Current or next tournament, plus the season calendar. */
async function getScoreboard(dates) {
  const fromFixture = await fixture(dates ? `scoreboard-${dates}` : 'scoreboard');
  if (fromFixture) return fromFixture;
  const url = new URL(SCOREBOARD);
  if (dates) url.searchParams.set('dates', dates);
  return fetchJson(url.toString());
}

/** One tournament's leaderboard, including purse and (once final) prize money. */
async function getLeaderboard(eventId, season) {
  const fromFixture = await fixture(`leaderboard-${eventId}`);
  if (fromFixture) return fromFixture;
  const url = new URL(LEADERBOARD);
  url.searchParams.set('league', 'pga');
  url.searchParams.set('event', String(eventId));
  url.searchParams.set('season', String(season));
  url.searchParams.set('_', String(Date.now())); // busts ESPN's stale cache
  return fetchJson(url.toString());
}

/** Season money list, every player, all pages. */
async function getSeasonMoney(season) {
  const fromFixture = await fixture(`money-${season}`);
  if (fromFixture) return normalizeMoney(fromFixture);

  const rows = [];
  let page = 1;
  let pages = 1;
  while (page <= pages && page <= 12) {
    const url = new URL(BYATHLETE);
    url.searchParams.set('region', 'us');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('contentorigin', 'espn');
    url.searchParams.set('isqualified', 'false');
    url.searchParams.set('limit', '50');
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'general.amount:desc');
    url.searchParams.set('season', String(season));
    // eslint-disable-next-line no-await-in-loop
    const json = await fetchJson(url.toString());
    pages = json?.pagination?.pages || 1;
    rows.push(...normalizeMoney(json));
    page += 1;
  }
  return rows;
}

/** Pull [{id, name, earnings, events, wins}] out of a byathlete page. */
function normalizeMoney(json) {
  const names = json?.categories?.[0]?.names || [];
  const idx = (key) => names.indexOf(key);
  const amountAt = idx('amount');
  const eventsAt = idx('tournamentsPlayed');
  const winsAt = idx('wins');

  return (json?.athletes || []).map((row) => {
    const values = row?.categories?.[0]?.values || [];
    return {
      id: String(row?.athlete?.id ?? ''),
      name: row?.athlete?.displayName ?? '',
      headshot: row?.athlete?.headshot?.href ?? null,
      earnings: Number(values[amountAt] ?? 0) || 0,
      events: Number(values[eventsAt] ?? 0) || 0,
      wins: Number(values[winsAt] ?? 0) || 0,
    };
  }).filter((row) => row.id);
}

/** Flatten a leaderboard response into the shape the app stores. */
function normalizeLeaderboard(json) {
  const event = json?.events?.[0];
  if (!event) return null;

  const competition = event.competitions?.[0] || {};
  const completed = Boolean(event.status?.type?.completed);

  const players = (competition.competitors || []).map((c) => {
    const stat = (name) => (c.statistics || []).find((s) => s.name === name);
    const statusType = c.status?.type || {};
    const reason = statusType.description || '';
    const isCut = statusType.id === '3';
    const positionText = c.status?.position?.displayName || '-';
    const position = Number(String(positionText).replace('T', '')) || null;

    return {
      id: String(c.athlete?.id ?? c.id ?? ''),
      name: c.athlete?.displayName ?? '',
      headshot: c.athlete?.headshot?.href ?? null,
      position,
      position_text: positionText,
      tied: Boolean(c.status?.position?.isTie),
      score: c.score?.displayValue ?? null,
      strokes: c.score?.value ?? null,
      round: c.status?.period ?? null,
      thru: c.status?.thru ?? null,
      thru_text: c.status?.displayValue ?? '',
      tee_time: c.status?.teeTime ?? null,
      made_cut: !isCut && positionText !== '-',
      out_reason: isCut ? (reason.includes('Withdraw') ? 'WD' : reason.includes('Disq') ? 'DQ' : 'CUT') : null,
      movement: c.movement ?? 0,
      sort_order: c.sortOrder ?? 9999,
      earnings: Number(stat('officialAmount')?.value ?? c.earnings ?? 0) || 0,
      cup_points: Number(stat('cupPoints')?.value ?? 0) || 0,
    };
  });

  players.sort((a, b) => a.sort_order - b.sort_order);

  return {
    event: {
      id: String(event.id),
      name: event.name,
      purse: Number(event.purse ?? 0) || 0,
      start: event.date ?? null,
      end: event.endDate ?? null,
      season: event.season?.year ?? null,
      round: competition.status?.period ?? 0,
      status: event.status?.type?.name ?? 'STATUS_SCHEDULED',
      status_detail: competition.status?.type?.detail ?? event.status?.type?.description ?? '',
      completed,
      course: event.courses?.[0]?.name ?? null,
      par: event.courses?.[0]?.par ?? null,
      winner: event.winner?.displayName ?? null,
    },
    players,
  };
}

/** The season schedule: [{id, name, start, end}] */
function normalizeCalendar(scoreboard) {
  return (scoreboard?.leagues?.[0]?.calendar || []).map((c) => ({
    id: String(c.id),
    name: c.label,
    start: c.startDate,
    end: c.endDate,
  }));
}

module.exports = {
  getScoreboard,
  getLeaderboard,
  getSeasonMoney,
  normalizeLeaderboard,
  normalizeCalendar,
  normalizeMoney,
};
