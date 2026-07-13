const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = process.env.REPO || "aYAN68312-byte/LANDING-PAGE-";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("ERROR: set GITHUB_TOKEN env var first.");
  process.exit(1);
}
const ROOT = __dirname;
const files = execSync("git ls-files", { cwd: ROOT, encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter(Boolean);

async function putFile(rel) {
  const abs = path.join(ROOT, rel);
  const content = fs.readFileSync(abs).toString("base64");
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURI(rel)}`;
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "User-Agent": "southbook-deploy",
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json"
  };
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message: `Add ${rel}`, content })
  });
  if (res.ok) {
    console.log("OK   " + rel);
  } else {
    const txt = await res.text();
    console.error("FAIL " + rel + " -> " + res.status + " " + txt);
  }
}

(async () => {
  for (const f of files) {
    await putFile(f);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log("\nDONE. All files pushed to " + REPO);
})();
