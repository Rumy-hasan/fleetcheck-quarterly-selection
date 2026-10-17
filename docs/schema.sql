-- DOCUMENTATION ONLY: not executed by this repo, which uses an in-memory repository.
-- The two quarterly-selection tables from the Part 2 data model, as PostgreSQL.
-- `companies` and `vehicles` are the Part 2 core tables and are not repeated here.

CREATE TABLE selection_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES companies (id),
  year              smallint    NOT NULL,
  quarter           smallint    NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  percentage_used   smallint    NOT NULL CHECK (percentage_used BETWEEN 1 AND 100),
  seed              char(64)    NOT NULL CHECK (seed ~ '^[0-9a-f]{64}$'),
  algorithm_version text        NOT NULL,
  eligible_count    integer     NOT NULL CHECK (eligible_count BETWEEN 4 AND 200000),
  picked_count      integer     NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- One draw per company per quarter: the idempotency key (CLAUDE.md decisions 7-8).
  UNIQUE (tenant_id, year, quarter)
);

-- The frozen eligible list at draw time; picked = true marks the selected vehicles.
CREATE TABLE selection_run_vehicles (
  selection_run_id uuid    NOT NULL REFERENCES selection_runs (id),
  vehicle_id       uuid    NOT NULL REFERENCES vehicles (id),
  tenant_id        uuid    NOT NULL REFERENCES companies (id),
  picked           boolean NOT NULL,
  PRIMARY KEY (selection_run_id, vehicle_id)
);

-- Tenant isolation with row-level security (Part 2): each request sets app.tenant_id.
ALTER TABLE selection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_run_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON selection_runs
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON selection_run_vehicles
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Runs are append-only for the application role: no edits after the draw (docs/decisions.md D9).
REVOKE UPDATE, DELETE ON selection_runs, selection_run_vehicles FROM app_role;

-- saveIfAbsent, in one transaction:
--   INSERT INTO selection_runs (...) VALUES (...)
--     ON CONFLICT (tenant_id, year, quarter) DO NOTHING
--     RETURNING id;                       -- no row returned: another call won the race
--   -- if a row was returned: INSERT the frozen list into selection_run_vehicles
--   SELECT * FROM selection_runs WHERE tenant_id = $1 AND year = $2 AND quarter = $3;
