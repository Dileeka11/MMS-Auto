-- =====================================================================
--  Accounting auto-posting — LIVE install (run AFTER accounting_live.sql)
--
--  Run once in phpMyAdmin (SQL tab) on the live database BEFORE deploying
--  the code that auto-posts invoices / receipts / expenses / GRNs / returns /
--  stock adjustments. Same result as `php artisan migrate` (migrations
--  2026_10_22_000002 … 000004) + the new rows in AccountingSeeder.
--  No foreign keys (host rejects FK, errno 150). Idempotent.
--
--  After running it: log in as admin → Accounting → Posting Setup →
--  "Re-post all documents" to backfill journals for existing documents.
-- =====================================================================

SET NAMES utf8mb4;

-- 1. Tables / columns ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `account_mappings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(40) NOT NULL,
  `account_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_mappings_key_unique` (`key`),
  KEY `account_mappings_account_id_index` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- stock_adjustments.unit_cost (only added when missing)
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_adjustments' AND COLUMN_NAME = 'unit_cost');
SET @sql := IF(@has = 0, 'ALTER TABLE `stock_adjustments` ADD `unit_cost` decimal(14,2) NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Item-level sales returns
CREATE TABLE IF NOT EXISTS `sales_return_lines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sales_return_id` bigint(20) unsigned NOT NULL,
  `invoice_line_id` bigint(20) unsigned DEFAULT NULL,
  `code` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `qty` int(11) NOT NULL,
  `rate` decimal(14,2) NOT NULL DEFAULT 0.00,
  `unit_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sales_return_lines_sales_return_id_index` (`sales_return_id`),
  KEY `sales_return_lines_invoice_line_id_index` (`invoice_line_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_returns' AND COLUMN_NAME = 'vat_amount');
