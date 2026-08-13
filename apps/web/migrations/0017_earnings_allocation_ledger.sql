CREATE TABLE `allocation_run` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `currency` text NOT NULL CHECK (length(`currency`) = 3),
  `distributable_amount` integer NOT NULL CHECK (`distributable_amount` > 0),
  `reserve_amount` integer NOT NULL CHECK (`reserve_amount` >= 0),
  `platform_amount` integer NOT NULL CHECK (`platform_amount` >= 0),
  `status` text NOT NULL CHECK (`status` IN ('draft', 'posted')),
  `request_sha256` text NOT NULL,
  `reason` text NOT NULL,
  `agreement_reference` text NOT NULL,
  `posted_by_user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `posted_at` integer,
  FOREIGN KEY (`posted_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `allocation_run_mode_posted_idx` ON `allocation_run` (`mode`, `posted_at`);

CREATE TABLE `allocation_run_receipt` (
  `allocation_run_id` text NOT NULL,
  `cash_receipt_id` text NOT NULL,
  `amount` integer NOT NULL CHECK (`amount` > 0),
  PRIMARY KEY (`allocation_run_id`, `cash_receipt_id`),
  FOREIGN KEY (`allocation_run_id`) REFERENCES `allocation_run` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`cash_receipt_id`) REFERENCES `cash_receipt` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `allocation_run_receipt_receipt_idx` ON `allocation_run_receipt` (`cash_receipt_id`);

CREATE TABLE `publisher_earning` (
  `id` text PRIMARY KEY NOT NULL,
  `allocation_run_id` text NOT NULL,
  `publisher_id` text NOT NULL,
  `amount` integer NOT NULL CHECK (`amount` > 0),
  `currency` text NOT NULL CHECK (length(`currency`) = 3),
  `available_at` integer NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('accrued', 'released', 'reversed')),
  `created_at` integer NOT NULL,
  `released_at` integer,
  FOREIGN KEY (`allocation_run_id`) REFERENCES `allocation_run` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `publisher_earning_publisher_status_idx` ON `publisher_earning` (`publisher_id`, `status`, `available_at`);
CREATE INDEX `publisher_earning_allocation_idx` ON `publisher_earning` (`allocation_run_id`);

