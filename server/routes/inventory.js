import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateInventory, validateUUIDParam } from '../middleware/validation.js';
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
const ALLOWED_FILTERS = ['category'];
const ALLOWED_SORT_FIELDS = ['name', 'category', 'quantity', 'unit_price', 'created_at'];
const SEARCH_FIELDS = ['i.name', 'i.sku', 'v.name'];

// --------------------------------------------------------------------------
// GET / — List inventory with pagination, search, and filtering
//
// Includes a special ?low_stock=true filter to find items needing reorder.
// Backward compatible: returns all if no page/limit params (capped at 500).
// --------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
  const search = parseSearchParam(req.query);
  const filters = parseFilterParams(req.query, ALLOWED_FILTERS);
  const hasFilters = Object.keys(filters).length > 0;
  const lowStock = req.query.low_stock === 'true';

  // Backward compatible — return all (capped)
  if (!isPaginated && !search && !hasFilters && !lowStock) {
    const result = await query(`
      SELECT i.*, v.name as vendor_name
      FROM inventory i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      ORDER BY i.name
      LIMIT 500
    `);
    res.set('Cache-Control', 'private, max-age=10');
    return res.json(result.rows);
  }

  // Paginated
  const { page, limit, offset } = parsePaginationParams(req.query);
  const { sort, order } = parseSortParams(req.query, 'name', 'ASC', ALLOWED_SORT_FIELDS);

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
    whereClauses.push(`i.${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  // Special filter: low stock items (quantity <= reorder_point)
  if (lowStock) {
    whereClauses.push('i.quantity <= i.reorder_point');
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count
  const countResult = await query(
    `SELECT COUNT(*) FROM inventory i LEFT JOIN vendors v ON i.vendor_id = v.id ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Data
  const sortCol = sort === 'name' ? 'i.name' : `i.${sort}`;
  const dataQuery = `
    SELECT i.*, v.name as vendor_name
    FROM inventory i
    LEFT JOIN vendors v ON i.vendor_id = v.id
    ${whereClause}
    ORDER BY ${sortCol} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=10');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

// --------------------------------------------------------------------------
// POST / — Create inventory item
// --------------------------------------------------------------------------
router.post('/', validateInventory, asyncHandler(async (req, res) => {
  const { name, category, sku, quantity, reorderPoint, unitPrice, vendorId, location } = req.body;
  const result = await query(
    `INSERT INTO inventory (name, category, sku, quantity, reorder_point, unit_price, vendor_id, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name, category, sku, quantity, reorderPoint, unitPrice, vendorId || null, location]
  );
  res.status(201).json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// PUT /:id — Update inventory item
// --------------------------------------------------------------------------
router.put('/:id', validateUUIDParam, validateInventory, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, category, sku, quantity, reorderPoint, unitPrice, vendorId, location } = req.body;
  const result = await query(
    `UPDATE inventory SET name = $1, category = $2, sku = $3, quantity = $4,
     reorder_point = $5, unit_price = $6, vendor_id = $7, location = $8
     WHERE id = $9 RETURNING *`,
    [name, category, sku, quantity, reorderPoint, unitPrice, vendorId || null, location, id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Inventory item');
  }
  res.json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// DELETE /:id — Delete inventory item
// --------------------------------------------------------------------------
router.delete('/:id', validateUUIDParam, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM inventory WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Inventory item');
  }
  res.json({ success: true });
}));

export default router;
