import Link from 'next/link';
import { getDashboard } from '../lib/pool';
import { money, Movement, timeAgo, EventBadge } from './ui';

export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  const data = await getDashboard();
  const { standings, event, settings, updatedAt } = data;
  const live = Boolean(event && !event.completed && event.round > 0);
  const leader = standings[0];
  const purseInPlay = live ? event.purse : 0;
  const totalWon = standings.reduce((sum, t) => sum + t.banked, 0);

  if (!standings.length) {
    return (
      <>
        <h1>Standings</h1>
        <p className="sub">No teams loaded yet.</p>
        <div className="banner">
          Add teams on the <Link href="/admin">admin page</Link>, then hit refresh to pull in
          scores and money from the PGA Tour.
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Standings</h1>
      <p className="sub">
        Money won since the pool started on {new Date(settings.poolStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
        {' '}Updated {timeAgo(updatedAt)}.
      </p>

      <div className="cards">
        <div className="card">
          <div className="label">Leader</div>
          <div className="value">{leader.name}</div>
          <div className="note">{money(leader.total, { short: true })} · {leader.owner}</div>
        </div>
        <div className="card">
          <div className="label">This week</div>
          <div className="value" style={{ fontSize: 17 }}>{event ? event.name : 'No event'}</div>
          <div className="note">
            <EventBadge event={event} />{' '}
            {event ? `${money(event.purse, { short: true })} purse` : 'Check back Thursday'}
          </div>
        </div>
        <div className="card">
          <div className="label">Pool money won</div>
          <div className="value">{money(totalWon, { short: true })}</div>
          <div className="note">across {standings.length} teams</div>
        </div>
        <div className="card">
          <div className="label">{live ? 'In play' : 'Teams'}</div>
          <div className="value">{live ? money(purseInPlay, { short: true }) : standings.length}</div>
          <div className="note">{live ? 'still to be won this week' : 'entries in the pool'}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <h2>Every team</h2>
          <span className="small muted">
            {live ? 'Projected column includes this week’s estimated payouts' : 'Banked money only'}
          </span>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th className="rank">#</th>
                <th>Team</th>
                <th className="hide-sm">Owner</th>
                <th className="num">Banked</th>
                {live && <th className="num">This week</th>}
                {live && <th className="num">Projected</th>}
                <th className="num hide-sm">Move</th>
                <th className="hide-sm" style={{ width: 120 }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team) => (
                <tr key={team.id}>
                  <td className="rank">{team.rank}</td>
                  <td>
                    <Link href={`/team/${team.id}`} style={{ fontWeight: 600 }}>{team.name}</Link>
                    {live && team.playing > 0 && (
                      <span className="pill live" style={{ marginLeft: 8 }}>{team.playing} playing</span>
                    )}
                  </td>
                  <td className="hide-sm muted">{team.owner}</td>
                  <td className="num">{money(team.banked)}</td>
                  {live && <td className="num muted">{team.live ? `+${money(team.live)}` : '–'}</td>}
                  {live && <td className="num" style={{ fontWeight: 600 }}>{money(team.total)}</td>}
                  <td className="num hide-sm"><Movement change={team.rankChange} /></td>
                  <td className="hide-sm">
                    <div className="bar">
                      <span style={{ width: `${leader.total ? (team.total / leader.total) * 100 : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="foot">
        Money figures come from the PGA Tour via ESPN. Projected payouts during a tournament are
        estimates based on the standard Tour payout table and are replaced by real numbers when
        the event goes final.
      </footer>
    </>
  );
}
