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

CREATE TABLE subscribers (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  subscriber_id TEXT NOT NULL UNIQUE REFERENCES subscribers(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE link_requests (
  id TEXT PRIMARY KEY NOT NULL,
  app_id TEXT NOT NULL REFERENCES apps(id),
  runtime_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  proof_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  subscriber_id TEXT REFERENCES subscribers(id),
  approved_at INTEGER,
  exchanged_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE app_links (
  id TEXT PRIMARY KEY NOT NULL,
  app_id TEXT NOT NULL REFERENCES apps(id),
  subscriber_id TEXT NOT NULL REFERENCES subscribers(id),
  installation_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX app_link_installation
  ON app_links(app_id, subscriber_id, installation_id);

CREATE TABLE app_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  app_link_id TEXT NOT NULL REFERENCES app_links(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
