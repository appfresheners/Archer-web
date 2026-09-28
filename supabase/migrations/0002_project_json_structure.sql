-- 0002_project_json_structure.sql — Archer v1-full: structured (JSON) project storage
-- =============================================================================
-- Epic 2 rework: AI generation returns STRUCTURED JSON, not markdown. A
-- generated project is persisted as structured data — scalar columns
-- (name, purpose, successful_outcome) + next actions as `actions` rows +
-- depth-specific extras as a typed JSONB column — never as a raw markdown blob.
--
-- Changes:
--   1. projects.planning_detail jsonb (nullable) — holds the Full-GTD Natural
--      Planning extras as structured JSON: { principles[], vision,
--      ideas[], organizing[] }. NULL for Minimal-depth projects.
--   2. projects.breakdown_md is DROPPED — no markdown is stored anywhere.
--
-- Idempotent: add-column / drop-column are guarded with if [not] exists.
-- Apply with the Supabase CLI (`supabase db push`) or the SQL editor.
-- =============================================================================

alter table projects
  add column if not exists planning_detail jsonb;

comment on column projects.planning_detail is
  'Full-GTD Natural Planning extras as structured JSON: { principles: string[], vision: string, ideas: string[], organizing: string[] }. NULL for minimal-depth projects.';

alter table projects
  drop column if exists breakdown_md;

-- No markdown is stored anywhere. The goals table's markdown blob is dropped
-- too; Epic 3's goal wizard will persist the goal breakdown as structured
-- JSON (skill_framework, drivers, barriers, if_then_plan already exist as
-- structured columns; the remaining breakdown becomes structured in Epic 3).
alter table goals
  drop column if exists breakdown_md;
