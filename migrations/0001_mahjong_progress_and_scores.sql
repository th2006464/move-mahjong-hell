CREATE TABLE IF NOT EXISTS mahjong_scores (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  ended_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mahjong_scores_rank
  ON mahjong_scores(score DESC, duration_seconds ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS mahjong_saves (
  client_id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  game_state TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  elapsed_seconds INTEGER NOT NULL CHECK (elapsed_seconds >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
