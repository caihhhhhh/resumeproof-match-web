export const runtimeEventsSchema = `
CREATE TABLE IF NOT EXISTS runtime_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at_ms INTEGER NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('match', 'ocr', 'jd_parse')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'fallback')),
  provider TEXT NOT NULL,
  model TEXT,
  duration_ms INTEGER NOT NULL,
  error_code TEXT
)
`;

export const runtimeEventsTimeIndex = `
CREATE INDEX IF NOT EXISTS idx_runtime_events_occurred_at
ON runtime_events (occurred_at_ms DESC)
`;

export const runtimeEventsStatusIndex = `
CREATE INDEX IF NOT EXISTS idx_runtime_events_status_time
ON runtime_events (status, occurred_at_ms DESC)
`;

export const contentSamplesSchema = `
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
)
`;

export const contentSamplesExpiryIndex = `
CREATE INDEX IF NOT EXISTS idx_content_samples_expiry
ON content_samples (expires_at_ms ASC)
`;

export const productEventsSchema = `
CREATE TABLE IF NOT EXISTS product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at_ms INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  page_path TEXT NOT NULL,
  properties_json TEXT NOT NULL
)
`;

export const productEventsTimeIndex = `
CREATE INDEX IF NOT EXISTS idx_product_events_time
ON product_events (occurred_at_ms DESC)
`;

export const productEventsNameIndex = `
CREATE INDEX IF NOT EXISTS idx_product_events_name_time
ON product_events (event_name, occurred_at_ms DESC)
`;

export const feedbackEventsSchema = `
CREATE TABLE IF NOT EXISTS feedback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at_ms INTEGER NOT NULL,
  helpful INTEGER NOT NULL,
  reason TEXT NOT NULL,
  stage TEXT NOT NULL,
  grade TEXT NOT NULL,
  score_band TEXT NOT NULL
)
`;

export const feedbackEventsTimeIndex = `
CREATE INDEX IF NOT EXISTS idx_feedback_events_time
ON feedback_events (occurred_at_ms DESC)
`;
