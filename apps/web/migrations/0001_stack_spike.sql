CREATE TABLE stack_spike_checks (
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL
);

INSERT INTO stack_spike_checks (id, created_at)
VALUES ('d1-ready', unixepoch() * 1000);
