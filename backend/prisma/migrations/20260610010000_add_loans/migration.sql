CREATE TABLE `loans` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `account_id` VARCHAR(191) NOT NULL,
  `person_name` VARCHAR(191) NOT NULL,
  `type` ENUM('RECEIVABLE', 'PAYABLE') NOT NULL,
  `principal_amount` DECIMAL(14, 2) NOT NULL,
  `remaining_amount` DECIMAL(14, 2) NOT NULL,
  `description` VARCHAR(191) NULL,
  `loan_date` DATETIME(3) NOT NULL,
  `status` ENUM('OPEN', 'PAID') NOT NULL DEFAULT 'OPEN',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `loans_user_id_idx`(`user_id`),
  INDEX `loans_account_id_idx`(`account_id`),
  INDEX `loans_type_idx`(`type`),
  INDEX `loans_status_idx`(`status`),
  INDEX `loans_loan_date_idx`(`loan_date`),
  INDEX `loans_user_id_type_status_idx`(`user_id`, `type`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `loan_payments` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `loan_id` VARCHAR(191) NOT NULL,
  `account_id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `description` VARCHAR(191) NULL,
  `payment_date` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `loan_payments_user_id_idx`(`user_id`),
  INDEX `loan_payments_loan_id_idx`(`loan_id`),
  INDEX `loan_payments_account_id_idx`(`account_id`),
  INDEX `loan_payments_payment_date_idx`(`payment_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `loans` ADD CONSTRAINT `loans_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `loans` ADD CONSTRAINT `loans_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `loan_payments` ADD CONSTRAINT `loan_payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `loan_payments` ADD CONSTRAINT `loan_payments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `loan_payments` ADD CONSTRAINT `loan_payments_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
