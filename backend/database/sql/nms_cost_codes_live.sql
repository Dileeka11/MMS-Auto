-- =====================================================================
--  NMS Auto cost codes — LIVE install
--
--  Switches the Chart of Accounts to the cost codes in
--  "Cost Code - Rev A (NMS Auto).xls" (sheet "Cost Code - NMS (Final)"):
--  the sheet's Account Types become the account groups, its cost codes
--  (R1000, R1000:R1100, E3000 … L7000) the accounts, with descriptions.
--
--  Same result as `php artisan migrate` (2026_11_09_000004_install_nms_cost_codes)
--  i.e. App\Services\Accounting\CostCodes::install(). Run once in phpMyAdmin
--  (SQL tab) BEFORE deploying the matching code. Idempotent.
--
--  Existing accounts are RE-CODED IN PLACE (same id), so journals, receipts,
--  vouchers and Posting Setup keep working:
--    110000 Cash → A3140 · 110200 → A3210 · 410000 → R1100 · 210100 → L4610 …
--  110100 Bank is merged into A3121 HNB Bank Account (old 1001).
--  Old seeded accounts with no cost code are deleted when unused.
--
--  TAKE A DATABASE BACKUP (phpMyAdmin → Export) FIRST.
--  Generated file — edit the generator, not this script.
-- =====================================================================

SET NAMES utf8mb4;

