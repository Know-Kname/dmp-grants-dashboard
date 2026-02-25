import express from 'express';
import { query, withTransaction } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateContract, validateContractUpdate, validateUUIDParam } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import {
  parsePaginationParams,
  parseFilterParams,
  parseSortParams,
  parseSearchParam,
  buildSearchClause,
  createPaginatedResponse,
} from '../utils/pagination.js';

const router = express.Router();
router.use(authenticateToken);

// Allowed filters & sort fields
const ALLOWED_FILTERS = ['status', 'type'];
const ALLOWED_SORT_FIELDS = ['created_at', 'signed_date', 'total_amount', 'contract_number', 'status'];
const SEARCH_FIELDS = ['c.contract_number'];

// --------------------------------------------------------------------------
// GET / — List contracts with pagination, search, filtering
//
// Uses LEFT JOIN LATERAL for contract items instead of correlated subquery.
// Research shows LATERAL JOIN is faster for aggregation patterns.
//
// Backward compatible: returns all if no page/limit params (capped at 200).
// --------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
  const search = parseSearchParam(req.query);
  const filters = parseFilterParams(req.query, ALLOWED_FILTERS);
  const hasFilters = Object.keys(filters).length > 0;

  // --- Backward-compatible full list (capped) ---
  if (!isPaginated && !search && !hasFilters) {
    const result = await query(`
      SELECT c.*, cu.first_name, cu.last_name, items.items
      FROM contracts c
      JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(ci.*), '[]'::json) AS items
        FROM contract_items ci
        WHERE ci.contract_id = c.id
      ) items ON true
      ORDER BY c.created_at DESC
      LIMIT 200
    `);
    res.set('Cache-Control', 'private, max-age=10');
    return res.json(result.rows);
  }

  // --- Paginated ---
  const { page, limit, offset } = parsePaginationParams(req.query);
  const { sort, order } = parseSortParams(req.query, 'created_at', 'DESC', ALLOWED_SORT_FIELDS);

  // Build WHERE
  const whereClauses = [];
  const params = [];
  let paramIndex = 1;

  if (search) {
    // Search by contract number or customer name
    const searchFields = ['c.contract_number', "cu.last_name || ' ' || cu.first_name"];
    const searchResult = buildSearchClause(search, searchFields, paramIndex);
    if (searchResult.clause) {
      whereClauses.push(searchResult.clause);
      params.push(...searchResult.params);
      paramIndex = searchResult.nextParam;
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    whereClauses.push(`c.${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count (without the LATERAL JOIN for speed)
  const countResult = await query(
    `SELECT COUNT(*)
     FROM contracts c
     JOIN customers cu ON c.customer_id = cu.id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Data with LATERAL JOIN for contract items
  const dataQuery = `
    SELECT c.*, cu.first_name, cu.last_name, items.items
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    LEFT JOIN LATERAL (
      SELECT COALESCE(json_agg(ci.*), '[]'::json) AS items
      FROM contract_items ci
      WHERE ci.contract_id = c.id
    ) items ON true
    ${whereClause}
    ORDER BY c.${sort} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=10');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

// --------------------------------------------------------------------------
// POST / — Create contract with items (TRANSACTION)
//
// Uses withTransaction() to ensure atomicity — if item inserts fail,
// the contract insert is rolled back. Previously this was non-transactional.
//
// Batch-inserts items with a single multi-row INSERT for efficiency.
// --------------------------------------------------------------------------
router.post('/', validateContract, asyncHandler(async (req, res) => {
  const { contractNumber, type, customerId, totalAmount, signedDate, paymentPlan, items } = req.body;

  const contract = await withTransaction(async (client) => {
    // 1. Insert contract
    const contractResult = await client.query(
      `INSERT INTO contracts (contract_number, type, customer_id, total_amount, signed_date, payment_plan, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
      [contractNumber, type, customerId, totalAmount, signedDate, JSON.stringify(paymentPlan || null)]
    );

    const newContract = contractResult.rows[0];

    // 2. Batch-insert contract items (single query instead of N queries)
    if (items && items.length > 0) {
      const values = [];
      const placeholders = [];
      let idx = 1;

      for (const item of items) {
        placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2})`);
        values.push(newContract.id, item.description, item.amount);
        idx += 3;
      }

      await client.query(
        `INSERT INTO contract_items (contract_id, description, amount)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    return newContract;
  });

  res.status(201).json(contract);
}));

// --------------------------------------------------------------------------
// PUT /:id — Update contract
// --------------------------------------------------------------------------
router.put('/:id', validateUUIDParam, validateContractUpdate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { totalAmount, amountPaid, status, paymentPlan } = req.body;
  const result = await query(
    `UPDATE contracts SET total_amount = $1, amount_paid = $2, status = $3,
     payment_plan = $4 WHERE id = $5 RETURNING *`,
    [totalAmount, amountPaid, status, JSON.stringify(paymentPlan || null), id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Contract');
  }
  res.json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// DELETE /:id — Delete contract (cascades to contract_items via FK)
// --------------------------------------------------------------------------
router.delete('/:id', validateUUIDParam, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM contracts WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Contract');
  }
  res.json({ success: true });
}));

export default router;
