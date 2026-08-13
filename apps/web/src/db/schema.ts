import { sql } from "drizzle-orm";
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

export const billingCustomers = sqliteTable(
  "billing_customer",
  {
    id: text("id").primaryKey(),
    subscriberUserId: text("subscriber_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("billing_customer_provider_identity_unique").on(table.provider, table.mode, table.providerCustomerId),
    uniqueIndex("billing_customer_subscriber_mode_unique").on(table.provider, table.mode, table.subscriberUserId),
  ],
);

export const normalizedSubscriptions = sqliteTable(
  "normalized_subscription",
  {
    id: text("id").primaryKey(),
    billingCustomerId: text("billing_customer_id").notNull().references(() => billingCustomers.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    status: text("status", { enum: ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"] }).notNull(),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
    entitledUntil: integer("entitled_until", { mode: "timestamp" }),
    latestStatusEventKey: text("latest_status_event_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("normalized_subscription_provider_identity_unique").on(table.provider, table.mode, table.providerSubscriptionId),
    uniqueIndex("normalized_subscription_customer_unique").on(table.billingCustomerId),
    index("normalized_subscription_customer_idx").on(table.billingCustomerId),
  ],
);

export const billingInvoices = sqliteTable(
  "billing_invoice",
  {
    id: text("id").primaryKey(),
    normalizedSubscriptionId: text("normalized_subscription_id").notNull().references(() => normalizedSubscriptions.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerInvoiceId: text("provider_invoice_id").notNull(),
    status: text("status", { enum: ["paid", "payment_failed"] }).notNull(),
    amountPaid: integer("amount_paid").notNull().default(0),
    currency: text("currency"),
    periodStart: integer("period_start", { mode: "timestamp" }),
    periodEnd: integer("period_end", { mode: "timestamp" }),
    latestEventKey: text("latest_event_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("billing_invoice_provider_identity_unique").on(table.provider, table.mode, table.providerInvoiceId),
    index("billing_invoice_subscription_idx").on(table.normalizedSubscriptionId),
  ],
);

export const billingEvents = sqliteTable(
  "billing_event",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    providerCreatedAt: integer("provider_created_at", { mode: "timestamp" }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    outcome: text("outcome", { enum: ["applied", "noop"] }).notNull(),
    detail: text("detail").notNull(),
    billingCustomerId: text("billing_customer_id").references(() => billingCustomers.id, { onDelete: "restrict" }),
    normalizedSubscriptionId: text("normalized_subscription_id").references(() => normalizedSubscriptions.id, { onDelete: "restrict" }),
    billingInvoiceId: text("billing_invoice_id").references(() => billingInvoices.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("billing_event_provider_identity_unique").on(table.provider, table.mode, table.providerEventId),
    index("billing_event_customer_idx").on(table.billingCustomerId),
    index("billing_event_subscription_idx").on(table.normalizedSubscriptionId),
  ],
);

export const cashReceipts = sqliteTable(
  "cash_receipt",
  {
    id: text("id").primaryKey(),
    billingInvoiceId: text("billing_invoice_id").notNull().references(() => billingInvoices.id, { onDelete: "restrict" }),
    sourceBillingEventId: text("source_billing_event_id").notNull().references(() => billingEvents.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("cash_receipt_invoice_unique").on(table.billingInvoiceId), uniqueIndex("cash_receipt_source_event_unique").on(table.sourceBillingEventId)],
);

export const billingCheckoutAttempts = sqliteTable(
  "billing_checkout_attempt",
  {
    id: text("id").primaryKey(),
    subscriberUserId: text("subscriber_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    priceId: text("price_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    providerCustomerId: text("provider_customer_id"),
    providerSessionId: text("provider_session_id"),
    status: text("status", { enum: ["creating", "open", "complete", "expired", "failed"] }).notNull(),
    latestEventKey: text("latest_event_key"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("billing_checkout_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("billing_checkout_session_unique").on(table.provider, table.mode, table.providerSessionId),
    uniqueIndex("billing_checkout_active_subscriber_unique").on(table.provider, table.mode, table.subscriberUserId).where(sql`${table.status} IN ('creating', 'open')`),
    index("billing_checkout_subscriber_idx").on(table.subscriberUserId, table.mode),
  ],
);

export const publisherConnectedAccounts = sqliteTable(
  "publisher_connected_account",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id").notNull().references(() => publishers.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accountType: text("account_type", { enum: ["express"] }).notNull(),
    detailsSubmitted: integer("details_submitted", { mode: "boolean" }).notNull().default(false),
    chargesEnabled: integer("charges_enabled", { mode: "boolean" }).notNull().default(false),
    payoutsEnabled: integer("payouts_enabled", { mode: "boolean" }).notNull().default(false),
    transfersCapability: text("transfers_capability", { enum: ["active", "inactive", "pending", "unrequested"] }).notNull(),
    requirementsCurrentlyDueCount: integer("requirements_currently_due_count").notNull().default(0),
    disabledReason: text("disabled_reason"),
    latestEventKey: text("latest_event_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("publisher_connected_account_identity_unique").on(table.provider, table.mode, table.providerAccountId),
    uniqueIndex("publisher_connected_account_publisher_mode_unique").on(table.provider, table.mode, table.publisherId),
  ],
);

export const stripeConnectEvents = sqliteTable(
  "stripe_connect_event",
  {
    id: text("id").primaryKey(),
    publisherConnectedAccountId: text("publisher_connected_account_id").notNull().references(() => publisherConnectedAccounts.id, { onDelete: "restrict" }),
    publisherId: text("publisher_id").notNull().references(() => publishers.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type", { enum: ["account.updated"] }).notNull(),
    providerCreatedAt: integer("provider_created_at", { mode: "timestamp" }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    outcome: text("outcome", { enum: ["applied", "noop"] }).notNull(),
  },
  (table) => [
    uniqueIndex("stripe_connect_event_provider_identity_unique").on(table.provider, table.mode, table.providerEventId),
    index("stripe_connect_event_account_idx").on(table.publisherConnectedAccountId, table.providerCreatedAt),
  ],
);

export const appLinkRequests = sqliteTable(
  "app_link_request",
  {
    id: text("id").primaryKey(),
    appId: text("app_id").notNull().references(() => apps.id, { onDelete: "restrict" }),
    runtimeId: text("runtime_id").notNull(),
    installationId: text("installation_id").notNull(),
    proofChallenge: text("proof_challenge").notNull(),
    status: text("status", { enum: ["requested", "approved", "denied", "exchanged"] }).notNull(),
    subscriberUserId: text("subscriber_user_id").references(() => user.id, { onDelete: "restrict" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    exchangedAt: integer("exchanged_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("app_link_request_app_status_idx").on(table.appId, table.status),
    index("app_link_request_subscriber_idx").on(table.subscriberUserId, table.createdAt),
    index("app_link_request_expiry_idx").on(table.expiresAt),
  ],
);

export const appLinks = sqliteTable(
  "app_link",
  {
    id: text("id").primaryKey(),
    appId: text("app_id").notNull().references(() => apps.id, { onDelete: "restrict" }),
    subscriberUserId: text("subscriber_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    installationId: text("installation_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    lastLinkedAt: integer("last_linked_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("app_link_installation_unique").on(table.appId, table.subscriberUserId, table.installationId),
    index("app_link_subscriber_idx").on(table.subscriberUserId, table.appId),
  ],
);

export const appSessions = sqliteTable(
  "app_session",
  {
    id: text("id").primaryKey(),
    appLinkId: text("app_link_id").notNull().references(() => appLinks.id, { onDelete: "restrict" }),
    linkRequestId: text("link_request_id").notNull().references(() => appLinkRequests.id, { onDelete: "restrict" }),
    runtimeId: text("runtime_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    revokeReason: text("revoke_reason"),
  },
  (table) => [
    uniqueIndex("app_session_link_request_unique").on(table.linkRequestId),
    uniqueIndex("app_session_token_hash_unique").on(table.tokenHash),
    index("app_session_link_idx").on(table.appLinkId, table.createdAt),
  ],
);
