PRAGMA foreign_keys = ON;

CREATE TABLE publishers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE apps (
  id TEXT PRIMARY KEY NOT NULL,
  publisher_id TEXT NOT NULL REFERENCES publishers(id),
  name TEXT NOT NULL,
  features TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'suspended')),
  created_at INTEGER NOT NULL
);

CREATE TABLE app_distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL REFERENCES apps(id),
  browser_family TEXT NOT NULL,
  channel TEXT NOT NULL,
  runtime_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX app_distribution_runtime_identity
  ON app_distributions(channel, runtime_id);

CREATE UNIQUE INDEX app_distribution_per_app
  ON app_distributions(app_id, browser_family, channel, runtime_id);
