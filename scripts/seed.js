/**
 * Load the starting teams. Run once:  npm run seed
 * Prices are each player's 2026 PGA Tour earnings, which is what the pool
 * charges against the $35M cap.
 */

const store = require('../lib/store');
const { DEFAULT_SETTINGS } = require('../lib/pool');

const TEAMS = [
  {
    id: 'emax-1',
    name: 'EMAX 1',
    owner: 'Eric',
    players: [
      ['Tommy Fleetwood', 7714605],
      ['Nicolai Hojgaard', 4914868],
      ['Jake Knapp', 3974296],
      ['Maverick McNealy', 3973877],
      ['Justin Thomas', 3966774],
      ['Michael Brennan', 3358668],
      ['Eric Cole', 3022154],
      ['Jackson Koivun', 1947262],
      ['Ben James', 1119670],
      ['Patrick Reed', 900000],
    ],
  },
  {
    id: 'emax-2',
    name: 'EMAX 2',
    owner: 'Eric',
    players: [
      ['Russell Henley', 8153228],
      ['Tommy Fleetwood', 7714605],
      ['Tom Kim', 5352960],
      ['Maverick McNealy', 3973877],
      ['Jackson Koivun', 1947262],
      ['Matt Wallace', 1930724],
      ['Mac Meissner', 1685976],
      ['Brooks Koepka', 1658567],
      ['Beau Hossler', 1548296],
      ['Patrick Reed', 900000],
    ],
  },
];

async function main() {
  const teams = TEAMS.map((t) => ({
    ...t,
    players: t.players.map(([name, price]) => ({ name, price, espnId: null })),
  }));

  await store.set('teams', teams);
  await store.set('settings', DEFAULT_SETTINGS);

  teams.forEach((t) => {
    const spend = t.players.reduce((sum, p) => sum + p.price, 0);
    console.log(`${t.name}: ${t.players.length} players, $${spend.toLocaleString()} of $35,000,000`);
  });
  console.log(`\nSaved to ${store.usingPostgres ? 'Postgres' : 'data/store.json'}.`);
  console.log('Next: npm run refresh   (pulls scores and money from ESPN)');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
