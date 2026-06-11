ALTER TABLE `users`
  ADD COLUMN `email_verified_at` DATETIME(3) NULL;

UPDATE `users`
SET `email_verified_at` = COALESCE(`email_verified_at`, NOW(3));

CREATE TABLE `email_verification_codes` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `purpose` ENUM('REGISTER', 'PASSWORD_CHANGE', 'PASSWORD_RESET') NOT NULL,
  `code_hash` TEXT NOT NULL,
  `new_password_hash` TEXT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `email_verification_codes_user_id_idx` (`user_id`),
  INDEX `email_verification_codes_email_idx` (`email`),
  INDEX `email_verification_codes_purpose_idx` (`purpose`),
  INDEX `email_verification_codes_expires_at_idx` (`expires_at`),
  INDEX `email_verification_codes_user_id_purpose_used_at_idx` (`user_id`, `purpose`, `used_at`),
  CONSTRAINT `email_verification_codes_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
