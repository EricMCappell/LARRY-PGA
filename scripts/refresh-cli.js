/** Pull fresh data from ESPN and recompute standings:  npm run refresh */

const { refresh, getDashboard } = require('../lib/pool');

async function main() {
  const result = await refresh();
  console.log(`Event: ${result.event ? result.event.name : 'none'} — ${result.event?.status_detail || ''}`);
  if (result.warnings.length) console.log('Warnings:', result.warnings.join(' | '));
  if (result.unmatched.length) {
    console.log('Unmatched players:', result.unmatched.map((u) => `${u.player} (${u.team})`).join(', '));
  }

  const { standings, event } = await getDashboard();
  console.log('\nStandings');
  standings.forEach((t) => {
    const live = t.live ? `  (+$${t.live.toLocaleString()} projected)` : '';
    console.log(`${String(t.rank).padStart(2)}. ${t.name.padEnd(22)} $${t.banked.toLocaleString().padStart(12)}${live}`);
  });
  if (event) console.log(`\nThis week: ${event.name}, purse $${event.purse.toLocaleString()}, ${event.status_detail || event.status}`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