CREATE TABLE `ledger_entry` (
  `id` text PRIMARY KEY NOT NULL,
  `allocation_run_id` text NOT NULL,
  `entry_type` text NOT NULL CHECK (`entry_type` IN ('cash_receipt', 'reserve', 'platform', 'publisher_earning')),
  `amount` integer NOT NULL CHECK (`amount` <> 0),
  `currency` text NOT NULL CHECK (length(`currency`) = 3),
  `cash_receipt_id` text,
  `publisher_id` text,
  `publisher_earning_id` text,
  `posted_at` integer NOT NULL,
  FOREIGN KEY (`allocation_run_id`) REFERENCES `allocation_run` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`cash_receipt_id`) REFERENCES `cash_receipt` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_earning_id`) REFERENCES `publisher_earning` (`id`) ON UPDATE no action ON DELETE restrict,
  CHECK (
    (`entry_type` = 'cash_receipt' AND `amount` < 0 AND `cash_receipt_id` IS NOT NULL AND `publisher_id` IS NULL AND `publisher_earning_id` IS NULL) OR
    (`entry_type` IN ('reserve', 'platform') AND `amount` > 0 AND `cash_receipt_id` IS NULL AND `publisher_id` IS NULL AND `publisher_earning_id` IS NULL) OR
    (`entry_type` = 'publisher_earning' AND `amount` > 0 AND `cash_receipt_id` IS NULL AND `publisher_id` IS NOT NULL AND `publisher_earning_id` IS NOT NULL)
  )
);

CREATE UNIQUE INDEX `ledger_entry_receipt_unique` ON `ledger_entry` (`allocation_run_id`, `cash_receipt_id`) WHERE `entry_type` = 'cash_receipt';
CREATE UNIQUE INDEX `ledger_entry_earning_unique` ON `ledger_entry` (`allocation_run_id`, `publisher_earning_id`) WHERE `entry_type` = 'publisher_earning';
CREATE UNIQUE INDEX `ledger_entry_reserve_unique` ON `ledger_entry` (`allocation_run_id`) WHERE `entry_type` = 'reserve';
CREATE UNIQUE INDEX `ledger_entry_platform_unique` ON `ledger_entry` (`allocation_run_id`) WHERE `entry_type` = 'platform';

CREATE TRIGGER `allocation_receipt_capacity`
BEFORE INSERT ON `allocation_run_receipt`
BEGIN
  SELECT CASE WHEN
    (SELECT `amount` FROM `cash_receipt` WHERE `id` = NEW.`cash_receipt_id`) <
    NEW.`amount` + COALESCE((SELECT sum(`amount`) FROM `allocation_run_receipt` WHERE `cash_receipt_id` = NEW.`cash_receipt_id`), 0)
  THEN RAISE(ABORT, 'cash_receipt_overallocated') END;
  SELECT CASE WHEN
    (SELECT `currency` FROM `cash_receipt` WHERE `id` = NEW.`cash_receipt_id`) <>
    (SELECT `currency` FROM `allocation_run` WHERE `id` = NEW.`allocation_run_id`)
  THEN RAISE(ABORT, 'cash_receipt_currency_mismatch') END;
END;

CREATE TRIGGER `allocation_run_validate_post`
BEFORE UPDATE OF `status` ON `allocation_run`
WHEN OLD.`status` = 'draft' AND NEW.`status` = 'posted'
BEGIN
  SELECT CASE WHEN
    (SELECT COALESCE(sum(`amount`), 0) FROM `allocation_run_receipt` WHERE `allocation_run_id` = NEW.`id`) <> NEW.`distributable_amount` OR
    NEW.`reserve_amount` + NEW.`platform_amount` + (SELECT COALESCE(sum(`amount`), 0) FROM `publisher_earning` WHERE `allocation_run_id` = NEW.`id`) <> NEW.`distributable_amount` OR
    (SELECT COALESCE(sum(`amount`), 0) FROM `ledger_entry` WHERE `allocation_run_id` = NEW.`id`) <> 0
  THEN RAISE(ABORT, 'allocation_run_not_balanced') END;
END;

CREATE TRIGGER `allocation_run_immutable_update`
BEFORE UPDATE ON `allocation_run`
WHEN OLD.`status` = 'posted'
BEGIN SELECT RAISE(ABORT, 'posted_allocation_immutable'); END;

CREATE TRIGGER `allocation_run_immutable_delete`
BEFORE DELETE ON `allocation_run`
WHEN OLD.`status` = 'posted'
BEGIN SELECT RAISE(ABORT, 'posted_allocation_immutable'); END;

CREATE TRIGGER `allocation_receipt_immutable_update`
BEFORE UPDATE ON `allocation_run_receipt`
WHEN (SELECT `status` FROM `allocation_run` WHERE `id` = OLD.`allocation_run_id`) = 'posted'
BEGIN SELECT RAISE(ABORT, 'posted_allocation_immutable'); END;

CREATE TRIGGER `allocation_receipt_immutable_delete`
BEFORE DELETE ON `allocation_run_receipt`
WHEN (SELECT `status` FROM `allocation_run` WHERE `id` = OLD.`allocation_run_id`) = 'posted'
BEGIN SELECT RAISE(ABORT, 'posted_allocation_immutable'); END;

CREATE TRIGGER `ledger_entry_immutable_update`
BEFORE UPDATE ON `ledger_entry`
BEGIN SELECT RAISE(ABORT, 'ledger_entry_immutable'); END;

CREATE TRIGGER `ledger_entry_immutable_delete`
BEFORE DELETE ON `ledger_entry`
BEGIN SELECT RAISE(ABORT, 'ledger_entry_immutable'); END;

CREATE TRIGGER `publisher_earning_financial_immutable`
BEFORE UPDATE OF `allocation_run_id`, `publisher_id`, `amount`, `currency`, `available_at` ON `publisher_earning`
WHEN (SELECT `status` FROM `allocation_run` WHERE `id` = OLD.`allocation_run_id`) = 'posted'
BEGIN SELECT RAISE(ABORT, 'publisher_earning_financials_immutable'); END;

CREATE TRIGGER `publisher_earning_immutable_delete`
BEFORE DELETE ON `publisher_earning`
WHEN (SELECT `status` FROM `allocation_run` WHERE `id` = OLD.`allocation_run_id`) = 'posted'
BEGIN SELECT RAISE(ABORT, 'publisher_earning_immutable'); END;

CREATE TRIGGER `cash_receipt_immutable_update`
BEFORE UPDATE ON `cash_receipt`
BEGIN SELECT RAISE(ABORT, 'cash_receipt_immutable'); END;

CREATE TRIGGER `cash_receipt_immutable_delete`
BEFORE DELETE ON `cash_receipt`
BEGIN SELECT RAISE(ABORT, 'cash_receipt_immutable'); END;
