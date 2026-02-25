import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateDeposit,
  validatePayable,
  validatePayableUpdate,
  validateReceivable,
  validateReceivableUpdate,
  validateUUIDParam,
} from '../middleware/validation.js';
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

// ============================================================================
// DEPOSITS
// ============================================================================
const DEPOSIT_FILTERS = ['method'];
const DEPOSIT_SORT_FIELDS = ['date', 'amount', 'created_at'];

router.get('/deposits', asyncHandler(async (req, res) => {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

  if (!isPaginated) {
    const result = await query(`
      SELECT d.*, c.first_name, c.last_name, u.name as created_by_name
      FROM deposits d
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN users u ON d.created_by = u.id
      ORDER BY d.date DESC
      LIMIT 500
    `);
    res.set('Cache-Control', 'private, max-age=10');
    return res.json(result.rows);
  }

  const { page, limit, offset } = parsePaginationParams(req.query);
  const filters = parseFilterParams(req.query, DEPOSIT_FILTERS);
  const { sort, order } = parseSortParams(req.query, 'date', 'DESC', DEPOSIT_SORT_FIELDS);
  const search = parseSearchParam(req.query);

  const whereClauses = [];
  const params = [];
  let paramIndex = 1;

  if (search) {
    const searchResult = buildSearchClause(
      search,
      ['d.reference', "c.last_name || ' ' || c.first_name"],
      paramIndex
    );
    if (searchResult.clause) {
      whereClauses.push(searchResult.clause);
      params.push(...searchResult.params);
      paramIndex = searchResult.nextParam;
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    whereClauses.push(`d.${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  // Date range filter
  if (req.query.from_date) {
    whereClauses.push(`d.date >= $${paramIndex}`);
    params.push(req.query.from_date);
    paramIndex++;
  }
  if (req.query.to_date) {
    whereClauses.push(`d.date <= $${paramIndex}`);
    params.push(req.query.to_date);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)
     FROM deposits d
     LEFT JOIN customers c ON d.customer_id = c.id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataQuery = `
    SELECT d.*, c.first_name, c.last_name, u.name as created_by_name
    FROM deposits d
    LEFT JOIN customers c ON d.customer_id = c.id
    LEFT JOIN users u ON d.created_by = u.id
    ${whereClause}
    ORDER BY d.${sort} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=10');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

router.post('/deposits', validateDeposit, asyncHandler(async (req, res) => {
  const { amount, date, method, reference, customerId, notes } = req.body;
  const result = await query(
    `INSERT INTO deposits (amount, date, method, reference, customer_id, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [amount, date, method, reference || null, customerId || null, notes || null, req.user.id]
  );
  res.status(201).json(result.rows[0]);
}));

// ============================================================================
// ACCOUNTS RECEIVABLE
// ============================================================================
const AR_FILTERS = ['status'];
const AR_SORT_FIELDS = ['due_date', 'amount', 'created_at', 'status'];

router.get('/receivables', asyncHandler(async (req, res) => {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
  const overdue = req.query.overdue === 'true';

  if (!isPaginated && !overdue) {
    const result = await query(`
      SELECT ar.*, c.first_name, c.last_name
      FROM accounts_receivable ar
      JOIN customers c ON ar.customer_id = c.id
      ORDER BY ar.due_date
      LIMIT 500
    `);
    res.set('Cache-Control', 'private, max-age=10');
    return res.json(result.rows);
  }

  const { page, limit, offset } = parsePaginationParams(req.query);
  const filters = parseFilterParams(req.query, AR_FILTERS);
  const { sort, order } = parseSortParams(req.query, 'due_date', 'ASC', AR_SORT_FIELDS);
  const search = parseSearchParam(req.query);

  const whereClauses = [];
  const params = [];
  let paramIndex = 1;

  if (search) {
    const searchResult = buildSearchClause(
      search,
      ['ar.invoice_number', "c.last_name || ' ' || c.first_name"],
      paramIndex
    );
    if (searchResult.clause) {
      whereClauses.push(searchResult.clause);
      params.push(...searchResult.params);
      paramIndex = searchResult.nextParam;
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    whereClauses.push(`ar.${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  // Special filter: overdue items
  if (overdue) {
    whereClauses.push("ar.status IN ('pending', 'partial') AND ar.due_date < CURRENT_DATE");
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)
     FROM accounts_receivable ar
     JOIN customers c ON ar.customer_id = c.id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataQuery = `
    SELECT ar.*, c.first_name, c.last_name
    FROM accounts_receivable ar
    JOIN customers c ON ar.customer_id = c.id
    ${whereClause}
    ORDER BY ar.${sort} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=10');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

router.post('/receivables', validateReceivable, asyncHandler(async (req, res) => {
  const { customerId, invoiceNumber, amount, dueDate } = req.body;
  const result = await query(
    `INSERT INTO accounts_receivable (customer_id, invoice_number, amount, due_date, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [customerId, invoiceNumber, amount, dueDate]
  );
  res.status(201).json(result.rows[0]);
}));

router.put('/receivables/:id', validateUUIDParam, validateReceivableUpdate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amountPaid, status } = req.body;
  const result = await query(
    `UPDATE accounts_receivable SET amount_paid = $1, status = $2
     WHERE id = $3 RETURNING *`,
    [amountPaid, status, id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Accounts receivable');
  }
  res.json(result.rows[0]);
}));

// ============================================================================
// ACCOUNTS PAYABLE
// ============================================================================
const AP_FILTERS = ['status'];
const AP_SORT_FIELDS = ['due_date', 'amount', 'created_at', 'status'];

router.get('/payables', asyncHandler(async (req, res) => {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
  const overdue = req.query.overdue === 'true';

  if (!isPaginated && !overdue) {
    const result = await query(`
      SELECT ap.*, v.name as vendor_name
      FROM accounts_payable ap
      JOIN vendors v ON ap.vendor_id = v.id
      ORDER BY ap.due_date
      LIMIT 500
    `);
    res.set('Cache-Control', 'private, max-age=10');
    return res.json(result.rows);
  }

  const { page, limit, offset } = parsePaginationParams(req.query);
  const filters = parseFilterParams(req.query, AP_FILTERS);
  const { sort, order } = parseSortParams(req.query, 'due_date', 'ASC', AP_SORT_FIELDS);
  const search = parseSearchParam(req.query);

  const whereClauses = [];
  const params = [];
  let paramIndex = 1;

  if (search) {
    const searchResult = buildSearchClause(
      search,
      ['ap.invoice_number', 'v.name'],
      paramIndex
    );
    if (searchResult.clause) {
      whereClauses.push(searchResult.clause);
      params.push(...searchResult.params);
      paramIndex = searchResult.nextParam;
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    whereClauses.push(`ap.${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  if (overdue) {
    whereClauses.push("ap.status IN ('pending', 'partial') AND ap.due_date < CURRENT_DATE");
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)
     FROM accounts_payable ap
     JOIN vendors v ON ap.vendor_id = v.id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataQuery = `
    SELECT ap.*, v.name as vendor_name
    FROM accounts_payable ap
    JOIN vendors v ON ap.vendor_id = v.id
    ${whereClause}
    ORDER BY ap.${sort} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=10');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

router.post('/payables', validatePayable, asyncHandler(async (req, res) => {
  const { vendorId, invoiceNumber, amount, dueDate } = req.body;
  const result = await query(
    `INSERT INTO accounts_payable (vendor_id, invoice_number, amount, due_date, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [vendorId, invoiceNumber, amount, dueDate]
  );
  res.status(201).json(result.rows[0]);
}));

router.put('/payables/:id', validateUUIDParam, validatePayableUpdate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amountPaid, status } = req.body;
  const result = await query(
    `UPDATE accounts_payable SET amount_paid = $1, status = $2
     WHERE id = $3 RETURNING *`,
    [amountPaid, status, id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Accounts payable');
  }
  res.json(result.rows[0]);
}));

export default router;
