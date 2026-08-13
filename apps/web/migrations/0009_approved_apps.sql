CREATE TABLE `app` (
  `id` text PRIMARY KEY NOT NULL,
  `publisher_id` text NOT NULL,
  `approved_submission_id` text NOT NULL,
  `name` text NOT NULL,
  `features_json` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('approved', 'suspended')),
  `approved_at` integer NOT NULL,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`approved_submission_id`) REFERENCES `app_submission` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `app_approved_submission_unique` ON `app` (`approved_submission_id`);
CREATE INDEX `app_publisher_idx` ON `app` (`publisher_id`);

CREATE TABLE `app_distribution` (
  `app_id` text NOT NULL,
  `browser_family` text NOT NULL CHECK (`browser_family` = 'chromium'),
  `channel` text NOT NULL CHECK (`channel` IN ('unpacked', 'chrome_web_store')),
  `runtime_id` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('approved', 'suspended')),
  `approved_at` integer NOT NULL,
  PRIMARY KEY (`app_id`, `channel`, `runtime_id`),
  FOREIGN KEY (`app_id`) REFERENCES `app` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `app_distribution_identity_unique` ON `app_distribution` (`channel`, `runtime_id`);
