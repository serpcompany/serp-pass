CREATE TABLE `publisher_payment` (
  `id` text PRIMARY KEY NOT NULL,
  `publisher_earning_id` text NOT NULL,
  `publisher_id` text NOT NULL,
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `method` text NOT NULL CHECK (`method` IN ('ach', 'bank_transfer', 'paypal', 'wise', 'other')),
  `provider_reference` text NOT NULL,
  `amount` integer NOT NULL CHECK (`amount` > 0),
  `currency` text NOT NULL CHECK (length(`currency`) = 3),
  `paid_at` integer NOT NULL,
  `request_sha256` text NOT NULL,
  `reason` text NOT NULL,
  `recorded_by_user_id` text NOT NULL,
  `recorded_at` integer NOT NULL,
  FOREIGN KEY (`publisher_earning_id`) REFERENCES `publisher_earning` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `publisher_payment_earning_unique` ON `publisher_payment` (`publisher_earning_id`);
CREATE UNIQUE INDEX `publisher_payment_reference_unique` ON `publisher_payment` (`mode`, `method`, `provider_reference`);
CREATE INDEX `publisher_payment_publisher_paid_idx` ON `publisher_payment` (`publisher_id`, `paid_at`);

CREATE TRIGGER `publisher_payment_validate_insert`
BEFORE INSERT ON `publisher_payment`
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM `publisher_earning` earning
    JOIN `allocation_run` run ON run.`id` = earning.`allocation_run_id`
    WHERE earning.`id` = NEW.`publisher_earning_id`
      AND earning.`publisher_id` = NEW.`publisher_id`
      AND earning.`amount` = NEW.`amount`
      AND earning.`currency` = NEW.`currency`
      AND earning.`status` = 'accrued'
      AND run.`mode` = NEW.`mode`
      AND earning.`available_at` <= NEW.`paid_at`
  ) THEN RAISE(ABORT, 'publisher_payment_earning_mismatch') END;
END;

CREATE TRIGGER `publisher_payment_immutable_update`
BEFORE UPDATE ON `publisher_payment`
BEGIN SELECT RAISE(ABORT, 'publisher_payment_immutable'); END;

CREATE TRIGGER `publisher_payment_immutable_delete`
BEFORE DELETE ON `publisher_payment`
BEGIN SELECT RAISE(ABORT, 'publisher_payment_immutable'); END;
