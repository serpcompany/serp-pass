CREATE TABLE `operator_audit_event` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_user_id` text,
  `action` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `occurred_at` integer NOT NULL,
  `reason` text NOT NULL,
  FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `operator_audit_event_target_idx` ON `operator_audit_event` (`target_type`, `target_id`);