SET @sql := IF(@has = 0, 'ALTER TABLE `sales_returns` ADD `vat_amount` decimal(14,2) NOT NULL DEFAULT 0, ADD `restocked` tinyint(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. New default accounts -----------------------------------------------
INSERT IGNORE INTO `accounts` (`group_id`,`code`,`name`,`is_active`,`is_default`,`created_by`,`created_at`,`updated_at`)
SELECT g.`id`, v.`code`, v.`name`, 1, 1, 'system', NOW(), NOW()
FROM (
            SELECT '410100' AS code, 'Sales Returns' AS name, '4100' AS grp
  UNION ALL SELECT '510100', 'Stock Adjustment (Gain)/Loss', '5100'
) v
JOIN `account_groups` g ON g.`code` = v.`grp`;

-- 3. Posting roles → default accounts (by code) -------------------------
INSERT IGNORE INTO `account_mappings` (`key`,`account_id`,`created_at`,`updated_at`)
SELECT v.`k`, a.`id`, NOW(), NOW()
FROM (
            SELECT 'cash' AS k,       '110000' AS code
  UNION ALL SELECT 'bank',             '110100'
  UNION ALL SELECT 'receivable',       '110200'
  UNION ALL SELECT 'inventory',        '110300'
  UNION ALL SELECT 'vat_input',        '110400'
  UNION ALL SELECT 'payable',          '210000'
  UNION ALL SELECT 'vat_output',       '210100'
  UNION ALL SELECT 'sales',            '410000'
  UNION ALL SELECT 'sales_returns',    '410100'
  UNION ALL SELECT 'cogs',             '510000'
  UNION ALL SELECT 'stock_adjustment', '510100'
  UNION ALL SELECT 'discount',         '520000'
  UNION ALL SELECT 'expense',          '5009'
  UNION ALL SELECT 'retained_earnings','3002'
) v
LEFT JOIN `accounts` a ON a.`code` = v.`code`;

-- 4. Merge duplicate accounts into the 110000 series ---------------------
--    (same as migration 2026_10_22_000004). Postings, opening balances and
--    mappings move to the keeper; the duplicate is deactivated. A duplicate
--    with sub-accounts is skipped. 1001 HNB Bank and 2001 AP stay separate.
DROP TEMPORARY TABLE IF EXISTS `tmp_merge`;
CREATE TEMPORARY TABLE `tmp_merge` (`dup_id` bigint unsigned, `keep_id` bigint unsigned, `keep_code` varchar(20));
INSERT INTO `tmp_merge`
SELECT d.`id`, k.`id`, k.`code`
FROM (
            SELECT '1002' AS dup, '110000' AS keep
  UNION ALL SELECT '1003', '110200'
  UNION ALL SELECT '5001', '110300'
  UNION ALL SELECT '2002', '210000'
  UNION ALL SELECT '4001', '410000'
  UNION ALL SELECT '5004', '510000'
) p
JOIN `accounts` d ON d.`code` = p.`dup` AND d.`is_active` = 1
JOIN `accounts` k ON k.`code` = p.`keep`
WHERE NOT EXISTS (SELECT 1 FROM `accounts` c WHERE c.`parent_id` = d.`id`);

UPDATE `journal_lines` l JOIN `tmp_merge` m ON m.`dup_id` = l.`account_id` SET l.`account_id` = m.`keep_id`;
UPDATE `account_mappings` x JOIN `tmp_merge` m ON m.`dup_id` = x.`account_id` SET x.`account_id` = m.`keep_id`;

-- opening balances: add into the keeper's row for the same year, then net it
UPDATE `opening_balances` kb
JOIN `tmp_merge` m ON m.`keep_id` = kb.`account_id`
JOIN `opening_balances` db ON db.`account_id` = m.`dup_id` AND db.`financial_year_id` = kb.`financial_year_id`
SET kb.`debit` = kb.`debit` + db.`debit`, kb.`credit` = kb.`credit` + db.`credit`;
DELETE db FROM `opening_balances` db
JOIN `tmp_merge` m ON m.`dup_id` = db.`account_id`
JOIN `opening_balances` kb ON kb.`account_id` = m.`keep_id` AND kb.`financial_year_id` = db.`financial_year_id`;
UPDATE `opening_balances` ob JOIN `tmp_merge` m ON m.`dup_id` = ob.`account_id` SET ob.`account_id` = m.`keep_id`;
UPDATE `opening_balances` SET `debit` = `debit` - `credit`, `credit` = 0 WHERE `debit` >= `credit` AND `credit` > 0;
UPDATE `opening_balances` SET `credit` = `credit` - `debit`, `debit` = 0 WHERE `credit` > `debit` AND `debit` > 0;

UPDATE `accounts` a JOIN `tmp_merge` m ON m.`dup_id` = a.`id`
SET a.`is_active` = 0, a.`name` = LEFT(CONCAT(a.`name`, ' (merged into ', m.`keep_code`, ')'), 150);
DROP TEMPORARY TABLE `tmp_merge`;

-- 5. Record the migrations -----------------------------------------------
SET @batch := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);
INSERT INTO `migrations` (`migration`,`batch`)
SELECT v.m, @batch
FROM (
            SELECT 1 AS seq, '2026_10_22_000002_create_account_mappings_table' AS m
  UNION ALL SELECT 2, '2026_10_22_000003_add_lines_to_sales_returns'
  UNION ALL SELECT 3, '2026_10_22_000004_merge_duplicate_accounts'
) v
WHERE NOT EXISTS (SELECT 1 FROM `migrations` x WHERE x.`migration` = v.m)
ORDER BY v.seq;

-- 6. Quick check — expect 14 | 14 | 2 | 0
SELECT
  (SELECT COUNT(*) FROM `account_mappings`)                                AS roles,
  (SELECT COUNT(*) FROM `account_mappings` WHERE `account_id` IS NOT NULL) AS roles_with_account,
  (SELECT COUNT(*) FROM `accounts` WHERE `code` IN ('410100','510100'))     AS new_accounts,
  (SELECT COUNT(*) FROM `accounts` WHERE `code` IN ('1002','1003','5001','2002','4001','5004') AND `is_active` = 1) AS active_duplicates;
