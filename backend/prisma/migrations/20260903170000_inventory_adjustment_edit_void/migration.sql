ALTER TABLE `inventory_adjustments`
  ADD COLUMN `status` ENUM('ACTIVE', 'VOID') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `void_reason` TEXT NULL,
  ADD COLUMN `voided_at` DATETIME(3) NULL,
  ADD COLUMN `voided_by_user_id` VARCHAR(191) NULL,
  ADD INDEX `inventory_adjustments_status_idx`(`status`),
  ADD INDEX `inventory_adjustments_voided_by_user_id_idx`(`voided_by_user_id`),
  ADD CONSTRAINT `inventory_adjustments_voided_by_user_id_fkey`
    FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_movements`
  MODIFY COLUMN `type` ENUM(
    'ENTRY',
    'ORDER',
    'ORDER_VOID',
    'ADJUSTMENT_ADD',
    'ADJUSTMENT_SUBTRACT',
    'ADJUSTMENT_EDIT',
    'ADJUSTMENT_VOID',
    'TRANSFER_OUT',
    'TRANSFER_IN'
  ) NOT NULL;
