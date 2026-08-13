CREATE TABLE `publisher_connected_account` (
  `id` text PRIMARY KEY NOT NULL,
  `publisher_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_account_id` text NOT NULL,
  `account_type` text NOT NULL CHECK (`account_type` = 'express'),
  `details_submitted` integer NOT NULL DEFAULT 0 CHECK (`details_submitted` IN (0, 1)),
  `charges_enabled` integer NOT NULL DEFAULT 0 CHECK (`charges_enabled` IN (0, 1)),
  `payouts_enabled` integer NOT NULL DEFAULT 0 CHECK (`payouts_enabled` IN (0, 1)),
  `transfers_capability` text NOT NULL CHECK (`transfers_capability` IN ('active', 'inactive', 'pending', 'unrequested')),
  `requirements_currently_due_count` integer NOT NULL DEFAULT 0 CHECK (`requirements_currently_due_count` >= 0),
  `disabled_reason` text,
  `latest_event_key` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `publisher_connected_account_identity_unique` ON `publisher_connected_account` (`provider`, `mode`, `provider_account_id`);
CREATE UNIQUE INDEX `publisher_connected_account_publisher_mode_unique` ON `publisher_connected_account` (`provider`, `mode`, `publisher_id`);

CREATE TABLE `stripe_connect_event` (
  `id` text PRIMARY KEY NOT NULL,
  `publisher_connected_account_id` text NOT NULL,
  `publisher_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_event_id` text NOT NULL,
  `event_type` text NOT NULL CHECK (`event_type` = 'account.updated'),
  `provider_created_at` integer NOT NULL,
  `received_at` integer NOT NULL,
  `payload_sha256` text NOT NULL,
  `outcome` text NOT NULL CHECK (`outcome` IN ('applied', 'noop')),
  FOREIGN KEY (`publisher_connected_account_id`) REFERENCES `publisher_connected_account` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `stripe_connect_event_provider_identity_unique` ON `stripe_connect_event` (`provider`, `mode`, `provider_event_id`);
CREATE INDEX `stripe_connect_event_account_idx` ON `stripe_connect_event` (`publisher_connected_account_id`, `provider_created_at`);
