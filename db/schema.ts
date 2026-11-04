export const runtimeEventsSchema = `
CREATE TABLE IF NOT EXISTS runtime_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at_ms INTEGER NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('match', 'ocr', 'jd_parse')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'fallback')),
  provider TEXT NOT NULL,
  model TEXT,
  source TEXT,
  method TEXT,
  duration_ms INTEGER NOT NULL,
  error_code TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
  cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_microusd INTEGER
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

export const savedJobsSchema = `
CREATE TABLE IF NOT EXISTS saved_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  site TEXT NOT NULL,
  dedupe_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  salary TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  jd TEXT NOT NULL DEFAULT '',
  captured_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE (user_id, dedupe_hash)
)
`;

export const savedJobsUserIndex = `
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_time
ON saved_jobs (user_id, captured_at_ms DESC)
`;

export const syncTokensSchema = `
CREATE TABLE IF NOT EXISTS sync_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  last_used_at_ms INTEGER
)
`;

export const syncTokensUserIndex = `
CREATE INDEX IF NOT EXISTS idx_sync_tokens_user
ON sync_tokens (user_id, created_at_ms DESC)
`;
