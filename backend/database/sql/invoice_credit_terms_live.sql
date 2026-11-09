-- =====================================================================
--  Sales invoice credit period (credit_days + due_date) — LIVE install
--
--  Run once in phpMyAdmin (SQL tab) BEFORE deploying the code.
--  Same result as `php artisan migrate` (2026_11_09_000003_add_credit_terms_to_invoices).
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE `invoices`
  ADD COLUMN `credit_days` smallint unsigned NULL AFTER `terms`,
  ADD COLUMN `due_date` date NULL AFTER `credit_days`;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_11_09_000003_add_credit_terms_to_invoices', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`;
