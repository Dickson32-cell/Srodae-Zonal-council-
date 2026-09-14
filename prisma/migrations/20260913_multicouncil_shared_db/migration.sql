-- Multi-council migration: converts the single-council production database
-- into the shared multi-council schema. Every existing row is preserved and
-- tagged council_id='adweso'. Runs inside a transaction; safe to re-run
-- (guards on every step).

BEGIN;

-- 1. fee_payer: add council tag
ALTER TABLE fee_payer ADD COLUMN IF NOT EXISTS council_id VARCHAR(24) NOT NULL DEFAULT 'adweso';
CREATE INDEX IF NOT EXISTS fee_payer_council_idx ON fee_payer (council_id);

-- 2. fee
ALTER TABLE fee ADD COLUMN IF NOT EXISTS council_id VARCHAR(24) NOT NULL DEFAULT 'adweso';
CREATE INDEX IF NOT EXISTS fee_council_idx ON fee (council_id);

-- 3. payment
ALTER TABLE payment ADD COLUMN IF NOT EXISTS council_id VARCHAR(24) NOT NULL DEFAULT 'adweso';
CREATE INDEX IF NOT EXISTS payment_council_idx ON payment (council_id);

-- 4. serial_counter: composite PK (council + area)
-- NOTE: live table's first column is camelCase "electoralArea" (legacy from
-- before @map was added); normalize it first, then apply the composite PK.
ALTER TABLE serial_counter ADD COLUMN IF NOT EXISTS council_id VARCHAR(24) NOT NULL DEFAULT 'adweso';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'serial_counter' AND column_name = 'electoralArea') THEN
    ALTER TABLE serial_counter RENAME COLUMN "electoralArea" TO electoral_area;
  END IF;
END $$;
ALTER TABLE serial_counter DROP CONSTRAINT IF EXISTS serial_counter_pkey;
ALTER TABLE serial_counter ADD PRIMARY KEY (council_id, electoral_area);

-- 5. app_user: composite unique (council + username) replaces global unique
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS council_id VARCHAR(24) NOT NULL DEFAULT 'adweso';
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_username_key;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_council_id_username_key;
CREATE UNIQUE INDEX app_user_council_username_idx ON app_user (council_id, username);
CREATE INDEX IF NOT EXISTS app_user_council_idx ON app_user (council_id);

-- 6. password_change_request
ALTER TABLE password_change_request ADD COLUMN IF NOT EXISTS council_id VARCHAR(24) NOT NULL DEFAULT 'adweso';
CREATE INDEX IF NOT EXISTS pcr_council_idx ON password_change_request (council_id);

-- 7. pending_edit
ALTER TABLE pending_edit ADD COLUMN IF NOT EXISTS council_id VARCHAR(24) NOT NULL DEFAULT 'adweso';
CREATE INDEX IF NOT EXISTS pending_edit_council_idx ON pending_edit (council_id);

-- 8. audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS council_id VARCHAR(24) NOT NULL DEFAULT 'adweso';
CREATE INDEX IF NOT EXISTS audit_log_council_idx ON audit_log (council_id);

-- 9. license_state: single row id=1 -> per-council rows (id = council id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'license_state' AND column_name = 'id'
             AND data_type = 'integer') THEN
    -- convert: copy row 1 into a new council-keyed row, then drop the int table
    CREATE TABLE license_state_new (
      id VARCHAR(24) PRIMARY KEY,
      paid_through INTEGER NOT NULL DEFAULT 0,
      license_key VARCHAR(30),
      last_payment_at TIMESTAMPTZ(3)
    );
    INSERT INTO license_state_new (id, paid_through, license_key, last_payment_at)
      SELECT 'adweso', paid_through, license_key, last_payment_at FROM license_state WHERE id = 1;
    DROP TABLE license_state;
    ALTER TABLE license_state_new RENAME TO license_state;
  END IF;
END $$;

-- 10. seed the other 7 councils' license rows + serial counters
INSERT INTO license_state (id, paid_through) VALUES
  ('newtown', 0), ('ogua', 0), ('nkukwao', 0), ('betom', 0),
  ('srodae', 0), ('oldestate', 0), ('anlotown', 0)
ON CONFLICT (id) DO NOTHING;

COMMIT;