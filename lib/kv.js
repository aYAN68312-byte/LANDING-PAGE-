function kv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return {
    async run(command, key, args) {
      try {
        const res = await fetch(`${url}/${command}/${key}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(args || [])
        });
        const j = await res.json().catch(() => ({}));
        return j && "result" in j ? j.result : null;
      } catch (e) {
        return null;
      }
    },
    zadd(key, score, member) {
      return this.run("zadd", key, [score, member]);
    },
    zcount(key, min, max) {
      return this.run("zcount", key, [min, max]);
    },
    zremrangebyscore(key, min, max) {
      return this.run("zremrangebyscore", key, [min, max]);
    }
  };
}

module.exports = { kv };
