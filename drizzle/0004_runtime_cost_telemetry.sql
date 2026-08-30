ALTER TABLE runtime_events ADD COLUMN source TEXT;
ALTER TABLE runtime_events ADD COLUMN method TEXT;
ALTER TABLE runtime_events ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runtime_events ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runtime_events ADD COLUMN cache_hit_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runtime_events ADD COLUMN cache_miss_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runtime_events ADD COLUMN estimated_cost_microusd INTEGER;
