import Link from 'next/link';
import { getDashboard } from '../../lib/pool';
import { money, timeAgo, EventBadge } from '../ui';
import LeaderboardTable from './leaderboard-table';

export const dynamic = 'force-dynamic';

export default async function EventPage() {
  const data = await getDashboard();
  const { event, leaderboard, projections, standings } = data;

  if (!event) {
    return (
      <>
        <h1>This week</h1>
        <p className="sub">No tournament data yet — run a refresh from the admin page.</p>
      </>
    );
  }

  // Which pool teams own each player in the field.
  const owners = new Map();
  standings.forEach((team) => {
    team.players.forEach((p) => {
      if (!p.espnId) return;
      const list = owners.get(p.espnId) || [];
      list.push(team);
      owners.set(p.espnId, list);
    });
  });

  const live = !event.completed && event.round > 0;
  const owned = leaderboard.filter((p) => owners.has(p.id));
  const poolMoneyInPlay = owned.reduce((sum, p) => sum + (projections[p.id] || p.earnings || 0), 0);

  // Every player in the field, with the pool teams that own him attached.
  const rows = leaderboard.map((p) => ({
    ...p,
    amount: live ? projections[p.id] || 0 : p.earnings,
    teams: (owners.get(p.id) || []).map((t) => ({ id: t.id, name: t.name })),
  }));

  return (
    <>
      <h1>{event.name}</h1>
      <p className="sub">
        <EventBadge event={event} /> {event.course ? `· ${event.course}` : ''} · {money(event.purse)} purse ·
        updated {timeAgo(data.updatedAt)}
      </p>

      <div className="cards">
        <div className="card">
          <div className="label">Status</div>
          <div className="value" style={{ fontSize: 18 }}>{event.status_detail || (event.completed ? 'Final' : 'Scheduled')}</div>
          <div className="note">{event.winner ? `Won by ${event.winner}` : `${leaderboard.length} in the field`}</div>
        </div>
        <div className="card">
          <div className="label">Pool players in the field</div>
          <div className="value">{owned.length}</div>
          <div className="note">of {leaderboard.length} starters</div>
        </div>
        <div className="card">
          <div className="label">{live ? 'Projected to the pool' : 'Won by the pool'}</div>
          <div className="value">{money(poolMoneyInPlay, { short: true })}</div>
          <div className="note">{live ? 'estimated from current positions' : 'final prize money'}</div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <LeaderboardTable players={rows} live={live} />
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        The whole field is listed. Rows in green are players someone in the pool owns.
        {live ? ' Projected money updates with every refresh.' : ' Prize money is final.'}
      </p>
    </>
  );
}
