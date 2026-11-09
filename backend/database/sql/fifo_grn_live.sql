-- =====================================================================
--  FIFO stock layers + GRN-on-approval — LIVE install
--
--  Run once in phpMyAdmin (SQL tab) BEFORE deploying the FIFO / GRN code.
--  Same result as `php artisan migrate`
--  (2026_11_09_000001_create_stock_layers_and_grn_posting).
--  No foreign keys (host rejects FK, errno 150). Idempotent: the opening
--  layers and the GRN back-fill only run the first time.
-- =====================================================================

SET NAMES utf8mb4;

SET @first := (SELECT COUNT(*) = 0 FROM information_schema.TABLES
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_layers');

CREATE TABLE IF NOT EXISTS `stock_layers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `item_id` bigint(20) unsigned NOT NULL,
  `source_type` varchar(20) NOT NULL,
  `source_id` bigint(20) unsigned NULL,
  `date` date NOT NULL,
  `qty_in` int(11) NOT NULL,
  `qty_left` int(11) NOT NULL,
  `unit_cost` decimal(14,4) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL,
  `updated_at` timestamp NULL,
  PRIMARY KEY (`id`),
  KEY `stock_layers_item_id_qty_left_index` (`item_id`, `qty_left`),
  KEY `stock_layers_source_type_source_id_index` (`source_type`, `source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_layer_moves` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `stock_layer_id` bigint(20) unsigned NOT NULL,
  `item_id` bigint(20) unsigned NOT NULL,
  `source_type` varchar(20) NOT NULL,
  `source_id` bigint(20) unsigned NULL,
  `qty` int(11) NOT NULL,
  `unit_cost` decimal(14,4) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL,
  `updated_at` timestamp NULL,
  PRIMARY KEY (`id`),
  KEY `stock_layer_moves_source_type_source_id_index` (`source_type`, `source_id`),
  KEY `stock_layer_moves_stock_layer_id_index` (`stock_layer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every item with stock gets an opening layer at its FIFO cost (avg cost when 0).
INSERT INTO `stock_layers` (`item_id`,`source_type`,`source_id`,`date`,`qty_in`,`qty_left`,`unit_cost`,`created_at`,`updated_at`)
SELECT `id`, 'opening', NULL, CURDATE(), `qty`, `qty`,
       IF(`fifo_cost` > 0, `fifo_cost`, `avg_cost`), NOW(), NOW()
FROM `items` WHERE `qty` > 0 AND @first = 1;

-- grns.stock_posted_at — existing GRNs already moved stock when they were saved.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grns' AND COLUMN_NAME = 'stock_posted_at');
SET @sql := IF(@has = 0, 'ALTER TABLE `grns` ADD `stock_posted_at` timestamp NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := IF(@has = 0, 'UPDATE `grns` SET `stock_posted_at` = COALESCE(`created_at`, NOW())', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`migration`,`batch`)
SELECT '2026_11_09_000001_create_stock_layers_and_grn_posting', IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_11_09_000001_create_stock_layers_and_grn_posting');

-- Quick check — layered qty should equal on-hand qty; unposted GRNs should be 0 right after install
SELECT
  (SELECT IFNULL(SUM(`qty`), 0) FROM `items` WHERE `qty` > 0) AS on_hand_qty,
  (SELECT IFNULL(SUM(`qty_left`), 0) FROM `stock_layers`) AS layered_qty,
  (SELECT COUNT(*) FROM `grns` WHERE `stock_posted_at` IS NULL) AS unposted_grns;
