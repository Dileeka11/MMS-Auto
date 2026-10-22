-- =====================================================================
--  Accounting auto-posting — LIVE install (run AFTER accounting_live.sql)
--
--  Run once in phpMyAdmin (SQL tab) on the live database BEFORE deploying
--  the code that auto-posts invoices / receipts / expenses / GRNs / returns /
--  stock adjustments. Same result as `php artisan migrate` (migration
--  2026_10_22_000002) + the new rows in AccountingSeeder.
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
) v
LEFT JOIN `accounts` a ON a.`code` = v.`code`;

-- 4. Record the migration ------------------------------------------------
INSERT INTO `migrations` (`migration`,`batch`)
SELECT '2026_10_22_000002_create_account_mappings_table', IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_10_22_000002_create_account_mappings_table');

-- 5. Quick check — expect 13 | 13 | 2
SELECT
  (SELECT COUNT(*) FROM `account_mappings`)                            AS roles,
  (SELECT COUNT(*) FROM `account_mappings` WHERE `account_id` IS NOT NULL) AS roles_with_account,
  (SELECT COUNT(*) FROM `accounts` WHERE `code` IN ('410100','510100')) AS new_accounts;
