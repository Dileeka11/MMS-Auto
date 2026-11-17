-- =====================================================================
--  Expense Type master — LIVE install
--
--  Loads Master Files → Expense Type from the "E" cost codes: one type per
--  postable E-account (101 types), Code = GL Account = the cost code, so an
--  expense posts straight to that account. Header accounts (E3000, E4000 …)
--  and the system-posted E3110 (COGS) / E3320 (stock adjustment) are left out.
--  Names that occur twice in the chart carry their section, e.g.
--  "Staff Training (Admin)" / "Staff Training (S&D)".
--
--  Same result as `php artisan migrate` (2026_11_17_000001_install_expense_types)
--  i.e. App\Services\Accounting\ExpenseTypes::install().
--  Run in phpMyAdmin (SQL tab) AFTER nms_cost_codes_live.sql. Idempotent:
--  a type whose code or name already exists is skipped, so edits made in
--  Master Files are kept.
--
--  Existing types with an E cost code but a blank GL Account get that code
--  as their GL Account. Old types whose GL account is not in the chart (demo Fuel / Salary /
--  Rent …, accounts 5101–5199) are set Inactive, not deleted — past
--  expenses keep their type.
--
--  Generated from ExpenseTypes::rows() — regenerate rather than hand-edit.
-- =====================================================================

SET NAMES utf8mb4;
START TRANSACTION;

-- 1. Retire types pointing at a GL account that isn't in the chart --------
UPDATE `masters` m
SET m.`status` = 'Inactive', m.`updated_at` = NOW()
WHERE m.`type` = 'expenseType' AND m.`status` <> 'Inactive'
  AND IFNULL(JSON_UNQUOTE(JSON_EXTRACT(m.`data`, '$.account')), '') <> ''
  AND JSON_UNQUOTE(JSON_EXTRACT(m.`data`, '$.account')) NOT IN (SELECT a.`code` FROM `accounts` a WHERE a.`is_active` = 1);

-- 2. Types entered by hand with a cost code but no GL Account: link them --
UPDATE `masters` m
SET m.`data` = JSON_SET(IFNULL(m.`data`, '{}'), '$.account', UPPER(TRIM(m.`code`))), m.`updated_at` = NOW()
WHERE m.`type` = 'expenseType'
  AND IFNULL(JSON_UNQUOTE(JSON_EXTRACT(m.`data`, '$.account')), '') = ''
  AND UPPER(TRIM(m.`code`)) IN (SELECT a.`code` FROM `accounts` a WHERE a.`is_active` = 1);

