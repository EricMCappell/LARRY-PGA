'use client';

import { useEffect, useState } from 'react';

const SAMPLE = `EMAX 1 | Eric
Tommy Fleetwood 7714605
Nicolai Hojgaard 4914868
Jake Knapp 3974296`;

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('poolAdmin');
    if (saved) { setPassword(saved); setAuthed(true); }
  }, []);

  async function call(action, body = {}) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setStatus({ ok: true, message: json.message || 'Done', detail: json });
      if (json.teamsText !== undefined) setText(json.teamsText);
      if (json.info) setInfo(json.info);
      return json;
    } catch (err) {
      setStatus({ ok: false, message: err.message });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e) {
    e.preventDefault();
    const result = await call('status');
    if (result) {
      sessionStorage.setItem('poolAdmin', password);
      setAuthed(true);
    }
  }

  if (!authed) {
    return (
      <>
        <h1>Admin</h1>
        <p className="sub">Enter the admin password to manage teams and refresh data.</p>
        <form onSubmit={signIn} style={{ maxWidth: 340 }}>
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          <div style={{ marginTop: 14 }}>
            <button className="primary" type="submit" disabled={busy || !password}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </div>
        </form>
        {status && !status.ok && <div className="banner warn" style={{ maxWidth: 340 }}>{status.message}</div>}
      </>
    );
  }

  return (
    <>
      <h1>Admin</h1>
      <p className="sub">Only you can see this page. Everyone else gets the read-only dashboard.</p>

      {status && (
        <div className={`banner ${status.ok ? '' : 'warn'}`}>
          <strong>{status.ok ? 'Done. ' : 'Problem: '}</strong>{status.message}
          {status.detail?.unmatched?.length > 0 && (
            <div className="small" style={{ marginTop: 6 }}>
              Unmatched players: {status.detail.unmatched.map((u) => `${u.player} (${u.team})`).join(', ')}
            </div>
          )}
          {status.detail?.warnings?.length > 0 && (
            <div className="small" style={{ marginTop: 6 }}>{status.detail.warnings.join(' · ')}</div>
          )}
        </div>
      )}

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head"><h2>Data</h2></div>
        <div style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="primary" disabled={busy} onClick={() => call('refresh')}>
            {busy ? 'Working…' : 'Refresh from PGA Tour'}
          </button>
          <button disabled={busy} onClick={() => call('baseline')}>Re-capture start-of-pool baseline</button>
          <button disabled={busy} onClick={() => call('load')}>Load teams into the editor</button>
        </div>
        {info && (
          <div style={{ padding: '0 16px 16px' }} className="small muted">
            {info.teams} teams · baseline captured {info.baselineCapturedAt || 'never'} ·
            last refresh {info.updatedAt || 'never'} · storage: {info.storage}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h2>Teams</h2>
          <span className="small muted">One team per block, blank line between teams</span>
        </div>
        <div style={{ padding: 16 }}>
          <p className="small muted" style={{ marginTop: 0 }}>
            Format: a header line of <code>Team name | Owner</code>, then one player per line with his
            price. Prices are optional but make the return columns work.
          </p>
          <textarea
            value={text}
            placeholder={SAMPLE}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button className="primary" disabled={busy} onClick={() => call('saveTeams', { text })}>
              Save teams
            </button>
            <button disabled={busy} onClick={() => call('load')}>Reload</button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head"><h2>Fix a player name</h2></div>
        <div style={{ padding: 16 }}>
          <p className="small muted" style={{ marginTop: 0 }}>
            If a player shows as unmatched, link his name to his ESPN player id (the number in his
            espn.com player URL).
          </p>
          <AliasForm onSave={(name, id) => call('alias', { name, id })} busy={busy} />
        </div>
      </div>
    </>
  );
}

function AliasForm({ onSave, busy }) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 220px' }}>
        <label htmlFor="alias-name">Player name (as written on the team)</label>
        <input id="alias-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div style={{ flex: '0 1 160px' }}>
        <label htmlFor="alias-id">ESPN id</label>
        <input id="alias-id" value={id} onChange={(e) => setId(e.target.value)} />
      </div>
      <button disabled={busy || !name || !id} onClick={() => onSave(name, id)}>Link</button>
    </div>
  );
}
