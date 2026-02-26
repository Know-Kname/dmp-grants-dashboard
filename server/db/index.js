import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Connection Pool Configuration (optimized for production workloads)
// ---------------------------------------------------------------------------
const poolConfig = {
  // Support both DATABASE_URL (our convention) and POSTGRES_URL (Vercel Postgres integration)
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,

  // Pool sizing — sized for a single-server Node process.
  // max should roughly equal the expected concurrent queries; 20 is a safe
  // default that avoids overloading a small PostgreSQL instance.
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  min: parseInt(process.env.DB_POOL_MIN, 10) || 2,

  // How long a client can sit idle before being closed (ms)
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30_000,

  // How long to wait when requesting a client from the pool (ms).
  // Prevents requests from hanging forever when the pool is exhausted.
  connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT, 10) || 10_000,

  // Per-query statement timeout (ms). Kills any query running longer than
  // this to protect from runaway scans. 30 s is generous for CRUD ops.
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT, 10) || 30_000,

  // Close & replace connections older than 30 minutes. Prevents stale
  // connections from accumulating and rotates through DNS changes.
  maxLifetimeSeconds: parseInt(process.env.DB_MAX_LIFETIME, 10) || 1800,

  // Close & replace a connection after N uses. Guards against per-connection
  // memory leaks in PostgreSQL. 7500 is the node-postgres recommended default.
  maxUses: parseInt(process.env.DB_MAX_USES, 10) || 7500,

  // Application name for pg_stat_activity visibility
  application_name: 'dmp-cemetery-app',
};

export const pool = new Pool(poolConfig);

// ---------------------------------------------------------------------------
// Pool event handlers — observability & resilience
// ---------------------------------------------------------------------------
pool.on('error', (err) => {
  // Unexpected errors on idle clients — log but don't crash.
  console.error('[DB] Unexpected error on idle client:', err.message);
});

pool.on('connect', (client) => {
  // Set session-level defaults on every new connection
  client.query(`SET statement_timeout = '${poolConfig.statement_timeout}'`);
});

if (process.env.NODE_ENV !== 'production') {
  pool.on('acquire', () => {
    // Helpful for dev — track pool saturation
    const { totalCount, idleCount, waitingCount } = pool;
    if (waitingCount > 0) {
      console.warn(`[DB] Pool pressure — total: ${totalCount}, idle: ${idleCount}, waiting: ${waitingCount}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Execute a parameterized query with optional timing / logging.
 * Drop-in replacement for the original `query(text, params)`.
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const durationMs = Date.now() - start;

    // Log slow queries (> 500 ms) in all environments
    if (durationMs > 500) {
      console.warn('[DB] Slow query', {
        durationMs,
        text: text.slice(0, 200),
        rows: result.rowCount,
      });
    }

    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error('[DB] Query error', {
      durationMs,
      text: text.slice(0, 200),
      error: err.message,
      code: err.code,
    });
    throw err;
  }
}

/**
 * Get a dedicated client from the pool for multi-statement transactions.
 *
 * Usage:
 *   const client = await getClient();
 *   try {
 *     await client.query('BEGIN');
 *     // ... work ...
 *     await client.query('COMMIT');
 *   } catch (err) {
 *     await client.query('ROLLBACK');
 *     throw err;
 *   } finally {
 *     client.release();
 *   }
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Execute a function inside a database transaction.
 * Automatically handles BEGIN / COMMIT / ROLLBACK and client release.
 *
 * Usage:
 *   const result = await withTransaction(async (client) => {
 *     await client.query('INSERT INTO ...');
 *     await client.query('INSERT INTO ...');
 *     return { ok: true };
 *   });
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Health check — verifies the database is reachable.
 */
export async function healthCheck() {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT 1 AS ok');
    return {
      status: 'ok',
      responseTimeMs: Date.now() - start,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  } catch (err) {
    return {
      status: 'error',
      responseTimeMs: Date.now() - start,
      error: err.message,
    };
  }
}

/**
 * Graceful shutdown — drain connections on process exit.
 */
export async function shutdown() {
  console.log('[DB] Draining pool…');
  await pool.end();
  console.log('[DB] Pool drained.');
}

// Graceful shutdown hooks
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default pool;
