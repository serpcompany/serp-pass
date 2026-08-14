ALTER TABLE app_submission ADD COLUMN store_version TEXT;

CREATE TABLE app_connection_verification (
  app_id TEXT NOT NULL REFERENCES app_assignment(app_id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES app_submission(id) ON DELETE RESTRICT,
  browser_family TEXT NOT NULL CHECK (browser_family = 'chromium'),
  channel TEXT NOT NULL CHECK (channel IN ('unpacked', 'chrome_web_store')),
  runtime_id TEXT NOT NULL,
  first_connected_at INTEGER NOT NULL,
  last_connected_at INTEGER NOT NULL,
  connection_count INTEGER NOT NULL CHECK (connection_count > 0),
  PRIMARY KEY (app_id, browser_family, runtime_id)
);

CREATE INDEX app_connection_verification_submission_idx
  ON app_connection_verification(submission_id);
