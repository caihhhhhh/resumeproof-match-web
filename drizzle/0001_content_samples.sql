CREATE TABLE IF NOT EXISTS content_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  occurred_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  resume_text TEXT NOT NULL,
  jd_text TEXT NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C')),
  summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_samples_expiry
ON content_samples (expires_at_ms ASC);
