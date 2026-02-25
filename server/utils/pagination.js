/**
 * Pagination, Search & Filter Utilities
 *
 * Supports two pagination strategies:
 *   1. Offset-based  — simple, good for small tables (<5K rows), allows page jumps
 *   2. Cursor-based  — constant performance at any depth, ideal for large tables (39K+ burials)
 *
 * Search supports:
 *   • pg_trgm (trigram) — fuzzy name/address/short-string matching with similarity ranking
 *   • tsvector/tsquery  — full-text search on longer text (notes, descriptions)
 *   • ILIKE fallback    — for simple substring matching on small datasets
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Offset-based pagination helpers
// ---------------------------------------------------------------------------

/**
 * Parse offset pagination parameters from query string.
 */
export function parsePaginationParams(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) page = DEFAULT_PAGE;
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Create pagination metadata for offset-based responses.
 */
export function createPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

/**
 * Create a complete paginated response envelope.
 */
export function createPaginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: createPaginationMeta(total, page, limit),
  };
}

// ---------------------------------------------------------------------------
// Cursor-based pagination helpers (for large tables like burials)
// ---------------------------------------------------------------------------

/**
 * Parse cursor pagination parameters.
 * Expects: ?limit=50&cursor=<base64-encoded-cursor>
 * The cursor encodes { created_at, id } of the last item on the previous page.
 */
export function parseCursorParams(query) {
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  let cursor = null;
  if (query.cursor) {
    try {
      const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
      cursor = JSON.parse(decoded);
    } catch {
      cursor = null; // Invalid cursor → start from beginning
    }
  }

  return { limit, cursor };
}

/**
 * Encode a cursor from the last row of a result set.
 */
export function encodeCursor(row, fields = ['created_at', 'id']) {
  if (!row) return null;
  const payload = {};
  for (const f of fields) {
    payload[f] = row[f];
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Build WHERE clause for cursor-based pagination.
 * Uses (created_at, id) < ($N, $N+1) for DESC ordering.
 */
export function buildCursorClause(cursor, startParam = 1, direction = 'DESC') {
  if (!cursor || !cursor.created_at || !cursor.id) {
    return { clause: '', params: [], nextParam: startParam };
  }

  const op = direction === 'DESC' ? '<' : '>';
  const clause = `(created_at, id) ${op} ($${startParam}, $${startParam + 1})`;
  return {
    clause,
    params: [cursor.created_at, cursor.id],
    nextParam: startParam + 2,
  };
}

/**
 * Create a cursor-paginated response envelope.
 */
export function createCursorResponse(data, limit, cursorFields = ['created_at', 'id']) {
  const hasMore = data.length === limit;
  const lastRow = data.length > 0 ? data[data.length - 1] : null;
  return {
    data,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore ? encodeCursor(lastRow, cursorFields) : null,
      count: data.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

/**
 * Parse filter parameters from query string.
 */
export function parseFilterParams(query, allowedFilters = []) {
  const filters = {};
  for (const key of allowedFilters) {
    if (query[key] !== undefined && query[key] !== '' && query[key] !== 'all') {
      filters[key] = query[key];
    }
  }
  return filters;
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

/**
 * Parse and validate sort parameters.
 */
export function parseSortParams(query, defaultSort, defaultOrder = 'DESC', allowedSortFields = []) {
  let sort = query.sort || defaultSort;
  let order = (query.order || defaultOrder).toUpperCase();

  if (allowedSortFields.length > 0 && !allowedSortFields.includes(sort)) {
    sort = defaultSort;
  }
  if (order !== 'ASC' && order !== 'DESC') {
    order = defaultOrder;
  }

  return { sort, order };
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

/**
 * Parse search term from query string.
 */
export function parseSearchParam(query) {
  const search = query.search || query.q;
  return search && search.trim() ? search.trim() : null;
}

/**
 * Build a trigram similarity search clause using pg_trgm.
 * Best for short strings: names, addresses, permit numbers.
 * Returns rows ranked by similarity — very typo-tolerant.
 *
 * @param {string} search — user search term
 * @param {string} expression — SQL expression to match against (can be concatenated columns)
 * @param {number} startParam — starting $N parameter index
 * @param {number} threshold — minimum similarity (0.0–1.0), default 0.1 for broad matching
 * @returns {{ clause, orderExpr, params, nextParam }}
 */
export function buildTrigramSearch(search, expression, startParam = 1, threshold = 0.1) {
  if (!search) {
    return { clause: '', orderExpr: '', params: [], nextParam: startParam };
  }
  // Use similarity() > threshold as filter, order by similarity DESC for relevance
  return {
    clause: `similarity(${expression}, $${startParam}) > ${threshold}`,
    orderExpr: `similarity(${expression}, $${startParam}) DESC`,
    params: [search],
    nextParam: startParam + 1,
  };
}

/**
 * Build a full-text search clause using tsvector/tsquery.
 * Best for longer text: notes, descriptions.
 *
 * @param {string} search — user search term
 * @param {string} vectorColumn — name of the tsvector column (e.g. 'search_vector')
 * @param {number} startParam — starting parameter index
 * @returns {{ clause, orderExpr, params, nextParam }}
 */
export function buildFullTextSearch(search, vectorColumn, startParam = 1) {
  if (!search) {
    return { clause: '', orderExpr: '', params: [], nextParam: startParam };
  }
  // Convert user input to tsquery: split words, join with & for AND matching,
  // append :* to each for prefix matching (e.g. "john sm" → "john:* & sm:*")
  const tsquery = search
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w}:*`)
    .join(' & ');

  return {
    clause: `${vectorColumn} @@ to_tsquery('english', $${startParam})`,
    orderExpr: `ts_rank(${vectorColumn}, to_tsquery('english', $${startParam})) DESC`,
    params: [tsquery],
    nextParam: startParam + 1,
  };
}

/**
 * Build a combined search clause: tries trigram first for name fields,
 * falls back to ILIKE for simple substring matching.
 * This is the backward-compatible version used by endpoints that haven't
 * been upgraded to trigram/FTS yet.
 *
 * @param {string} search
 * @param {Array} fields — column names to search
 * @param {number} startParam
 * @returns {{ clause, params, nextParam }}
 */
export function buildSearchClause(search, fields, startParam = 1) {
  if (!search || fields.length === 0) {
    return { clause: '', params: [], nextParam: startParam };
  }

  const conditions = fields.map(
    (field, index) => `${field} ILIKE $${startParam + index}`
  );

  const searchPattern = `%${search}%`;
  const params = fields.map(() => searchPattern);

  return {
    clause: `(${conditions.join(' OR ')})`,
    params,
    nextParam: startParam + fields.length,
  };
}
