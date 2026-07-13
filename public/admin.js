const $ = (sel) => document.querySelector(sel);
const loginView = $("#login-view");
const adminView = $("#admin-view");
const loginForm = $("#login-form");
const settingsForm = $("#settings-form");
const toast = $("#toast");
let token = sessionStorage.getItem("sb_token") || "";

function showToast(msg, ok = true) {
  toast.textContent = msg;
  toast.className = "toast " + (ok ? "toast--ok" : "toast--err");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2600);
}

async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers);
  if (token) headers["Authorization"] = "Bearer " + token;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { method: opts.method || "GET", headers, body: opts.body });
  return res;
}

function fillForm(s) {
  const f = settingsForm;
  const set = (name, val) => { const el = f.elements[name]; if (el && val != null) el.value = val; };
  set("whatsappLink", s.whatsappLink);
  set("brandName", s.brandName);
  set("logoPath", s.logoPath);
  set("heroImage", s.heroImage);
  set("eyebrowEn", s.eyebrowEn);
  set("eyebrowHi", s.eyebrowHi);
  set("heroTitle", s.heroTitle);
  set("heroCopyEn", s.heroCopyEn);
  set("heroCopyHi", s.heroCopyHi);
  set("heroCopySmallEn", s.heroCopySmallEn);
  set("heroCopySmallHi", s.heroCopySmallHi);
  const st = s.stats || {};
  set("usersLabelEn", st.usersLabelEn);
  set("usersLabelHi", st.usersLabelHi);
  set("userCount", st.userCount);
  f.elements["animateUsers"].checked = st.animateUsers !== false;
  set("minDepositLabelEn", st.minDepositLabelEn);
  set("minDepositLabelHi", st.minDepositLabelHi);
  set("minDeposit", st.minDeposit);
  set("minWithdrawalLabelEn", st.minWithdrawalLabelEn);
  set("minWithdrawalLabelHi", st.minWithdrawalLabelHi);
  set("minWithdrawal", st.minWithdrawal);
  set("ctaTextEn", s.ctaTextEn);
  set("ctaTextHi", s.ctaTextHi);
  set("serviceEyebrow", s.serviceEyebrow);
  set("serviceTitleEn", s.serviceTitleEn);
  set("serviceTitleHi", s.serviceTitleHi);
  set("servicePoints", (s.servicePoints || []).join("\n"));
}

async function loadSettings() {
  const res = await api("/api/settings");
  if (res.ok) fillForm(await res.json());
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = $("#login-password").value;
  const res = await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
  if (res.ok) {
    const data = await res.json();
    token = data.token;
    sessionStorage.setItem("sb_token", token);
    loginView.classList.add("hidden");
    adminView.classList.remove("hidden");
    loadSettings();
  } else {
    $("#login-error").textContent = "Wrong password. Try again.";
  }
});

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = settingsForm;
  const payload = {
    whatsappLink: f.elements["whatsappLink"].value,
    brandName: f.elements["brandName"].value,
    logoPath: f.elements["logoPath"].value,
    heroImage: f.elements["heroImage"].value,
    eyebrowEn: f.elements["eyebrowEn"].value,
    eyebrowHi: f.elements["eyebrowHi"].value,
    heroTitle: f.elements["heroTitle"].value,
    heroCopyEn: f.elements["heroCopyEn"].value,
    heroCopyHi: f.elements["heroCopyHi"].value,
    heroCopySmallEn: f.elements["heroCopySmallEn"].value,
    heroCopySmallHi: f.elements["heroCopySmallHi"].value,
    stats: {
      usersLabelEn: f.elements["usersLabelEn"].value,
      usersLabelHi: f.elements["usersLabelHi"].value,
      userCount: Number(f.elements["userCount"].value),
      animateUsers: f.elements["animateUsers"].checked,
      minDepositLabelEn: f.elements["minDepositLabelEn"].value,
      minDepositLabelHi: f.elements["minDepositLabelHi"].value,
      minDeposit: Number(f.elements["minDeposit"].value),
      minWithdrawalLabelEn: f.elements["minWithdrawalLabelEn"].value,
      minWithdrawalLabelHi: f.elements["minWithdrawalLabelHi"].value,
      minWithdrawal: Number(f.elements["minWithdrawal"].value)
    },
    ctaTextEn: f.elements["ctaTextEn"].value,
    ctaTextHi: f.elements["ctaTextHi"].value,
    serviceEyebrow: f.elements["serviceEyebrow"].value,
    serviceTitleEn: f.elements["serviceTitleEn"].value,
    serviceTitleHi: f.elements["serviceTitleHi"].value,
    servicePoints: f.elements["servicePoints"].value.split("\n").map((s) => s.trim()).filter(Boolean)
  };

  const newPw = f.elements["newPassword"].value;
  const curPw = f.elements["currentPassword"].value;
  const confPw = f.elements["confirmPassword"].value;
  if (newPw) {
    if (newPw !== confPw) {
      showToast("❌ New passwords do not match.", false);
      return;
    }
    payload.currentPassword = curPw;
    payload.newPassword = newPw;
  }

  const res = await api("/api/settings", { method: "POST", body: JSON.stringify(payload) });
  if (res.ok) {
    showToast(newPw ? "✅ Saved! Password changed." : "✅ Saved! Changes are live.");
    f.elements["currentPassword"].value = "";
    f.elements["newPassword"].value = "";
    f.elements["confirmPassword"].value = "";
  } else if (res.status === 401) {
    showToast("Session expired. Please login again.", false);
    sessionStorage.removeItem("sb_token");
    token = "";
    adminView.classList.add("hidden");
    loginView.classList.remove("hidden");
  } else {
    showToast("❌ Could not save. Try again.", false);
  }
});

$("#logout-btn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  sessionStorage.removeItem("sb_token");
  token = "";
  adminView.classList.add("hidden");
  loginView.classList.remove("hidden");
});

if (token) {
  loginView.classList.add("hidden");
  adminView.classList.remove("hidden");
  loadSettings();
}
