/**
 * Builds SYNTHETIC ESPN responses for offline testing.
 *
 * These are not real data — they exist so the app can be run and the scoring
 * checked without hitting ESPN. Point the app at them with:
 *   ESPN_FIXTURES=./fixtures npm run refresh
 *
 * Scenarios: "pre" (pool hasn't started), "live" (round 3 in progress),
 * "final" (event complete, money paid).
 */

const fs = require('fs');
const path = require('path');

const scenario = process.argv[2] || 'pre';
const dir = path.join(process.cwd(), 'fixtures');
fs.mkdirSync(dir, { recursive: true });

// name, fake-but-stable id, 2026 earnings at pool start, fall money added after
const PLAYERS = [
  ['Tommy Fleetwood', '5539', 7714605, 291000],
  ['Nicolai Hojgaard', '4610337', 4914868, 0],
  ['Jake Knapp', '4602686', 3974296, 152000],
  ['Maverick McNealy', '4360439', 3973877, 0],
  ['Justin Thomas', '4848', 3966774, 900000],
  ['Michael Brennan', '4921329', 3358668, 0],
  ['Eric Cole', '5539901', 3022154, 61000],
  ['Jackson Koivun', '5215013', 1947262, 0],
  ['Ben James', '5142833', 1119670, 0],
  ['Patrick Reed', '4906', 0, 0],
  ['Russell Henley', '3454', 8153228, 0],
  ['Tom Kim', '4602673', 5352960, 0],
  ['Matt Wallace', '4231053', 1930724, 0],
  ['Mac Meissner', '4683049', 1685976, 0],
  ['Brooks Koepka', '6798', 1658567, 0],
  ['Beau Hossler', '4425', 1548296, 0],
  ['Scottie Scheffler', '9478', 30937525, 0],
  ['Rory McIlroy', '3470', 11573749, 0],
];

const STAT_NAMES = [
  'amount', 'cupPoints', 'tournamentsPlayed', 'roundsPlayed', 'cutsMade',
  'topTenFinishes', 'wins', 'scoringAverage', 'yardsPerDrive', 'driveAccuracyPct',
  'greensInRegPct', 'strokesPerHole', 'sandSaves', 'savePct', 'birdiesPerRound',
];

function moneyFixture(season) {
  const athletes = PLAYERS.map(([name, id, base, fall]) => {
    const amount = season === 2026 ? base + (scenario === 'final' ? fall : 0) : 0;
    const values = [amount, 0, 20, 70, 15, 3, 1, 69.9, 300, 60, 68, 1.7, 0, 50, 4.1];
    return {
      athlete: { id, displayName: name, headshot: { href: `https://a.espncdn.com/i/headshots/golf/players/full/${id}.png` } },
      categories: [{ name: 'general', totals: values.map(String), values, ranks: values.map(() => '-') }],
    };
  });
  return {
    categories: [{ name: 'general', names: STAT_NAMES }],
    athletes: season === 2026 ? athletes : [],
    pagination: { count: athletes.length, limit: 50, page: 1, pages: 1 },
  };
}

