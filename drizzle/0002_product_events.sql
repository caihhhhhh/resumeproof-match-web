CREATE TABLE IF NOT EXISTS product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at_ms INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  page_path TEXT NOT NULL,
  properties_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_events_time
ON product_events (occurred_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_name_time
ON product_events (event_name, occurred_at_ms DESC);
