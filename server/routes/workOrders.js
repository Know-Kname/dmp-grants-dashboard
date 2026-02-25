import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateUUIDParam, validateWorkOrder } from '../middleware/validation.js';
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
const ALLOWED_FILTERS = ['status', 'priority', 'type'];
const ALLOWED_SORT_FIELDS = ['created_at', 'due_date', 'title', 'priority', 'status'];
const SEARCH_FIELDS = ['wo.title', 'wo.description'];

// --------------------------------------------------------------------------
// GET / — List work orders with pagination, search, and filtering
//
// Backward compatible: returns all if no page/limit params (capped at 500).
// --------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
  const search = parseSearchParam(req.query);
  const filters = parseFilterParams(req.query, ALLOWED_FILTERS);
  const hasFilters = Object.keys(filters).length > 0;

  // Backward compatible — return all (capped)
  if (!isPaginated && !search && !hasFilters) {
    const result = await query(`
      SELECT wo.*, u.name as assigned_to_name, c.name as created_by_name
      FROM work_orders wo
      LEFT JOIN users u ON wo.assigned_to = u.id
      LEFT JOIN users c ON wo.created_by = c.id
      ORDER BY wo.created_at DESC
      LIMIT 500
    `);
    res.set('Cache-Control', 'private, max-age=5');
    return res.json(result.rows);
  }

  // Parse params
  const { page, limit, offset } = parsePaginationParams(req.query);
  const { sort, order } = parseSortParams(req.query, 'created_at', 'DESC', ALLOWED_SORT_FIELDS);

  // Build WHERE
  const whereClauses = [];
  const params = [];
  let paramIndex = 1;

  if (search) {
    const searchResult = buildSearchClause(search, SEARCH_FIELDS, paramIndex);
    if (searchResult.clause) {
      whereClauses.push(searchResult.clause);
      params.push(...searchResult.params);
      paramIndex = searchResult.nextParam;
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    whereClauses.push(`wo.${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count
  const countResult = await query(
    `SELECT COUNT(*) FROM work_orders wo ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Data with JOINs
  const sortCol = sort === 'created_at' ? `wo.${sort}` : `wo.${sort}`;
  const dataQuery = `
    SELECT wo.*, u.name as assigned_to_name, c.name as created_by_name
    FROM work_orders wo
    LEFT JOIN users u ON wo.assigned_to = u.id
    LEFT JOIN users c ON wo.created_by = c.id
    ${whereClause}
    ORDER BY ${sortCol} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=5');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

// --------------------------------------------------------------------------
// POST / — Create work order
// --------------------------------------------------------------------------
router.post('/', validateWorkOrder, asyncHandler(async (req, res) => {
  const { title, description, type, priority, assignedTo, dueDate } = req.body;
  const result = await query(
    `INSERT INTO work_orders (title, description, type, priority, status, assigned_to, due_date, created_by)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7) RETURNING *`,
    [title, description, type, priority, assignedTo || null, dueDate || null, req.user.id]
  );
  res.status(201).json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// PUT /:id — Update work order
// --------------------------------------------------------------------------
router.put('/:id', validateUUIDParam, validateWorkOrder, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, type, priority, status, assignedTo, dueDate, completedDate } = req.body;
  const result = await query(
    `UPDATE work_orders SET title = $1, description = $2, type = $3, priority = $4,
     status = $5, assigned_to = $6, due_date = $7, completed_date = $8
     WHERE id = $9 RETURNING *`,
    [title, description, type, priority, status, assignedTo || null, dueDate || null, completedDate || null, id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Work order');
  }
  res.json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// DELETE /:id — Delete work order
// --------------------------------------------------------------------------
router.delete('/:id', validateUUIDParam, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM work_orders WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Work order');
  }
  res.json({ success: true });
}));

export default router;
