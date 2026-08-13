CREATE TABLE `publisher` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('invited', 'active', 'suspended')),
  `created_at` integer NOT NULL,
  `created_by_user_id` text NOT NULL,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE TABLE `publisher_membership` (
  `publisher_id` text NOT NULL,
  `user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`publisher_id`, `user_id`),
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `publisher_membership_user_idx` ON `publisher_membership` (`user_id`);

CREATE TABLE `app_assignment` (
  `app_id` text PRIMARY KEY NOT NULL,
  `publisher_id` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('assigned', 'submitted', 'approved', 'revoked')),
  `assigned_at` integer NOT NULL,
  `assigned_by_user_id` text NOT NULL,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`assigned_by_user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `app_assignment_publisher_idx` ON `app_assignment` (`publisher_id`);

CREATE TABLE `publisher_invitation_assignment` (
  `invitation_id` text PRIMARY KEY NOT NULL,
  `publisher_id` text NOT NULL,
  `app_id` text NOT NULL,
  FOREIGN KEY (`invitation_id`) REFERENCES `publisher_invitation` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`publisher_id`) REFERENCES `publisher` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`app_id`) REFERENCES `app_assignment` (`app_id`) ON UPDATE no action ON DELETE cascade
);
