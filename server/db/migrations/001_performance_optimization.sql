-- =============================================================================
-- DMP Cemetery App — Performance Optimization Migration
-- Run AFTER the base schema.sql has been applied.
-- All statements are idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================================
-- ---------------------------------------------------------------------------
-- 0. ENABLE EXTENSIONS
--    pg_trgm — trigram-based fuzzy matching for name/address searches.
--    Research shows pg_trgm outperforms tsvector for short-string search
--    (names, permit numbers, addresses). We use BOTH:
--      • pg_trgm for fuzzy name/address matching (typo-tolerant)
--      • tsvector for full-text search on longer text (notes, descriptions)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- ---------------------------------------------------------------------------
-- 1. MISSING B-TREE INDEXES
--    Covers common WHERE / JOIN / ORDER BY columns missing from base schema.
-- ---------------------------------------------------------------------------
-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
-- Customers — searched by name, email, phone
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_last_name ON customers(last_name);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(last_name, first_name);
-- Work orders — common filters & sorts
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_type ON work_orders(type);
CREATE INDEX IF NOT EXISTS idx_work_orders_due_date ON work_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at DESC);
-- Composite for the most common list query (status + created_at sort)
CREATE INDEX IF NOT EXISTS idx_work_orders_status_created ON work_orders(status, created_at DESC);
-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_vendor ON inventory(vendor_id);
-- Partial index: quickly find items that need reordering
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(quantity)
WHERE quantity <= reorder_point;
-- Deposits
CREATE INDEX IF NOT EXISTS idx_deposits_date ON deposits(date DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_customer ON deposits(customer_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_by ON deposits(created_by);
-- Accounts receivable
CREATE INDEX IF NOT EXISTS idx_ar_status ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_ar_due_date ON accounts_receivable(due_date);
CREATE INDEX IF NOT EXISTS idx_ar_invoice ON accounts_receivable(invoice_number);
-- Partial index: quickly find overdue invoices
CREATE INDEX IF NOT EXISTS idx_ar_overdue ON accounts_receivable(due_date)
WHERE status IN ('pending', 'partial');
-- Accounts payable
CREATE INDEX IF NOT EXISTS idx_ap_status ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_ap_due_date ON accounts_payable(due_date);
-- Partial index: unpaid bills
CREATE INDEX IF NOT EXISTS idx_ap_unpaid ON accounts_payable(due_date)
WHERE status IN ('pending', 'partial');
-- Burials — largest table (~39K rows)
CREATE INDEX IF NOT EXISTS idx_burials_deceased_name ON burials(deceased_last_name, deceased_first_name);
CREATE INDEX IF NOT EXISTS idx_burials_permit ON burials(permit_number);
CREATE INDEX IF NOT EXISTS idx_burials_created_at ON burials(created_at DESC);
-- Composite for cursor pagination (created_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_burials_cursor ON burials(created_at DESC, id DESC);
-- Contracts
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(type);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at DESC);
-- Contract items — FK lookup + aggregate
CREATE INDEX IF NOT EXISTS idx_contract_items_contract ON contract_items(contract_id);
-- Grants
CREATE INDEX IF NOT EXISTS idx_grants_type ON grants(type);
CREATE INDEX IF NOT EXISTS idx_grants_deadline ON grants(deadline);
CREATE INDEX IF NOT EXISTS idx_grants_created_at ON grants(created_at DESC);
-- ---------------------------------------------------------------------------
-- 2. TRIGRAM (pg_trgm) INDEXES — fuzzy name / address search
--    GIN trigram indexes enable fast ILIKE, similarity(), and % operators
--    on short string columns. Perfect for searching by deceased name,
--    customer name, permit number, and plot location.
-- ---------------------------------------------------------------------------
-- Burials: fuzzy search on deceased name + permit
CREATE INDEX IF NOT EXISTS idx_burials_trgm_name ON burials USING GIN (
  (
    deceased_last_name || ' ' || deceased_first_name || ' ' || COALESCE(deceased_middle_name, '')
  ) gin_trgm_ops
);
CREATE INDEX IF NOT EXISTS idx_burials_trgm_permit ON burials USING GIN (permit_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_burials_trgm_location ON burials USING GIN (
  (
    section || ' ' || lot || ' ' || grave || ' ' || plot_location
  ) gin_trgm_ops
);
-- Customers: fuzzy search on name + email + phone
CREATE INDEX IF NOT EXISTS idx_customers_trgm_name ON customers USING GIN (
  (last_name || ' ' || first_name) gin_trgm_ops
);
CREATE INDEX IF NOT EXISTS idx_customers_trgm_email ON customers USING GIN (email gin_trgm_ops);
-- Work orders: fuzzy search on title
CREATE INDEX IF NOT EXISTS idx_work_orders_trgm_title ON work_orders USING GIN (title gin_trgm_ops);
-- ---------------------------------------------------------------------------
-- 3. FULL-TEXT SEARCH (tsvector) COLUMNS + GIN INDEXES
--    Used for searching longer text fields (notes, descriptions).
--    Triggers keep vectors in sync automatically.
-- ---------------------------------------------------------------------------
-- Burials full-text search (notes + contact info)
ALTER TABLE burials
ADD COLUMN IF NOT EXISTS search_vector tsvector;
UPDATE burials
SET search_vector = to_tsvector(
    'english',
    coalesce(deceased_first_name, '') || ' ' || coalesce(deceased_last_name, '') || ' ' || coalesce(deceased_middle_name, '') || ' ' || coalesce(plot_location, '') || ' ' || coalesce(section, '') || ' ' || coalesce(lot, '') || ' ' || coalesce(grave, '') || ' ' || coalesce(contact_name, '') || ' ' || coalesce(permit_number, '') || ' ' || coalesce(notes, '')
  )
WHERE search_vector IS NULL;
CREATE INDEX IF NOT EXISTS idx_burials_search ON burials USING GIN(search_vector);
-- Customers full-text search
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS search_vector tsvector;
UPDATE customers
SET search_vector = to_tsvector(
    'english',
    coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(address, '') || ' ' || coalesce(city, '') || ' ' || coalesce(notes, '')
  )
WHERE search_vector IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers USING GIN(search_vector);
-- Grants full-text search
ALTER TABLE grants
ADD COLUMN IF NOT EXISTS search_vector tsvector;
UPDATE grants
SET search_vector = to_tsvector(
    'english',
    coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(source, '') || ' ' || coalesce(notes, '')
  )
WHERE search_vector IS NULL;
CREATE INDEX IF NOT EXISTS idx_grants_search ON grants USING GIN(search_vector);
-- Work orders full-text search
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS search_vector tsvector;
UPDATE work_orders
SET search_vector = to_tsvector(
    'english',
    coalesce(title, '') || ' ' || coalesce(description, '')
  )
WHERE search_vector IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_search ON work_orders USING GIN(search_vector);
-- ---------------------------------------------------------------------------
-- 4. TRIGGERS — keep search_vector and updated_at in sync automatically
-- ---------------------------------------------------------------------------
-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Apply updated_at triggers to every table that has the column
DO $$
DECLARE tbl TEXT;
BEGIN FOR tbl IN
SELECT table_name
FROM information_schema.columns
WHERE column_name = 'updated_at'
  AND table_schema = 'public' LOOP EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
    tbl,
    tbl,
    tbl,
    tbl
  );
END LOOP;
END $$;
-- Burials search vector trigger
CREATE OR REPLACE FUNCTION burials_search_vector_update() RETURNS TRIGGER AS $$ BEGIN NEW.search_vector := to_tsvector(
    'english',
    coalesce(NEW.deceased_first_name, '') || ' ' || coalesce(NEW.deceased_last_name, '') || ' ' || coalesce(NEW.deceased_middle_name, '') || ' ' || coalesce(NEW.plot_location, '') || ' ' || coalesce(NEW.section, '') || ' ' || coalesce(NEW.lot, '') || ' ' || coalesce(NEW.grave, '') || ' ' || coalesce(NEW.contact_name, '') || ' ' || coalesce(NEW.permit_number, '') || ' ' || coalesce(NEW.notes, '')
  );
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_burials_search ON burials;
CREATE TRIGGER trg_burials_search BEFORE
INSERT
  OR
UPDATE ON burials FOR EACH ROW EXECUTE FUNCTION burials_search_vector_update();
-- Customers search vector trigger
CREATE OR REPLACE FUNCTION customers_search_vector_update() RETURNS TRIGGER AS $$ BEGIN NEW.search_vector := to_tsvector(
    'english',
    coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '') || ' ' || coalesce(NEW.email, '') || ' ' || coalesce(NEW.phone, '') || ' ' || coalesce(NEW.address, '') || ' ' || coalesce(NEW.city, '') || ' ' || coalesce(NEW.notes, '')
  );
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_customers_search ON customers;
CREATE TRIGGER trg_customers_search BEFORE
INSERT
  OR
UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION customers_search_vector_update();
-- Grants search vector trigger
CREATE OR REPLACE FUNCTION grants_search_vector_update() RETURNS TRIGGER AS $$ BEGIN NEW.search_vector := to_tsvector(
    'english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '') || ' ' || coalesce(NEW.source, '') || ' ' || coalesce(NEW.notes, '')
  );
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_grants_search ON grants;
CREATE TRIGGER trg_grants_search BEFORE
INSERT
  OR
UPDATE ON grants FOR EACH ROW EXECUTE FUNCTION grants_search_vector_update();
-- Work orders search vector trigger
CREATE OR REPLACE FUNCTION work_orders_search_vector_update() RETURNS TRIGGER AS $$ BEGIN NEW.search_vector := to_tsvector(
    'english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '')
  );
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_work_orders_search ON work_orders;
CREATE TRIGGER trg_work_orders_search BEFORE
INSERT
  OR
UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION work_orders_search_vector_update();
-- ---------------------------------------------------------------------------
-- 5. ANALYZE — update query planner statistics after adding indexes
-- ---------------------------------------------------------------------------
ANALYZE users;
ANALYZE customers;
ANALYZE vendors;
ANALYZE work_orders;
ANALYZE inventory;
ANALYZE deposits;
ANALYZE accounts_receivable;
ANALYZE accounts_payable;
ANALYZE burials;
ANALYZE contracts;
ANALYZE contract_items;
ANALYZE grants;