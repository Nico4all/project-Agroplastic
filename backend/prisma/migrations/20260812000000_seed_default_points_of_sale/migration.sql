UPDATE `points_of_sale`
SET `name` = 'Cali', `code` = 'Cl', `document_prefix` = 'Cl',
    `city` = 'Cali', `address` = NULL, `is_active` = true
WHERE LOWER(`code`) = 'cl' OR LOWER(`name`) = 'cali';

INSERT INTO `points_of_sale`
  (`id`, `name`, `code`, `document_prefix`, `city`, `address`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'Cali', 'Cl', 'Cl', 'Cali', NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `points_of_sale` WHERE LOWER(`code`) = 'cl' OR LOWER(`name`) = 'cali'
);

UPDATE `points_of_sale`
SET `name` = 'Ipiales', `code` = 'Ip', `document_prefix` = 'Ip',
    `city` = 'Ipiales', `address` = NULL, `is_active` = true
WHERE LOWER(`code`) = 'ip' OR LOWER(`name`) = 'ipiales';

INSERT INTO `points_of_sale`
  (`id`, `name`, `code`, `document_prefix`, `city`, `address`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'Ipiales', 'Ip', 'Ip', 'Ipiales', NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `points_of_sale` WHERE LOWER(`code`) = 'ip' OR LOWER(`name`) = 'ipiales'
);

UPDATE `points_of_sale`
SET `name` = 'Pasto', `code` = 'Ps', `document_prefix` = 'Ps',
    `city` = 'Pasto', `address` = NULL, `is_active` = true
WHERE LOWER(`code`) = 'ps' OR LOWER(`name`) = 'pasto';

INSERT INTO `points_of_sale`
  (`id`, `name`, `code`, `document_prefix`, `city`, `address`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'Pasto', 'Ps', 'Ps', 'Pasto', NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `points_of_sale` WHERE LOWER(`code`) = 'ps' OR LOWER(`name`) = 'pasto'
);

UPDATE `points_of_sale`
SET `name` = 'Popayan', `code` = 'Py', `document_prefix` = 'Py',
    `city` = 'Popayan', `address` = NULL, `is_active` = true
WHERE LOWER(`code`) = 'py' OR LOWER(`name`) IN ('popayan', 'popayán');

INSERT INTO `points_of_sale`
  (`id`, `name`, `code`, `document_prefix`, `city`, `address`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), 'Popayan', 'Py', 'Py', 'Popayan', NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `points_of_sale`
  WHERE LOWER(`code`) = 'py' OR LOWER(`name`) IN ('popayan', 'popayán')
);
