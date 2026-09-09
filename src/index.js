const json = (data, init = {}) => Response.json(data, {
  ...init,
  headers: { 'Cache-Control': 'no-store', ...(init.headers || {}) },
});

const cleanName = value => String(value || '匿名玩家').trim().slice(0, 16) || '匿名玩家';
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(value);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'move-mahjong-hell' });
      }

      if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT player_name AS playerName, score, duration_seconds AS durationSeconds,
                 ended_at AS recordedAt, 'completed' AS recordType
          FROM mahjong_scores
          UNION ALL
          SELECT player_name AS playerName, score, elapsed_seconds AS durationSeconds,
                 saved_at AS recordedAt, 'saved' AS recordType
          FROM mahjong_save_history
          ORDER BY score DESC, durationSeconds ASC, recordedAt DESC
          LIMIT 50
        `).all();
        return json({ ok: true, entries: results });
      }

      if (url.pathname === '/api/save' && request.method === 'GET') {
        const clientId = url.searchParams.get('clientId');
        if (!validId(clientId)) return json({ ok: false, error: 'invalid clientId' }, { status: 400 });
        const saveId = url.searchParams.get('saveId');
        if (saveId && !validId(saveId)) return json({ ok: false, error: 'invalid saveId' }, { status: 400 });
        const row = saveId
          ? await env.DB.prepare(`
              SELECT player_name AS playerName, game_state AS gameState, score,
                     elapsed_seconds AS elapsedSeconds, saved_at AS updatedAt
              FROM mahjong_save_history WHERE client_id = ? AND id = ?
            `).bind(clientId, saveId).first()
          : await env.DB.prepare(`
              SELECT player_name AS playerName, game_state AS gameState, score,
                     elapsed_seconds AS elapsedSeconds, updated_at AS updatedAt
              FROM mahjong_saves WHERE client_id = ?
            `).bind(clientId).first();
        return json({ ok: true, save: row || null });
      }

      if (url.pathname === '/api/saves' && request.method === 'GET') {
        const clientId = url.searchParams.get('clientId');
        if (!validId(clientId)) return json({ ok: false, error: 'invalid clientId' }, { status: 400 });
        const { results } = await env.DB.prepare(`
          SELECT id, score, elapsed_seconds AS elapsedSeconds, saved_at AS savedAt
          FROM mahjong_save_history
          WHERE client_id = ?
          ORDER BY saved_at DESC
          LIMIT 30
        `).bind(clientId).all();
        if (results.length) return json({ ok: true, saves: results });
        const legacy = await env.DB.prepare(`
          SELECT score, elapsed_seconds AS elapsedSeconds, updated_at AS savedAt
          FROM mahjong_saves WHERE client_id = ?
        `).bind(clientId).first();
        return json({ ok: true, saves: legacy ? [{ id: 'latest', ...legacy }] : [] });
      }

      if (url.pathname === '/api/save' && request.method === 'POST') {
        const body = await request.json();
        if (!validId(body.clientId)) return json({ ok: false, error: 'invalid clientId' }, { status: 400 });
        const gameState = JSON.stringify(body.gameState);
        const score = Math.max(0, Math.min(10000, Number(body.score) || 0));
        const elapsed = Math.max(0, Math.min(864000, Number(body.elapsedSeconds) || 0));
        const saveId = validId(body.saveId) ? body.saveId : crypto.randomUUID();
        const savedAt = new Date().toISOString();
        if (gameState.length > 200000) return json({ ok: false, error: 'save too large' }, { status: 413 });
        await env.DB.prepare(`
          INSERT INTO mahjong_save_history(id, client_id, player_name, game_state, score, elapsed_seconds, saved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            player_name=excluded.player_name, game_state=excluded.game_state,
            score=excluded.score, elapsed_seconds=excluded.elapsed_seconds,
            saved_at=excluded.saved_at
        `).bind(saveId, body.clientId, cleanName(body.playerName), gameState, score, elapsed, savedAt).run();
        await env.DB.prepare(`
          INSERT INTO mahjong_saves(client_id, player_name, game_state, score, elapsed_seconds, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(client_id) DO UPDATE SET
            player_name=excluded.player_name, game_state=excluded.game_state,
            score=excluded.score, elapsed_seconds=excluded.elapsed_seconds,
            updated_at=CURRENT_TIMESTAMP
        `).bind(body.clientId, cleanName(body.playerName), gameState, score, elapsed).run();
        await env.DB.prepare(`
          DELETE FROM mahjong_save_history
          WHERE client_id = ? AND id NOT IN (
            SELECT id FROM mahjong_save_history WHERE client_id = ? ORDER BY saved_at DESC LIMIT 30
          )
        `).bind(body.clientId, body.clientId).run();
        return json({ ok: true, saveId, savedAt });
      }

      if (url.pathname === '/api/end' && request.method === 'POST') {
        const body = await request.json();
        if (!validId(body.clientId)) return json({ ok: false, error: 'invalid clientId' }, { status: 400 });
        const score = Math.max(0, Math.min(10000, Number(body.score) || 0));
        const duration = Math.max(0, Math.min(864000, Number(body.durationSeconds) || 0));
        await env.DB.prepare(`
          INSERT INTO mahjong_scores(id, client_id, player_name, score, duration_seconds, ended_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), body.clientId, cleanName(body.playerName), score, duration, new Date().toISOString()).run();
        return json({ ok: true });
      }
    } catch (error) {
      console.error(JSON.stringify({ event: 'api_error', path: url.pathname, message: error?.message }));
      return json({ ok: false, error: 'server error' }, { status: 500 });
    }

    return env.ASSETS.fetch(request);
  },
};
