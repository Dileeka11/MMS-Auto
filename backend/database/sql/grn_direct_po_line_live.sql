-- =====================================================================
--  Direct GRN for local Ex-Showroom POs — LIVE install
--
--  Run once in phpMyAdmin (SQL tab) BEFORE deploying the code.
--  Same result as `php artisan migrate` (2026_11_16_000001_add_po_line_to_grn_lines).
--  Adds grn_lines.purchase_order_line_id and backfills it from the
--  shipment line of every existing GRN line.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE `grn_lines`
  ADD COLUMN `purchase_order_line_id` bigint unsigned NULL AFTER `shipment_line_id`,
  ADD CONSTRAINT `grn_lines_purchase_order_line_id_foreign`
    FOREIGN KEY (`purchase_order_line_id`) REFERENCES `purchase_order_lines` (`id`) ON DELETE SET NULL;

UPDATE `grn_lines` gl
  JOIN `shipment_lines` sl ON sl.`id` = gl.`shipment_line_id`
   SET gl.`purchase_order_line_id` = sl.`purchase_order_line_id`
 WHERE gl.`purchase_order_line_id` IS NULL;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_11_16_000001_add_po_line_to_grn_lines', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`;
