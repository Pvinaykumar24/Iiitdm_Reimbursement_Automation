CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(100) UNIQUE NOT NULL,
  password     VARCHAR(255) NOT NULL,
  role         VARCHAR(20) NOT NULL CHECK (role IN ('FACULTY','DEAN','ACCOUNTS','ADMIN')),
  department   VARCHAR(100),
  employee_id  VARCHAR(20) UNIQUE,
  bank_account VARCHAR(20),
  ifsc_code    VARCHAR(15),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_no     VARCHAR(50) UNIQUE NOT NULL,
  title          VARCHAR(255) NOT NULL,
  funding_agency VARCHAR(100) NOT NULL,
  pi_id          UUID REFERENCES users(id),
  total_budget   NUMERIC(12,2) NOT NULL,
  start_date     DATE,
  end_date       DATE,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_heads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  head_name  VARCHAR(50) NOT NULL,
  allocated  NUMERIC(12,2) NOT NULL,
  utilized   NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_no       VARCHAR(20) UNIQUE,
  faculty_id     UUID REFERENCES users(id),
  project_id     UUID REFERENCES projects(id),
  budget_head_id UUID REFERENCES budget_heads(id),
  purpose        TEXT NOT NULL,
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         VARCHAR(30) DEFAULT 'DRAFT'
                 CHECK (status IN ('DRAFT','DEAN_PENDING','DEAN_APPROVED',
                                   'DEAN_REJECTED','ACCOUNTS_PENDING','PROCESSED','REJECTED')),
  submitted_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claim_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     UUID REFERENCES claims(id) ON DELETE CASCADE,
  vendor_name  VARCHAR(150) NOT NULL,
  bill_no      VARCHAR(100) NOT NULL,
  bill_date    DATE NOT NULL,
  description  TEXT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1,
  unit_price   NUMERIC(10,2) NOT NULL,
  cgst_percent NUMERIC(4,2) DEFAULT 0,
  sgst_percent NUMERIC(4,2) DEFAULT 0,
  igst_percent NUMERIC(4,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  gstin_vendor VARCHAR(20),
  item_order   INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS approvals (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims(id),
  actor_id UUID REFERENCES users(id),
  stage    VARCHAR(30) NOT NULL,
  action   VARCHAR(20) NOT NULL,
  remarks  TEXT,
  acted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  claim_id   UUID REFERENCES claims(id),
  user_id    UUID REFERENCES users(id),
  action     VARCHAR(80) NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  claim_id   UUID REFERENCES claims(id),
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);