function leaderboardFixture() {
  const statusByScenario = {
    pre: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled' },
    live: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress' },
    final: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final' },
  }[scenario];

  // Pool players plus a bunch of others, so the full field is exercised.
  const FILLER = [
    'Adam Schenk', 'Chad Ramey', 'Kevin Roy', 'Sam Ryder', 'Nick Hardy',
    'Lee Hodges', 'Vince Whaley', 'Chan Kim', 'Zac Blair', 'Rico Hoey',
    'Taylor Moore', 'Hayden Springer', 'Dylan Wu', 'Joel Dahmen', 'Harry Higgs',
    'Mark Hubbard', 'Peter Malnati', 'Luke List', 'Ben Martin', 'Robert Streb',
  ].map((name, i) => [name, `9${String(100000 + i)}`, 0, 0]);
  const field = [...PLAYERS.slice(0, 12), ...FILLER];
  const competitors = scenario === 'pre' ? [] : field.map(([name, id, , fall], i) => {
    const missedCut = i >= 22;
    const position = missedCut ? null : i + 1;
    return {
      id,
      athlete: { id, displayName: name, headshot: { href: '' } },
      movement: (i % 5) - 2,
      sortOrder: i,
      earnings: scenario === 'final' ? fall : 0,
      score: { value: 270 + i, displayValue: `${-14 + i}` },
      status: {
        displayValue: missedCut ? 'CUT' : scenario === 'final' ? 'F' : `Thru ${18 - (i % 6) * 3}`,
        period: scenario === 'final' ? 4 : 3,
        thru: 18 - (i % 6) * 3,
        displayThru: String(18 - (i % 6) * 3),
        position: { id: String(position || 0), displayName: missedCut ? '-' : (i === 1 || i === 2 ? 'T2' : String(i + 1)), isTie: i === 1 || i === 2 },
        type: missedCut
          ? { id: '3', name: 'STATUS_CUT', state: 'post', completed: false, description: 'Missed Cut', shortDetail: 'CUT' }
          : { id: '2', name: 'STATUS_FINISH', state: 'post', completed: true, description: 'Finish', shortDetail: 'F' },
      },
      statistics: [
        { name: 'scoreToPar', value: -14 + i, displayValue: `${-14 + i}` },
        { name: 'officialAmount', value: scenario === 'final' ? fall : 0, displayValue: scenario === 'final' ? `$${fall.toLocaleString()}` : '--' },
        { name: 'cupPoints', value: 0, displayValue: '0' },
      ],
    };
  });

  // positions 2 and 3 tie, so the payout split gets exercised
  competitors.forEach((c, i) => { if (i === 2) c.status.position.id = '2'; });

  return {
    events: [{
      id: '401850914',
      name: 'Biltmore Championship Asheville',
      date: '2026-09-17T04:00Z',
      endDate: '2026-09-20T04:00Z',
      purse: 5000000,
      displayPurse: '$5,000,000',
      season: { year: 2026 },
      status: { type: statusByScenario },
      courses: [{ name: 'The Cliffs at Walnut Cove', par: 71 }],
      winner: scenario === 'final' ? { id: '5539', displayName: 'Tommy Fleetwood' } : undefined,
      competitions: [{
        id: '401850914',
        status: { period: scenario === 'pre' ? 0 : scenario === 'final' ? 4 : 3, type: { ...statusByScenario, detail: scenario === 'live' ? 'Round 3 - In Progress' : statusByScenario.description } },
        competitors,
      }],
    }],
  };
}

const scoreboard = {
  leagues: [{
    id: '1106',
    season: { year: 2026 },
    calendar: [
      { id: '401850914', label: 'Biltmore Championship Asheville', startDate: '2026-09-17T04:00Z', endDate: '2026-09-20T04:00Z' },
      { id: '401850915', label: 'Bank of Utah Championship', startDate: '2026-10-01T04:00Z', endDate: '2026-10-04T04:00Z' },
    ],
  }],
  season: { year: 2026, type: 2 },
  events: [{ id: '401850914', name: 'Biltmore Championship Asheville', date: '2026-09-17T04:00Z', endDate: '2026-09-20T04:00Z', season: { year: 2026 } }],
};

fs.writeFileSync(path.join(dir, 'scoreboard.json'), JSON.stringify(scoreboard, null, 1));
fs.writeFileSync(path.join(dir, 'leaderboard-401850914.json'), JSON.stringify(leaderboardFixture(), null, 1));
fs.writeFileSync(path.join(dir, 'money-2026.json'), JSON.stringify(moneyFixture(2026), null, 1));
fs.writeFileSync(path.join(dir, 'money-2027.json'), JSON.stringify(moneyFixture(2027), null, 1));
console.log(`Wrote synthetic fixtures for the "${scenario}" scenario to ./fixtures`);
