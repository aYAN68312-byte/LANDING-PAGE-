const { kv } = require("../lib/kv");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).end(JSON.stringify({ error: "Method not allowed" }));

  const now = Date.now();
  const client = kv();
  if (client) {
    try {
      await client.zadd("visits", now, `${now}:${Math.random().toString(36).slice(2)}`);
      await client.zremrangebyscore("visits", "-inf", now - 7 * 86400000);
    } catch (e) {
      /* ignore */
    }
    return res.end(JSON.stringify({ ok: true, persisted: true }));
  }

  return res.end(JSON.stringify({ ok: true, persisted: false }));
};
