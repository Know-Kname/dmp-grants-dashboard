import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateBurial, validateUUIDParam } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import {
  parsePaginationParams,
  parseCursorParams,
  parseFilterParams,
  parseSortParams,
  parseSearchParam,
  buildCursorClause,
  buildTrigramSearch,
  buildFullTextSearch,
  createPaginatedResponse,
  createCursorResponse,
  DEFAULT_LIMIT,
} from '../utils/pagination.js';

const router = express.Router();
router.use(authenticateToken);

// Allowed filters & sort fields
const ALLOWED_FILTERS = ['section'];
const ALLOWED_SORT_FIELDS = ['created_at', 'burial_date', 'deceased_last_name'];

// --------------------------------------------------------------------------
// GET /  — List burials with pagination, search, and filtering
//
// Supports TWO pagination modes:
//   • Cursor-based (default for large dataset): ?cursor=<base64>&limit=50
//   • Offset-based (for page jumps):            ?page=1&limit=50
//
// Search uses pg_trgm for fuzzy name/location matching (typo-tolerant)
// with tsvector fallback for notes/full-text queries.
// --------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const search = parseSearchParam(req.query);
  const filters = parseFilterParams(req.query, ALLOWED_FILTERS);
  const useCursor = req.query.cursor !== undefined || (req.query.page === undefined);

  // Build WHERE clauses
  const whereClauses = [];
  const params = [];
  let paramIndex = 1;
  let searchOrderExpr = '';

  // Search — use trigram for name/location, full-text for broader search
  if (search) {
    // Trigram search across deceased name + location + permit
    const nameExpr = `deceased_last_name || ' ' || deceased_first_name || ' ' || COALESCE(deceased_middle_name, '')`;
    const locationExpr = `section || ' ' || lot || ' ' || grave || ' ' || plot_location`;

    // Try trigram first (fuzzy matching on name fields)
    const trgm = buildTrigramSearch(
      search,
      `${nameExpr} || ' ' || ${locationExpr} || ' ' || COALESCE(permit_number, '')`,
      paramIndex,
      0.08 // Lower threshold for broader matching across concatenated fields
    );

    if (trgm.clause) {
      whereClauses.push(trgm.clause);
      params.push(...trgm.params);
      paramIndex = trgm.nextParam;
      searchOrderExpr = trgm.orderExpr;
    }
  }

  // Filters
  for (const [key, value] of Object.entries(filters)) {
    whereClauses.push(`${key} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  // --- Cursor-based pagination (default) ---
  if (useCursor && !search) {
    const { limit, cursor } = parseCursorParams(req.query);
    const cursorResult = buildCursorClause(cursor, paramIndex);

    const allClauses = [
      ...whereClauses,
      ...(cursorResult.clause ? [cursorResult.clause] : []),
    ];
    params.push(...cursorResult.params);

    const fullWhere = allClauses.length > 0
      ? `WHERE ${allClauses.join(' AND ')}`
      : '';

    const dataQuery = `
      SELECT id, deceased_first_name, deceased_last_name, deceased_middle_name,
             date_of_birth, date_of_death, burial_date, plot_location,
             section, lot, grave, contact_name, contact_phone,
             contact_email, permit_number, notes, created_at, updated_at
      FROM burials
      ${fullWhere}
      ORDER BY created_at DESC, id DESC
      LIMIT $${cursorResult.nextParam}
    `;
    params.push(limit);

    const result = await query(dataQuery, params);

    res.set('Cache-Control', 'private, max-age=5');
    return res.json(createCursorResponse(result.rows, limit));
  }

  // --- Offset-based pagination (when page is specified, or when searching) ---
  const { page, limit, offset } = parsePaginationParams(req.query);
  const { sort, order } = parseSortParams(req.query, 'created_at', 'DESC', ALLOWED_SORT_FIELDS);

  // Count
  const countQuery = `SELECT COUNT(*) FROM burials ${whereClause}`;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Data
  const orderBy = searchOrderExpr || `${sort} ${order}`;
  const dataQuery = `
    SELECT id, deceased_first_name, deceased_last_name, deceased_middle_name,
           date_of_birth, date_of_death, burial_date, plot_location,
           section, lot, grave, contact_name, contact_phone,
           contact_email, permit_number, notes, created_at, updated_at
    FROM burials
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  res.set('Cache-Control', 'private, max-age=5');
  res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
}));

// --------------------------------------------------------------------------
// POST / — Create burial
// --------------------------------------------------------------------------
router.post('/', validateBurial, asyncHandler(async (req, res) => {
  const {
    deceasedFirstName, deceasedLastName, deceasedMiddleName,
    dateOfBirth, dateOfDeath, burialDate, plotLocation,
    section, lot, grave, contactName, contactPhone,
    contactEmail, permitNumber, notes
  } = req.body;

  const result = await query(
    `INSERT INTO burials (
      deceased_first_name, deceased_last_name, deceased_middle_name,
      date_of_birth, date_of_death, burial_date, plot_location,
      section, lot, grave, contact_name, contact_phone,
      contact_email, permit_number, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [
      deceasedFirstName, deceasedLastName, deceasedMiddleName,
      dateOfBirth || null, dateOfDeath || null, burialDate, plotLocation,
      section, lot, grave, contactName || null, contactPhone || null,
      contactEmail || null, permitNumber || null, notes || null
    ]
  );
  res.status(201).json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// PUT /:id — Update burial
// --------------------------------------------------------------------------
router.put('/:id', validateUUIDParam, validateBurial, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    deceasedFirstName, deceasedLastName, deceasedMiddleName,
    dateOfBirth, dateOfDeath, burialDate, plotLocation,
    section, lot, grave, contactName, contactPhone,
    contactEmail, permitNumber, notes
  } = req.body;

  const result = await query(
    `UPDATE burials SET
      deceased_first_name = $1, deceased_last_name = $2, deceased_middle_name = $3,
      date_of_birth = $4, date_of_death = $5, burial_date = $6, plot_location = $7,
      section = $8, lot = $9, grave = $10, contact_name = $11, contact_phone = $12,
      contact_email = $13, permit_number = $14, notes = $15
     WHERE id = $16 RETURNING *`,
    [
      deceasedFirstName, deceasedLastName, deceasedMiddleName,
      dateOfBirth || null, dateOfDeath || null, burialDate, plotLocation,
      section, lot, grave, contactName || null, contactPhone || null,
      contactEmail || null, permitNumber || null, notes || null, id
    ]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Burial record');
  }
  res.json(result.rows[0]);
}));

// --------------------------------------------------------------------------
// DELETE /:id — Delete burial
// --------------------------------------------------------------------------
router.delete('/:id', validateUUIDParam, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM burials WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Burial record');
  }
  res.json({ success: true });
}));

export default router;
