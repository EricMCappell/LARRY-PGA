# Larry's PGA Pool — live dashboard

A public, no-login dashboard for a season-long PGA Tour money pool: standings,
live leaderboard with projected payouts, per-team pages, and a password-protected
admin area for loading teams.

Built with Next.js. Free to host. Data comes from ESPN's public golf feeds.

---

## How the scoring works

The pool counts money won from the first fall event (Sept 17, 2026) through the
end of the 2027 season. ESPN reports money by calendar season, so each player's
pool total is:

```
(2026 season earnings  −  their 2026 earnings on the day the pool started)
+ 2027 season earnings
```

That subtracted figure is the **baseline**. It's captured once, before the first
tee shot, and then frozen. If you ever need to recapture it, there's a button on
the admin page — but only do that before the pool's first event, or everyone's
totals reset.

**Projected payouts.** ESPN only publishes prize money once a tournament is
final. While an event is being played, the app estimates each player's payout by
applying the standard PGA Tour payout percentages to that event's purse, with
ties splitting the combined share. Those estimates appear in the "This week" and
"Projected" columns and are replaced by ESPN's real numbers when the event ends.

---

## Running it locally

```bash
npm install
npm run seed          # loads the starting teams
npm run refresh       # pulls scores + money from ESPN
npm run dev           # http://localhost:3000
```

With no `DATABASE_URL` set, everything is stored in `data/store.json`. That's
fine for local use; for the deployed site you want a real database (below).

### Testing without internet

```bash
node scripts/make-fixtures.js live     # or: pre, final
ESPN_FIXTURES=./fixtures npm run refresh
ESPN_FIXTURES=./fixtures npm run dev
```

The fixtures are synthetic — invented scores and payouts for testing only.

---

## Deploying

The app runs anywhere Next.js runs. These steps are for Vercel, which is free at
this size.

1. **Push this folder to a GitHub repo.**
2. **Create a Postgres database.** Neon (neon.tech) and Supabase both have free
   tiers. Copy the connection string.
3. **Import the repo at vercel.com** and set three environment variables:

   | Variable | What it is |
   |---|---|
   | `DATABASE_URL` | the Postgres connection string |
   | `ADMIN_PASSWORD` | whatever you want to type to reach `/admin` |
   | `CRON_SECRET` | any random string; protects the refresh endpoint |

4. **Deploy**, then open `/admin`, paste your teams, and hit *Refresh from PGA Tour*.
5. **Schedule the refresh.** `vercel.json` already registers a daily cron. During
   tournament weeks you want it more often than that, which Vercel's free tier
   doesn't allow, so point a free external scheduler (cron-job.org works) at:

   ```
   https://your-app.vercel.app/api/refresh?key=YOUR_CRON_SECRET
   ```

   Every 15 minutes Thursday through Sunday is plenty.

---

## The admin page

At `/admin`, behind `ADMIN_PASSWORD`:

- **Teams** — paste every team as plain text. Blank line between teams, a
  `Team name | Owner` header, then one player per line with his price:

  ```
  EMAX 1 | Eric
  Tommy Fleetwood 7714605
  Nicolai Hojgaard 4914868
  ...

  EMAX 2 | Dave
  Russell Henley 8153228
  ...
  ```

- **Refresh from PGA Tour** — pulls fresh scores and money right now.
- **Re-capture baseline** — only before the pool's first event.
- **Fix a player name** — if someone shows as "unmatched", link his name to his
  ESPN player id (the number in his espn.com player URL).

Players are matched to ESPN by name, ignoring accents and punctuation. A player
who hasn't teed it up on the PGA Tour yet (a Korn Ferry graduate, say) stays
unmatched until his first start, then matches automatically.

---

## Layout

```
app/
  page.js              standings
  event/page.js        this week's leaderboard + projected payouts
  players/page.js      every rostered player, cost vs money won
  team/[id]/page.js    one team
  admin/page.js        admin UI
  api/refresh/route.js the scheduled refresh
  api/admin/route.js   admin actions
lib/
  espn.js              ESPN feeds and response parsing
  payouts.js           standard payout table + tie splitting
  pool.js              scoring, matching, the refresh job
  store.js             Postgres or JSON file
  teams-text.js        the paste-in team format
scripts/
  seed.js              load the starting teams
  refresh-cli.js       refresh from the command line
  make-fixtures.js     synthetic test data
```

## A caveat about the data

ESPN's golf endpoints are public but undocumented, and they can change without
warning. Two known quirks are handled in `lib/espn.js`: the leaderboard URL
serves a stale cached response unless you add an extra query parameter, and prize
money is blank until an event is final. If the feeds ever break, the dashboard
keeps showing the last good snapshot rather than going blank.
