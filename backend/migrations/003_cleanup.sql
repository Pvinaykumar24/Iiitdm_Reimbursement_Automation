-- Migration 003: Fix status constraint + remove unused user columns
-- 1. Fix claims.status CHECK (was missing SRIC_PENDING, SRIC_REJECTED, DEAN_PENDING, DEAN_FORWARDED)
-- 2. Drop bank_account and ifsc_code from users (not used in this portal)

BEGIN;

-- Fix status CHECK constraint
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_status_check;

ALTER TABLE claims ADD CONSTRAINT claims_status_check
  CHECK (status IN (
    'DRAFT',
    'SRIC_PENDING',
    'SRIC_REJECTED',
    'DEAN_PENDING',
    'DEAN_REJECTED',
    'DEAN_FORWARDED',
    'ACCOUNTS_PENDING',
    'PROCESSED'
  ));

-- Drop unused banking columns from users
ALTER TABLE users DROP COLUMN IF EXISTS bank_account;
ALTER TABLE users DROP COLUMN IF EXISTS ifsc_code;

COMMIT;
