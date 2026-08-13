CREATE TABLE `publisher_connect_onboarding` (
  `id` text PRIMARY KEY NOT NULL,
  `publisher_id` text NOT NULL,
  `provider` text NOT NULL CHECK (`provider` = 'stripe'),
  `mode` text NOT NULL CHECK (`mode` IN ('test', 'live')),
  `country` text NOT NULL CHECK (length(`country`) = 2 AND `country` = upper(`country`) AND `country` GLOB '[A-Z][A-Z]'),
  `provider_account_id` text,
  `idempotency_key` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('creating', 'account_created')),
  `created_by_user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CHECK (`status` = 'creating' OR `provider_account_id` IS NOT NULL),
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `publisher_connect_onboarding_publisher_mode_unique` ON `publisher_connect_onboarding` (`provider`, `mode`, `publisher_id`);
CREATE UNIQUE INDEX `publisher_connect_onboarding_account_unique` ON `publisher_connect_onboarding` (`provider`, `mode`, `provider_account_id`) WHERE `provider_account_id` IS NOT NULL;
CREATE UNIQUE INDEX `publisher_connect_onboarding_idempotency_unique` ON `publisher_connect_onboarding` (`idempotency_key`);

CREATE TRIGGER `publisher_connect_onboarding_defining_immutable`
BEFORE UPDATE ON `publisher_connect_onboarding`
WHEN OLD.`publisher_id` <> NEW.`publisher_id`
  OR OLD.`provider` <> NEW.`provider`
  OR OLD.`mode` <> NEW.`mode`
  OR OLD.`country` <> NEW.`country`
  OR OLD.`idempotency_key` <> NEW.`idempotency_key`
  OR OLD.`created_by_user_id` <> NEW.`created_by_user_id`
  OR OLD.`created_at` <> NEW.`created_at`
  OR (OLD.`provider_account_id` IS NOT NULL AND (NEW.`provider_account_id` IS NULL OR OLD.`provider_account_id` <> NEW.`provider_account_id`))
BEGIN
  SELECT RAISE(ABORT, 'publisher_connect_onboarding defining fields are immutable');
END;

CREATE TRIGGER `publisher_connect_onboarding_status_guard`
BEFORE UPDATE OF `status` ON `publisher_connect_onboarding`
WHEN OLD.`status` <> NEW.`status`
  AND NOT (OLD.`status` = 'creating' AND NEW.`status` = 'account_created')
BEGIN
  SELECT RAISE(ABORT, 'publisher_connect_onboarding status transition is invalid');
END;

CREATE TRIGGER `publisher_connect_onboarding_no_delete`
BEFORE DELETE ON `publisher_connect_onboarding`
BEGIN
  SELECT RAISE(ABORT, 'publisher_connect_onboarding cannot be deleted');
END;
