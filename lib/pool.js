/**
 * Pool scoring.
 *
 * The pool counts money won from the first fall event onward — not a calendar
 * season — so a player's pool earnings are:
 *
 *     (2026 season total  -  their 2026 total on the day the pool started)
 *   +  2027 season total
 *
 * The subtracted figure is the "baseline": a snapshot of the 2026 money list
 * taken before the first tee shot. It's captured once and then frozen.
 */

const store = require('./store');
const espn = require('./espn');
const { projectLeaderboard } = require('./payouts');

const DEFAULT_SETTINGS = {
  poolName: "Larry's PGA Pool 2027",
  poolStart: '2026-09-17',
  baselineSeason: 2026,
  seasons: [2026, 2027],
  salaryCap: 35000000,
  maxPlayers: 10,
};

async function getSettings() {
  const saved = await store.get('settings', {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

async function getTeams() {
  return store.get('teams', []);
}

/** Money a player has won inside the pool window. */
function poolEarnings(playerId, money, baseline, baselineSeason) {
  if (!playerId) return 0;
  let total = 0;
  Object.entries(money || {}).forEach(([season, bySeason]) => {
    const earned = Number(bySeason?.[playerId]?.earnings ?? 0) || 0;
    if (Number(season) === Number(baselineSeason)) {
      const start = Number(baseline?.[playerId] ?? 0) || 0;
      total += Math.max(0, earned - start);
    } else {
      total += earned;
    }
  });
  return total;
}

/**
 * Build the full standings table from stored data.
 * Returns teams sorted by banked + live projected money.
 */
function buildStandings({ teams, money, baseline, settings, projections, leaderboard, previous }) {
  const liveById = new Map((leaderboard || []).map((p) => [p.id, p]));
  const prevRank = new Map((previous || []).map((t) => [t.id, t.rank]));

  const rows = teams.map((team) => {
    const players = team.players.map((player) => {
      const banked = poolEarnings(player.espnId, money, baseline, settings.baselineSeason);
      const live = player.espnId ? Number(projections?.[player.espnId] ?? 0) || 0 : 0;
      const inPlay = player.espnId ? liveById.get(player.espnId) || null : null;
      return {
        ...player,
        banked,
        live,
        total: banked + live,
        inPlay: inPlay && {
          position: inPlay.position_text,
          score: inPlay.score,
          thru: inPlay.thru_text,
          made_cut: inPlay.made_cut,
          out_reason: inPlay.out_reason,
          movement: inPlay.movement,
        },
      };
    });

    const banked = players.reduce((sum, p) => sum + p.banked, 0);
    const live = players.reduce((sum, p) => sum + p.live, 0);
    const spend = players.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

    return {
      id: team.id,
      name: team.name,
      owner: team.owner || '',
      players,
      spend,
      banked,
      live,
      total: banked + live,
      playing: players.filter((p) => p.inPlay && p.inPlay.made_cut).length,
    };
  });

  rows.sort((a, b) => b.total - a.total || b.banked - a.banked);
  rows.forEach((row, i) => {
    row.rank = i + 1;
    row.bankedRank = null;
    const was = prevRank.get(row.id);
    row.rankChange = was ? was - row.rank : 0;
  });

  // A second ranking that ignores live projections, so you can see what's real
  // money and what's still on the course.
  [...rows]
    .sort((a, b) => b.banked - a.banked)
    .forEach((row, i) => { row.bankedRank = i + 1; });

  return rows;
}

/** Everything the pages need, read from the store. */
async function getDashboard() {
  const [settings, teams, snapshot] = await Promise.all([
    getSettings(),
    getTeams(),
    store.get('snapshot', null),
  ]);

  const money = snapshot?.money || {};
  const baseline = snapshot?.baseline || (await store.get('baseline', {}));
  const standings = buildStandings({
    teams,
    money,
    baseline,
    settings,
    projections: snapshot?.projections || {},
    leaderboard: snapshot?.leaderboard || [],
    previous: snapshot?.previousStandings || [],
  });

  return {
    settings,
    standings,
    event: snapshot?.event || null,
    leaderboard: snapshot?.leaderboard || [],
    projections: snapshot?.projections || {},
    updatedAt: snapshot?.updatedAt || null,
    unmatched: snapshot?.unmatched || [],
    money,
    baseline,
  };
}

/** Normalize a name for matching: lowercase, no accents, no punctuation. */
function nameKey(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z]/g, '');
}

/**
 * Attach ESPN athlete ids to team players by name, using the season money list
 * and the current leaderboard as the directory. Manual overrides in the
 * `aliases` document always win.
 */
async function matchPlayers(directory) {
  const [teams, aliases] = await Promise.all([getTeams(), store.get('aliases', {})]);
  const byKey = new Map();
  directory.forEach((p) => { if (!byKey.has(nameKey(p.name))) byKey.set(nameKey(p.name), p); });

  const unmatched = [];
  const updated = teams.map((team) => ({
    ...team,
    players: team.players.map((player) => {
      const override = aliases[nameKey(player.name)];
      const found = override ? { id: override } : byKey.get(nameKey(player.name));
      if (!found) unmatched.push({ team: team.name, player: player.name });
      return { ...player, espnId: found ? String(found.id) : null };
    }),
  }));

  await store.set('teams', updated);
  return { teams: updated, unmatched };
}

/**
 * Pull fresh data from ESPN and recompute everything.
 * Safe to call as often as you like; it writes one snapshot document.
 */
async function refresh({ captureBaseline = null } = {}) {
  const settings = await getSettings();
  const started = Date.now();
  const warnings = [];

  // 1. What tournament is on (or next)?
  const scoreboard = await espn.getScoreboard();
  const calendar = espn.normalizeCalendar(scoreboard);
  const currentEventId = scoreboard?.events?.[0]?.id ? String(scoreboard.events[0].id) : null;
  const currentSeason = scoreboard?.season?.year || new Date().getFullYear();

  // 2. That tournament's leaderboard (scores now, real money once final).
  let event = null;
  let leaderboard = [];
  if (currentEventId) {
    try {
      const raw = await espn.getLeaderboard(currentEventId, currentSeason);
      const normalized = espn.normalizeLeaderboard(raw);
      if (normalized) {
        event = normalized.event;
        leaderboard = normalized.players;
      }
    } catch (err) {
      warnings.push(`Leaderboard fetch failed: ${err.message}`);
    }
  }

  // 3. Season money lists for every season the pool spans.
  const money = {};
  for (const season of settings.seasons) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const rows = await espn.getSeasonMoney(season);
      money[season] = Object.fromEntries(rows.map((r) => [r.id, r]));
    } catch (err) {
      warnings.push(`Money list ${season} failed: ${err.message}`);
      money[season] = (await store.get('snapshot', {}))?.money?.[season] || {};
    }
  }

  // 4. Baseline: each player's 2026 money on the day the pool started.
  let baseline = await store.get('baseline', null);
  const poolStarted = new Date() >= new Date(settings.poolStart);
  const shouldCapture = captureBaseline === true || (baseline === null && !poolStarted);
  if (shouldCapture) {
    baseline = Object.fromEntries(
      Object.values(money[settings.baselineSeason] || {}).map((r) => [r.id, r.earnings])
    );
    await store.set('baseline', baseline);
    await store.set('baselineCapturedAt', new Date().toISOString());
  }
  if (baseline === null) {
    baseline = {};
    warnings.push('No baseline captured — pool earnings will include money won before the pool started.');
  }

  // 5. Match team rosters to ESPN ids using everyone we've seen.
  const directory = [
    ...Object.values(money[settings.baselineSeason] || {}),
    ...Object.values(money[settings.seasons[settings.seasons.length - 1]] || {}),
    ...leaderboard,
  ];
  const { teams, unmatched } = await matchPlayers(directory);

  // 6. Projected payouts for a tournament still in progress.
  const live = event && !event.completed && event.round > 0;
  const projections = live ? projectLeaderboard(leaderboard, event.purse) : {};

  // 7. Standings, and keep the previous set so the page can show movement.
  const previousSnapshot = await store.get('snapshot', null);
  const standings = buildStandings({
    teams, money, baseline, settings, projections, leaderboard,
    previous: previousSnapshot?.standings || [],
  });

  const snapshot = {
    updatedAt: new Date().toISOString(),
    tookMs: Date.now() - started,
    event,
    calendar,
    leaderboard,
    projections,
    money,
    baseline,
    standings: standings.map((t) => ({ id: t.id, name: t.name, rank: t.rank, total: t.total, banked: t.banked })),
    previousStandings: previousSnapshot?.standings || [],
    unmatched,
    warnings,
  };
  await store.set('snapshot', snapshot);

  // A weekly history line for each team, used by the trend chart.
  const history = await store.get('history', []);
  const today = new Date().toISOString().slice(0, 10);
  const withoutToday = history.filter((h) => h.date !== today);
  withoutToday.push({ date: today, totals: Object.fromEntries(standings.map((t) => [t.id, t.banked])) });
  await store.set('history', withoutToday.slice(-400));

  return { ok: true, event, teams: standings.length, unmatched, warnings, tookMs: snapshot.tookMs };
}

module.exports = {
  getSettings,
  getTeams,
  getDashboard,
  buildStandings,
  poolEarnings,
  matchPlayers,
  nameKey,
  refresh,
  DEFAULT_SETTINGS,
};
