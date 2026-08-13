ALTER TABLE `transfer_attempt` ADD COLUMN `amount_reversed` integer NOT NULL DEFAULT 0 CHECK (`amount_reversed` >= 0);
ALTER TABLE `transfer_attempt` ADD COLUMN `latest_event_key` text;

CREATE TABLE `stripe_transfer_event` (
  `id` text PRIMARY KEY NOT NULL,
  `transfer_attempt_id` text NOT NULL,
  `settlement_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_event_id` text NOT NULL,
  `event_type` text NOT NULL CHECK (`event_type` IN ('transfer.created', 'transfer.updated', 'transfer.reversed')),
  `provider_created_at` integer NOT NULL,
  `received_at` integer NOT NULL,
  `payload_sha256` text NOT NULL,
  `outcome` text NOT NULL CHECK (`outcome` IN ('applied', 'noop')),
  FOREIGN KEY (`transfer_attempt_id`) REFERENCES `transfer_attempt` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`settlement_id`) REFERENCES `settlement` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `stripe_transfer_event_provider_identity_unique` ON `stripe_transfer_event` (`provider`, `mode`, `provider_event_id`);
CREATE INDEX `stripe_transfer_event_attempt_idx` ON `stripe_transfer_event` (`transfer_attempt_id`, `provider_created_at`);

CREATE TRIGGER `transfer_attempt_validate_reversed_evidence`
BEFORE UPDATE OF `status` ON `transfer_attempt`
WHEN NEW.`status` = 'reversed'
BEGIN
  SELECT CASE WHEN NEW.`amount_reversed` <> NEW.`amount` OR NEW.`reversed_at` IS NULL
  THEN RAISE(ABORT, 'full_transfer_reversal_evidence_required') END;
END;

CREATE TRIGGER `settlement_validate_reversed`
BEFORE UPDATE OF `status` ON `settlement`
WHEN OLD.`status` = 'transferred' AND NEW.`status` = 'reversed'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `transfer_attempt`
    WHERE `settlement_id` = NEW.`id` AND `status` = 'reversed' AND `amount_reversed` = `amount`
  ) THEN RAISE(ABORT, 'settlement_requires_reversed_transfer') END;
END;
