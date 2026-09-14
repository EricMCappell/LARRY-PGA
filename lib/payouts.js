/**
 * Projected prize money.
 *
 * ESPN only publishes prize money once an event is final, so while a tournament
 * is being played we estimate it ourselves: the standard PGA Tour payout
 * percentages applied to that event's purse, with ties splitting the combined
 * share of the positions they occupy (which is how the Tour actually pays).
 *
 * The percentages below are the Tour's standard full-field distribution. They
 * are accurate to within a few hundred dollars for most events, but treat every
 * projected figure as an estimate: it is replaced by ESPN's real number the
 * moment the tournament goes final.
 */

// Standard PGA Tour distribution, positions 1..65, as percentages of the purse.
const STANDARD = [
  18, 10.9, 6.9, 4.9, 4.1, 3.625, 3.375, 3.125, 2.925, 2.725,
  2.525, 2.325, 2.125, 1.925, 1.825, 1.725, 1.625, 1.525, 1.425, 1.325,
  1.225, 1.125, 1.045, 0.965, 0.885, 0.805, 0.775, 0.745, 0.715, 0.685,
  0.655, 0.625, 0.595, 0.57, 0.545, 0.52, 0.495, 0.475, 0.455, 0.435,
  0.415, 0.395, 0.375, 0.355, 0.335, 0.315, 0.295, 0.279, 0.265, 0.257,
  0.251, 0.245, 0.241, 0.237, 0.235, 0.233, 0.231, 0.229, 0.227, 0.225,
  0.223, 0.221, 0.219, 0.217, 0.215,
];

// No-cut limited fields (signature events, TOUR Championship) pay everyone, but
// the top of the table is the same shape. For positions past the table we fall
// back to the last listed percentage.
function pct(position) {
  if (position < 1) return 0;
  return STANDARD[Math.min(position, STANDARD.length) - 1];
}

/**
 * Money for one position, splitting ties.
 * @param {number} purse       total purse in dollars
 * @param {number} position    finishing position (1 = leader)
 * @param {number} tiedCount   how many players share that position
 */
function payoutForPosition(purse, position, tiedCount = 1) {
  if (!purse || !position) return 0;
  let total = 0;
  for (let i = 0; i < tiedCount; i += 1) total += pct(position + i);
  return Math.round((purse * (total / tiedCount)) / 100);
}

/**
 * Project payouts for a whole live leaderboard.
 *
 * @param {Array} players  [{ id, position, made_cut }] where position is numeric
 *                         (players who missed the cut, withdrew or were DQ'd
 *                         should have made_cut false)
 * @param {number} purse
 * @returns {Object} map of player id -> projected dollars
 */
function projectLeaderboard(players, purse) {
  const counts = new Map();
  players.forEach((p) => {
    if (!p.made_cut || !p.position) return;
    counts.set(p.position, (counts.get(p.position) || 0) + 1);
  });

  const out = {};
  players.forEach((p) => {
    out[p.id] = !p.made_cut || !p.position
      ? 0
      : payoutForPosition(purse, p.position, counts.get(p.position) || 1);
  });
  return out;
}

module.exports = { payoutForPosition, projectLeaderboard, STANDARD };
