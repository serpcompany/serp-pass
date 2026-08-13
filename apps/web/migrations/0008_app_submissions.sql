CREATE TABLE `app_submission` (
  `id` text PRIMARY KEY NOT NULL,
  `app_id` text NOT NULL,
  `publisher_id` text NOT NULL,
  `schema_version` integer NOT NULL,
  `manifest_json` text NOT NULL,
  `ownership_evidence` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('pending', 'approved', 'rejected')),
  `submitted_by_user_id` text NOT NULL,
  `submitted_at` integer NOT NULL,
  `reviewed_by_user_id` text,
  `reviewed_at` integer,
  `review_reason` text,
  FOREIGN KEY (`app_id`) REFERENCES `app_assignment` (`app_id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `app_submission_publisher_status_idx` ON `app_submission` (`publisher_id`, `status`);
CREATE INDEX `app_submission_app_idx` ON `app_submission` (`app_id`);
CREATE UNIQUE INDEX `app_submission_one_pending_per_app` ON `app_submission` (`app_id`) WHERE `status` = 'pending';

CREATE TABLE `submission_distribution_claim` (
  `submission_id` text NOT NULL,
  `browser_family` text NOT NULL CHECK (`browser_family` = 'chromium'),
  `channel` text NOT NULL CHECK (`channel` IN ('unpacked', 'chrome_web_store')),
  `runtime_id` text NOT NULL,
  PRIMARY KEY (`submission_id`, `channel`, `runtime_id`),
  FOREIGN KEY (`submission_id`) REFERENCES `app_submission` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `submission_distribution_identity_unique` ON `submission_distribution_claim` (`channel`, `runtime_id`);
