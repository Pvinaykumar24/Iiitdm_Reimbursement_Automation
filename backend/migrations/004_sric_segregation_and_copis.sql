-- Migration 004: Add SRIC segregation columns to claim_items and create project_copis table
BEGIN;

-- 1. Add SRIC segregation columns to claim_items if they do not exist
ALTER TABLE claim_items
  ADD COLUMN IF NOT EXISTS sric_cgst          NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sric_sgst          NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sric_igst          NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sric_other_charges NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sric_tax_mode      VARCHAR(20) DEFAULT 'amount';

-- 2. Create project_copis table
CREATE TABLE IF NOT EXISTS project_copis (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  co_pi_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, co_pi_id)
);

COMMIT;
