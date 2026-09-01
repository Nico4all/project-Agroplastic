ALTER TABLE `points_of_sale`
  ADD COLUMN `next_inventory_adjustment_number` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `next_inventory_transfer_number` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `inventory_adjustments` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `point_of_sale_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `document_sequence` INTEGER NOT NULL,
  `document_number` VARCHAR(191) NOT NULL,
  `operation` ENUM('ADD', 'SUBTRACT') NOT NULL,
  `quantity` DECIMAL(14, 3) NOT NULL,
  `balance_before` DECIMAL(14, 3) NOT NULL,
  `balance_after` DECIMAL(14, 3) NOT NULL,
  `observation` TEXT NULL,
  `adjustment_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_adjustments_document_number_key`(`document_number`),
  INDEX `inventory_adjustments_user_id_idx`(`user_id`),
  INDEX `inventory_adjustments_point_of_sale_id_document_sequence_idx`(`point_of_sale_id`, `document_sequence`),
  INDEX `inventory_adjustments_product_id_adjustment_date_idx`(`product_id`, `adjustment_date`),
  INDEX `inventory_adjustments_adjustment_date_idx`(`adjustment_date`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_adjustments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustments_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustments_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `inventory_adjustments` (
  `id`, `user_id`, `point_of_sale_id`, `product_id`, `document_sequence`, `document_number`,
  `operation`, `quantity`, `balance_before`, `balance_after`, `observation`,
  `adjustment_date`, `created_at`, `updated_at`
)
SELECT
  historical.`id`, historical.`user_id`, historical.`point_of_sale_id`, historical.`product_id`, historical.`sequence`,
  CONCAT(historical.`document_prefix`, '-AI-', historical.`sequence`), historical.`operation`,
  historical.`quantity`, historical.`balance_before`, historical.`balance_after`, NULL,
  historical.`created_at`, historical.`created_at`, historical.`created_at`
FROM (
  SELECT
    movement.`id`, movement.`user_id`, movement.`point_of_sale_id`, movement.`product_id`, point.`document_prefix`,
    ROW_NUMBER() OVER (PARTITION BY movement.`point_of_sale_id` ORDER BY movement.`created_at`, movement.`id`) AS `sequence`,
    IF(movement.`type` = 'ADJUSTMENT_ADD', 'ADD', 'SUBTRACT') AS `operation`,
    ABS(movement.`quantity_change`) AS `quantity`,
    movement.`balance_after` - movement.`quantity_change` AS `balance_before`,
    movement.`balance_after`, movement.`created_at`
  FROM `inventory_movements` movement
  INNER JOIN `points_of_sale` point ON point.`id` = movement.`point_of_sale_id`
  WHERE movement.`type` IN ('ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT')
) historical;

UPDATE `points_of_sale` point
LEFT JOIN (
  SELECT `point_of_sale_id`, MAX(`document_sequence`) + 1 AS `next_number`
  FROM `inventory_adjustments`
  GROUP BY `point_of_sale_id`
) adjustment ON adjustment.`point_of_sale_id` = point.`id`
SET point.`next_inventory_adjustment_number` = GREATEST(point.`next_inventory_adjustment_number`, COALESCE(adjustment.`next_number`, 1));

CREATE TABLE `inventory_transfers` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `origin_point_of_sale_id` VARCHAR(191) NOT NULL,
  `destination_point_of_sale_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `document_sequence` INTEGER NOT NULL,
  `document_number` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(14, 3) NOT NULL,
  `origin_balance_before` DECIMAL(14, 3) NOT NULL,
  `origin_balance_after` DECIMAL(14, 3) NOT NULL,
  `destination_balance_before` DECIMAL(14, 3) NOT NULL,
  `destination_balance_after` DECIMAL(14, 3) NOT NULL,
  `observation` TEXT NULL,
  `transfer_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_transfers_document_number_key`(`document_number`),
  INDEX `inventory_transfers_user_id_idx`(`user_id`),
  INDEX `inv_transfers_origin_seq_idx`(`origin_point_of_sale_id`, `document_sequence`),
  INDEX `inv_transfers_dest_date_idx`(`destination_point_of_sale_id`, `transfer_date`),  INDEX `inventory_transfers_product_id_transfer_date_idx`(`product_id`, `transfer_date`),
  INDEX `inventory_transfers_transfer_date_idx`(`transfer_date`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_transfers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfers_origin_point_of_sale_id_fkey` FOREIGN KEY (`origin_point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfers_destination_point_of_sale_id_fkey` FOREIGN KEY (`destination_point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfers_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_movements`
  ADD COLUMN `inventory_adjustment_id` VARCHAR(191) NULL,
  ADD COLUMN `inventory_transfer_id` VARCHAR(191) NULL,
  MODIFY COLUMN `type` ENUM('ENTRY', 'ORDER', 'ORDER_VOID', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT', 'TRANSFER_OUT', 'TRANSFER_IN') NOT NULL,
  ADD INDEX `inventory_movements_inventory_adjustment_id_idx`(`inventory_adjustment_id`),
  ADD INDEX `inventory_movements_inventory_transfer_id_idx`(`inventory_transfer_id`);

UPDATE `inventory_movements`
SET `inventory_adjustment_id` = `id`
WHERE `type` IN ('ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT');

ALTER TABLE `inventory_movements`
  ADD CONSTRAINT `inventory_movements_inventory_adjustment_id_fkey` FOREIGN KEY (`inventory_adjustment_id`) REFERENCES `inventory_adjustments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_movements_inventory_transfer_id_fkey` FOREIGN KEY (`inventory_transfer_id`) REFERENCES `inventory_transfers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
