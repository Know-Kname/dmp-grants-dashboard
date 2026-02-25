import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateCustomer, validateUUIDParam } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import {
  parsePaginationParams,
  parseFilterParams,
  parseSortParams,
  parseSearchParam,
  buildTrigramSearch,
  createPaginatedResponse,
} from '../utils/pagination.js';

const router = express.Router();
router.use(authenticateToken);

// Allowed filter and sort fields
const ALLOWED_FILTERS = ['city', 'state'];
const ALLOWED_SORT_FIELDS = ['last_name', 'first_name', 'created_at', 'city'];

// --------------------------------------------------------------------------
// GET / — List customers with pagination, search, and filtering
//
// Backward compatible: if no page/limit params, returns all (capped at 500).
// Search uses pg_trgm for fuzzy name/email matching.
// --------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
  const search = parseSearchParam(req.query);

  // If no pagination and no search, backward-compatible full list (capped)
  if (!isPaginated && !search) {
    const result = await query(
      'SELECT * FROM customers ORDER BY last_name, first_name LIMIT 500'
    );
    res.set('Cache-Control', 'private, max-age=10');
    return res.json(result.rows);
  }

  // Parse params
  const { page, limit, offset } = parsePaginationParams(req.query);
  const filters = parseFilterParams(req.query, ALLOWED_FILTERS);
  const { sort, order } = parseSortParams(req.query, 'last_name', 'ASC', ALLOWED_SORT_FIELDS);

  // Build WHERE
  const whereClauses = [];
  const params = [];
  let paramIndex = 1;
  let searchOrderExpr = '';

  if (search) {
    const trgm = buildTrigramSearch(
      search,
      `last_name || ' ' || first_name || ' ' || COALESCE(email, '') || ' ' || COALESCE(phone, '')`,
      paramIndex,
      0.1
    );
    if (trgm.clause) {
      whereClauses.push(trgm.clause);
      params.push(...trgm.params);
      paramIndex = trgm.nextParam;
      searchOrderExpr = trgm.orderExpr;
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    whereClauses.push(`${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count
  const countResult = await query(`SELECT COUNT(*) FROM customers ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Data
  const orderBy = searchOrderExpr || `${sort} ${order}`;
  const dataQuery = `
    SELECT * FROM customers
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=10');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

// --------------------------------------------------------------------------
// POST / — Create customer
// --------------------------------------------------------------------------
router.post('/', validateCustomer, asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, address, city, state, zipCode, notes } = req.body;
  const result = await query(
    `INSERT INTO customers (first_name, last_name, email, phone, address, city, state, zip_code, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [firstName, lastName, email || null, phone || null, address || null, city || null, state || null, zipCode || null, notes || null]
  );
  res.status(201).json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// PUT /:id — Update customer
// --------------------------------------------------------------------------
router.put('/:id', validateUUIDParam, validateCustomer, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, phone, address, city, state, zipCode, notes } = req.body;
  const result = await query(
    `UPDATE customers SET first_name = $1, last_name = $2, email = $3, phone = $4,
     address = $5, city = $6, state = $7, zip_code = $8, notes = $9
     WHERE id = $10 RETURNING *`,
    [firstName, lastName, email || null, phone || null, address || null, city || null, state || null, zipCode || null, notes || null, id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Customer');
  }
  res.json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// DELETE /:id — Delete customer
// --------------------------------------------------------------------------
router.delete('/:id', validateUUIDParam, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Customer');
  }
  res.json({ success: true });
}));

export default router;
