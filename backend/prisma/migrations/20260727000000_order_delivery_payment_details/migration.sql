ALTER TABLE `orders`
  ADD COLUMN `delivery_address` VARCHAR(300) NULL,
  ADD COLUMN `client_phone` VARCHAR(50) NULL,
  ADD COLUMN `payment_method` ENUM('CASH', 'BANK') NULL,
  ADD COLUMN `observations` TEXT NULL;
