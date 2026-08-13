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
