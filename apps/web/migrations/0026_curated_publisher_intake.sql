CREATE TABLE publisher_application (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  publisher_name TEXT NOT NULL,
  app_name TEXT NOT NULL,
  public_listing_url TEXT NOT NULL,
  source_url TEXT,
  product_description TEXT NOT NULL,
  permissions_and_privacy TEXT NOT NULL,
  ownership_attested INTEGER NOT NULL CHECK (ownership_attested = 1),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  submitted_at INTEGER NOT NULL,
  reviewed_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  reviewed_at INTEGER,
  review_reason TEXT,
  invitation_id TEXT REFERENCES publisher_invitation(id) ON DELETE RESTRICT,
  publisher_id TEXT REFERENCES publisher(id) ON DELETE RESTRICT,
  app_id TEXT REFERENCES app_assignment(app_id) ON DELETE RESTRICT
);

CREATE INDEX publisher_application_status_submitted_idx
  ON publisher_application(status, submitted_at);

CREATE INDEX publisher_application_email_idx
  ON publisher_application(email);

CREATE TABLE publisher_application_decision_guard (
  application_id TEXT PRIMARY KEY NOT NULL REFERENCES publisher_application(id) ON DELETE CASCADE,
  decided_at INTEGER NOT NULL
);

CREATE TABLE app_submission_package (
  submission_id TEXT PRIMARY KEY NOT NULL REFERENCES app_submission(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  object_etag TEXT NOT NULL,
  extension_manifest_json TEXT NOT NULL,
  inspection_json TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL
);

CREATE INDEX app_submission_package_sha256_idx
  ON app_submission_package(sha256);
