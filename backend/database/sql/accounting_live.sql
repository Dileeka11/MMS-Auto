-- =====================================================================
--  Accounting module — LIVE install
--  (Financial Year, Chart of Accounts, Journal, General Ledger, Trial Balance)
--
--  Run once in phpMyAdmin (SQL tab) on the live MMS-Auto database.
--  Same result as `php artisan migrate` + `php artisan db:seed --class=AccountingSeeder`.
--  No foreign keys (the host rejects FK, errno 150) — integrity is enforced
--  in the Laravel app layer. Idempotent: safe to run more than once.
--
--  Permissions: nothing to insert — the "Accounting" module lives in
--  App\Support\Permissions::MODULES. Grant it from Administration → User Permission.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Tables (exact structure the Laravel migrations produce)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `account_categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `normal_balance` enum('debit','credit') NOT NULL,
  `statement_type` enum('BS','PNL') NOT NULL DEFAULT 'BS',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_categories_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_groups` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) unsigned NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_groups_code_unique` (`code`),
  KEY `account_groups_category_id_index` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint(20) unsigned NOT NULL,
  `parent_id` bigint(20) unsigned DEFAULT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(150) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` varchar(50) NOT NULL DEFAULT 'admin',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_code_unique` (`code`),
  KEY `accounts_group_id_index` (`group_id`),
  KEY `accounts_parent_id_index` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `entry_date` date NOT NULL,
  `posting_date` date DEFAULT NULL,
  `reference` varchar(50) DEFAULT NULL,
  `source_type` varchar(40) DEFAULT NULL,
  `source_id` bigint(20) unsigned DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'LKR',
  `branch` varchar(100) DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `financial_year_id` bigint(20) unsigned DEFAULT NULL,
  `invoice_number` varchar(30) DEFAULT NULL,
  `customer_name` varchar(150) DEFAULT NULL,
  `payment_method` varchar(20) DEFAULT NULL,
  `payment_account_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `journal_entries_source_type_source_id_unique` (`source_type`,`source_id`),
  KEY `journal_entries_entry_date_index` (`entry_date`),
  KEY `journal_entries_financial_year_id_index` (`financial_year_id`),
  KEY `journal_entries_payment_account_id_index` (`payment_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_lines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `entry_id` bigint(20) unsigned NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `memo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `journal_lines_entry_id_index` (`entry_id`),
  KEY `journal_lines_account_id_index` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_years` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `year_name` varchar(20) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `opening_balances` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `financial_year_id` bigint(20) unsigned NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ob_year_account` (`financial_year_id`,`account_id`),
  KEY `opening_balances_financial_year_id_index` (`financial_year_id`),
  KEY `opening_balances_account_id_index` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. Seed — 5 categories, 8 groups, 34 default accounts, FY 2026/2027
--    (INSERT IGNORE skips rows that already exist by unique code;
--     groups/accounts are linked to their parent by code, not by id)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `account_categories` (`code`,`name`,`normal_balance`,`statement_type`,`created_at`,`updated_at`) VALUES
  ('1000','Assets','debit','BS',NOW(),NOW()),
  ('2000','Liabilities','credit','BS',NOW(),NOW()),
  ('3000','Equity','credit','BS',NOW(),NOW()),
  ('4000','Income','credit','PNL',NOW(),NOW()),
  ('5000','Expenses','debit','PNL',NOW(),NOW());

INSERT IGNORE INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, v.`code`, v.`name`, NOW(), NOW()
FROM (
            SELECT 1 AS seq, '1100' AS code, 'Current Assets' AS name, '1000' AS cat
  UNION ALL SELECT 2, '1200', 'Non Current Assets',      '1000'
  UNION ALL SELECT 3, '2100', 'Current Liabilities',     '2000'
  UNION ALL SELECT 4, '2200', 'Long Term Liabilities',   '2000'
  UNION ALL SELECT 5, '3100', 'Owner Equity',            '3000'
  UNION ALL SELECT 6, '4100', 'Operating Income',        '4000'
  UNION ALL SELECT 7, '5100', 'Administrative Expenses', '5000'
  UNION ALL SELECT 8, '5200', 'Selling Expenses',        '5000'
) v
JOIN `account_categories` c ON c.`code` = v.`cat`
ORDER BY v.seq;

INSERT IGNORE INTO `accounts` (`group_id`,`code`,`name`,`is_active`,`is_default`,`created_by`,`created_at`,`updated_at`)
SELECT g.`id`, v.`code`, v.`name`, 1, 1, 'system', NOW(), NOW()
FROM (
            SELECT  1 AS seq, '110000' AS code, 'Cash' AS name, '1100' AS grp
  UNION ALL SELECT  2, '110100', 'Bank',                            '1100'
  UNION ALL SELECT  3, '110200', 'Trade Receivable',                '1100'
  UNION ALL SELECT  4, '110300', 'Inventory',                       '1100'
  UNION ALL SELECT  5, '110400', 'VAT Input (Recoverable)',         '1100'
  UNION ALL SELECT  6, '210000', 'Trade Payable',                   '2100'
  UNION ALL SELECT  7, '210100', 'VAT Output (Payable)',            '2100'
  UNION ALL SELECT  8, '410000', 'Sales Revenue',                   '4100'
  UNION ALL SELECT  9, '510000', 'Cost of Sales',                   '5100'
  UNION ALL SELECT 10, '520000', 'Cash Discount Given',             '5200'
  -- Stage-01 account master
  UNION ALL SELECT 11, '1001',   'HNB Bank Account',                '1100'
  UNION ALL SELECT 12, '1002',   'Cash in Hand',                    '1100'
  UNION ALL SELECT 13, '1003',   'Trade Receivables',               '1100'
  UNION ALL SELECT 14, '1004',   'Prepayments',                     '1100'
  UNION ALL SELECT 15, '1005',   'Fixed Assets',                    '1200'
  UNION ALL SELECT 16, '5001',   'Inventory / Stock',               '1100'
  UNION ALL SELECT 17, '2001',   'Accounts Payable',                '2100'
  UNION ALL SELECT 18, '2002',   'Trade Payables',                  '2100'
  UNION ALL SELECT 19, '2003',   'Accrued Expenses',                '2100'
  UNION ALL SELECT 20, '2004',   'Loans',                           '2200'
  UNION ALL SELECT 21, '2005',   'Tax Payable',                     '2100'
  UNION ALL SELECT 22, '3001',   'Share Capital',                   '3100'
  UNION ALL SELECT 23, '3002',   'Retained Earnings',               '3100'
  UNION ALL SELECT 24, '4001',   'Sales Revenue (Stage 01)',        '4100'
  UNION ALL SELECT 25, '4002',   'Other Income',                    '4100'
  UNION ALL SELECT 26, '5002',   'Office Stationery Expense',       '5100'
  UNION ALL SELECT 27, '5003',   'IT Equipment Expense',            '5100'
  UNION ALL SELECT 28, '5004',   'Cost of Sales (Stage 01)',        '5100'
  UNION ALL SELECT 29, '5005',   'Salaries',                        '5100'
  UNION ALL SELECT 30, '5006',   'Rent',                            '5100'
  UNION ALL SELECT 31, '5007',   'Utilities',                       '5100'
  UNION ALL SELECT 32, '5008',   'Finance Costs',                   '5100'
  UNION ALL SELECT 33, '5009',   'Administrative Expenses',         '5100'
  UNION ALL SELECT 34, '5010',   'Selling & Distribution Expenses', '5200'
) v
JOIN `account_groups` g ON g.`code` = v.`grp`
ORDER BY v.seq;

INSERT INTO `financial_years` (`year_name`,`start_date`,`end_date`,`is_active`,`created_at`,`updated_at`)
SELECT '2026/2027', '2026-04-01', '2027-03-31', 1, NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `financial_years` WHERE `year_name` = '2026/2027');

