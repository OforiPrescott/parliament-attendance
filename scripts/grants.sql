-- Least-privilege grants for the application account (PostgreSQL).
-- Run as the database owner / a superuser AFTER schema.sql:
--   psql -U postgres -d parliament_attendance -f scripts/grants.sql
-- Change the password first. The schema should be owned by a separate
-- admin role, so the app account cannot ALTER/DROP tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pa_app') THEN
    CREATE ROLE pa_app LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END $$;

GRANT CONNECT ON DATABASE parliament_attendance TO pa_app;
GRANT USAGE ON SCHEMA public TO pa_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON regions                TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON parties                TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON constituencies         TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON parliaments            TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON parliament_sessions    TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON meetings               TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON committees             TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON mps                    TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON mp_memberships         TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON committee_members      TO pa_app;
GRANT SELECT                         ON roles                  TO pa_app;
GRANT SELECT, INSERT, UPDATE         ON users                  TO pa_app;
GRANT SELECT, INSERT, UPDATE         ON user_sessions          TO pa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sittings               TO pa_app;
GRANT SELECT, INSERT, UPDATE         ON attendance             TO pa_app;
GRANT SELECT, INSERT, UPDATE         ON attendance_corrections TO pa_app;
GRANT SELECT, INSERT                 ON audit_logs             TO pa_app;  -- append-only
GRANT SELECT, INSERT, UPDATE         ON settings               TO pa_app;

-- Identity columns draw from sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pa_app;
