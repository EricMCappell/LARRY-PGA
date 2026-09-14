/**
 * Tiny key/value store.
 *
 * Two drivers, picked automatically:
 *   - Postgres  when DATABASE_URL is set (production: Neon, Supabase, Vercel Postgres)
 *   - JSON file when it isn't          (local development, no database needed)
 *
 * Everything in this app is small (30 teams, ~200 players, one snapshot), so a
 * single table of JSON documents is plenty and keeps the SQL trivial.
 */

const fs = require('fs/promises');
const path = require('path');

const FILE = process.env.STORE_FILE || path.join(process.cwd(), 'data', 'store.json');
const usingPostgres = Boolean(process.env.DATABASE_URL);

let pool = null;
let ready = null;

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

async function init() {
  if (!usingPostgres) return;
  if (!ready) {
    ready = getPool().query(
      `CREATE TABLE IF NOT EXISTS pool_kv (
         key TEXT PRIMARY KEY,
         value JSONB NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
  }
  await ready;
}

async function readFile() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeFile(data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

async function get(key, fallback = null) {
  if (usingPostgres) {
    await init();
    const { rows } = await getPool().query('SELECT value FROM pool_kv WHERE key = $1', [key]);
    return rows.length ? rows[0].value : fallback;
  }
  const data = await readFile();
  return key in data ? data[key] : fallback;
}

async function set(key, value) {
  if (usingPostgres) {
    await init();
    await getPool().query(
      `INSERT INTO pool_kv (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
    return value;
  }
  const data = await readFile();
  data[key] = value;
  await writeFile(data);
  return value;
}

module.exports = { get, set, usingPostgres };