-- 1. accounts.description -------------------------------------------------
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'description');
SET @sql := IF(@has = 0, 'ALTER TABLE `accounts` ADD `description` varchar(255) NULL AFTER `name`', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- Everything below runs in one transaction (ALTER TABLE above commits on its own).
START TRANSACTION;

-- 2. Groups — the sheet's Account Types -------------------------------------
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'A1', 'Fixed Assets', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '1000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'A2', 'Other Assets', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '1000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'A31', 'Bank', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '1000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'A32', 'Accounts Receivable', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '1000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'A35', 'Other Current Assets', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '1000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'L41', 'Accounts Payable', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '2000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'L43', 'Other Current Liabilities', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '2000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'L48', 'Long Term Liabilities', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '2000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'L50', 'Loans', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '2000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'L60', 'Equity', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '3000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'R1', 'Income', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '4000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'R2', 'Other Income', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '4000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'E3', 'Cost of Goods Sold', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '5000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();
INSERT INTO `account_groups` (`category_id`,`code`,`name`,`created_at`,`updated_at`)
SELECT c.`id`, 'E4', 'Expenses', NOW(), NOW() FROM `account_categories` c WHERE c.`code` = '5000'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category_id` = VALUES(`category_id`), `updated_at` = NOW();

-- 3. Old chart → cost codes (re-code in place; merge when the code is taken) ---

-- 110000 → A3140
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '110000');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'A3140');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'A3140' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'A3140')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '110000';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 1001 → A3121
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '1001');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'A3121');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'A3121' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'A3121')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '1001';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 110100 → A3121
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '110100');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'A3121');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'A3121' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'A3121')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '110100';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 110200 → A3210
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '110200');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'A3210');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'A3210' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'A3210')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '110200';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 110300 → A3810
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '110300');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'A3810');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'A3810' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'A3810')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '110300';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 110400 → A3543
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '110400');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'A3543');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'A3543' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'A3543')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '110400';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 210000 → L4140
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '210000');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'L4140');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'L4140' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'L4140')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '210000';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 2001 → L4140
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '2001');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'L4140');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'L4140' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'L4140')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '2001';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 210100 → L4610
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '210100');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'L4610');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'L4610' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'L4610')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '210100';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 410000 → R1100
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '410000');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'R1100');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'R1100' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'R1100')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '410000';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 410100 → R1200
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '410100');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'R1200');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'R1200' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'R1200')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '410100';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 520000 → R1400
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '520000');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'R1400');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'R1400' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'R1400')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '520000';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 510000 → E3110
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '510000');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E3110');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E3110' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E3110')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '510000';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 510100 → E3320
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '510100');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E3320');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E3320' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E3320')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '510100';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 5009 → E4520
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '5009');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E4520');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E4520' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E4520')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '5009';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 3002 → L7000
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '3002');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'L7000');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'L7000' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'L7000')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '3002';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 1004 → A3511
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '1004');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'A3511');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'A3511' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'A3511')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '1004';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 1005 → A1140
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '1005');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'A1140');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'A1140' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'A1140')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '1005';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 2004 → L5210
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '2004');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'L5210');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'L5210' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'L5210')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '2004';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 2005 → L4650
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '2005');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'L4650');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'L4650' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'L4650')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '2005';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 4002 → R2100
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '4002');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'R2100');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'R2100' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'R2100')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '4002';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 5002 → E4360
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '5002');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E4360');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E4360' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E4360')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '5002';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 5003 → E4400
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '5003');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E4400');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E4400' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E4400')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '5003';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 5005 → E4120
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '5005');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E4120');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E4120' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E4120')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '5005';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 5006 → E4320
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '5006');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E4320');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E4320' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E4320')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '5006';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 5007 → E4300
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '5007');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E4300');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E4300' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E4300')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '5007';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 5008 → E7500
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '5008');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E7500');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E7500' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E7500')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '5008';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 5010 → E5390
SET @from := (SELECT `id` FROM `accounts` WHERE `code` = '5010');
SET @into := (SELECT `id` FROM `accounts` WHERE `code` = 'E5390');
SET @merge := (@from IS NOT NULL AND @into IS NOT NULL AND @from <> @into);
UPDATE `accounts` SET `code` = 'E5390' WHERE `id` = @from AND @into IS NULL;
UPDATE `masters` SET `data` = JSON_SET(`data`, '$.account', 'E5390')
  WHERE `type` = 'expenseType' AND @from IS NOT NULL AND JSON_VALID(`data`)
    AND JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.account')) = '5010';
UPDATE `journal_lines` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `journal_entries` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `account_mappings` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `cash_vouchers` SET `counter_account_id` = @into WHERE @merge AND `counter_account_id` = @from;
UPDATE `expenses` SET `payment_account_id` = @into WHERE @merge AND `payment_account_id` = @from;
UPDATE `receipts` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
UPDATE `accounts` SET `parent_id` = @into WHERE @merge AND `parent_id` = @from;
UPDATE `accounts` k JOIN `accounts` d ON d.`id` = @from SET k.`is_cashbook` = 1 WHERE @merge AND k.`id` = @into AND d.`is_cashbook` = 1;
DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
CREATE TEMPORARY TABLE `tmp_ob` AS
  SELECT k.`id` AS kid, d.`id` AS did, ROUND((k.`debit` - k.`credit`) + (d.`debit` - d.`credit`), 2) AS net
  FROM `opening_balances` k JOIN `opening_balances` d ON d.`financial_year_id` = k.`financial_year_id`
  WHERE @merge AND k.`account_id` = @into AND d.`account_id` = @from;
UPDATE `opening_balances` k JOIN `tmp_ob` t ON t.kid = k.`id` SET k.`debit` = GREATEST(0, t.net), k.`credit` = GREATEST(0, -t.net);
DELETE d FROM `opening_balances` d JOIN `tmp_ob` t ON t.did = d.`id`;
UPDATE `opening_balances` SET `account_id` = @into WHERE @merge AND `account_id` = @from;
DELETE FROM `accounts` WHERE @merge AND `id` = @from;

-- 4. The cost-code chart ---------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS `tmp_chart`;
CREATE TEMPORARY TABLE `tmp_chart` (`seq` int, `code` varchar(20), `parent` varchar(20), `grp` varchar(10), `name` varchar(150), `description` varchar(255)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `tmp_chart` VALUES
  (1, 'R1000', NULL, 'R1', 'Revenue & Income', 'Revenue & Income Related Accounts'),
  (2, 'R1100', 'R1000', 'R1', 'Sales Income', 'Sales Income'),
  (3, 'R1200', 'R1000', 'R1', 'Sales Return', 'Sales Return'),
  (4, 'R1300', 'R1000', 'R1', 'Damage Return', 'Damage Return'),
  (5, 'R1400', 'R1000', 'R1', 'Trade Discount', 'Trade Discount'),
  (6, 'R2000', NULL, 'R2', 'Other Income', 'Other Income'),
  (7, 'R2100', 'R2000', 'R2', 'Sundry', 'Sundry Income'),
  (8, 'R2200', 'R2000', 'R2', 'Interest', 'Interest received on short term and long term investments'),
  (9, 'R2300', 'R2000', 'R2', 'Disposal of Assets', 'Sales income from disposal of fixed assets etc.'),
  (10, 'E3000', NULL, 'E3', 'Cost of Sales', 'Cost of Sales'),
  (11, 'E3110', 'E3000', 'E3', 'Finish Good', 'Finish Good Account'),
  (12, 'E3120', 'E3000', 'E3', 'Contract Manufactures', 'Contract Manufactures Account'),
  (13, 'E3130', 'E3000', 'E3', 'Packing Material', 'Packing Material Suppliers Account'),
  (14, 'E3140', 'E3000', 'E3', 'Raw Material', 'Raw Material Suppliers Account'),
  (15, 'E3210', 'E3000', 'E3', 'Material Transport', 'Material Transport Charges Account'),
  (16, 'E3310', 'E3000', 'E3', 'Stock Provision', 'Annual Provision For Damaged Stocks & Obsolete Stocks Account'),
  (17, 'E3320', 'E3000', 'E3', 'Damages & Losses', 'Damages & Losses on Product'),
  (18, 'E3330', 'E3000', 'E3', 'Demurrages', 'Demurrages'),
  (19, 'E3410', 'E3000', 'E3', 'Clearance Charges', 'Clearance Charges Account'),
  (20, 'E3420', 'E3000', 'E3', 'Custom Duty', 'Custom Duty Account'),
  (21, 'E3510', 'E3000', 'E3', 'Repairs to PME', 'Repairs to Plant, Machinery & Equipment Account'),
  (22, 'E3610', 'E3000', 'E3', 'Cleaning Service', 'Cleaning Service & Pest Control Services Account'),
  (23, 'E3710', 'E3000', 'E3', 'Other expenses', 'Other Cost of Sales Expenses'),
  (24, 'E4000', NULL, 'E4', 'Administration Expenses', 'Administration Expenses'),
  (25, 'E4110', 'E4000', 'E4', 'Board of Directors Remuneration', 'Board of Directors Remuneration'),
  (26, 'E4120', 'E4000', 'E4', 'Salaries', 'Management Staff Salaries'),
  (27, 'E4130', 'E4000', 'E4', 'Allowances', 'Management Staff Allowances'),
  (28, 'E4140', 'E4000', 'E4', 'Incentive', 'Management Staff Incentive'),
  (29, 'E4150', 'E4000', 'E4', 'Holiday Pay', 'Management Holiday Pay'),
  (30, 'E4160', 'E4000', 'E4', 'Traveling a (Local)', 'Traveling and Subsistence (Local)'),
  (31, 'E4170', 'E4000', 'E4', 'Traveling (Overseas)', 'Traveling and Subsistence (Overseas)'),
  (32, 'E4180', 'E4000', 'E4', 'Direct Labor Payment Account', 'Direct Labor Payment'),
  (33, 'E4190', 'E4000', 'E4', 'Allowances to Trainees Account', 'Allowances to Trainees'),
  (34, 'E4200', 'E4000', 'E4', 'Bonus Account', 'Bonus'),
  (35, 'E4210', 'E4000', 'E4', 'Gratuity Payment', 'Gratuity Payment'),
  (36, 'E4220', 'E4000', 'E4', 'Staff Training', 'Staff Training'),
  (37, 'E4230', 'E4000', 'E4', 'Library Facilities', 'Library Facilities'),
  (38, 'E4240', 'E4000', 'E4', 'Staff Welfare', 'Staff Welfare'),
  (39, 'E4250', 'E4000', 'E4', 'Uniforms', 'Uniforms & Protective Clothing'),
  (40, 'E4260', 'E4000', 'E4', '12% EPF Contribution', '12% EPF Contribution for all employees of the Company'),
  (41, 'E4270', 'E4000', 'E4', '3% ETF Contribution', '3% ETF Contribution for all employees of the Company'),
  (42, 'E4280', 'E4000', 'E4', 'Building Maintenance', 'Building Maintenance'),
  (43, 'E4290', 'E4000', 'E4', 'Furniture, fittings', 'Furniture, fittings and Equipment'),
  (44, 'E4300', 'E4000', 'E4', 'Electricity', 'Electricity Consumption'),
  (45, 'E4310', 'E4000', 'E4', 'Water', 'Water Supply Charges'),
  (46, 'E4320', 'E4000', 'E4', 'Housing Rent', 'Housing Rent'),
  (47, 'E4330', 'E4000', 'E4', 'Vehicle Maintenance', 'Vehicle Maintenance'),
  (48, 'E4340', 'E4000', 'E4', 'Vehicle Fuel, Oil etc.', 'Vehicle Fuel, Oil and Licenses'),
  (49, 'E4350', 'E4000', 'E4', 'Vehicle Hire', 'Vehicle Hire Charges'),
  (50, 'E4360', 'E4000', 'E4', 'Office Supplies', 'Office Supplies'),
  (51, 'E4370', 'E4000', 'E4', 'Postage Account', 'Postage'),
  (52, 'E4380', 'E4000', 'E4', 'Telecommunications', 'Telecommunications'),
  (53, 'E4390', 'E4000', 'E4', 'Software licenses and M', 'Expenses on Software licenses and maintenance'),
  (54, 'E4400', 'E4000', 'E4', 'IT related hardware', 'Expenses on maintenance of IT related hardware'),
  (55, 'E4410', 'E4000', 'E4', 'Consumables Account', 'Consumables'),
  (56, 'E4420', 'E4000', 'E4', 'Security Expenses', 'Payment to Security Staff on Contract'),
  (57, 'E4430', 'E4000', 'E4', 'Co. Incorporation Exp', 'Company Incorporation Expenses'),
  (58, 'E4440', 'E4000', 'E4', 'Secretarial Service', 'Payments to Private Secretarial Service'),
  (59, 'E4450', 'E4000', 'E4', 'Legal Fees', 'Legal Fees'),
  (60, 'E4460', 'E4000', 'E4', 'Audit Fees', 'Audit Fees'),
  (61, 'E4470', 'E4000', 'E4', 'Consultancy Fees', 'Consultancy Fees'),
  (62, 'E4480', 'E4000', 'E4', 'R &D Expenditure', 'Research & Development Expenditure'),
  (63, 'E4490', 'E4000', 'E4', 'Insurance', 'Insurance Premiums'),
  (64, 'E4500', 'E4000', 'E4', 'Repairs to office Equipment', 'Repairs to Furniture & Fittings'),
  (65, 'E4510', 'E4000', 'E4', 'Traveling (Overseas)', 'Traveling (Overseas)'),
  (66, 'E4520', 'E4000', 'E4', 'Other Admin Exp', 'Other Administration Expenses'),
  (67, 'E5000', NULL, 'E4', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses'),
  (68, 'E5110', 'E5000', 'E4', 'Sales Staff Salaries', 'Other Staff Salaries Account'),
  (69, 'E5120', 'E5000', 'E4', 'Sales Staff OT', 'Other Staff Overtime Account'),
  (70, 'E5130', 'E5000', 'E4', 'Sales Staff Allowances Account', 'Other Staff Allowances Account'),
  (71, 'E5140', 'E5000', 'E4', 'Sales Staff Incentive', 'Other Staff Incentive Account'),
  (72, 'E5150', 'E5000', 'E4', 'Sales Staff Holiday Pay', 'Other Staff Holiday Pay Account'),
  (73, 'E5160', 'E5000', 'E4', 'Traveling a (Local)', 'Traveling and Subsistence (Local)'),
  (74, 'E5170', 'E5000', 'E4', 'Traveling (Overseas)', 'Traveling and Subsistence (Overseas)'),
  (75, 'E5180', 'E5000', 'E4', 'Direct Labor Payment Account', 'Direct Labor Payment Account'),
  (76, 'E5190', 'E5000', 'E4', 'Allowances to Trainees Account', 'Allowances to Trainees Account'),
  (77, 'E5200', 'E5000', 'E4', 'Bonus Account', 'Bonus Account'),
  (78, 'E5210', 'E5000', 'E4', 'Gratuity Payment', 'Gratuity Payment Account'),
  (79, 'E5220', 'E5000', 'E4', 'Staff Training', 'Staff Training Account'),
  (80, 'E5230', 'E5000', 'E4', 'Library Facilities', 'Library Facilities Account'),
  (81, 'E5240', 'E5000', 'E4', 'Staff Welfare', 'Staff Welfare Account'),
  (82, 'E5250', 'E5000', 'E4', 'Uniforms', 'Uniforms & Protective Clothing Account'),
  (83, 'E5260', 'E5000', 'E4', '12% EPF Contribution', '12% EPF Contribution for all employees of the Company'),
  (84, 'E5270', 'E5000', 'E4', '3% ETF Contribution', '3% ETF Contribution for all employees of the Company'),
  (85, 'E5280', 'E5000', 'E4', 'Vehicle Maintenance', 'Vehicle Maintenance Account'),
  (86, 'E5290', 'E5000', 'E4', 'Vehicle Fuel, Oil etc.', 'Vehicle Fuel, Oil and Licenses Account'),
  (87, 'E5300', 'E5000', 'E4', 'Vehicle Hire Charge', 'Vehicle Hire Charges Account'),
  (88, 'E5310', 'E5000', 'E4', 'Telecommunications', 'Telecommunications Account'),
  (89, 'E5320', 'E5000', 'E4', 'Advertising & Promotion', 'Advertising & Promotion Account'),
  (90, 'E5330', 'E5000', 'E4', 'Public Relations', 'Public Relations'),
  (91, 'E5340', 'E5000', 'E4', 'Entertainment', 'Entertainment Account'),
  (92, 'E5350', 'E5000', 'E4', 'Donation', 'Donation Account'),
  (93, 'E5360', 'E5000', 'E4', 'CSR Exp', 'Corporate Social Responsibility (CSR) Projects Account'),
  (94, 'E5370', 'E5000', 'E4', 'Bad Debts Written Off', 'Bad Debts Written Off Account'),
  (95, 'E5380', 'E5000', 'E4', 'Provision - Bad Debts', 'Provision for Bad Debts Account'),
  (96, 'E5390', 'E5000', 'E4', 'Other S&D Exp', 'Other Selling and Distribution Expenses'),
  (97, 'E5400', 'E5000', 'E4', 'Courier Charges', 'Courier Charges'),
  (98, 'E6000', NULL, 'E4', 'Depreciation', 'Depreciation'),
  (99, 'E6110', 'E6000', 'E4', 'Buildings', 'Depreciation - Buildings'),
  (100, 'E6120', 'E6000', 'E4', 'Vehicles', 'Depreciation - Vehicles'),
  (101, 'E6130', 'E6000', 'E4', 'Leasehold Vehicles.', 'Depreciation - Leasehold Vehicles.'),
  (102, 'E6140', 'E6000', 'E4', 'Lab Equipment', 'Depreciation - Lab Equipment'),
  (103, 'E6150', 'E6000', 'E4', 'Waste Water TP', 'Depreciation - Waste Water Treatment Plant'),
  (104, 'E6160', 'E6000', 'E4', 'Intangible Assets', 'Depreciation - Intangible Assets'),
  (105, 'E6170', 'E6000', 'E4', 'Computers & IT', 'Depreciation - Computers & IT related Equipment Account'),
  (106, 'E6180', 'E6000', 'E4', 'Other Sundry Assets', 'Depreciation - Other Sundry Assets'),
  (107, 'E6190', 'E6000', 'E4', 'Furniture & Fittings', 'Depreciation - Furniture & Fittings'),
  (108, 'E6200', 'E6000', 'E4', 'Machinery & Tools', 'Depreciation - Machinery & Tools'),
  (109, 'E6210', 'E6000', 'E4', 'Solar System', 'Depreciation of Solar System'),
  (110, 'E7000', NULL, 'E4', 'Finance - Expenses', 'Finance - Expenses'),
  (111, 'E7100', 'E7000', 'E4', 'Overdraft Interest', 'Overdraft Interest Account'),
  (112, 'E7200', 'E7000', 'E4', 'Interest charges', 'Long / Short Term Interest Account'),
  (113, 'E7300', 'E7000', 'E4', 'Bank Charges', 'Bank Charges Account'),
  (114, 'E7400', 'E7000', 'E4', 'Exchange Gain/ Losses', 'Exchange Rate Gain/ Losses Account'),
  (115, 'E7500', 'E7000', 'E4', 'Other Finance Exp', 'Other Finance Expenses'),
  (116, 'E8000', NULL, 'E4', 'Taxation', 'Taxation'),
  (117, 'E8100', 'E8000', 'E4', 'Income Tax', 'Income Tax Account'),
  (118, 'E8200', 'E8000', 'E4', 'Other Taxes', 'Other Taxes Account'),
  (119, 'A1000', NULL, 'A1', 'Fixed Assets', 'Fixed Assets'),
  (120, 'A1010', 'A1000', 'A1', 'Lands', 'Lands'),
  (121, 'A1020', 'A1000', 'A1', 'Buildings', 'Buildings'),
  (122, 'A1030', 'A1000', 'A1', 'Cumulative Dep- Buildings', 'Provision for cumulative depreciation - Buildings'),
  (123, 'A1040', 'A1000', 'A1', 'Buildings Renovation', 'Buildings Renovation'),
  (124, 'A1050', 'A1000', 'A1', 'Leasehold Lands', 'Leasehold Lands'),
  (125, 'A1060', 'A1000', 'A1', 'Motor vehicles', 'Motor vehicles'),
  (126, 'A1070', 'A1000', 'A1', 'Cumulative Dep- Vehicles', 'Provision for cumulative depreciation - Vehicles'),
  (127, 'A1080', 'A1000', 'A1', 'Leasehold Vehicles', 'Leasehold Vehicles'),
  (128, 'A1090', 'A1000', 'A1', 'Cum, Dep, Leasehold Vehicles.', 'Provision for cumulative depreciation - Leasehold Vehicles.'),
  (129, 'A1100', 'A1000', 'A1', 'Intangible Assets', 'Intangible Assets'),
  (130, 'A1110', 'A1000', 'A1', 'Amortization - Intangible A.', 'Provision for cumulative depreciation - Intangible Assets'),
  (131, 'A1120', 'A1000', 'A1', 'Computer,& IT Equip.', 'Computers & IT related Equipment Account'),
  (132, 'A1130', 'A1000', 'A1', 'Cumulative Dep Computer & IT', 'Provision for cumulative depreciation - Computers & IT related Equipment Account'),
  (133, 'A1140', 'A1000', 'A1', 'Other fixed Assets', 'Other fixed assets not specified'),
  (134, 'A1150', 'A1000', 'A1', 'Cumulative Dep.- Other Asets', 'Provision for cumulative depreciation - Other Sundry Assets'),
  (135, 'A1160', 'A1000', 'A1', 'Furniture & fittings', 'Furniture & fittings'),
  (136, 'A1170', 'A1000', 'A1', 'Cumulative Dep- Furniture & Fit', 'Provision for cumulative depreciation - Furniture & Fittings'),
  (137, 'A1180', 'A1000', 'A1', 'Machinery & tools', 'Machinery & tools'),
  (138, 'A1190', 'A1000', 'A1', 'Cumulative Dep- Machi. & Tools', 'Provision for cumulative depreciation - Machinery & Tools'),
  (139, 'A1200', 'A1000', 'A1', 'Solar System', 'Solar System'),
  (140, 'A1210', 'A1000', 'A1', 'Cumulative Dep. of Solar Sy,', 'Provision for Cumulative Depreciation of Solar System'),
  (141, 'A2000', NULL, 'A2', 'Investment -Other Non CA', 'Investment ( Other Non Current Assets)/Long Term Liability'),
  (142, 'A2100', 'A2000', 'A2', 'Investment in the subsidiary', 'Investment in the subsidiary'),
  (143, 'A3100', NULL, 'A31', 'Bank (Current Assets)', 'Bank (Current Assets)'),
  (144, 'A3110', 'A3100', 'A31', 'Petty cash & cash imprest', 'Petty cash & cash imprest'),
  (145, 'A3120', 'A3100', 'A31', 'Bank Current AC', 'Bank Current Account Balances'),
  (146, 'A3121', 'A3120', 'A31', 'HNB Bank Account', 'HNB bank current account'),
  (147, 'A3130', 'A3100', 'A31', 'Bank Savings AC', 'Bank Savings Account Balances'),
  (148, 'A3140', 'A3100', 'A31', 'Cash In Hand', 'Cash In Hand'),
  (149, 'A3200', NULL, 'A32', 'Trade Receivable -CA', 'Trade Receivable (Current Assets)'),
  (150, 'A3210', 'A3200', 'A32', 'Trade Receivable', 'Trade Receivable'),
  (151, 'A3220', 'A3200', 'A32', 'Trade Receivable from Courier', 'Trade Receivable from Courier'),
  (152, 'A3500', NULL, 'A35', 'Other Current Assets', 'Other Current Assets'),
  (153, 'A3510', 'A3500', 'A35', 'Investment in treasury Bills', 'Investment in treasury Bills / Bonds'),
  (154, 'A3511', 'A3500', 'A35', 'Advanced Payment', 'Advanced Payment Account'),
  (155, 'A3512', 'A3500', 'A35', 'Deposits Payment', 'Deposits Payment Account'),
  (156, 'A3520', 'A3500', 'A35', 'Salary advance for festival', 'Salary advance for festival'),
  (157, 'A3521', 'A3500', 'A35', 'Salary advance', 'Normal monthly salary advance'),
  (158, 'A3530', 'A3500', 'A35', 'Cheques return', 'Cheques return'),
  (159, 'A3540', 'A3500', 'A35', 'Interest receivable -Saving AC', 'Interest receivable on savings accounts'),
  (160, 'A3541', 'A3500', 'A35', 'Interest -Fixed Deposit AC', 'Interest receivable on fixed deposit accounts'),
  (161, 'A3542', 'A3500', 'A35', 'Dividend - From Company', 'Dividend Receivable for the Investment on Equity Securities'),
  (162, 'A3543', 'A3500', 'A35', 'VAT Receivable from CGIR', 'VAT Receivable from CGIR'),
  (163, 'A3544', 'A3500', 'A35', 'Sundry debtors', 'Sundry debtors'),
  (164, 'A3600', NULL, 'A35', 'Undeposited Cheques', 'Undeposited Cheques'),
  (165, 'A3800', NULL, 'A35', 'Stock', 'Stock'),
  (166, 'A3810', 'A3800', 'A35', 'Finish Good', 'Finish Good'),
  (167, 'A3820', 'A3800', 'A35', 'Contract Manufactures', 'Contract Manufactures'),
  (168, 'A3830', 'A3800', 'A35', 'Packing Material Suppliers', 'Packing Material Suppliers'),
  (169, 'A3840', 'A3800', 'A35', 'Raw Material Suppliers', 'Raw Material Suppliers'),
  (170, 'A3850', 'A3800', 'A35', 'Goods in transit', 'Goods in transit'),
  (171, 'L4100', NULL, 'L41', 'Trade Payables (Current Liability)', 'Trade Payables (Current Liabilities)'),
  (172, 'L4110', 'L4100', 'L41', 'Contract Manufactures', 'Contract Manufactures'),
  (173, 'L4120', 'L4100', 'L41', 'Raw Material Suppliers', 'Raw Material Suppliers'),
  (174, 'L4130', 'L4100', 'L41', 'Packing Material Suppliers', 'Packing Material Suppliers'),
  (175, 'L4140', 'L4100', 'L41', 'Import related Exp.', 'Amounts payable on foreign suppliers (CIF value, LC charges, duty, clearing charges etc.)'),
  (176, 'L4200', NULL, 'L41', 'Accrued Exp.', 'Other Payables (Accrued Expenses)'),
  (177, 'L4210', 'L4200', 'L41', 'Electricity', 'Electricity Consumption Account'),
  (178, 'L4220', 'L4200', 'L41', 'Water', 'Water Supply Charges Account'),
  (179, 'L4230', 'L4200', 'L41', 'Telecommunications', 'Telecommunications Account'),
  (180, 'L4240', 'L4200', 'L41', 'Security', 'Payment to Security Staff on Contract Account'),
  (181, 'L4250', 'L4200', 'L41', 'Insurance', 'Insurance Premiums Account'),
  (182, 'L4300', NULL, 'L43', 'Provision', 'Provision'),
  (183, 'L4310', 'L4300', 'L43', 'Employees gratuity', 'Provision for employees gratuity'),
  (184, 'L4320', 'L4300', 'L43', 'Damage stock items', 'Provision made in respect of the value of damage stock items which cannot be used further'),
  (185, 'L4330', 'L4300', 'L43', 'stock adjustment account', 'Provision for the uncleared stock adjustment balances remain in the stock adjustment account'),
  (186, 'L4340', 'L4300', 'L43', 'Bad & Doubtful debts', 'Provision for Bad & Doubtful debts of Other debtors'),
  (187, 'L4400', NULL, 'L43', 'Opening Balance Equity', 'Opening Balance Equity'),
  (188, 'L4500', NULL, 'L43', 'Current Liability', 'Other Current Liability'),
  (189, 'L4510', 'L4500', 'L43', 'Control Account for Salary', 'Control Account for Salary'),
  (190, 'L4511', 'L4500', 'L43', 'EPF control AC', 'Employee contributions payable to Provident Fund'),
  (191, 'L4512', 'L4500', 'L43', 'ETF Control AC', 'Employee contributions payable to Trust Fund'),
  (192, 'L4530', 'L4500', 'L43', 'Cheque return/ cancelled AC', 'Cheque return/ cancellation of company issued cheque'),
  (193, 'L4540', 'L4500', 'L43', 'Sales Commission Payable', 'Sales Commission Payable'),
  (194, 'L4550', 'L4500', 'L43', 'Advances & Deposits', 'Advances & Deposits Received from Customers'),
  (195, 'L4560', 'L4500', 'L43', 'Courier Charges', 'Courier Charges'),
  (196, 'L4570', 'L4500', 'L43', 'Audit and Secretory Fees', 'Audit and Secretory Fees'),
  (197, 'L4600', NULL, 'L43', 'Tax Account', 'Tax Account'),
  (198, 'L4610', 'L4600', 'L43', 'VAT payable to CGIR', 'VAT payable to CGIR'),
  (199, 'L4620', 'L4600', 'L43', 'SSCL payable to CGIR', 'SSCL payable to CGIR'),
  (200, 'L4630', 'L4600', 'L43', 'WHT to CGIR', 'Withholding tax payable to CGIR'),
  (201, 'L4640', 'L4600', 'L43', 'Stamp Duty Payable', 'Stamp Duty Payable'),
  (202, 'L4650', 'L4600', 'L43', 'Income Tax', 'Income Tax'),
  (203, 'L4700', NULL, 'L43', 'Inter Company', 'Inter Company Accounts'),
  (204, 'L4710', 'L4700', 'L43', 'NMS Auto Supply', 'NMS Auto Supply'),
  (205, 'L4800', NULL, 'L48', 'Director''s Current Account', 'Director''s Current Account'),
  (206, 'L4810', 'L4800', 'L48', 'Nevil', 'Nevil'),
  (207, 'L4820', 'L4800', 'L48', 'Surangi', 'Surangi'),
  (208, 'L4830', 'L4800', 'L48', 'Krishna', 'Krishna'),
  (209, 'L5000', NULL, 'L50', 'Bank Loan', 'Bank Loan'),
  (210, 'L5110', 'L5000', 'L50', 'Loan obtained from COM Bank', 'Loan obtained from COM Bank'),
  (211, 'L5210', 'L5000', 'L50', 'Other Long term Loan', 'Other Long term Loan'),
  (212, 'L5310', 'L5000', 'L50', 'Credit facility obtained- Buyer', 'Credit facility obtained from buyers'),
  (213, 'L5320', 'L5000', 'L50', 'Credit facility obtained -Supp', 'Credit facility obtained from suppliers'),
  (214, 'L6000', NULL, 'L60', 'Share Capital', 'Share Capital'),
  (215, 'L6110', 'L6000', 'L60', 'Nevil', 'Share Holder C/A-Nevil'),
  (216, 'L6120', 'L6000', 'L60', 'Surangi', 'Share Holder C/A -Manoj'),
  (217, 'L6130', 'L6000', 'L60', 'Krishna', 'Share Holder C/A-Saminda'),
  (218, 'L7000', NULL, 'L60', 'Retain Earning', 'Retain Earning');

INSERT INTO `accounts` (`group_id`,`code`,`name`,`description`,`is_active`,`is_default`,`created_by`,`created_at`,`updated_at`)
SELECT g.`id`, t.`code`, t.`name`, t.`description`, 1, 1, 'system', NOW(), NOW()
FROM `tmp_chart` t JOIN `account_groups` g ON g.`code` = t.`grp`
WHERE NOT EXISTS (SELECT 1 FROM `accounts` a WHERE a.`code` = t.`code`)
ORDER BY t.`seq`;

UPDATE `accounts` a
JOIN `tmp_chart` t ON t.`code` = a.`code`
JOIN `account_groups` g ON g.`code` = t.`grp`
LEFT JOIN `accounts` p ON p.`code` = t.`parent`
SET a.`group_id` = g.`id`, a.`parent_id` = p.`id`, a.`name` = t.`name`, a.`description` = t.`description`,
    a.`is_default` = 1, a.`created_by` = 'system', a.`updated_at` = NOW();

UPDATE `accounts` SET `is_cashbook` = 1 WHERE `code` IN ('A3110', 'A3121', 'A3130', 'A3140');

-- 5. Old seeded accounts with no cost code: delete if unused, else deactivate
DROP TEMPORARY TABLE IF EXISTS `tmp_left`;
CREATE TEMPORARY TABLE `tmp_left` AS
  SELECT a.`id`, 0 AS used FROM `accounts` a
  WHERE a.`created_by` = 'system' AND a.`code` NOT IN (SELECT `code` FROM `tmp_chart`);
UPDATE `tmp_left` t SET t.used = (
     EXISTS (SELECT 1 FROM `journal_lines` x WHERE x.`account_id` = t.`id`)
  OR EXISTS (SELECT 1 FROM `journal_entries` x WHERE x.`payment_account_id` = t.`id`)
  OR EXISTS (SELECT 1 FROM `account_mappings` x WHERE x.`account_id` = t.`id`)
  OR EXISTS (SELECT 1 FROM `cash_vouchers` x WHERE x.`account_id` = t.`id`)
  OR EXISTS (SELECT 1 FROM `cash_vouchers` x WHERE x.`counter_account_id` = t.`id`)
  OR EXISTS (SELECT 1 FROM `expenses` x WHERE x.`payment_account_id` = t.`id`)
  OR EXISTS (SELECT 1 FROM `receipts` x WHERE x.`account_id` = t.`id`)
  OR EXISTS (SELECT 1 FROM `opening_balances` x WHERE x.`account_id` = t.`id`)
  OR EXISTS (SELECT 1 FROM `accounts` x WHERE x.`parent_id` = t.`id`));
DELETE a FROM `accounts` a JOIN `tmp_left` t ON t.`id` = a.`id` WHERE t.used = 0;
UPDATE `accounts` a JOIN `tmp_left` t ON t.`id` = a.`id`
SET a.`is_active` = 0, a.`is_cashbook` = 0, a.`is_default` = 0 WHERE t.used = 1;

-- Old groups left empty
DELETE g FROM `account_groups` g LEFT JOIN `accounts` a ON a.`group_id` = g.`id`
WHERE a.`id` IS NULL AND g.`code` NOT IN ('A1', 'A2', 'A31', 'A32', 'A35', 'L41', 'L43', 'L48', 'L50', 'L60', 'R1', 'R2', 'E3', 'E4');

-- 6. Posting roles without a row → their default cost code
INSERT INTO `account_mappings` (`key`,`account_id`,`created_at`,`updated_at`)
SELECT v.k, a.`id`, NOW(), NOW() FROM (
            SELECT 'cash' AS k, 'A3140' AS c
  UNION ALL SELECT 'bank', 'A3121'
  UNION ALL SELECT 'receivable', 'A3210'
  UNION ALL SELECT 'inventory', 'A3810'
  UNION ALL SELECT 'vat_input', 'A3543'
  UNION ALL SELECT 'payable', 'L4140'
  UNION ALL SELECT 'vat_output', 'L4610'
  UNION ALL SELECT 'sales', 'R1100'
  UNION ALL SELECT 'sales_returns', 'R1200'
  UNION ALL SELECT 'cogs', 'E3110'
  UNION ALL SELECT 'stock_adjustment', 'E3320'
  UNION ALL SELECT 'discount', 'R1400'
  UNION ALL SELECT 'expense', 'E4520'
  UNION ALL SELECT 'retained_earnings', 'L7000'
) v LEFT JOIN `accounts` a ON a.`code` = v.c
WHERE NOT EXISTS (SELECT 1 FROM `account_mappings` m WHERE m.`key` = v.k);

-- 7. Record the migration
INSERT INTO `migrations` (`migration`,`batch`)
SELECT '2026_11_09_000004_install_nms_cost_codes', IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_11_09_000004_install_nms_cost_codes');

COMMIT;

DROP TEMPORARY TABLE IF EXISTS `tmp_ob`;
DROP TEMPORARY TABLE IF EXISTS `tmp_chart`;
DROP TEMPORARY TABLE IF EXISTS `tmp_left`;

-- 8. Quick check — expect 218 | 14 | 0 | 14
SELECT
  (SELECT COUNT(*) FROM `accounts` WHERE `code` REGEXP '^[AELR][0-9]{4}$') AS cost_code_accounts,
  (SELECT COUNT(*) FROM `account_groups`)                                    AS `groups`,
  (SELECT COUNT(*) FROM `accounts` WHERE `code` REGEXP '^[0-9]+$')           AS old_numeric_accounts,
  (SELECT COUNT(*) FROM `account_mappings` m JOIN `accounts` a ON a.`id` = m.`account_id`
     WHERE a.`is_active` = 1 AND NOT EXISTS (SELECT 1 FROM `accounts` ch WHERE ch.`parent_id` = a.`id`)) AS postable_roles;
