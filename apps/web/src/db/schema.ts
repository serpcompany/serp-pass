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
    storeVersion: text("store_version"),
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

export const appConnectionVerifications = sqliteTable(
  "app_connection_verification",
  {
    appId: text("app_id")
      .notNull()
      .references(() => appAssignments.appId, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => appSubmissions.id, { onDelete: "restrict" }),
    browserFamily: text("browser_family", { enum: ["chromium"] }).notNull(),
    channel: text("channel", { enum: ["unpacked", "chrome_web_store"] }).notNull(),
    runtimeId: text("runtime_id").notNull(),
    firstConnectedAt: integer("first_connected_at", { mode: "timestamp" }).notNull(),
    lastConnectedAt: integer("last_connected_at", { mode: "timestamp" }).notNull(),
    connectionCount: integer("connection_count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.appId, table.browserFamily, table.runtimeId] }),
    index("app_connection_verification_submission_idx").on(table.submissionId),
  ],
);

export const appSubmissionPackages = sqliteTable(
  "app_submission_package",
  {
    submissionId: text("submission_id")
      .primaryKey()
      .references(() => appSubmissions.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mediaType: text("media_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    objectEtag: text("object_etag").notNull(),
    extensionManifestJson: text("extension_manifest_json").notNull(),
    inspectionJson: text("inspection_json").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("app_submission_package_object_key_unique").on(table.objectKey), index("app_submission_package_sha256_idx").on(table.sha256)],
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

export const publisherApplications = sqliteTable(
  "publisher_application",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    publisherName: text("publisher_name").notNull(),
    appName: text("app_name").notNull(),
    publicListingUrl: text("public_listing_url").notNull(),
    sourceUrl: text("source_url"),
    productDescription: text("product_description").notNull(),
    permissionsAndPrivacy: text("permissions_and_privacy").notNull(),
    ownershipAttested: integer("ownership_attested", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    reviewReason: text("review_reason"),
    invitationId: text("invitation_id").references(() => publisherInvitations.id, { onDelete: "restrict" }),
    publisherId: text("publisher_id").references(() => publishers.id, { onDelete: "restrict" }),
    appId: text("app_id").references(() => appAssignments.appId, { onDelete: "restrict" }),
  },
  (table) => [index("publisher_application_status_submitted_idx").on(table.status, table.submittedAt), index("publisher_application_email_idx").on(table.email)],
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

export const publisherConnectOnboardings = sqliteTable(
  "publisher_connect_onboarding",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id").notNull().references(() => publishers.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    country: text("country").notNull(),
    providerAccountId: text("provider_account_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status", { enum: ["creating", "account_created"] }).notNull(),
    createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("publisher_connect_onboarding_publisher_mode_unique").on(table.provider, table.mode, table.publisherId),
    uniqueIndex("publisher_connect_onboarding_account_unique").on(table.provider, table.mode, table.providerAccountId).where(sql`${table.providerAccountId} IS NOT NULL`),
    uniqueIndex("publisher_connect_onboarding_idempotency_unique").on(table.idempotencyKey),
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

export const allocationRuns = sqliteTable(
  "allocation_run",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    currency: text("currency").notNull(),
    distributableAmount: integer("distributable_amount").notNull(),
    reserveAmount: integer("reserve_amount").notNull(),
    platformAmount: integer("platform_amount").notNull(),
    status: text("status", { enum: ["draft", "posted"] }).notNull(),
    requestSha256: text("request_sha256").notNull(),
    reason: text("reason").notNull(),
    agreementReference: text("agreement_reference").notNull(),
    postedByUserId: text("posted_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    postedAt: integer("posted_at", { mode: "timestamp" }),
  },
  (table) => [index("allocation_run_mode_posted_idx").on(table.mode, table.postedAt)],
);

export const allocationRunReceipts = sqliteTable(
  "allocation_run_receipt",
  {
    allocationRunId: text("allocation_run_id").notNull().references(() => allocationRuns.id, { onDelete: "restrict" }),
    cashReceiptId: text("cash_receipt_id").notNull().references(() => cashReceipts.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
  },
  (table) => [primaryKey({ columns: [table.allocationRunId, table.cashReceiptId] }), index("allocation_run_receipt_receipt_idx").on(table.cashReceiptId)],
);

export const publisherEarnings = sqliteTable(
  "publisher_earning",
  {
    id: text("id").primaryKey(),
    allocationRunId: text("allocation_run_id").notNull().references(() => allocationRuns.id, { onDelete: "restrict" }),
    publisherId: text("publisher_id").notNull().references(() => publishers.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    availableAt: integer("available_at", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["accrued", "released", "reversed"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    releasedAt: integer("released_at", { mode: "timestamp" }),
  },
  (table) => [index("publisher_earning_publisher_status_idx").on(table.publisherId, table.status, table.availableAt), index("publisher_earning_allocation_idx").on(table.allocationRunId)],
);

export const publisherPayments = sqliteTable(
  "publisher_payment",
  {
    id: text("id").primaryKey(),
    publisherEarningId: text("publisher_earning_id").notNull().references(() => publisherEarnings.id, { onDelete: "restrict" }),
    publisherId: text("publisher_id").notNull().references(() => publishers.id, { onDelete: "restrict" }),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    method: text("method", { enum: ["ach", "bank_transfer", "paypal", "wise", "other"] }).notNull(),
    providerReference: text("provider_reference").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    paidAt: integer("paid_at", { mode: "timestamp" }).notNull(),
    requestSha256: text("request_sha256").notNull(),
    reason: text("reason").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("publisher_payment_earning_unique").on(table.publisherEarningId),
    uniqueIndex("publisher_payment_reference_unique").on(table.mode, table.method, table.providerReference),
    index("publisher_payment_publisher_paid_idx").on(table.publisherId, table.paidAt),
  ],
);

export const ledgerEntries = sqliteTable(
  "ledger_entry",
  {
    id: text("id").primaryKey(),
    allocationRunId: text("allocation_run_id").notNull().references(() => allocationRuns.id, { onDelete: "restrict" }),
    entryType: text("entry_type", { enum: ["cash_receipt", "reserve", "platform", "publisher_earning"] }).notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    cashReceiptId: text("cash_receipt_id").references(() => cashReceipts.id, { onDelete: "restrict" }),
    publisherId: text("publisher_id").references(() => publishers.id, { onDelete: "restrict" }),
    publisherEarningId: text("publisher_earning_id").references(() => publisherEarnings.id, { onDelete: "restrict" }),
    postedAt: integer("posted_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("ledger_entry_receipt_unique").on(table.allocationRunId, table.cashReceiptId).where(sql`${table.entryType} = 'cash_receipt'`),
    uniqueIndex("ledger_entry_earning_unique").on(table.allocationRunId, table.publisherEarningId).where(sql`${table.entryType} = 'publisher_earning'`),
    uniqueIndex("ledger_entry_reserve_unique").on(table.allocationRunId).where(sql`${table.entryType} = 'reserve'`),
    uniqueIndex("ledger_entry_platform_unique").on(table.allocationRunId).where(sql`${table.entryType} = 'platform'`),
  ],
);

export const settlements = sqliteTable(
  "settlement",
  {
    id: text("id").primaryKey(),
    publisherEarningId: text("publisher_earning_id").notNull().references(() => publisherEarnings.id, { onDelete: "restrict" }),
    publisherId: text("publisher_id").notNull().references(() => publishers.id, { onDelete: "restrict" }),
    publisherConnectedAccountId: text("publisher_connected_account_id").notNull().references(() => publisherConnectedAccounts.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: ["pending", "transferred", "reversed"] }).notNull(),
    requestSha256: text("request_sha256").notNull(),
    reason: text("reason").notNull(),
    requestedByUserId: text("requested_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    transferredAt: integer("transferred_at", { mode: "timestamp" }),
    reversedAt: integer("reversed_at", { mode: "timestamp" }),
  },
  (table) => [uniqueIndex("settlement_earning_unique").on(table.publisherEarningId), index("settlement_publisher_status_idx").on(table.publisherId, table.status, table.createdAt)],
);

export const transferAttempts = sqliteTable(
  "transfer_attempt",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id").notNull().references(() => settlements.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    executionMode: text("execution_mode", { enum: ["local_simulation", "stripe_api"] }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    destinationAccountId: text("destination_account_id").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: ["creating", "succeeded", "failed", "reversed"] }).notNull(),
    providerTransferId: text("provider_transfer_id"),
    failureCode: text("failure_code"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    succeededAt: integer("succeeded_at", { mode: "timestamp" }),
    reversedAt: integer("reversed_at", { mode: "timestamp" }),
    amountReversed: integer("amount_reversed").notNull().default(0),
    latestEventKey: text("latest_event_key"),
  },
  (table) => [
    uniqueIndex("transfer_attempt_settlement_unique").on(table.settlementId),
    uniqueIndex("transfer_attempt_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("transfer_attempt_provider_identity_unique").on(table.provider, table.providerTransferId).where(sql`${table.providerTransferId} IS NOT NULL`),
  ],
);

export const stripeTransferEvents = sqliteTable(
  "stripe_transfer_event",
  {
    id: text("id").primaryKey(),
    transferAttemptId: text("transfer_attempt_id").notNull().references(() => transferAttempts.id, { onDelete: "restrict" }),
    settlementId: text("settlement_id").notNull().references(() => settlements.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type", { enum: ["transfer.created", "transfer.updated", "transfer.reversed"] }).notNull(),
    providerCreatedAt: integer("provider_created_at", { mode: "timestamp" }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    outcome: text("outcome", { enum: ["applied", "noop"] }).notNull(),
  },
  (table) => [uniqueIndex("stripe_transfer_event_provider_identity_unique").on(table.provider, table.mode, table.providerEventId), index("stripe_transfer_event_attempt_idx").on(table.transferAttemptId, table.providerCreatedAt)],
);

export const connectedAccountPayouts = sqliteTable(
  "connected_account_payout",
  {
    id: text("id").primaryKey(),
    publisherConnectedAccountId: text("publisher_connected_account_id").notNull().references(() => publisherConnectedAccounts.id, { onDelete: "restrict" }),
    publisherId: text("publisher_id").notNull().references(() => publishers.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerPayoutId: text("provider_payout_id").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: ["pending", "in_transit", "paid", "failed", "canceled"] }).notNull(),
    arrivalDate: integer("arrival_date", { mode: "timestamp" }),
    failureCode: text("failure_code"),
    latestEventKey: text("latest_event_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("connected_account_payout_identity_unique").on(table.provider, table.mode, table.providerPayoutId), index("connected_account_payout_publisher_idx").on(table.publisherId, table.createdAt)],
);

export const stripePayoutEvents = sqliteTable(
  "stripe_payout_event",
  {
    id: text("id").primaryKey(),
    connectedAccountPayoutId: text("connected_account_payout_id").notNull().references(() => connectedAccountPayouts.id, { onDelete: "restrict" }),
    publisherConnectedAccountId: text("publisher_connected_account_id").notNull().references(() => publisherConnectedAccounts.id, { onDelete: "restrict" }),
    publisherId: text("publisher_id").notNull().references(() => publishers.id, { onDelete: "restrict" }),
    provider: text("provider", { enum: ["stripe"] }).notNull(),
    mode: text("mode", { enum: ["test", "live"] }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type", { enum: ["payout.created", "payout.updated", "payout.paid", "payout.failed", "payout.canceled"] }).notNull(),
    providerCreatedAt: integer("provider_created_at", { mode: "timestamp" }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    outcome: text("outcome", { enum: ["applied", "noop"] }).notNull(),
  },
  (table) => [uniqueIndex("stripe_payout_event_provider_identity_unique").on(table.provider, table.mode, table.providerEventId), index("stripe_payout_event_payout_idx").on(table.connectedAccountPayoutId, table.providerCreatedAt)],
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
