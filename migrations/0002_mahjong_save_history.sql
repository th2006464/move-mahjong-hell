CREATE TABLE IF NOT EXISTS mahjong_save_history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  game_state TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  elapsed_seconds INTEGER NOT NULL CHECK (elapsed_seconds >= 0),
  saved_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mahjong_save_history_client_time
  ON mahjong_save_history(client_id, saved_at DESC);
