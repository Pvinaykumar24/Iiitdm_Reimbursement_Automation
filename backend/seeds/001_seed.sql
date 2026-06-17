-- Password for all seed users is: Password@123
-- Hash generated with bcrypt rounds=10

INSERT INTO users (name, email, password, role, department, employee_id) VALUES
('Dr. Karthick S',  'karthick@iiitdm.ac.in', '$2a$10$vSEuB9Ap1pZazXqFEMJnf.Et0JYGHRcRARHnwEDFoCwlV9x/AX9m6', 'FACULTY',  'ECE', 'FAC001'),
('Dr. Priya M',     'priya@iiitdm.ac.in',    '$2a$10$vSEuB9Ap1pZazXqFEMJnf.Et0JYGHRcRARHnwEDFoCwlV9x/AX9m6', 'FACULTY',  'CSE', 'FAC002'),
('Dean SR Office',  'dean@iiitdm.ac.in',     '$2a$10$vSEuB9Ap1pZazXqFEMJnf.Et0JYGHRcRARHnwEDFoCwlV9x/AX9m6', 'DEAN',     NULL,  'DEAN01'),
('Accounts Office', 'accounts@iiitdm.ac.in', '$2a$10$vSEuB9Ap1pZazXqFEMJnf.Et0JYGHRcRARHnwEDFoCwlV9x/AX9m6', 'ACCOUNTS', NULL,  'ACC01'),
('Admin',           'admin@iiitdm.ac.in',    '$2a$10$vSEuB9Ap1pZazXqFEMJnf.Et0JYGHRcRARHnwEDFoCwlV9x/AX9m6', 'ADMIN',    NULL,  'ADM01');

-- Seed a project for Dr. Karthick (replace UUID after running the users insert)
INSERT INTO projects (project_no, title, funding_agency, pi_id, total_budget, start_date, end_date)
SELECT 'MTRDC-DRDO-CARS-01', 'MTRDC DRDO CARS Research Project', 'DRDO',
       id, 500000.00, '2025-01-01', '2027-12-31'
FROM users WHERE email='karthick@iiitdm.ac.in';

INSERT INTO budget_heads (project_id, head_name, allocated)
SELECT id, 'Equipment',   200000.00 FROM projects WHERE project_no='MTRDC-DRDO-CARS-01'
UNION ALL
SELECT id, 'Consumable',  100000.00 FROM projects WHERE project_no='MTRDC-DRDO-CARS-01'
UNION ALL
SELECT id, 'Contingency',  50000.00 FROM projects WHERE project_no='MTRDC-DRDO-CARS-01'
UNION ALL
SELECT id, 'Travel',       80000.00 FROM projects WHERE project_no='MTRDC-DRDO-CARS-01'
UNION ALL
SELECT id, 'Others',       70000.00 FROM projects WHERE project_no='MTRDC-DRDO-CARS-01';