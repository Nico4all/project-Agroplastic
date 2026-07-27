ALTER TABLE `orders`
  MODIFY COLUMN `payment_method` ENUM('CASH', 'BANK', 'CREDIT') NULL;
