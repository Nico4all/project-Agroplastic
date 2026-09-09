ALTER TABLE `inventory_transfers`
  ADD COLUMN `status` ENUM('ACTIVE', 'VOID') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `void_reason` TEXT NULL,
  ADD COLUMN `voided_at` DATETIME(3) NULL,
  ADD COLUMN `voided_by_user_id` VARCHAR(191) NULL,
  ADD INDEX `inventory_transfers_status_idx`(`status`),
  ADD INDEX `inventory_transfers_voided_by_user_id_idx`(`voided_by_user_id`),
  ADD CONSTRAINT `inventory_transfers_voided_by_user_id_fkey`
    FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_movements`
  MODIFY COLUMN `type` ENUM(
    'ENTRY',
    'ENTRY_EDIT',
    'ENTRY_VOID',
    'ORDER',
    'ORDER_VOID',
    'ADJUSTMENT_ADD',
    'ADJUSTMENT_SUBTRACT',
    'ADJUSTMENT_EDIT',
    'ADJUSTMENT_VOID',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'TRANSFER_EDIT_OUT',
    'TRANSFER_EDIT_IN',
    'TRANSFER_VOID_OUT',
    'TRANSFER_VOID_IN'
  ) NOT NULL;
