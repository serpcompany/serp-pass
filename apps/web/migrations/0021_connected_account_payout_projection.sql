CREATE TABLE `connected_account_payout` (
  `id` text PRIMARY KEY NOT NULL,
  `publisher_connected_account_id` text NOT NULL,
  `publisher_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_payout_id` text NOT NULL,
  `amount` integer NOT NULL CHECK (`amount` > 0),
  `currency` text NOT NULL CHECK (length(`currency`) = 3),
  `status` text NOT NULL CHECK (`status` IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')),
  `arrival_date` integer,
  `failure_code` text,
  `latest_event_key` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`publisher_connected_account_id`) REFERENCES `publisher_connected_account` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `connected_account_payout_identity_unique` ON `connected_account_payout` (`provider`, `mode`, `provider_payout_id`);
CREATE INDEX `connected_account_payout_publisher_idx` ON `connected_account_payout` (`publisher_id`, `created_at`);

CREATE TABLE `stripe_payout_event` (
  `id` text PRIMARY KEY NOT NULL,
  `connected_account_payout_id` text NOT NULL,
  `publisher_connected_account_id` text NOT NULL,
  `publisher_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_event_id` text NOT NULL,
  `event_type` text NOT NULL CHECK (`event_type` IN ('payout.created', 'payout.updated', 'payout.paid', 'payout.failed', 'payout.canceled')),
  `provider_created_at` integer NOT NULL,
  `received_at` integer NOT NULL,
  `payload_sha256` text NOT NULL,
  `outcome` text NOT NULL CHECK (`outcome` IN ('applied', 'noop')),
  FOREIGN KEY (`connected_account_payout_id`) REFERENCES `connected_account_payout` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_connected_account_id`) REFERENCES `publisher_connected_account` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `stripe_payout_event_provider_identity_unique` ON `stripe_payout_event` (`provider`, `mode`, `provider_event_id`);
CREATE INDEX `stripe_payout_event_payout_idx` ON `stripe_payout_event` (`connected_account_payout_id`, `provider_created_at`);
