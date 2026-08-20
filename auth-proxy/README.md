# TK5 Tools — auth gate (reverse proxy)

Phase 1 of the sign-in feature: a **Caddy reverse proxy + a tiny auth service**
that puts a login in front of the TK5 Tools console. Nobody reaches the console
without a valid **MVS/RAKF** user ID + password.

```
Browser ──HTTPS──► Caddy ──(forward_auth)──► auth-service ──curl FTP login──► HTTPD FTP :8021 (RAKF validates)
                     │
                     └──(authenticated)──► HTTPD console :8080
```

**Co-located deployment (primary):** it runs **on the MVS host** — the Ubuntu box
at `192.168.1.XXX` that also runs Hercules — and proxies to the local HTTPD over
loopback. The auth service validates credentials by attempting an FTP login
(curl exit 0 = valid, `530` = not) — RAKF is the real authority.

> Split-host variant (proxy on a separate machine): set
> `TK5_SITE=https://192.168.1.10`, `TK5_BACKEND=192.168.1.20:8080`, and
> `TK5_FTP_HOST=192.168.1.20`.

## What Phase 1 does (and doesn't)
- ✅ Login page; only authenticated users reach the console.
- ✅ Credentials checked against the live MVS system (RAKF via FTP).
- ✅ Signed, HttpOnly session cookie (8h default). The **password is not stored**
  — only the user ID is kept, signed, in the cookie.
- ❌ Not yet: per-user *authorization*. In Phase 1 the console's actions still run
  under the HERC01 backend identity. Phase 2 re-routes reads/writes/submits to run
  as the logged-in user so RAKF enforces what each user can do.

## Files
| File | Purpose |
|------|---------|
| `Caddyfile` | Reverse proxy: TLS, login/auth routes, forward_auth gate, proxy to HTTPD |
| `auth-service.js` | Node (no deps): login page, FTP credential check, session cookie, forward_auth verify |
| `login.html` | The themed sign-in page (read by the auth service) |

## Prerequisites (on the Ubuntu host, 192.168.1.XXX)
- **Caddy 2.x**, **Node 18+**, and **curl** (curl is used by the auth service for the FTP check).

## Run it (co-located on 192.168.1.XXX)
Get the files onto the box (e.g. `git clone` this repo into `/opt/tk5-tools`), then:
1. **Pick a strong session secret** (persist it — a restart with a new secret logs everyone out):
   ```bash
   export TK5_SESSION_SECRET=$(openssl rand -hex 32)
   ```
   The FTP host and backend default to `127.0.0.1` (local MVS), so no other env is needed.
2. **Start the auth service** (binds to 127.0.0.1:4180; only Caddy talks to it):
   ```bash
   cd auth-proxy && node auth-service.js
   ```
   For production, run it under systemd (see the unit below) so it restarts and
   keeps the same secret.
3. **Start Caddy:**
   ```bash
   caddy run --config ./Caddyfile
   ```
   It serves `https://192.168.1.XXX` with Caddy's internal CA (self-signed — browsers
   warn once, or install Caddy's root CA on clients). For a hostname, set
   `export TK5_SITE=https://tk5.example.com` and remove the `tls internal` line for
   automatic public certs.
4. Browse to `https://192.168.1.XXX/` → login page → sign in with any valid MVS user ID.

## Required hardening — block the back door
The proxy only helps if users **can't reach `192.168.1.XXX:8080` directly** (that
would skip the login). Since Caddy talks to the HTTPD over loopback (`127.0.0.1:8080`),
you can firewall the public port on the Ubuntu host — allow loopback, drop external:
```bash
sudo ufw allow 443/tcp        # Caddy (the only way in)
sudo ufw allow 22/tcp         # keep your SSH
sudo ufw deny  8080/tcp       # MVS HTTPD - no direct access
sudo ufw deny  8021/tcp       # MVS FTP  - optional, if not needed externally
sudo ufw enable
```
Loopback traffic (Caddy → 127.0.0.1:8080) is unaffected by these rules, so the
console keeps working through the proxy. (If Hercules binds these ports only to
`192.168.1.XXX` rather than `0.0.0.0`, point `TK5_BACKEND`/`TK5_FTP_HOST` at
`192.168.1.XXX` and adjust the ufw rules to match your interface.)

## systemd unit (optional, for the auth service)
```ini
# /etc/systemd/system/tk5-auth.service
[Unit]
Description=TK5 Tools auth service
After=network.target

[Service]
Environment=TK5_SESSION_SECRET=REPLACE_WITH_A_LONG_RANDOM_HEX
WorkingDirectory=/opt/tk5-tools/auth-proxy
ExecStart=/usr/bin/node auth-service.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Config (env vars)
| Var | Default | Notes |
|-----|---------|-------|
| `TK5_SESSION_SECRET` | random per start | **Set this** and persist it |
| `TK5_FTP_HOST` | `127.0.0.1` | MVS FTP host (RAKF validator); set to the MVS IP if split-host |
| `TK5_FTP_PORT` | `8021` | HTTPD FTP port |
| `TK5_AUTH_PORT` | `4180` | Local port the auth service listens on |
| `TK5_SESSION_TTL` | `28800` | Session lifetime, seconds (8h) |
| `TK5_SITE` | `https://192.168.1.XXX` | Caddy site address (Caddyfile); hostname for real certs |
| `TK5_BACKEND` | `127.0.0.1:8080` | MVS HTTPD address Caddy proxies to (Caddyfile) |
| `TK5_INSECURE_COOKIE` | (unset) | `1` drops the `Secure` cookie flag — **local HTTP testing only** |

## Notes
- **User ID + password are upper-folded** before the check, matching the 3270
  logon (so lowercase input works). If your RAKF is configured for mixed-case
  passwords, remove the `.toUpperCase()` on `pass` in `auth-service.js`.
- Session-expiry mid-use: browser navigations redirect to `/login`; XHR/fetch get
  a `401`. A page reload then lands you back on the login. (Smoother handling can
  come with Phase 2.)
