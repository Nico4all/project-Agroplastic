CREATE TABLE `order_payments` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `method` ENUM('CASH', 'BANK', 'CREDIT') NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `order_payments_order_id_method_key`(`order_id`, `method`),
  INDEX `order_payments_method_idx`(`method`),
  PRIMARY KEY (`id`),
  CONSTRAINT `order_payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `order_payments` (`id`, `order_id`, `method`, `amount`, `created_at`)
SELECT UUID(), `id`, `payment_method`, `total_amount`, `created_at`
FROM `orders`
WHERE `payment_method` IS NOT NULL;

ALTER TABLE `points_of_sale`
  ADD COLUMN `next_portfolio_collection_number` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `portfolio_collections` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `point_of_sale_id` VARCHAR(191) NOT NULL,
  `document_sequence` INTEGER NOT NULL,
  `document_number` VARCHAR(191) NOT NULL,
  `payment_method` ENUM('CASH', 'BANK') NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `collection_date` DATETIME(3) NOT NULL,
  `description` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `portfolio_collections_document_number_key`(`document_number`),
  INDEX `portfolio_collections_order_id_collection_date_idx`(`order_id`, `collection_date`),
  INDEX `portfolio_collections_user_id_idx`(`user_id`),
  INDEX `portfolio_collections_point_of_sale_id_document_sequence_idx`(`point_of_sale_id`, `document_sequence`),
  PRIMARY KEY (`id`),
  CONSTRAINT `portfolio_collections_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `portfolio_collections_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `portfolio_collections_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
