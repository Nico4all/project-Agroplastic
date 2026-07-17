ALTER TABLE `users`
  ADD COLUMN `document_suffix` VARCHAR(191) NULL,
  ADD COLUMN `next_income_number` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `next_expense_number` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `next_order_number` INTEGER NOT NULL DEFAULT 1;

UPDATE `users` AS `u`
JOIN (
  SELECT
    `ranked_source`.`id`,
    `ranked_source`.`base_suffix`,
    ROW_NUMBER() OVER (
      PARTITION BY `ranked_source`.`base_suffix`
      ORDER BY `ranked_source`.`created_at`, `ranked_source`.`id`
    ) AS `suffix_number`
  FROM (
    SELECT
      `id`,
      `created_at`,
      COALESCE(
        NULLIF(
          LEFT(
            TRIM(BOTH '-' FROM REGEXP_REPLACE(UPPER(TRIM(COALESCE(NULLIF(`city`, ''), `username`))), '[^[:alnum:]]+', '-')),
            170
          ),
          ''
        ),
        'USR'
      ) AS `base_suffix`
    FROM `users`
  ) AS `ranked_source`
) AS `suffixes` ON `suffixes`.`id` = `u`.`id`
SET `u`.`document_suffix` = CASE
  WHEN `suffixes`.`suffix_number` = 1 THEN `suffixes`.`base_suffix`
  ELSE CONCAT(`suffixes`.`base_suffix`, '-', `suffixes`.`suffix_number`)
END;

ALTER TABLE `clients`
  ADD COLUMN `identity_document_key` VARCHAR(191) NULL;

UPDATE `clients`
SET `identity_document_key` = UPPER(REGEXP_REPLACE(TRIM(`identity_document`), '[^[:alnum:]]+', ''));

UPDATE `clients` AS `client`
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `identity_document_key`
      ORDER BY `created_at`, `id`
    ) AS `duplicate_number`
  FROM `clients`
) AS `duplicates` ON `duplicates`.`id` = `client`.`id`
SET `client`.`identity_document_key` = CONCAT(`client`.`identity_document_key`, '-DUP-', `client`.`id`)
WHERE `duplicates`.`duplicate_number` > 1;

ALTER TABLE `incomes`
  ADD COLUMN `document_sequence` INTEGER NULL,
  ADD COLUMN `document_number` VARCHAR(191) NULL;

UPDATE `incomes` AS `income`
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `user_id`
      ORDER BY `created_at`, `id`
    ) AS `sequence_number`
  FROM `incomes`
) AS `numbered` ON `numbered`.`id` = `income`.`id`
JOIN `users` AS `user` ON `user`.`id` = `income`.`user_id`
SET
  `income`.`document_sequence` = `numbered`.`sequence_number`,
  `income`.`document_number` = CONCAT(`user`.`document_suffix`, '-', `numbered`.`sequence_number`);

ALTER TABLE `expenses`
  ADD COLUMN `document_sequence` INTEGER NULL,
  ADD COLUMN `document_number` VARCHAR(191) NULL;

UPDATE `expenses` AS `expense`
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `user_id`
      ORDER BY `created_at`, `id`
    ) AS `sequence_number`
  FROM `expenses`
) AS `numbered` ON `numbered`.`id` = `expense`.`id`
JOIN `users` AS `user` ON `user`.`id` = `expense`.`user_id`
SET
  `expense`.`document_sequence` = `numbered`.`sequence_number`,
  `expense`.`document_number` = CONCAT(`user`.`document_suffix`, '-', `numbered`.`sequence_number`);

UPDATE `users` AS `user`
SET `next_income_number` = COALESCE(
  (SELECT MAX(`document_sequence`) + 1 FROM `incomes` WHERE `user_id` = `user`.`id`),
  1
);

UPDATE `users` AS `user`
SET `next_expense_number` = COALESCE(
  (SELECT MAX(`document_sequence`) + 1 FROM `expenses` WHERE `user_id` = `user`.`id`),
  1
);

ALTER TABLE `users`
  MODIFY `document_suffix` VARCHAR(191) NOT NULL;

ALTER TABLE `clients`
  MODIFY `identity_document_key` VARCHAR(191) NOT NULL;

ALTER TABLE `incomes`
  MODIFY `document_sequence` INTEGER NOT NULL,
  MODIFY `document_number` VARCHAR(191) NOT NULL;

ALTER TABLE `expenses`
  MODIFY `document_sequence` INTEGER NOT NULL,
  MODIFY `document_number` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `users_document_suffix_key` ON `users`(`document_suffix`);
CREATE UNIQUE INDEX `clients_identity_document_key_key` ON `clients`(`identity_document_key`);
CREATE UNIQUE INDEX `incomes_document_number_key` ON `incomes`(`document_number`);
CREATE UNIQUE INDEX `incomes_user_id_document_sequence_key` ON `incomes`(`user_id`, `document_sequence`);
CREATE UNIQUE INDEX `expenses_document_number_key` ON `expenses`(`document_number`);
CREATE UNIQUE INDEX `expenses_user_id_document_sequence_key` ON `expenses`(`user_id`, `document_sequence`);

CREATE TABLE `products` (
  `id` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `normalized_description` VARCHAR(191) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_by_user_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `products_normalized_description_key`(`normalized_description`),
  INDEX `products_is_active_idx`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orders` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `client_id` VARCHAR(191) NOT NULL,
  `document_sequence` INTEGER NOT NULL,
  `document_number` VARCHAR(191) NOT NULL,
  `client_name` VARCHAR(191) NOT NULL,
  `client_document` VARCHAR(191) NOT NULL,
  `total_amount` DECIMAL(14, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `orders_document_number_key`(`document_number`),
  UNIQUE INDEX `orders_user_id_document_sequence_key`(`user_id`, `document_sequence`),
  INDEX `orders_user_id_idx`(`user_id`),
  INDEX `orders_client_id_idx`(`client_id`),
  INDEX `orders_created_at_idx`(`created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `product_description` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL,
  `unit_price` DECIMAL(14, 2) NOT NULL,
  `line_total` DECIMAL(14, 2) NOT NULL,
  INDEX `order_items_order_id_idx`(`order_id`),
  INDEX `order_items_product_id_idx`(`product_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `products`
  ADD CONSTRAINT `products_created_by_user_id_fkey`
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `orders_client_id_fkey`
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `order_items_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX `clients_city_idx` ON `clients`;
DROP INDEX `clients_is_general_idx` ON `clients`;
DROP INDEX `clients_identity_document_idx` ON `clients`;
DROP INDEX `incomes_city_idx` ON `incomes`;
DROP INDEX `expenses_city_idx` ON `expenses`;

ALTER TABLE `clients`
  DROP COLUMN `city`,
  DROP COLUMN `is_general`;

ALTER TABLE `incomes`
  DROP COLUMN `city`;

ALTER TABLE `expenses`
  DROP COLUMN `city`;

ALTER TABLE `users`
  DROP COLUMN `city`;
