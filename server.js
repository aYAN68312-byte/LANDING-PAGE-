const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const SETTINGS_FILE = path.join(ROOT, "settings.json");
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-local-secret";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch (e) {
    console.error("Could not read settings.json:", e.message);
    process.exit(1);
  }
}

function saveSettings(s) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

let settings = loadSettings();

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return data + "." + sig;
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

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error("too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function parseBody(raw) {
  try {
    return typeof raw === "object" && raw !== null ? raw : JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function publicSettings(s) {
  const { adminPasswordHash, ...rest } = s;
  return rest;
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not Found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function safeJoin(base, target) {
  const full = path.normalize(path.join(base, target));
  if (!full.startsWith(base)) return null;
  return full;
}

const FORBIDDEN = new Set(["server.js", "settings.json", "package.json", "package-lock.json", "vercel.json"]);
function isPublicFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (FORBIDDEN.has(name) || name.startsWith(".")) return false;
  return Object.prototype.hasOwnProperty.call(MIME, path.extname(filePath).toLowerCase());
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (pathname === "/api/settings" && req.method === "GET") {
    return sendJson(res, 200, publicSettings(settings));
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const body = parseBody(await readBody(req));
    if (body.password === ADMIN_PASSWORD) return sendJson(res, 200, { token: sign({ exp: Date.now() + 12 * 60 * 60 * 1000 }) });
    return sendJson(res, 401, { error: "Wrong password" });
  }

  if (pathname === "/api/settings" && req.method === "POST") {
    if (!verifyToken(token)) return sendJson(res, 401, { error: "Unauthorized" });
    const body = parseBody(await readBody(req));
    settings = Object.assign(loadSettings(), sanitizeSettings(body, loadSettings()));
    saveSettings(settings);
    return sendJson(res, 200, { ok: true, settings: publicSettings(settings) });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/admin" || pathname === "/admin/") {
    return serveStatic(res, path.join(PUBLIC, "admin.html"));
  }
  if (pathname.startsWith("/admin/")) {
    const target = safeJoin(PUBLIC, pathname.slice("/admin/".length));
    if (target && isPublicFile(target)) return serveStatic(res, target);
  }

  let target = pathname === "/" ? path.join(PUBLIC, "index.html") : safeJoin(PUBLIC, pathname);
  if (target && fs.existsSync(target) && fs.statSync(target).isFile() && isPublicFile(target)) {
    return serveStatic(res, target);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
});

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

if (ADMIN_PASSWORD === "admin123") {
  console.log("\nNOTE: using default admin password 'admin123'. Set ADMIN_PASSWORD env to change it.\n");
}

server.listen(PORT, () => {
  console.log("SouthBook running at http://localhost:" + PORT);
  console.log("Admin: http://localhost:" + PORT + "/admin");
});
