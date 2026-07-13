const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-local-secret";
const REPO = process.env.REPO;
const SETTINGS_PATH = process.env.SETTINGS_PATH || "settings.json";
const GH_TOKEN = process.env.GITHUB_TOKEN;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + derived;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, key] = stored.split(":");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(key, "hex");
  const b = Buffer.from(derived, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return false;
  const [data, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString());
    return p.exp > Date.now();
  } catch {
    return false;
  }
}

function getToken(req) {
  const h = req.headers["authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

function readSettings() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), SETTINGS_PATH), "utf-8"));
}

function publicSettings(s) {
  const { adminPasswordHash, ...rest } = s;
  return rest;
}

function parseBody(raw) {
  try {
    return typeof raw === "object" && raw !== null ? raw : JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function sanitizeSettings(input, current) {
  const out = {};
  const str = (v, d) => (typeof v === "string" ? v : d);
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const bool = (v, d) => (v === undefined ? d : v === true || v === "true");
  const keepStr = (val, existing) => (val === undefined ? existing : str(val, ""));
  const keepNum = (val, existing) => (val === undefined ? existing : num(val, existing));

  out.brandName = keepStr(input.brandName, current.brandName);
  out.whatsappLink = keepStr(input.whatsappLink, current.whatsappLink);
  out.logoPath = keepStr(input.logoPath, current.logoPath);
  out.heroImage = keepStr(input.heroImage, current.heroImage);
  out.eyebrowEn = keepStr(input.eyebrowEn, current.eyebrowEn);
  out.eyebrowHi = keepStr(input.eyebrowHi, current.eyebrowHi);
  out.heroTitle = keepStr(input.heroTitle, current.heroTitle);
  out.heroCopyEn = keepStr(input.heroCopyEn, current.heroCopyEn);
  out.heroCopyHi = keepStr(input.heroCopyHi, current.heroCopyHi);
  out.heroCopySmallEn = keepStr(input.heroCopySmallEn, current.heroCopySmallEn);
  out.heroCopySmallHi = keepStr(input.heroCopySmallHi, current.heroCopySmallHi);

  const stIn = input.stats || {};
  const stCur = current.stats;
  out.stats = {
    usersLabelEn: keepStr(stIn.usersLabelEn, stCur.usersLabelEn),
    usersLabelHi: keepStr(stIn.usersLabelHi, stCur.usersLabelHi),
    userCount: keepNum(stIn.userCount, stCur.userCount),
    animateUsers: bool(stIn.animateUsers, stCur.animateUsers),
    minDepositLabelEn: keepStr(stIn.minDepositLabelEn, stCur.minDepositLabelEn),
    minDepositLabelHi: keepStr(stIn.minDepositLabelHi, stCur.minDepositLabelHi),
    minDeposit: keepNum(stIn.minDeposit, stCur.minDeposit),
    minWithdrawalLabelEn: keepStr(stIn.minWithdrawalLabelEn, stCur.minWithdrawalLabelEn),
    minWithdrawalLabelHi: keepStr(stIn.minWithdrawalLabelHi, stCur.minWithdrawalLabelHi),
    minWithdrawal: keepNum(stIn.minWithdrawal, stCur.minWithdrawal)
  };

  out.ctaTextEn = keepStr(input.ctaTextEn, current.ctaTextEn);
  out.ctaTextHi = keepStr(input.ctaTextHi, current.ctaTextHi);
  out.serviceEyebrow = keepStr(input.serviceEyebrow, current.serviceEyebrow);
  out.serviceTitleEn = keepStr(input.serviceTitleEn, current.serviceTitleEn);
  out.serviceTitleHi = keepStr(input.serviceTitleHi, current.serviceTitleHi);
  out.servicePoints = Array.isArray(input.servicePoints)
    ? input.servicePoints.map((s) => str(s, "")).filter(Boolean)
    : current.servicePoints;

  return out;
}

async function commitToGitHub(settings) {
  if (!REPO || !GH_TOKEN) return false;
  const url = `https://api.github.com/repos/${REPO}/contents/${SETTINGS_PATH}`;
  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    "User-Agent": "southbook-admin",
    Accept: "application/vnd.github+json"
  };
  let sha;
  try {
    const get = await fetch(url, { headers });
    if (get.ok) sha = (await get.json()).sha;
  } catch (e) {
    /* ignore */
  }
  const content = Buffer.from(JSON.stringify(settings, null, 2)).toString("base64");
  try {
    const put = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Update SouthBook settings from admin panel",
        content,
        sha
      })
    });
    return put.ok;
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    try {
      return res.end(JSON.stringify(publicSettings(readSettings())));
    } catch (e) {
      return res.status(500).end(JSON.stringify({ error: "Failed to read settings" }));
    }
  }

  if (req.method === "POST") {
    if (!verifyToken(getToken(req))) return res.status(401).end(JSON.stringify({ error: "Unauthorized" }));
    const body = parseBody(req.body);
    if (!body || typeof body !== "object") return res.status(400).end(JSON.stringify({ error: "Bad request" }));

    const current = readSettings();
    const updated = sanitizeSettings(body, current);

    if (body.newPassword) {
      const currentOk = current.adminPasswordHash
        ? verifyPassword(body.currentPassword || "", current.adminPasswordHash)
        : (body.currentPassword || "") === ADMIN_PASSWORD;
      if (!currentOk) return res.status(401).end(JSON.stringify({ error: "Current password is incorrect" }));
      if (body.newPassword.length < 4) return res.status(400).end(JSON.stringify({ error: "New password too short" }));
      updated.adminPasswordHash = hashPassword(body.newPassword);
    }

    try {
      fs.writeFileSync(path.join(process.cwd(), SETTINGS_PATH), JSON.stringify(updated, null, 2));
    } catch (e) {
      /* local write may fail on serverless; GitHub commit is the source of truth */
    }
    const committed = await commitToGitHub(updated);
    return res.end(JSON.stringify({ ok: true, committed, settings: publicSettings(updated) }));
  }

  return res.status(405).end(JSON.stringify({ error: "Method not allowed" }));
};
