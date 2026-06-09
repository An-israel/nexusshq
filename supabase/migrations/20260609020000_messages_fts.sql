-- GIN index for fast full-text search on message bodies.
-- Used by the SearchModal which upgrades from ILIKE to textSearch.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_body_fts
  ON messages USING GIN (to_tsvector('english', body));
