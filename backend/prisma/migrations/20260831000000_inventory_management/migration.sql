ALTER TABLE `points_of_sale`
  ADD COLUMN `next_inventory_entry_number` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `orders`
  ADD COLUMN `status` ENUM('ACTIVE', 'VOID') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `inventory_applied_at` DATETIME(3) NULL,
  ADD COLUMN `void_reason` VARCHAR(191) NULL,
  ADD COLUMN `voided_at` DATETIME(3) NULL,
  ADD COLUMN `voided_by_user_id` VARCHAR(191) NULL;

CREATE INDEX `orders_status_idx` ON `orders`(`status`);
CREATE INDEX `orders_voided_by_user_id_idx` ON `orders`(`voided_by_user_id`);
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_voided_by_user_id_fkey`
  FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `inventory_stocks` (
  `id` VARCHAR(191) NOT NULL,
  `point_of_sale_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_stocks_point_of_sale_id_product_id_key`(`point_of_sale_id`, `product_id`),
  INDEX `inventory_stocks_product_id_idx`(`product_id`),
  INDEX `inventory_stocks_point_of_sale_id_is_active_idx`(`point_of_sale_id`, `is_active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_stocks_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventory_stocks_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `inventory_stocks`
  (`id`, `point_of_sale_id`, `product_id`, `quantity`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), p.`id`, pr.`id`, 0, pr.`is_active`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `points_of_sale` p
CROSS JOIN `products` pr;

CREATE TABLE `inventory_entries` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `point_of_sale_id` VARCHAR(191) NOT NULL,
  `document_sequence` INTEGER NOT NULL,
  `document_number` VARCHAR(191) NOT NULL,
  `supplier_name` VARCHAR(191) NOT NULL,
  `remittance_number` VARCHAR(191) NULL,
  `observations` TEXT NULL,
  `entry_date` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_entries_document_number_key`(`document_number`),
  INDEX `inventory_entries_user_id_idx`(`user_id`),
  INDEX `inventory_entries_point_of_sale_id_document_sequence_idx`(`point_of_sale_id`, `document_sequence`),
  INDEX `inventory_entries_entry_date_idx`(`entry_date`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_entries_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_entry_items` (
  `id` VARCHAR(191) NOT NULL,
  `inventory_entry_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `product_description` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(14, 3) NOT NULL,
  INDEX `inventory_entry_items_inventory_entry_id_idx`(`inventory_entry_id`),
  INDEX `inventory_entry_items_product_id_idx`(`product_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_entry_items_inventory_entry_id_fkey` FOREIGN KEY (`inventory_entry_id`) REFERENCES `inventory_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventory_entry_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_movements` (
  `id` VARCHAR(191) NOT NULL,
  `point_of_sale_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `inventory_entry_id` VARCHAR(191) NULL,
  `order_id` VARCHAR(191) NULL,
  `type` ENUM('ENTRY', 'ORDER', 'ORDER_VOID') NOT NULL,
  `quantity_change` DECIMAL(14, 3) NOT NULL,
  `balance_after` DECIMAL(14, 3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `inventory_movements_point_of_sale_id_created_at_idx`(`point_of_sale_id`, `created_at`),
  INDEX `inventory_movements_product_id_created_at_idx`(`product_id`, `created_at`),
  INDEX `inventory_movements_inventory_entry_id_idx`(`inventory_entry_id`),
  INDEX `inventory_movements_order_id_idx`(`order_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_movements_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_movements_inventory_entry_id_fkey` FOREIGN KEY (`inventory_entry_id`) REFERENCES `inventory_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_movements_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
