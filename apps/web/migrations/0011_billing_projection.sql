CREATE TABLE `billing_customer` (
  `id` text PRIMARY KEY NOT NULL,
  `subscriber_user_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_customer_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`subscriber_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `billing_customer_provider_identity_unique` ON `billing_customer` (`provider`, `mode`, `provider_customer_id`);
CREATE UNIQUE INDEX `billing_customer_subscriber_mode_unique` ON `billing_customer` (`provider`, `mode`, `subscriber_user_id`);

CREATE TABLE `normalized_subscription` (
  `id` text PRIMARY KEY NOT NULL,
  `billing_customer_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_subscription_id` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  `cancel_at_period_end` integer NOT NULL DEFAULT 0 CHECK (`cancel_at_period_end` IN (0, 1)),
  `current_period_end` integer,
  `entitled_until` integer,
  `latest_status_event_key` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`billing_customer_id`) REFERENCES `billing_customer` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `normalized_subscription_provider_identity_unique` ON `normalized_subscription` (`provider`, `mode`, `provider_subscription_id`);
CREATE INDEX `normalized_subscription_customer_idx` ON `normalized_subscription` (`billing_customer_id`);

CREATE TABLE `billing_invoice` (
  `id` text PRIMARY KEY NOT NULL,
  `normalized_subscription_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_invoice_id` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('paid', 'payment_failed')),
  `amount_paid` integer NOT NULL DEFAULT 0 CHECK (`amount_paid` >= 0),
  `currency` text,
  `period_start` integer,
  `period_end` integer,
  `latest_event_key` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`normalized_subscription_id`) REFERENCES `normalized_subscription` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `billing_invoice_provider_identity_unique` ON `billing_invoice` (`provider`, `mode`, `provider_invoice_id`);
CREATE INDEX `billing_invoice_subscription_idx` ON `billing_invoice` (`normalized_subscription_id`);

CREATE TABLE `billing_event` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `provider_event_id` text NOT NULL,
  `event_type` text NOT NULL,
  `provider_created_at` integer NOT NULL,
  `received_at` integer NOT NULL,
  `payload_sha256` text NOT NULL,
  `outcome` text NOT NULL CHECK (`outcome` IN ('applied', 'noop')),
  `detail` text NOT NULL
);

CREATE UNIQUE INDEX `billing_event_provider_identity_unique` ON `billing_event` (`provider`, `mode`, `provider_event_id`);

CREATE TABLE `cash_receipt` (
  `id` text PRIMARY KEY NOT NULL,
  `billing_invoice_id` text NOT NULL,
  `source_billing_event_id` text NOT NULL,
  `amount` integer NOT NULL CHECK (`amount` >= 0),
  `currency` text NOT NULL,
  `received_at` integer NOT NULL,
  FOREIGN KEY (`billing_invoice_id`) REFERENCES `billing_invoice` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`source_billing_event_id`) REFERENCES `billing_event` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `cash_receipt_invoice_unique` ON `cash_receipt` (`billing_invoice_id`);
CREATE UNIQUE INDEX `cash_receipt_source_event_unique` ON `cash_receipt` (`source_billing_event_id`);
