const { kv } = require("../lib/kv");

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const now = Date.now();
  const client = kv();

  if (client) {
    try {
      const today = Number(await client.zcount("visits", startOfToday(), now)) || 0;
      const last24 = Number(await client.zcount("visits", now - 86400000, now)) || 0;
      const last7 = Number(await client.zcount("visits", now - 7 * 86400000, now)) || 0;
      return res.end(JSON.stringify({ today, last24, last7, persisted: true }));
    } catch (e) {
      /* fall through to fallback */
    }
  }

  return res.end(JSON.stringify({ today: 0, last24: 0, last7: 0, persisted: false }));
};
