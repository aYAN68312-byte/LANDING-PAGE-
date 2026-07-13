const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-local-secret";
const SETTINGS_PATH = process.env.SETTINGS_PATH || "settings.json";

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return data + "." + sig;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, key] = stored.split(":");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(key, "hex");
  const b = Buffer.from(derived, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(path.join(process.cwd(), SETTINGS_PATH), "utf-8"));
  } catch (e) {
    /* ignore */
  }

  const ok = settings.adminPasswordHash
    ? verifyPassword(body.password, settings.adminPasswordHash)
    : body.password === ADMIN_PASSWORD;

  if (ok) return res.end(JSON.stringify({ token: sign({ exp: Date.now() + 12 * 60 * 60 * 1000 }) }));
  return res.status(401).end(JSON.stringify({ error: "Wrong password" }));
};
