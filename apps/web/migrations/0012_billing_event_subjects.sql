ALTER TABLE `billing_event` ADD COLUMN `billing_customer_id` text REFERENCES `billing_customer` (`id`) ON UPDATE no action ON DELETE restrict;
ALTER TABLE `billing_event` ADD COLUMN `normalized_subscription_id` text REFERENCES `normalized_subscription` (`id`) ON UPDATE no action ON DELETE restrict;
ALTER TABLE `billing_event` ADD COLUMN `billing_invoice_id` text REFERENCES `billing_invoice` (`id`) ON UPDATE no action ON DELETE restrict;

CREATE INDEX `billing_event_customer_idx` ON `billing_event` (`billing_customer_id`);
CREATE INDEX `billing_event_subscription_idx` ON `billing_event` (`normalized_subscription_id`);
