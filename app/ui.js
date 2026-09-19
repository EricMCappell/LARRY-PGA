export function money(value, { short = false } = {}) {
  const n = Number(value) || 0;
  if (short) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
    if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}K`;
  }
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// Tee times are shown in Eastern time everywhere, on the server and in the
// browser alike, so the page reads the same for everyone.
const TEE_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * ESPN's "thru" text is a tee-time timestamp until a player starts his round.
 * Show that as a readable tee time ("Saturday 9:45 AM ET"); once he's on the
 * course, show his progress ("Thru 12", "F") as-is.
 */
export function thruLabel(text) {
  const t = String(text || '');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(t)) return t;
  const date = new Date(t);
  return Number.isNaN(date.getTime()) ? '' : `${TEE_TIME.format(date).replace(/\s+/g, ' ').replace(/ at /, ' ')} ET`;
}

export function Movement({ change }) {
  if (!change) return <span className="muted">–</span>;
  return change > 0
    ? <span className="up">▲ {change}</span>
    : <span className="down">▼ {Math.abs(change)}</span>;
}

export function timeAgo(iso) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function EventBadge({ event }) {
  if (!event) return null;
  const live = !event.completed && event.round > 0;
  return (
    <span className={`pill ${live ? 'live' : ''}`}>
      {live ? `Round ${event.round}` : event.completed ? 'Final' : 'Starts soon'}
    </span>
  );
}
