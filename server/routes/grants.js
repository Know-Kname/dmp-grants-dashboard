import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateGrant, validateUUIDParam } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import {
  parsePaginationParams,
  parseFilterParams,
  parseSortParams,
  parseSearchParam,
  buildFullTextSearch,
  buildSearchClause,
  createPaginatedResponse,
} from '../utils/pagination.js';

const router = express.Router();
router.use(authenticateToken);

// Allowed filter and sort fields
const ALLOWED_FILTERS = ['status', 'type'];
const ALLOWED_SORT_FIELDS = ['created_at', 'title', 'amount', 'deadline', 'status'];

// --------------------------------------------------------------------------
// GET / — List grants with pagination, search, and filtering
//
// Uses full-text search (tsvector) for title/description/source when the
// search_vector column is available, with ILIKE fallback for compatibility.
//
// Backward compatible: returns all if no page/limit params (capped at 500).
// --------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

  if (!isPaginated) {
    const result = await query('SELECT * FROM grants ORDER BY created_at DESC LIMIT 500');
    res.set('Cache-Control', 'private, max-age=10');
    return res.json(result.rows);
  }

  // Parse query parameters
  const { page, limit, offset } = parsePaginationParams(req.query);
  const filters = parseFilterParams(req.query, ALLOWED_FILTERS);
  const { sort, order } = parseSortParams(req.query, 'created_at', 'DESC', ALLOWED_SORT_FIELDS);
  const search = parseSearchParam(req.query);

  // Build query
  const whereClauses = [];
  const params = [];
  let paramIndex = 1;
  let searchOrderExpr = '';

  // Search — prefer full-text search if search_vector column exists
  if (search) {
    const fts = buildFullTextSearch(search, 'search_vector', paramIndex);
    if (fts.clause) {
      whereClauses.push(fts.clause);
      params.push(...fts.params);
      paramIndex = fts.nextParam;
      searchOrderExpr = fts.orderExpr;
    }
  }

  // Filters
  for (const [key, value] of Object.entries(filters)) {
    whereClauses.push(`${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) FROM grants ${whereClause}`;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated data
  const orderBy = searchOrderExpr || `${sort} ${order}`;
  const dataQuery = `
    SELECT id, title, description, type, source, amount, deadline,
           status, application_date, notes, created_at, updated_at
    FROM grants
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=10');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

// --------------------------------------------------------------------------
// POST / — Create grant
// --------------------------------------------------------------------------
router.post('/', validateGrant, asyncHandler(async (req, res) => {
  const { title, description, type, source, amount, deadline, status, applicationDate, notes } = req.body;
  const result = await query(
    `INSERT INTO grants (title, description, type, source, amount, deadline, status, application_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [title, description, type, source, amount, deadline, status, applicationDate, notes]
  );
  res.status(201).json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// PUT /:id — Update grant
// --------------------------------------------------------------------------
router.put('/:id', validateUUIDParam, validateGrant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, type, source, amount, deadline, status, applicationDate, notes } = req.body;
  const result = await query(
    `UPDATE grants SET title = $1, description = $2, type = $3, source = $4,
     amount = $5, deadline = $6, status = $7, application_date = $8, notes = $9
     WHERE id = $10 RETURNING *`,
    [title, description, type, source, amount, deadline, status, applicationDate, notes, id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Grant');
  }
  res.json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// DELETE /:id — Delete grant
// --------------------------------------------------------------------------
router.delete('/:id', validateUUIDParam, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM grants WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Grant');
  }
  res.json({ success: true });
}));

export default router;