-- 3. One expense type per postable E cost code ----------------------------
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3120', 'Contract Manufactures', 'Active', '{"account":"E3120","description":"Contract Manufactures Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3120' OR LOWER(TRIM(`name`)) = LOWER('Contract Manufactures')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3130', 'Packing Material', 'Active', '{"account":"E3130","description":"Packing Material Suppliers Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3130' OR LOWER(TRIM(`name`)) = LOWER('Packing Material')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3140', 'Raw Material', 'Active', '{"account":"E3140","description":"Raw Material Suppliers Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3140' OR LOWER(TRIM(`name`)) = LOWER('Raw Material')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3210', 'Material Transport', 'Active', '{"account":"E3210","description":"Material Transport Charges Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3210' OR LOWER(TRIM(`name`)) = LOWER('Material Transport')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3310', 'Stock Provision', 'Active', '{"account":"E3310","description":"Annual Provision For Damaged Stocks & Obsolete Stocks Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3310' OR LOWER(TRIM(`name`)) = LOWER('Stock Provision')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3330', 'Demurrages', 'Active', '{"account":"E3330","description":"Demurrages"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3330' OR LOWER(TRIM(`name`)) = LOWER('Demurrages')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3410', 'Clearance Charges', 'Active', '{"account":"E3410","description":"Clearance Charges Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3410' OR LOWER(TRIM(`name`)) = LOWER('Clearance Charges')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3420', 'Custom Duty', 'Active', '{"account":"E3420","description":"Custom Duty Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3420' OR LOWER(TRIM(`name`)) = LOWER('Custom Duty')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3510', 'Repairs to PME', 'Active', '{"account":"E3510","description":"Repairs to Plant, Machinery & Equipment Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3510' OR LOWER(TRIM(`name`)) = LOWER('Repairs to PME')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3610', 'Cleaning Service', 'Active', '{"account":"E3610","description":"Cleaning Service & Pest Control Services Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3610' OR LOWER(TRIM(`name`)) = LOWER('Cleaning Service')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E3710', 'Other expenses', 'Active', '{"account":"E3710","description":"Other Cost of Sales Expenses"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E3710' OR LOWER(TRIM(`name`)) = LOWER('Other expenses')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4110', 'Board of Directors Remuneration', 'Active', '{"account":"E4110","description":"Board of Directors Remuneration"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4110' OR LOWER(TRIM(`name`)) = LOWER('Board of Directors Remuneration')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4120', 'Salaries', 'Active', '{"account":"E4120","description":"Management Staff Salaries"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4120' OR LOWER(TRIM(`name`)) = LOWER('Salaries')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4130', 'Allowances', 'Active', '{"account":"E4130","description":"Management Staff Allowances"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4130' OR LOWER(TRIM(`name`)) = LOWER('Allowances')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4140', 'Incentive', 'Active', '{"account":"E4140","description":"Management Staff Incentive"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4140' OR LOWER(TRIM(`name`)) = LOWER('Incentive')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4150', 'Holiday Pay', 'Active', '{"account":"E4150","description":"Management Holiday Pay"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4150' OR LOWER(TRIM(`name`)) = LOWER('Holiday Pay')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4160', 'Traveling a (Local) (Admin)', 'Active', '{"account":"E4160","description":"Traveling and Subsistence (Local)"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4160' OR LOWER(TRIM(`name`)) = LOWER('Traveling a (Local) (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4170', 'Traveling (Overseas) (Admin, E4170)', 'Active', '{"account":"E4170","description":"Traveling and Subsistence (Overseas)"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4170' OR LOWER(TRIM(`name`)) = LOWER('Traveling (Overseas) (Admin, E4170)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4180', 'Direct Labor Payment Account (Admin)', 'Active', '{"account":"E4180","description":"Direct Labor Payment"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4180' OR LOWER(TRIM(`name`)) = LOWER('Direct Labor Payment Account (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4190', 'Allowances to Trainees Account (Admin)', 'Active', '{"account":"E4190","description":"Allowances to Trainees"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4190' OR LOWER(TRIM(`name`)) = LOWER('Allowances to Trainees Account (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4200', 'Bonus Account (Admin)', 'Active', '{"account":"E4200","description":"Bonus"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4200' OR LOWER(TRIM(`name`)) = LOWER('Bonus Account (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4210', 'Gratuity Payment (Admin)', 'Active', '{"account":"E4210","description":"Gratuity Payment"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4210' OR LOWER(TRIM(`name`)) = LOWER('Gratuity Payment (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4220', 'Staff Training (Admin)', 'Active', '{"account":"E4220","description":"Staff Training"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4220' OR LOWER(TRIM(`name`)) = LOWER('Staff Training (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4230', 'Library Facilities (Admin)', 'Active', '{"account":"E4230","description":"Library Facilities"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4230' OR LOWER(TRIM(`name`)) = LOWER('Library Facilities (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4240', 'Staff Welfare (Admin)', 'Active', '{"account":"E4240","description":"Staff Welfare"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4240' OR LOWER(TRIM(`name`)) = LOWER('Staff Welfare (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4250', 'Uniforms (Admin)', 'Active', '{"account":"E4250","description":"Uniforms & Protective Clothing"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4250' OR LOWER(TRIM(`name`)) = LOWER('Uniforms (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4260', '12% EPF Contribution (Admin)', 'Active', '{"account":"E4260","description":"12% EPF Contribution for all employees of the Company"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4260' OR LOWER(TRIM(`name`)) = LOWER('12% EPF Contribution (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4270', '3% ETF Contribution (Admin)', 'Active', '{"account":"E4270","description":"3% ETF Contribution for all employees of the Company"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4270' OR LOWER(TRIM(`name`)) = LOWER('3% ETF Contribution (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4280', 'Building Maintenance', 'Active', '{"account":"E4280","description":"Building Maintenance"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4280' OR LOWER(TRIM(`name`)) = LOWER('Building Maintenance')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4290', 'Furniture, fittings', 'Active', '{"account":"E4290","description":"Furniture, fittings and Equipment"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4290' OR LOWER(TRIM(`name`)) = LOWER('Furniture, fittings')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4300', 'Electricity', 'Active', '{"account":"E4300","description":"Electricity Consumption"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4300' OR LOWER(TRIM(`name`)) = LOWER('Electricity')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4310', 'Water', 'Active', '{"account":"E4310","description":"Water Supply Charges"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4310' OR LOWER(TRIM(`name`)) = LOWER('Water')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4320', 'Housing Rent', 'Active', '{"account":"E4320","description":"Housing Rent"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4320' OR LOWER(TRIM(`name`)) = LOWER('Housing Rent')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4330', 'Vehicle Maintenance (Admin)', 'Active', '{"account":"E4330","description":"Vehicle Maintenance"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4330' OR LOWER(TRIM(`name`)) = LOWER('Vehicle Maintenance (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4340', 'Vehicle Fuel, Oil etc. (Admin)', 'Active', '{"account":"E4340","description":"Vehicle Fuel, Oil and Licenses"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4340' OR LOWER(TRIM(`name`)) = LOWER('Vehicle Fuel, Oil etc. (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4350', 'Vehicle Hire', 'Active', '{"account":"E4350","description":"Vehicle Hire Charges"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4350' OR LOWER(TRIM(`name`)) = LOWER('Vehicle Hire')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4360', 'Office Supplies', 'Active', '{"account":"E4360","description":"Office Supplies"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4360' OR LOWER(TRIM(`name`)) = LOWER('Office Supplies')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4370', 'Postage Account', 'Active', '{"account":"E4370","description":"Postage"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4370' OR LOWER(TRIM(`name`)) = LOWER('Postage Account')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4380', 'Telecommunications (Admin)', 'Active', '{"account":"E4380","description":"Telecommunications"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4380' OR LOWER(TRIM(`name`)) = LOWER('Telecommunications (Admin)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4390', 'Software licenses and M', 'Active', '{"account":"E4390","description":"Expenses on Software licenses and maintenance"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4390' OR LOWER(TRIM(`name`)) = LOWER('Software licenses and M')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4400', 'IT related hardware', 'Active', '{"account":"E4400","description":"Expenses on maintenance of IT related hardware"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4400' OR LOWER(TRIM(`name`)) = LOWER('IT related hardware')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4410', 'Consumables Account', 'Active', '{"account":"E4410","description":"Consumables"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4410' OR LOWER(TRIM(`name`)) = LOWER('Consumables Account')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4420', 'Security Expenses', 'Active', '{"account":"E4420","description":"Payment to Security Staff on Contract"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4420' OR LOWER(TRIM(`name`)) = LOWER('Security Expenses')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4430', 'Co. Incorporation Exp', 'Active', '{"account":"E4430","description":"Company Incorporation Expenses"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4430' OR LOWER(TRIM(`name`)) = LOWER('Co. Incorporation Exp')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4440', 'Secretarial Service', 'Active', '{"account":"E4440","description":"Payments to Private Secretarial Service"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4440' OR LOWER(TRIM(`name`)) = LOWER('Secretarial Service')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4450', 'Legal Fees', 'Active', '{"account":"E4450","description":"Legal Fees"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4450' OR LOWER(TRIM(`name`)) = LOWER('Legal Fees')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4460', 'Audit Fees', 'Active', '{"account":"E4460","description":"Audit Fees"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4460' OR LOWER(TRIM(`name`)) = LOWER('Audit Fees')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4470', 'Consultancy Fees', 'Active', '{"account":"E4470","description":"Consultancy Fees"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4470' OR LOWER(TRIM(`name`)) = LOWER('Consultancy Fees')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4480', 'R &D Expenditure', 'Active', '{"account":"E4480","description":"Research & Development Expenditure"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4480' OR LOWER(TRIM(`name`)) = LOWER('R &D Expenditure')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4490', 'Insurance', 'Active', '{"account":"E4490","description":"Insurance Premiums"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4490' OR LOWER(TRIM(`name`)) = LOWER('Insurance')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4500', 'Repairs to office Equipment', 'Active', '{"account":"E4500","description":"Repairs to Furniture & Fittings"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4500' OR LOWER(TRIM(`name`)) = LOWER('Repairs to office Equipment')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4510', 'Traveling (Overseas) (Admin, E4510)', 'Active', '{"account":"E4510","description":"Traveling (Overseas)"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4510' OR LOWER(TRIM(`name`)) = LOWER('Traveling (Overseas) (Admin, E4510)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E4520', 'Other Admin Exp', 'Active', '{"account":"E4520","description":"Other Administration Expenses"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E4520' OR LOWER(TRIM(`name`)) = LOWER('Other Admin Exp')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5110', 'Sales Staff Salaries', 'Active', '{"account":"E5110","description":"Other Staff Salaries Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5110' OR LOWER(TRIM(`name`)) = LOWER('Sales Staff Salaries')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5120', 'Sales Staff OT', 'Active', '{"account":"E5120","description":"Other Staff Overtime Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5120' OR LOWER(TRIM(`name`)) = LOWER('Sales Staff OT')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5130', 'Sales Staff Allowances Account', 'Active', '{"account":"E5130","description":"Other Staff Allowances Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5130' OR LOWER(TRIM(`name`)) = LOWER('Sales Staff Allowances Account')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5140', 'Sales Staff Incentive', 'Active', '{"account":"E5140","description":"Other Staff Incentive Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5140' OR LOWER(TRIM(`name`)) = LOWER('Sales Staff Incentive')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5150', 'Sales Staff Holiday Pay', 'Active', '{"account":"E5150","description":"Other Staff Holiday Pay Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5150' OR LOWER(TRIM(`name`)) = LOWER('Sales Staff Holiday Pay')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5160', 'Traveling a (Local) (S&D)', 'Active', '{"account":"E5160","description":"Traveling and Subsistence (Local)"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5160' OR LOWER(TRIM(`name`)) = LOWER('Traveling a (Local) (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5170', 'Traveling (Overseas) (S&D)', 'Active', '{"account":"E5170","description":"Traveling and Subsistence (Overseas)"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5170' OR LOWER(TRIM(`name`)) = LOWER('Traveling (Overseas) (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5180', 'Direct Labor Payment Account (S&D)', 'Active', '{"account":"E5180","description":"Direct Labor Payment Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5180' OR LOWER(TRIM(`name`)) = LOWER('Direct Labor Payment Account (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5190', 'Allowances to Trainees Account (S&D)', 'Active', '{"account":"E5190","description":"Allowances to Trainees Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5190' OR LOWER(TRIM(`name`)) = LOWER('Allowances to Trainees Account (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5200', 'Bonus Account (S&D)', 'Active', '{"account":"E5200","description":"Bonus Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5200' OR LOWER(TRIM(`name`)) = LOWER('Bonus Account (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5210', 'Gratuity Payment (S&D)', 'Active', '{"account":"E5210","description":"Gratuity Payment Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5210' OR LOWER(TRIM(`name`)) = LOWER('Gratuity Payment (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5220', 'Staff Training (S&D)', 'Active', '{"account":"E5220","description":"Staff Training Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5220' OR LOWER(TRIM(`name`)) = LOWER('Staff Training (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5230', 'Library Facilities (S&D)', 'Active', '{"account":"E5230","description":"Library Facilities Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5230' OR LOWER(TRIM(`name`)) = LOWER('Library Facilities (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5240', 'Staff Welfare (S&D)', 'Active', '{"account":"E5240","description":"Staff Welfare Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5240' OR LOWER(TRIM(`name`)) = LOWER('Staff Welfare (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5250', 'Uniforms (S&D)', 'Active', '{"account":"E5250","description":"Uniforms & Protective Clothing Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5250' OR LOWER(TRIM(`name`)) = LOWER('Uniforms (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5260', '12% EPF Contribution (S&D)', 'Active', '{"account":"E5260","description":"12% EPF Contribution for all employees of the Company"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5260' OR LOWER(TRIM(`name`)) = LOWER('12% EPF Contribution (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5270', '3% ETF Contribution (S&D)', 'Active', '{"account":"E5270","description":"3% ETF Contribution for all employees of the Company"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5270' OR LOWER(TRIM(`name`)) = LOWER('3% ETF Contribution (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5280', 'Vehicle Maintenance (S&D)', 'Active', '{"account":"E5280","description":"Vehicle Maintenance Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5280' OR LOWER(TRIM(`name`)) = LOWER('Vehicle Maintenance (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5290', 'Vehicle Fuel, Oil etc. (S&D)', 'Active', '{"account":"E5290","description":"Vehicle Fuel, Oil and Licenses Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5290' OR LOWER(TRIM(`name`)) = LOWER('Vehicle Fuel, Oil etc. (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5300', 'Vehicle Hire Charge', 'Active', '{"account":"E5300","description":"Vehicle Hire Charges Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5300' OR LOWER(TRIM(`name`)) = LOWER('Vehicle Hire Charge')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5310', 'Telecommunications (S&D)', 'Active', '{"account":"E5310","description":"Telecommunications Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5310' OR LOWER(TRIM(`name`)) = LOWER('Telecommunications (S&D)')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5320', 'Advertising & Promotion', 'Active', '{"account":"E5320","description":"Advertising & Promotion Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5320' OR LOWER(TRIM(`name`)) = LOWER('Advertising & Promotion')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5330', 'Public Relations', 'Active', '{"account":"E5330","description":"Public Relations"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5330' OR LOWER(TRIM(`name`)) = LOWER('Public Relations')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5340', 'Entertainment', 'Active', '{"account":"E5340","description":"Entertainment Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5340' OR LOWER(TRIM(`name`)) = LOWER('Entertainment')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5350', 'Donation', 'Active', '{"account":"E5350","description":"Donation Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5350' OR LOWER(TRIM(`name`)) = LOWER('Donation')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5360', 'CSR Exp', 'Active', '{"account":"E5360","description":"Corporate Social Responsibility (CSR) Projects Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5360' OR LOWER(TRIM(`name`)) = LOWER('CSR Exp')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5370', 'Bad Debts Written Off', 'Active', '{"account":"E5370","description":"Bad Debts Written Off Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5370' OR LOWER(TRIM(`name`)) = LOWER('Bad Debts Written Off')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5380', 'Provision - Bad Debts', 'Active', '{"account":"E5380","description":"Provision for Bad Debts Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5380' OR LOWER(TRIM(`name`)) = LOWER('Provision - Bad Debts')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5390', 'Other S&D Exp', 'Active', '{"account":"E5390","description":"Other Selling and Distribution Expenses"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5390' OR LOWER(TRIM(`name`)) = LOWER('Other S&D Exp')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E5400', 'Courier Charges', 'Active', '{"account":"E5400","description":"Courier Charges"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E5400' OR LOWER(TRIM(`name`)) = LOWER('Courier Charges')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6110', 'Buildings', 'Active', '{"account":"E6110","description":"Depreciation - Buildings"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6110' OR LOWER(TRIM(`name`)) = LOWER('Buildings')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6120', 'Vehicles', 'Active', '{"account":"E6120","description":"Depreciation - Vehicles"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6120' OR LOWER(TRIM(`name`)) = LOWER('Vehicles')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6130', 'Leasehold Vehicles.', 'Active', '{"account":"E6130","description":"Depreciation - Leasehold Vehicles."}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6130' OR LOWER(TRIM(`name`)) = LOWER('Leasehold Vehicles.')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6140', 'Lab Equipment', 'Active', '{"account":"E6140","description":"Depreciation - Lab Equipment"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6140' OR LOWER(TRIM(`name`)) = LOWER('Lab Equipment')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6150', 'Waste Water TP', 'Active', '{"account":"E6150","description":"Depreciation - Waste Water Treatment Plant"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6150' OR LOWER(TRIM(`name`)) = LOWER('Waste Water TP')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6160', 'Intangible Assets', 'Active', '{"account":"E6160","description":"Depreciation - Intangible Assets"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6160' OR LOWER(TRIM(`name`)) = LOWER('Intangible Assets')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6170', 'Computers & IT', 'Active', '{"account":"E6170","description":"Depreciation - Computers & IT related Equipment Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6170' OR LOWER(TRIM(`name`)) = LOWER('Computers & IT')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6180', 'Other Sundry Assets', 'Active', '{"account":"E6180","description":"Depreciation - Other Sundry Assets"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6180' OR LOWER(TRIM(`name`)) = LOWER('Other Sundry Assets')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6190', 'Furniture & Fittings', 'Active', '{"account":"E6190","description":"Depreciation - Furniture & Fittings"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6190' OR LOWER(TRIM(`name`)) = LOWER('Furniture & Fittings')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6200', 'Machinery & Tools', 'Active', '{"account":"E6200","description":"Depreciation - Machinery & Tools"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6200' OR LOWER(TRIM(`name`)) = LOWER('Machinery & Tools')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E6210', 'Solar System', 'Active', '{"account":"E6210","description":"Depreciation of Solar System"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E6210' OR LOWER(TRIM(`name`)) = LOWER('Solar System')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E7100', 'Overdraft Interest', 'Active', '{"account":"E7100","description":"Overdraft Interest Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E7100' OR LOWER(TRIM(`name`)) = LOWER('Overdraft Interest')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E7200', 'Interest charges', 'Active', '{"account":"E7200","description":"Long / Short Term Interest Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E7200' OR LOWER(TRIM(`name`)) = LOWER('Interest charges')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E7300', 'Bank Charges', 'Active', '{"account":"E7300","description":"Bank Charges Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E7300' OR LOWER(TRIM(`name`)) = LOWER('Bank Charges')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E7400', 'Exchange Gain/ Losses', 'Active', '{"account":"E7400","description":"Exchange Rate Gain/ Losses Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E7400' OR LOWER(TRIM(`name`)) = LOWER('Exchange Gain/ Losses')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E7500', 'Other Finance Exp', 'Active', '{"account":"E7500","description":"Other Finance Expenses"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E7500' OR LOWER(TRIM(`name`)) = LOWER('Other Finance Exp')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E8100', 'Income Tax', 'Active', '{"account":"E8100","description":"Income Tax Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E8100' OR LOWER(TRIM(`name`)) = LOWER('Income Tax')));
INSERT INTO `masters` (`type`,`code`,`name`,`status`,`data`,`created_at`,`updated_at`)
SELECT 'expenseType', 'E8200', 'Other Taxes', 'Active', '{"account":"E8200","description":"Other Taxes Account"}', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `masters` WHERE `type` = 'expenseType' AND (UPPER(TRIM(`code`)) = 'E8200' OR LOWER(TRIM(`name`)) = LOWER('Other Taxes')));

-- 4. Mark the migration as run ---------------------------------------------
INSERT INTO `migrations` (`migration`,`batch`)
SELECT '2026_11_17_000001_install_expense_types', IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_11_17_000001_install_expense_types');

COMMIT;

-- 5. Quick check — expect 101 or more active E-code types
SELECT COUNT(*) AS active_e_code_expense_types
FROM `masters` WHERE `type` = 'expenseType' AND `status` = 'Active' AND `code` REGEXP '^E[0-9]{4}$';
