CREATE TABLE `publisher_invitation` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `token_hash` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('pending', 'accepted', 'revoked')),
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `created_by_user_id` text NOT NULL,
  `accepted_at` integer,
  `accepted_by_user_id` text,
  `acceptance_audit_event_id` text,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`accepted_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `publisher_invitation_token_hash_unique` ON `publisher_invitation` (`token_hash`);
CREATE UNIQUE INDEX `publisher_invitation_acceptance_audit_unique` ON `publisher_invitation` (`acceptance_audit_event_id`);
CREATE INDEX `publisher_invitation_email_status_idx` ON `publisher_invitation` (`email`, `status`);
