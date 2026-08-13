import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const stackSpikeChecks = sqliteTable("stack_spike_checks", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
});

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_identity_unique").on(table.providerId, table.accountId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const humanRoleAssignments = sqliteTable(
  "human_role_assignment",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["subscriber", "publisher", "operator"] }).notNull(),
    source: text("source", { enum: ["signup", "invitation", "operator_bootstrap"] }).notNull(),
    grantedAt: integer("granted_at", { mode: "timestamp" }).notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("human_role_assignment_role_idx").on(table.role),
  ],
);

export const operatorAuditEvents = sqliteTable(
  "operator_audit_event",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    reason: text("reason").notNull(),
  },
  (table) => [index("operator_audit_event_target_idx").on(table.targetType, table.targetId)],
);

export const publishers = sqliteTable("publisher", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["invited", "active", "suspended"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
});

export const publisherMemberships = sqliteTable(
  "publisher_membership",
  {
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.publisherId, table.userId] }), index("publisher_membership_user_idx").on(table.userId)],
);

export const appAssignments = sqliteTable(
  "app_assignment",
  {
    appId: text("app_id").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["assigned", "submitted", "approved", "revoked"] }).notNull(),
    assignedAt: integer("assigned_at", { mode: "timestamp" }).notNull(),
    assignedByUserId: text("assigned_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [index("app_assignment_publisher_idx").on(table.publisherId)],
);

export const appSubmissions = sqliteTable(
  "app_submission",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => appAssignments.appId, { onDelete: "restrict" }),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "restrict" }),
    schemaVersion: integer("schema_version").notNull(),
    manifestJson: text("manifest_json").notNull(),
    ownershipEvidence: text("ownership_evidence").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
    submittedByUserId: text("submitted_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    reviewReason: text("review_reason"),
  },
  (table) => [index("app_submission_publisher_status_idx").on(table.publisherId, table.status), index("app_submission_app_idx").on(table.appId)],
);

export const submissionDistributionClaims = sqliteTable(
  "submission_distribution_claim",
  {
    submissionId: text("submission_id")
      .notNull()
      .references(() => appSubmissions.id, { onDelete: "cascade" }),
    browserFamily: text("browser_family", { enum: ["chromium"] }).notNull(),
    channel: text("channel", { enum: ["unpacked", "chrome_web_store"] }).notNull(),
    runtimeId: text("runtime_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.submissionId, table.channel, table.runtimeId] }),
    uniqueIndex("submission_distribution_identity_unique").on(table.browserFamily, table.runtimeId),
  ],
);

export const apps = sqliteTable("app", {
  id: text("id").primaryKey(),
  publisherId: text("publisher_id")
    .notNull()
    .references(() => publishers.id, { onDelete: "restrict" }),
  approvedSubmissionId: text("approved_submission_id")
    .notNull()
    .references(() => appSubmissions.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  featuresJson: text("features_json").notNull(),
  status: text("status", { enum: ["approved", "suspended"] }).notNull(),
  approvedAt: integer("approved_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("app_approved_submission_unique").on(table.approvedSubmissionId), index("app_publisher_idx").on(table.publisherId)]);

export const appDistributions = sqliteTable(
  "app_distribution",
  {
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    browserFamily: text("browser_family", { enum: ["chromium"] }).notNull(),
    channel: text("channel", { enum: ["unpacked", "chrome_web_store"] }).notNull(),
    runtimeId: text("runtime_id").notNull(),
    status: text("status", { enum: ["approved", "suspended"] }).notNull(),
    approvedAt: integer("approved_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.appId, table.channel, table.runtimeId] }), uniqueIndex("app_distribution_identity_unique").on(table.browserFamily, table.runtimeId)],
);

export const publisherInvitations = sqliteTable(
  "publisher_invitation",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status", { enum: ["pending", "accepted", "revoked"] }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    acceptanceAuditEventId: text("acceptance_audit_event_id"),
  },
  (table) => [
    uniqueIndex("publisher_invitation_token_hash_unique").on(table.tokenHash),
    uniqueIndex("publisher_invitation_acceptance_audit_unique").on(table.acceptanceAuditEventId),
    index("publisher_invitation_email_status_idx").on(table.email, table.status),
  ],
);

export const publisherInvitationAssignments = sqliteTable("publisher_invitation_assignment", {
  invitationId: text("invitation_id")
    .primaryKey()
    .references(() => publisherInvitations.id, { onDelete: "cascade" }),
  publisherId: text("publisher_id")
    .notNull()
    .references(() => publishers.id, { onDelete: "cascade" }),
  appId: text("app_id")
    .notNull()
    .references(() => appAssignments.appId, { onDelete: "cascade" }),
});

export const rateLimit = sqliteTable(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: integer("last_request").notNull(),
  },
  (table) => [uniqueIndex("rate_limit_key_unique").on(table.key)],
);
