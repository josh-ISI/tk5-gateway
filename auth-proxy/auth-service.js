// TK5 Tools — auth gate (Phase 1)
// -----------------------------------------------------------------------------
// A tiny, dependency-free HTTP service that sits behind Caddy and:
//   * serves the login page,
//   * validates an MVS user ID + password by attempting an FTP login to the
//     HTTPD's FTP server (RAKF is the real authority — success/530 = valid/not),
//   * issues a signed session cookie, and
//   * answers Caddy's forward_auth check on every request.
//
// Only Caddy talks to it (binds to 127.0.0.1). No npm install: Node core plus
// the system `curl` for the FTP probe (matches the rest of this toolkit).
//
// Config via env vars (see README). Run:  node auth-service.js
// -----------------------------------------------------------------------------
"use strict";
const http = require("http");
const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const CFG = {
  port:        parseInt(process.env.TK5_AUTH_PORT || "4180", 10),
  // Default assumes the auth service runs on the SAME host as the MVS/HTTPD
  // (e.g. the Ubuntu box at 192.168.1.XXX), so the FTP validator is local.
  // For a split-host setup (proxy separate from MVS) set TK5_FTP_HOST=<mvs-ip>.
  ftpHost:     process.env.TK5_FTP_HOST || "127.0.0.1",
  ftpPort:     process.env.TK5_FTP_PORT || "8021",
  secret:      process.env.TK5_SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  ttlSeconds:  parseInt(process.env.TK5_SESSION_TTL || "28800", 10), // 8h
  cookieName:  "tk5sid",
  // Secure cookies require HTTPS (Caddy provides it). Set TK5_INSECURE_COOKIE=1
  // only for local HTTP testing.
  secureCookie: !process.env.TK5_INSECURE_COOKIE,
  curl:        process.env.TK5_CURL || (process.platform === "win32" ? "curl.exe" : "curl"),
};
if (!process.env.TK5_SESSION_SECRET) {
  console.warn("[warn] TK5_SESSION_SECRET not set - generated a random one; " +
    "sessions won't survive a restart. Set it (openssl rand -hex 32) for production.");
}

const LOGIN_HTML = fs.readFileSync(path.join(__dirname, "login.html"), "utf8");
const NULLDEV = process.platform === "win32" ? "NUL" : "/dev/null";

// ---- signed session token: base64url(json).hmac(sha256) --------------------
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url");
  return body + "." + mac;
}
function verify(token) {
  if (!token || token.indexOf(".") < 0) return null;
  const [body, mac] = token.split(".");
  const expect = crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p; try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch (e) { return null; }
  if (!p.exp || Date.now() / 1000 > p.exp) return null;
  return p;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach(c => {
    const i = c.indexOf("="); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function sessionUser(req) {
  const p = verify(parseCookies(req)[CFG.cookieName]);
  return p ? p.user : null;
}

// ---- credential check: an FTP login as the user (curl exit 0 = valid) ------
function checkCredentials(user, pass) {
  return new Promise((resolve) => {
    // execFile (no shell) so the user/password can never be interpreted as a
    // shell command; a bad password makes curl exit non-zero (67 on 530).
    execFile(CFG.curl,
      ["-s", "-m", "12", "--user", `${user}:${pass}`, `ftp://${CFG.ftpHost}:${CFG.ftpPort}/`, "-o", NULLDEV],
      { timeout: 15000 },
      (err) => resolve(!err));
  });
}

// ---- helpers ---------------------------------------------------------------
function send(res, code, headers, body) { res.writeHead(code, headers || {}); res.end(body || ""); }
function loginPage(res, msg) {
  const html = LOGIN_HTML.replace("<!--MSG-->", msg ? `<div class="err">${msg}</div>` : "");
  send(res, 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, html);
}
function setCookie(user) {
  const token = sign({ user, exp: Math.floor(Date.now() / 1000) + CFG.ttlSeconds });
  const attrs = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${CFG.ttlSeconds}`];
  if (CFG.secureCookie) attrs.push("Secure");
  return `${CFG.cookieName}=${encodeURIComponent(token)}; ${attrs.join("; ")}`;
}
function clearCookie() { return `${CFG.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`; }

// ---- routes ----------------------------------------------------------------
const server = http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;

  // Caddy forward_auth check: 204 if signed-in, else 302 (browser) / 401 (xhr)
  if (p === "/auth/verify") {
    const user = sessionUser(req);
    if (user) return send(res, 204, { "X-Tk5-User": user });
    const wantsHtml = (req.headers["accept"] || "").includes("text/html");
    return wantsHtml ? send(res, 302, { "Location": "/login" }) : send(res, 401, {}, "unauthorized");
  }

  if (p === "/login" && req.method === "GET") return loginPage(res);

  // Lets the console page ask "who am I?" so it can show the signed-in user
  // in the header. Reads the same session cookie /auth/verify checks.
  if (p === "/auth/whoami" && req.method === "GET") {
    const user = sessionUser(req);
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (!user) return send(res, 401, headers, JSON.stringify({ error: "not signed in" }));
    return send(res, 200, headers, JSON.stringify({ user }));
  }

  if (p === "/auth/login" && req.method === "POST") {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 8192) req.destroy(); });
    req.on("end", async () => {
      const form = new URLSearchParams(data);
      const user = (form.get("user") || "").trim().toUpperCase();
      const pass = (form.get("pass") || "").toUpperCase(); // MVS/RAKF fold to upper, like the 3270 logon
      if (!/^[A-Z0-9#@$]{1,8}$/.test(user)) return loginPage(res, "Invalid user ID.");
      const ok = await checkCredentials(user, pass);
      if (!ok) return loginPage(res, "Sign-in failed - check your user ID and password.");
      send(res, 302, { "Set-Cookie": setCookie(user), "Location": "/" });
    });
    return;
  }

  if (p === "/logout") return send(res, 302, { "Set-Cookie": clearCookie(), "Location": "/login" });

  send(res, 404, { "Content-Type": "text/plain" }, "not found");
});

server.listen(CFG.port, "127.0.0.1", () => {
  console.log(`TK5 auth service on 127.0.0.1:${CFG.port} - validating against ftp://${CFG.ftpHost}:${CFG.ftpPort}`);
});
