-- =====================================================================
--  IRD Tax Invoice serial (YYMMM_QQQQ_XXXXX) — LIVE install
--
--  Run once in phpMyAdmin (SQL tab) BEFORE deploying the code.
--  Same result as `php artisan migrate` (2026_11_09_000002_add_tax_invoice_no).
--  Existing VAT invoices are numbered in id order: 26NOV_VAT_00001, ...
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE `company_profiles` ADD COLUMN `invoice_class` varchar(15) NOT NULL DEFAULT 'VAT';
ALTER TABLE `invoices` ADD COLUMN `tax_invoice_no` varchar(40) NULL,
  ADD UNIQUE KEY `invoices_tax_invoice_no_unique` (`tax_invoice_no`);

SET @seq := 0;
UPDATE `invoices`
   SET `tax_invoice_no` = CONCAT(
         DATE_FORMAT(COALESCE(`date`, CURDATE()), '%y'),
         UPPER(DATE_FORMAT(COALESCE(`date`, CURDATE()), '%b')),
         '_VAT_',
         LPAD(@seq := @seq + 1, 5, '0'))
 WHERE `vat_applied` = 1
 ORDER BY `id`;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_11_09_000002_add_tax_invoice_no', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`;
