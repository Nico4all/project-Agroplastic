CREATE TABLE `users` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `accounts` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('CASH', 'BANK', 'SAVINGS', 'CREDIT_CARD', 'DIGITAL_WALLET', 'OTHER') NOT NULL,
  `initial_balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `current_balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `accounts_user_id_idx`(`user_id`),
  INDEX `accounts_user_id_is_active_idx`(`user_id`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `categories` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
  `color` VARCHAR(191) NULL,
  `icon` VARCHAR(191) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `categories_user_id_idx`(`user_id`),
  INDEX `categories_user_id_type_idx`(`user_id`, `type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `transactions` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `account_id` VARCHAR(191) NOT NULL,
  `category_id` VARCHAR(191) NOT NULL,
  `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `description` VARCHAR(191) NULL,
  `transaction_date` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `transactions_user_id_idx`(`user_id`),
  INDEX `transactions_account_id_idx`(`account_id`),
  INDEX `transactions_category_id_idx`(`category_id`),
  INDEX `transactions_type_idx`(`type`),
  INDEX `transactions_transaction_date_idx`(`transaction_date`),
  INDEX `transactions_user_id_transaction_date_idx`(`user_id`, `transaction_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `transfers` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `from_account_id` VARCHAR(191) NOT NULL,
  `to_account_id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `description` VARCHAR(191) NULL,
  `transfer_date` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `transfers_user_id_idx`(`user_id`),
  INDEX `transfers_from_account_id_idx`(`from_account_id`),
  INDEX `transfers_to_account_id_idx`(`to_account_id`),
  INDEX `transfers_transfer_date_idx`(`transfer_date`),
  INDEX `transfers_user_id_transfer_date_idx`(`user_id`, `transfer_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `token_hash` TEXT NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `refresh_tokens_user_id_idx`(`user_id`),
  INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `categories` ADD CONSTRAINT `categories_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_from_account_id_fkey` FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_to_account_id_fkey` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
