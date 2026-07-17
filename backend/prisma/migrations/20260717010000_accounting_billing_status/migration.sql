ALTER TABLE `incomes`
  ADD COLUMN `caused_at` DATETIME(3) NULL;

ALTER TABLE `expenses`
  ADD COLUMN `caused_at` DATETIME(3) NULL;

ALTER TABLE `orders`
  ADD COLUMN `invoiced_at` DATETIME(3) NULL;
