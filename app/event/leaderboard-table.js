'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { money } from '../ui';

export default function LeaderboardTable({ players, live }) {
  const [onlyPool, setOnlyPool] = useState(false);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return players.filter((p) => {
      if (onlyPool && !p.teams.length) return false;
      if (needle && !p.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [players, onlyPool, query]);

  const pooled = players.filter((p) => p.teams.length).length;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Leaderboard</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a player"
            style={{ width: 160, padding: '6px 10px', fontSize: 13 }}
          />
          <button onClick={() => setOnlyPool(false)} className={!onlyPool ? 'primary' : ''} style={{ padding: '6px 10px', fontSize: 13 }}>
            Full field ({players.length})
          </button>
          <button onClick={() => setOnlyPool(true)} className={onlyPool ? 'primary' : ''} style={{ padding: '6px 10px', fontSize: 13 }}>
            Pool players ({pooled})
          </button>
        </div>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th className="rank">Pos</th>
              <th>Player</th>
              <th className="num">Score</th>
              <th className="num hide-sm">Thru</th>
              <th className="num">{live ? 'Projected' : 'Won'}</th>
              <th>Owned by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={p.teams.length ? 'mine' : ''}>
                <td className="rank">
                  {p.made_cut ? p.position_text : <span className="pill cut">{p.out_reason}</span>}
                </td>
                <td><span style={{ fontWeight: p.teams.length ? 600 : 400 }}>{p.name}</span></td>
                <td className="num">{p.score ?? '–'}</td>
                <td className="num hide-sm muted">{p.thru_text || '–'}</td>
                <td className="num">{p.amount ? money(p.amount) : <span className="muted">–</span>}</td>
                <td className="small">
                  {p.teams.length
                    ? p.teams.map((t, i) => (
                      <span key={t.id}>{i > 0 && ', '}<Link href={`/team/${t.id}`}>{t.name}</Link></span>
                    ))
                    : <span className="muted">–</span>}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="muted" style={{ padding: 20 }}>No players match that.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
