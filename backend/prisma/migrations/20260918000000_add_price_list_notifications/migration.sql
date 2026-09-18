CREATE TABLE `app_notifications` (
  `id` VARCHAR(191) NOT NULL,
  `recipient_user_id` VARCHAR(191) NOT NULL,
  `sender_user_id` VARCHAR(191) NULL,
  `point_of_sale_id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `app_notifications_recipient_user_id_read_at_created_at_idx` (`recipient_user_id`, `read_at`, `created_at`),
  INDEX `app_notifications_point_of_sale_id_created_at_idx` (`point_of_sale_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `app_notifications`
  ADD CONSTRAINT `app_notifications_recipient_user_id_fkey`
    FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `app_notifications_sender_user_id_fkey`
    FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `app_notifications_point_of_sale_id_fkey`
    FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
