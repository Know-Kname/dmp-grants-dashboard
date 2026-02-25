import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();
router.use(authenticateToken);

// --------------------------------------------------------------------------
// GET /api/stats — Lightweight dashboard statistics
//
// Returns aggregate counts and metrics in a SINGLE query using CTEs.
// This replaces fetching all rows from 4+ tables just to count them.
// On a 39K burial table, this is ~100x faster than SELECT * FROM burials.
// --------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const result = await query(`
    WITH wo_stats AS (
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed
      FROM work_orders
    ),
    inv_stats AS (
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE quantity <= reorder_point) AS low_stock
      FROM inventory
    ),
    ar_stats AS (
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'overdue') AS overdue,
        COALESCE(SUM(amount - amount_paid), 0) AS outstanding_amount
      FROM accounts_receivable
    ),
    burial_stats AS (
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE
          EXTRACT(MONTH FROM burial_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM burial_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        ) AS this_month
      FROM burials
    ),
    recent_wo AS (
      SELECT id, title, status, created_at
      FROM work_orders
      ORDER BY created_at DESC
      LIMIT 3
    ),
    recent_burials AS (
      SELECT id, deceased_first_name, deceased_last_name, burial_date
      FROM burials
      ORDER BY burial_date DESC
      LIMIT 2
    )
    SELECT
      json_build_object(
        'workOrders', (SELECT row_to_json(wo_stats) FROM wo_stats),
        'inventory', (SELECT row_to_json(inv_stats) FROM inv_stats),
        'receivables', (SELECT row_to_json(ar_stats) FROM ar_stats),
        'burials', (SELECT row_to_json(burial_stats) FROM burial_stats),
        'recentWorkOrders', (SELECT COALESCE(json_agg(recent_wo), '[]'::json) FROM recent_wo),
        'recentBurials', (SELECT COALESCE(json_agg(recent_burials), '[]'::json) FROM recent_burials)
      ) AS stats
  `);

  res.set('Cache-Control', 'private, max-age=30');
  res.json(result.rows[0].stats);
}));

export default router;
