CREATE TABLE `human_role_assignment` (
  `user_id` text NOT NULL,
  `role` text NOT NULL CHECK (`role` IN ('subscriber', 'publisher', 'operator')),
  `source` text NOT NULL CHECK (`source` IN ('signup', 'invitation', 'operator_bootstrap')),
  `granted_at` integer NOT NULL,
  `granted_by_user_id` text,
  PRIMARY KEY (`user_id`, `role`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`granted_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `human_role_assignment_role_idx` ON `human_role_assignment` (`role`);

INSERT INTO `human_role_assignment` (`user_id`, `role`, `source`, `granted_at`)
SELECT `id`, 'subscriber', 'signup', unixepoch()
FROM `user`;
