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
