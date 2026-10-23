-- =====================================================================
--  Cash Book — LIVE install (run AFTER accounting_posting_live.sql)
--
--  Run once in phpMyAdmin (SQL tab) BEFORE deploying the Cash Book code.
--  Same result as `php artisan migrate` (2026_10_23_000001_create_cash_book).
--  No foreign keys (host rejects FK, errno 150). Idempotent.
-- =====================================================================

SET NAMES utf8mb4;

-- accounts.is_cashbook (+ flag Cash, Bank, HNB Bank the first time)
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'is_cashbook');
SET @sql := IF(@has = 0, 'ALTER TABLE `accounts` ADD `is_cashbook` tinyint(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := IF(@has = 0, 'UPDATE `accounts` SET `is_cashbook` = 1 WHERE `code` IN (''110000'',''110100'',''1001'')', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS `cash_vouchers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `type` varchar(10) NOT NULL,
  `date` date NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `counter_account_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `party` varchar(150) DEFAULT NULL,
  `supplier` varchar(150) DEFAULT NULL,
  `reference` varchar(60) DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cash_vouchers_code_unique` (`code`),
  KEY `cash_vouchers_date_index` (`date`),
  KEY `cash_vouchers_account_id_index` (`account_id`),
  KEY `cash_vouchers_counter_account_id_index` (`counter_account_id`),
  KEY `cash_vouchers_supplier_index` (`supplier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'payment_account_id');
SET @sql := IF(@has = 0, 'ALTER TABLE `expenses` ADD `payment_account_id` bigint(20) unsigned NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'receipts' AND COLUMN_NAME = 'account_id');
SET @sql := IF(@has = 0, 'ALTER TABLE `receipts` ADD `account_id` bigint(20) unsigned NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`migration`,`batch`)
SELECT '2026_10_23_000001_create_cash_book', IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_10_23_000001_create_cash_book');

-- Quick check — expect 3 (or more if you flagged others) | 1
SELECT
  (SELECT COUNT(*) FROM `accounts` WHERE `is_cashbook` = 1) AS cashbook_accounts,
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cash_vouchers') AS vouchers_table;
