-- Migration 005: Create email_queue table for resilient background email delivery
BEGIN;

CREATE TABLE IF NOT EXISTS email_queue (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMIT;
