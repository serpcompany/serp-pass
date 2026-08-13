DROP INDEX `submission_distribution_identity_unique`;
CREATE UNIQUE INDEX `submission_distribution_identity_unique` ON `submission_distribution_claim` (`browser_family`, `runtime_id`);

DROP INDEX `app_distribution_identity_unique`;
CREATE UNIQUE INDEX `app_distribution_identity_unique` ON `app_distribution` (`browser_family`, `runtime_id`);
