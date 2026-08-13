import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const publishers = sqliteTable("publishers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const apps = sqliteTable("apps", {
  id: text("id").primaryKey(),
  publisherId: text("publisher_id").notNull().references(() => publishers.id),
  name: text("name").notNull(),
  features: text("features", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status", { enum: ["approved", "suspended"] }).notNull(),
  createdAt: integer("created_at").notNull(),
});

export const appDistributions = sqliteTable(
  "app_distributions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: text("app_id").notNull().references(() => apps.id),
    browserFamily: text("browser_family").notNull(),
    channel: text("channel").notNull(),
    runtimeId: text("runtime_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("app_distribution_runtime_identity").on(table.channel, table.runtimeId),
    uniqueIndex("app_distribution_per_app").on(
      table.appId,
      table.browserFamily,
      table.channel,
      table.runtimeId,
    ),
  ],
);

export const subscribers = sqliteTable("subscribers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  subscriberId: text("subscriber_id").notNull().unique().references(() => subscribers.id),
  status: text("status", { enum: ["active", "inactive"] }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const linkRequests = sqliteTable("link_requests", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull().references(() => apps.id),
  runtimeId: text("runtime_id").notNull(),
  installationId: text("installation_id").notNull(),
  proofChallenge: text("proof_challenge").notNull(),
  expiresAt: integer("expires_at").notNull(),
  subscriberId: text("subscriber_id").references(() => subscribers.id),
  approvedAt: integer("approved_at"),
  exchangedAt: integer("exchanged_at"),
  createdAt: integer("created_at").notNull(),
});

export const appLinks = sqliteTable(
  "app_links",
  {
    id: text("id").primaryKey(),
    appId: text("app_id").notNull().references(() => apps.id),
    subscriberId: text("subscriber_id").notNull().references(() => subscribers.id),
    installationId: text("installation_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("app_link_installation").on(table.appId, table.subscriberId, table.installationId)],
);

export const appSessions = sqliteTable("app_sessions", {
  id: text("id").primaryKey(),
  appLinkId: text("app_link_id").notNull().references(() => appLinks.id),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  revokedAt: integer("revoked_at"),
});
