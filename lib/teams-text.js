/**
 * Teams are edited as plain text so you can paste straight from an email:
 *
 *   EMAX 1 | Eric
 *   Tommy Fleetwood 7,714,605
 *   Nicolai Hojgaard 4914868
 *   ...
 *
 *   EMAX 2 | Dave
 *   ...
 *
 * A blank line starts a new team. The header is "Team name | Owner" (owner
 * optional). Each player line is a name plus an optional price; commas, $ signs
 * and tabs are all fine.
 */

const { nameKey } = require('./pool');

function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team';
}

function parseTeams(text) {
  const blocks = String(text || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const used = new Set();
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const [header, ...rest] = lines;
    const [rawName, rawOwner] = header.split('|').map((s) => (s || '').trim());

    let id = slug(rawName);
    let n = 2;
    while (used.has(id)) { id = `${slug(rawName)}-${n}`; n += 1; }
    used.add(id);

    const players = rest.map((line) => {
      const match = line.match(/^(.*?)[\s,|]*\$?([\d][\d,.\s]*)?$/);
      const name = (match?.[1] || line).replace(/[|,]+$/, '').trim();
      const priceText = (match?.[2] || '').replace(/[^\d]/g, '');
      return { name, price: priceText ? Number(priceText) : 0, espnId: null };
    }).filter((p) => p.name);

    return { id, name: rawName || 'Team', owner: rawOwner || '', players };
  });
}

function teamsToText(teams) {
  return (teams || [])
    .map((team) => [
      `${team.name}${team.owner ? ` | ${team.owner}` : ''}`,
      ...team.players.map((p) => `${p.name}${p.price ? ` ${p.price.toLocaleString('en-US')}` : ''}`),
    ].join('\n'))
    .join('\n\n');
}

module.exports = { parseTeams, teamsToText, slug, nameKey };