-- ---------------------------------------------------------------------
-- 3. Record the migrations so `php artisan migrate` never re-creates
--    these tables (each row is only inserted if it isn't there yet).
-- ---------------------------------------------------------------------
SET @batch := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`,`batch`)
SELECT v.m, @batch
FROM (
            SELECT 1 AS seq, '2026_10_15_000001_create_accounting_tables' AS m
  UNION ALL SELECT 2, '2026_10_15_000002_add_parent_to_accounts'
  UNION ALL SELECT 3, '2026_10_15_000003_create_financial_years_table'
  UNION ALL SELECT 4, '2026_10_15_000004_create_opening_balances_table'
  UNION ALL SELECT 5, '2026_10_15_000005_extend_journal_entries_for_sales'
) v
WHERE NOT EXISTS (SELECT 1 FROM `migrations` x WHERE x.`migration` = v.m)
ORDER BY v.seq;

-- ---------------------------------------------------------------------
-- 4. Quick check — expect 5 | 8 | 34 | 1
-- ---------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM `account_categories`)                  AS categories,
  (SELECT COUNT(*) FROM `account_groups`)                      AS `groups`,
  (SELECT COUNT(*) FROM `accounts` WHERE `is_default` = 1)     AS default_accounts,
  (SELECT COUNT(*) FROM `financial_years` WHERE `is_active` = 1) AS active_years;
