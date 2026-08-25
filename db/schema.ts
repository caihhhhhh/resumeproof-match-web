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
