const crypto = require("crypto");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-local-secret";

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return data + "." + sig;
}

function parseBody(raw) {
  try {
    return typeof raw === "object" && raw !== null ? raw : JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).end(JSON.stringify({ error: "Method not allowed" }));

  const body = parseBody(req.body);
  if (body.password === ADMIN_PASSWORD) {
    return res.end(JSON.stringify({ token: sign({ exp: Date.now() + 12 * 60 * 60 * 1000 }) }));
  }
  return res.status(401).end(JSON.stringify({ error: "Wrong password" }));
};
