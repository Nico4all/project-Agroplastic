ALTER TABLE `inventory_stocks`
  ADD COLUMN `package_label` VARCHAR(100) NULL,
  ADD COLUMN `units_per_package` DECIMAL(14, 3) NULL,
  ADD COLUMN `package_price` DECIMAL(14, 2) NULL;

ALTER TABLE `order_items`
  ADD COLUMN `sale_unit` ENUM('UNIT', 'PACKAGE') NOT NULL DEFAULT 'UNIT',
  ADD COLUMN `presentation_label` VARCHAR(100) NOT NULL DEFAULT 'Unidad',
  ADD COLUMN `inventory_quantity` DECIMAL(14, 3) NULL;

UPDATE `order_items`
SET `inventory_quantity` = `quantity`
WHERE `inventory_quantity` IS NULL;

ALTER TABLE `order_items`
  MODIFY COLUMN `inventory_quantity` DECIMAL(14, 3) NOT NULL;
