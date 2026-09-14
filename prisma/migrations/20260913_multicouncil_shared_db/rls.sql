-- ROW-LEVEL SECURITY: physical tenant isolation in the database itself.
-- Each council deployment connects with a per-council database user whose
-- session sets app.council_id; RLS policies then make every query return
-- ONLY that council's rows — even if application code had a bug.
--
-- Deployment connects as: zc_adweso / zc_newtown / ... (passwords set at
-- provision time) or via SET app.council_id='xxx' on the main user.
--
-- The PRIMARY (owner) connection uses the unrestricted user and sees all rows.

-- 0. Create per-council roles with their passwords (CHANGE pw placeholders per council)
DO $$
DECLARE
  councils TEXT[] := ARRAY['adweso','newtown','ogua','nkukwao','betom','srodae','oldestate','anlotown'];
  c TEXT;
BEGIN
  FOREACH c IN ARRAY councils LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zc_' || c) THEN
      EXECUTE format('CREATE ROLE zc_%I LOGIN PASSWORD %L', c, 'CHANGE-ME-' || c || '-2026');
    END IF;
  END LOOP;
END $$;

-- 1. Enable RLS on every tenant table
ALTER TABLE fee_payer ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_change_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_edit ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_state ENABLE ROW LEVEL SECURITY;

-- 2. Per-council policies: role zc_<council> sees only council_id='<council>' rows
DO $$
DECLARE
  councils TEXT[] := ARRAY['adweso','newtown','ogua','nkukwao','betom','srodae','oldestate','anlotown'];
  tables TEXT[] := ARRAY['fee_payer','fee','payment','serial_counter','app_user','password_change_request','pending_edit','audit_log'];
  c TEXT;
  t TEXT;
  role TEXT;
BEGIN
  -- council_id-tagged tables: policy filters on council_id
  FOREACH t IN ARRAY tables LOOP
    FOREACH c IN ARRAY councils LOOP
      role := 'zc_' || c;
      EXECUTE format(
        'CREATE POLICY tenant_%s_%s ON %I FOR ALL TO %I USING (council_id = %L) WITH CHECK (council_id = %L)',
        c, t, t, role, c, c
      );
    END LOOP;
  END LOOP;
  -- license_state is keyed BY council id (id column) instead of a tag column
  FOREACH c IN ARRAY councils LOOP
    role := 'zc_' || c;
    EXECUTE format(
      'CREATE POLICY tenant_%s_license_state ON license_state FOR ALL TO %I USING (id = %L) WITH CHECK (id = %L)',
      c, role, c, c
    );
  END LOOP;
END $$;

-- 3. Council roles get table grants (read+write per RLS policy; no DDL)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zc_adweso, zc_newtown, zc_ogua, zc_nkukwao, zc_betom, zc_srodae, zc_oldestate, zc_anlotown;
GRANT USAGE ON SCHEMA public TO zc_adweso, zc_newtown, zc_ogua, zc_nkukwao, zc_betom, zc_srodae, zc_oldestate, zc_anlotown;

-- 4. Owner connection (current 'neondb_owner' / your main user) stays BYPASSRLS:
--    verify with: SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user;