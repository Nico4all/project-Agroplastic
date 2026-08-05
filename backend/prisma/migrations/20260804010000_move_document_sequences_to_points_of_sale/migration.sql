ALTER TABLE `points_of_sale`
  ADD COLUMN `document_prefix` VARCHAR(191) NULL,
  ADD COLUMN `next_income_number` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `next_expense_number` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `next_order_number` INTEGER NOT NULL DEFAULT 1;

UPDATE `points_of_sale`
SET `document_prefix` = `code`;

ALTER TABLE `incomes` ADD COLUMN `point_of_sale_id` VARCHAR(191) NULL;
ALTER TABLE `expenses` ADD COLUMN `point_of_sale_id` VARCHAR(191) NULL;
ALTER TABLE `orders` ADD COLUMN `point_of_sale_id` VARCHAR(191) NULL;

UPDATE `incomes` AS `i`
INNER JOIN `users` AS `u` ON `u`.`id` = `i`.`user_id`
SET `i`.`point_of_sale_id` = `u`.`point_of_sale_id`;

UPDATE `expenses` AS `e`
INNER JOIN `users` AS `u` ON `u`.`id` = `e`.`user_id`
SET `e`.`point_of_sale_id` = `u`.`point_of_sale_id`;

UPDATE `orders` AS `o`
INNER JOIN `users` AS `u` ON `u`.`id` = `o`.`user_id`
SET `o`.`point_of_sale_id` = `u`.`point_of_sale_id`;

UPDATE `points_of_sale` AS `p`
SET `next_income_number` = GREATEST(
  COALESCE((SELECT MAX(`i`.`document_sequence`) + 1 FROM `incomes` AS `i` WHERE `i`.`point_of_sale_id` = `p`.`id`), 1),
  COALESCE((SELECT MAX(`i`.`document_sequence`) + 1 FROM `incomes` AS `i` WHERE `i`.`document_number` LIKE CONCAT(`p`.`document_prefix`, '-%')), 1)
);

UPDATE `points_of_sale` AS `p`
SET `next_expense_number` = GREATEST(
  COALESCE((SELECT MAX(`e`.`document_sequence`) + 1 FROM `expenses` AS `e` WHERE `e`.`point_of_sale_id` = `p`.`id`), 1),
  COALESCE((SELECT MAX(`e`.`document_sequence`) + 1 FROM `expenses` AS `e` WHERE `e`.`document_number` LIKE CONCAT(`p`.`document_prefix`, '-%')), 1)
);

UPDATE `points_of_sale` AS `p`
SET `next_order_number` = GREATEST(
  COALESCE((SELECT MAX(`o`.`document_sequence`) + 1 FROM `orders` AS `o` WHERE `o`.`point_of_sale_id` = `p`.`id`), 1),
  COALESCE((SELECT MAX(`o`.`document_sequence`) + 1 FROM `orders` AS `o` WHERE `o`.`document_number` LIKE CONCAT(`p`.`document_prefix`, '-%')), 1)
);

ALTER TABLE `points_of_sale` MODIFY `document_prefix` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `points_of_sale_document_prefix_key` ON `points_of_sale`(`document_prefix`);

DROP INDEX `incomes_user_id_document_sequence_key` ON `incomes`;
DROP INDEX `expenses_user_id_document_sequence_key` ON `expenses`;
DROP INDEX `orders_user_id_document_sequence_key` ON `orders`;

CREATE INDEX `incomes_point_of_sale_id_document_sequence_idx` ON `incomes`(`point_of_sale_id`, `document_sequence`);
CREATE INDEX `expenses_point_of_sale_id_document_sequence_idx` ON `expenses`(`point_of_sale_id`, `document_sequence`);
CREATE INDEX `orders_point_of_sale_id_document_sequence_idx` ON `orders`(`point_of_sale_id`, `document_sequence`);

ALTER TABLE `incomes`
  ADD CONSTRAINT `incomes_point_of_sale_id_fkey`
  FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_point_of_sale_id_fkey`
  FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_point_of_sale_id_fkey`
  FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX `users_document_suffix_key` ON `users`;
ALTER TABLE `users`
  DROP COLUMN `document_suffix`,
  DROP COLUMN `next_income_number`,
  DROP COLUMN `next_expense_number`,
  DROP COLUMN `next_order_number`;
