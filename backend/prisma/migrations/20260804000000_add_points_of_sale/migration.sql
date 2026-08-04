CREATE TABLE `points_of_sale` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NULL,
  `address` VARCHAR(300) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `points_of_sale_code_key`(`code`),
  INDEX `points_of_sale_is_active_idx`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `users` ADD COLUMN `point_of_sale_id` VARCHAR(191) NULL;

INSERT INTO `points_of_sale` (`id`, `name`, `code`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), CONCAT('Punto de venta ', `name`), `document_suffix`, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `users`
WHERE `role` = 'BODEGA';

UPDATE `users` AS `u`
INNER JOIN `points_of_sale` AS `p` ON `p`.`code` = `u`.`document_suffix`
SET `u`.`point_of_sale_id` = `p`.`id`
WHERE `u`.`role` = 'BODEGA';

CREATE INDEX `users_point_of_sale_id_idx` ON `users`(`point_of_sale_id`);

ALTER TABLE `users`
ADD CONSTRAINT `users_point_of_sale_id_fkey`
FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
