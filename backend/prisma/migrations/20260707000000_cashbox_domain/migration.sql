ALTER TABLE `users`
  ADD COLUMN `username` VARCHAR(191) NULL,
  ADD COLUMN `role` ENUM('ADMIN', 'BODEGA') NOT NULL DEFAULT 'BODEGA',
  ADD COLUMN `city` VARCHAR(191) NULL,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

UPDATE `users`
SET `username` = LOWER(CONCAT(REPLACE(SUBSTRING_INDEX(`email`, '@', 1), ' ', '_'), '_', LEFT(`id`, 8)))
WHERE `username` IS NULL;

ALTER TABLE `users` MODIFY `username` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);

CREATE TABLE `clients` (
  `id` VARCHAR(191) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `identity_document` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NULL,
  `is_general` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_by_user_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `clients_city_idx`(`city`),
  INDEX `clients_is_general_idx`(`is_general`),
  INDEX `clients_identity_document_idx`(`identity_document`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `expense_categories` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_by_user_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `expense_categories_name_key`(`name`),
  INDEX `expense_categories_is_active_idx`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `incomes` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `client_id` VARCHAR(191) NOT NULL,
  `client_name` VARCHAR(191) NOT NULL,
  `client_document` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `type` ENUM('ADVANCE', 'RECEIVABLE_PAYMENT') NOT NULL,
  `payment_method` ENUM('CASH', 'BANK') NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `description` VARCHAR(191) NULL,
  `income_date` DATETIME(3) NOT NULL,
  `status` ENUM('ACTIVE', 'VOID') NOT NULL DEFAULT 'ACTIVE',
  `void_reason` VARCHAR(191) NULL,
  `voided_at` DATETIME(3) NULL,
  `voided_by_user_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `incomes_user_id_idx`(`user_id`),
  INDEX `incomes_client_id_idx`(`client_id`),
  INDEX `incomes_city_idx`(`city`),
  INDEX `incomes_type_idx`(`type`),
  INDEX `incomes_payment_method_idx`(`payment_method`),
  INDEX `incomes_status_idx`(`status`),
  INDEX `incomes_income_date_idx`(`income_date`),
  INDEX `incomes_user_id_income_date_idx`(`user_id`, `income_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `expenses` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `category_id` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `paid_to` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `description` VARCHAR(191) NULL,
  `approved_by` VARCHAR(191) NULL,
  `expense_date` DATETIME(3) NOT NULL,
  `status` ENUM('ACTIVE', 'VOID') NOT NULL DEFAULT 'ACTIVE',
  `void_reason` VARCHAR(191) NULL,
  `voided_at` DATETIME(3) NULL,
  `voided_by_user_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `expenses_user_id_idx`(`user_id`),
  INDEX `expenses_category_id_idx`(`category_id`),
  INDEX `expenses_city_idx`(`city`),
  INDEX `expenses_status_idx`(`status`),
  INDEX `expenses_expense_date_idx`(`expense_date`),
  INDEX `expenses_user_id_expense_date_idx`(`user_id`, `expense_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `clients` ADD CONSTRAINT `clients_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `expense_categories` ADD CONSTRAINT `expense_categories_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `incomes` ADD CONSTRAINT `incomes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `incomes` ADD CONSTRAINT `incomes_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `incomes` ADD CONSTRAINT `incomes_voided_by_user_id_fkey` FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_voided_by_user_id_fkey` FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT IGNORE INTO `expense_categories` (`id`, `name`, `is_active`, `created_at`, `updated_at`) VALUES
  (UUID(), 'Desaargue', true, NOW(3), NOW(3)),
  (UUID(), 'Papeleria', true, NOW(3), NOW(3)),
  (UUID(), 'Transporte', true, NOW(3), NOW(3)),
  (UUID(), 'Aux de bodega', true, NOW(3), NOW(3));
