import Link from 'next/link';
import { getDashboard } from '../../lib/pool';
import { money, timeAgo } from '../ui';
import Avatar from '../avatar';

export const dynamic = 'force-dynamic';

export default async function PlayersPage() {
  const data = await getDashboard();

  // One row per rostered player, with every team that owns him.
  const rows = new Map();
  data.standings.forEach((team) => {
    team.players.forEach((p) => {
      const key = p.espnId || p.name;
      const row = rows.get(key) || {
        name: p.name, espnId: p.espnId, price: p.price, banked: p.banked, live: p.live, teams: [],
      };
      row.teams.push(team);
      rows.set(key, row);
    });
  });

  const players = [...rows.values()].sort((a, b) => b.banked - a.banked || b.teams.length - a.teams.length);

  return (
    <>
      <h1>Players</h1>
      <p className="sub">
        Every player on a pool roster, what he cost and what he has won since the pool started.
        Updated {timeAgo(data.updatedAt)}.
      </p>

      <div className="panel">
        <div className="panel-head">
          <h2>{players.length} players rostered</h2>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th className="num">Cost</th>
                <th className="num">Won</th>
                <th className="num hide-sm">Owned by</th>
                <th className="hide-sm">Teams</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.espnId || p.name}>
                  <td>
                    <div className="player-row">
                      <Avatar src={data.headshots?.[p.espnId]} name={p.name} />
                      <span className="name">{p.name}</span>
                      {!p.espnId && <span className="pill">unmatched</span>}
                    </div>
                  </td>
                  <td className="num muted">{money(p.price, { short: true })}</td>
                  <td className="num">{money(p.banked)}</td>
                  <td className="num hide-sm muted">{p.teams.length}</td>
                  <td className="small hide-sm">
                    {p.teams.map((t, i) => (
                      <span key={t.id}>{i > 0 && ', '}<Link href={`/team/${t.id}`}>{t.name}</Link></span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.unmatched?.length > 0 && (
        <div className="banner warn">
          <strong>{data.unmatched.length} player(s) not matched to PGA Tour data.</strong>{' '}
          Their earnings will read as zero until they&apos;re linked on the{' '}
          <Link href="/admin">admin page</Link>: {data.unmatched.map((u) => u.player).join(', ')}
        </div>
      )}
    </>
  );
}
