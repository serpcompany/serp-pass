CREATE TABLE `settlement` (
  `id` text PRIMARY KEY NOT NULL,
  `publisher_earning_id` text NOT NULL,
  `publisher_id` text NOT NULL,
  `publisher_connected_account_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `amount` integer NOT NULL CHECK (`amount` > 0),
  `currency` text NOT NULL CHECK (length(`currency`) = 3),
  `status` text NOT NULL CHECK (`status` IN ('pending', 'transferred', 'reversed')),
  `request_sha256` text NOT NULL,
  `reason` text NOT NULL,
  `requested_by_user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `transferred_at` integer,
  `reversed_at` integer,
  FOREIGN KEY (`publisher_earning_id`) REFERENCES `publisher_earning` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_connected_account_id`) REFERENCES `publisher_connected_account` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`requested_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `settlement_earning_unique` ON `settlement` (`publisher_earning_id`);
CREATE INDEX `settlement_publisher_status_idx` ON `settlement` (`publisher_id`, `status`, `created_at`);

CREATE TABLE `transfer_attempt` (
  `id` text PRIMARY KEY NOT NULL,
  `settlement_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `execution_mode` text NOT NULL CHECK (`execution_mode` IN ('local_simulation', 'stripe_api')),
  `idempotency_key` text NOT NULL,
  `destination_account_id` text NOT NULL,
  `amount` integer NOT NULL CHECK (`amount` > 0),
  `currency` text NOT NULL CHECK (length(`currency`) = 3),
  `status` text NOT NULL CHECK (`status` IN ('creating', 'succeeded', 'failed', 'reversed')),
  `provider_transfer_id` text,
  `failure_code` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `succeeded_at` integer,
  `reversed_at` integer,
  FOREIGN KEY (`settlement_id`) REFERENCES `settlement` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `transfer_attempt_settlement_unique` ON `transfer_attempt` (`settlement_id`);
CREATE UNIQUE INDEX `transfer_attempt_idempotency_unique` ON `transfer_attempt` (`idempotency_key`);
CREATE UNIQUE INDEX `transfer_attempt_provider_identity_unique` ON `transfer_attempt` (`provider`, `provider_transfer_id`) WHERE `provider_transfer_id` IS NOT NULL;

CREATE TRIGGER `settlement_validate_insert`
BEFORE INSERT ON `settlement`
BEGIN
  SELECT CASE WHEN
    (SELECT `status` FROM `publisher_earning` WHERE `id` = NEW.`publisher_earning_id`) <> 'accrued' OR
    (SELECT `publisher_id` FROM `publisher_earning` WHERE `id` = NEW.`publisher_earning_id`) <> NEW.`publisher_id` OR
    (SELECT `amount` FROM `publisher_earning` WHERE `id` = NEW.`publisher_earning_id`) <> NEW.`amount` OR
    (SELECT `currency` FROM `publisher_earning` WHERE `id` = NEW.`publisher_earning_id`) <> NEW.`currency` OR
    (SELECT `publisher_id` FROM `publisher_connected_account` WHERE `id` = NEW.`publisher_connected_account_id`) <> NEW.`publisher_id` OR
    (SELECT `mode` FROM `publisher_connected_account` WHERE `id` = NEW.`publisher_connected_account_id`) <> NEW.`mode`
  THEN RAISE(ABORT, 'invalid_settlement_source') END;
END;

CREATE TRIGGER `transfer_attempt_validate_insert`
BEFORE INSERT ON `transfer_attempt`
BEGIN
  SELECT CASE WHEN
    (SELECT `status` FROM `settlement` WHERE `id` = NEW.`settlement_id`) <> 'pending' OR
    (SELECT `amount` FROM `settlement` WHERE `id` = NEW.`settlement_id`) <> NEW.`amount` OR
    (SELECT `currency` FROM `settlement` WHERE `id` = NEW.`settlement_id`) <> NEW.`currency` OR
    (SELECT `provider_account_id` FROM `publisher_connected_account` WHERE `id` = (SELECT `publisher_connected_account_id` FROM `settlement` WHERE `id` = NEW.`settlement_id`)) <> NEW.`destination_account_id`
  THEN RAISE(ABORT, 'invalid_transfer_attempt') END;
END;

CREATE TRIGGER `settlement_validate_transferred`
BEFORE UPDATE OF `status` ON `settlement`
WHEN OLD.`status` = 'pending' AND NEW.`status` = 'transferred'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `transfer_attempt`
    WHERE `settlement_id` = NEW.`id` AND `status` = 'succeeded' AND `provider_transfer_id` IS NOT NULL
  ) THEN RAISE(ABORT, 'settlement_requires_successful_transfer') END;
END;

CREATE TRIGGER `publisher_earning_validate_release`
BEFORE UPDATE OF `status` ON `publisher_earning`
WHEN OLD.`status` = 'accrued' AND NEW.`status` = 'released'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `settlement`
    WHERE `publisher_earning_id` = OLD.`id` AND `status` = 'transferred'
  ) THEN RAISE(ABORT, 'earning_requires_transferred_settlement') END;
END;

CREATE TRIGGER `settlement_immutable_delete`
BEFORE DELETE ON `settlement`
BEGIN SELECT RAISE(ABORT, 'settlement_immutable'); END;

CREATE TRIGGER `settlement_financial_immutable`
BEFORE UPDATE OF `publisher_earning_id`, `publisher_id`, `publisher_connected_account_id`, `provider`, `mode`, `amount`, `currency`, `request_sha256`, `reason`, `requested_by_user_id`, `created_at` ON `settlement`
BEGIN SELECT RAISE(ABORT, 'settlement_financials_immutable'); END;

CREATE TRIGGER `transfer_attempt_immutable_delete`
BEFORE DELETE ON `transfer_attempt`
BEGIN SELECT RAISE(ABORT, 'transfer_attempt_immutable'); END;

CREATE TRIGGER `transfer_attempt_financial_immutable`
BEFORE UPDATE OF `settlement_id`, `provider`, `execution_mode`, `idempotency_key`, `destination_account_id`, `amount`, `currency`, `created_at` ON `transfer_attempt`
BEGIN SELECT RAISE(ABORT, 'transfer_attempt_financials_immutable'); END;
