CREATE TABLE `billing_checkout_attempt` (
  `id` text PRIMARY KEY NOT NULL,
  `subscriber_user_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `price_id` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `provider_customer_id` text,
  `provider_session_id` text,
  `status` text NOT NULL CHECK (`status` IN ('creating', 'open', 'complete', 'expired', 'failed')),
  `latest_event_key` text,
  `expires_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`subscriber_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `billing_checkout_idempotency_unique` ON `billing_checkout_attempt` (`idempotency_key`);
CREATE UNIQUE INDEX `billing_checkout_session_unique` ON `billing_checkout_attempt` (`provider`, `mode`, `provider_session_id`);
CREATE UNIQUE INDEX `billing_checkout_active_subscriber_unique` ON `billing_checkout_attempt` (`provider`, `mode`, `subscriber_user_id`) WHERE `status` IN ('creating', 'open');
CREATE INDEX `billing_checkout_subscriber_idx` ON `billing_checkout_attempt` (`subscriber_user_id`, `mode`);
