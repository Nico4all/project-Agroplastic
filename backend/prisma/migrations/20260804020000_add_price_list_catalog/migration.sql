ALTER TABLE `users`
  MODIFY `role` ENUM('ADMIN', 'BODEGA', 'SUPERADMIN') NOT NULL DEFAULT 'BODEGA';

CREATE TABLE `suppliers` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `normalized_name` VARCHAR(191) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `suppliers_normalized_name_key`(`normalized_name`),
  INDEX `suppliers_is_active_idx`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `price_list_categories` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `normalized_name` VARCHAR(191) NOT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `price_list_categories_normalized_name_key`(`normalized_name`),
  INDEX `price_list_categories_is_active_sort_order_idx`(`is_active`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `price_list_products` (
  `id` VARCHAR(191) NOT NULL,
  `source_key` VARCHAR(600) NOT NULL,
  `category_id` VARCHAR(191) NOT NULL,
  `supplier_id` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(500) NOT NULL,
  `measure` VARCHAR(300) NULL,
  `presentation` VARCHAR(300) NULL,
  `primary_price_label` VARCHAR(191) NOT NULL,
  `secondary_price_label` VARCHAR(191) NOT NULL,
  `default_primary_price` DECIMAL(14, 2) NULL,
  `default_secondary_price` DECIMAL(14, 2) NULL,
  `default_primary_note` VARCHAR(300) NULL,
  `default_secondary_note` VARCHAR(300) NULL,
  `source_sheet` VARCHAR(191) NULL,
  `source_row` INTEGER NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `price_list_products_source_key_key`(`source_key`),
  INDEX `price_list_products_category_id_is_active_idx`(`category_id`, `is_active`),
  INDEX `price_list_products_supplier_id_is_active_idx`(`supplier_id`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `point_of_sale_prices` (
  `id` VARCHAR(191) NOT NULL,
  `point_of_sale_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `primary_price` DECIMAL(14, 2) NULL,
  `secondary_price` DECIMAL(14, 2) NULL,
  `primary_price_note` VARCHAR(300) NULL,
  `secondary_price_note` VARCHAR(300) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `point_of_sale_prices_point_of_sale_id_product_id_key`(`point_of_sale_id`, `product_id`),
  INDEX `point_of_sale_prices_product_id_idx`(`product_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `price_list_products`
  ADD CONSTRAINT `price_list_products_category_id_fkey`
  FOREIGN KEY (`category_id`) REFERENCES `price_list_categories`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `price_list_products`
  ADD CONSTRAINT `price_list_products_supplier_id_fkey`
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `point_of_sale_prices`
  ADD CONSTRAINT `point_of_sale_prices_point_of_sale_id_fkey`
  FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `point_of_sale_prices`
  ADD CONSTRAINT `point_of_sale_prices_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `price_list_products`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
