CREATE TABLE IF NOT EXISTS feedback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at_ms INTEGER NOT NULL,
  helpful INTEGER NOT NULL,
  reason TEXT NOT NULL,
  stage TEXT NOT NULL,
  grade TEXT NOT NULL,
  score_band TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_events_time
ON feedback_events (occurred_at_ms DESC);
