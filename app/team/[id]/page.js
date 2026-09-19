import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboard } from '../../../lib/pool';
import { money, timeAgo, thruLabel } from '../../ui';
import Avatar from '../../avatar';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ params }) {
  const { id } = await params;
  const data = await getDashboard();
  const team = data.standings.find((t) => String(t.id) === String(id));
  if (!team) notFound();

  const live = Boolean(data.event && !data.event.completed && data.event.round > 0);
  const best = Math.max(...team.players.map((p) => p.total), 1);
  const spendLeft = data.settings.salaryCap - team.spend;

  return (
    <>
      <p className="sub" style={{ margin: '24px 0 0' }}>
        <Link href="/">← All teams</Link>
      </p>
      <h1>{team.name}</h1>
      <p className="sub">{team.owner ? `${team.owner} · ` : ''}Rank {team.rank} of {data.standings.length} · updated {timeAgo(data.updatedAt)}</p>

      <div className="cards">
        <div className="card">
          <div className="label">Banked</div>
          <div className="value">{money(team.banked, { short: true })}</div>
          <div className="note">real money won since Sept 17</div>
        </div>
        {live && (
          <div className="card">
            <div className="label">Projected this week</div>
            <div className="value">{money(team.live, { short: true })}</div>
            <div className="note">{team.playing} still playing</div>
          </div>
        )}
        <div className="card">
          <div className="label">Cap left unspent</div>
          <div className="value">{money(spendLeft, { short: true })}</div>
          <div className="note">of {money(data.settings.salaryCap, { short: true })}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head"><h2>Roster</h2><span className="small muted">{team.players.length} players</span></div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th className="num hide-sm">Cost</th>
                <th className="num">Won</th>
                {live && <th>This week</th>}
                {live && <th className="num">Projected</th>}
                <th className="hide-sm" style={{ width: 110 }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {[...team.players].sort((a, b) => b.total - a.total).map((p) => (
                <tr key={p.name}>
                  <td>
                    <div className="player-row">
                      <Avatar src={data.headshots?.[p.espnId]} name={p.name} />
                      <span className="name">{p.name}</span>
                      {!p.espnId && <span className="pill">unmatched</span>}
                    </div>
                  </td>
                  <td className="num hide-sm muted">{money(p.price, { short: true })}</td>
                  <td className="num">{money(p.banked)}</td>
                  {live && (
                    <td className="small">
                      {p.inPlay
                        ? p.inPlay.made_cut
                          ? <>{p.inPlay.position} <span className="muted">{p.inPlay.score}{thruLabel(p.inPlay.thru) && ` · ${thruLabel(p.inPlay.thru)}`}</span></>
                          : <span className="pill cut">{p.inPlay.out_reason}</span>
                        : <span className="muted">not playing</span>}
                    </td>
                  )}
                  {live && <td className="num">{p.live ? `+${money(p.live)}` : '–'}</td>}
                  <td className="hide-sm">
                    <div className="bar"><span style={{ width: `${(p.total / best) * 100}%` }} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
