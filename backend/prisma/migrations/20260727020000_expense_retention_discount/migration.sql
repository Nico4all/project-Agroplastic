ALTER TABLE `expenses`
  ADD COLUMN `applies_retention` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `retention_percentage` DECIMAL(5, 2) NULL,
  ADD COLUMN `retention_amount` DECIMAL(14, 2) NULL;
