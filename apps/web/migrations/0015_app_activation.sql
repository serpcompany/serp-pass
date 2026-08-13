CREATE TABLE `app_link_request` (
  `id` text PRIMARY KEY NOT NULL,
  `app_id` text NOT NULL REFERENCES `app`(`id`) ON DELETE RESTRICT,
  `runtime_id` text NOT NULL,
  `installation_id` text NOT NULL,
  `proof_challenge` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('requested', 'approved', 'denied', 'exchanged')),
  `subscriber_user_id` text REFERENCES `user`(`id`) ON DELETE RESTRICT,
  `expires_at` integer NOT NULL,
  `decided_at` integer,
  `exchanged_at` integer,
  `created_at` integer NOT NULL
);

CREATE INDEX `app_link_request_app_status_idx` ON `app_link_request` (`app_id`, `status`);
CREATE INDEX `app_link_request_subscriber_idx` ON `app_link_request` (`subscriber_user_id`, `created_at`);
CREATE INDEX `app_link_request_expiry_idx` ON `app_link_request` (`expires_at`);

CREATE TABLE `app_link` (
  `id` text PRIMARY KEY NOT NULL,
  `app_id` text NOT NULL REFERENCES `app`(`id`) ON DELETE RESTRICT,
  `subscriber_user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE RESTRICT,
  `installation_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `last_linked_at` integer NOT NULL
);

CREATE UNIQUE INDEX `app_link_installation_unique` ON `app_link` (`app_id`, `subscriber_user_id`, `installation_id`);
CREATE INDEX `app_link_subscriber_idx` ON `app_link` (`subscriber_user_id`, `app_id`);

CREATE TABLE `app_session` (
  `id` text PRIMARY KEY NOT NULL,
  `app_link_id` text NOT NULL REFERENCES `app_link`(`id`) ON DELETE RESTRICT,
  `link_request_id` text NOT NULL REFERENCES `app_link_request`(`id`) ON DELETE RESTRICT,
  `runtime_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `created_at` integer NOT NULL,
  `revoked_at` integer,
  `revoke_reason` text
);

CREATE UNIQUE INDEX `app_session_link_request_unique` ON `app_session` (`link_request_id`);
CREATE UNIQUE INDEX `app_session_token_hash_unique` ON `app_session` (`token_hash`);
CREATE INDEX `app_session_link_idx` ON `app_session` (`app_link_id`, `created_at`);
