# 6. Installation and configuration guide

## 6.1 Requirements

| Component | Version |
|---|---|
| Node.js | 20 LTS or 22 LTS |
| PostgreSQL | 13+ (17 recommended) |
| OS | Ubuntu 22.04/24.04 LTS or any Linux with systemd; Windows Server works for development |
| Reverse proxy | nginx (TLS termination) |
| Browser | Current Chrome, Edge, Firefox or Safari |

## 6.2 Local / demonstration install

```bash
# 1. Database
psql -U postgres -c "CREATE ROLE pa_app LOGIN PASSWORD 'ChangeMe#2026';"
psql -U postgres -c "CREATE DATABASE parliament_attendance OWNER pa_app ENCODING 'UTF8' TEMPLATE template0;"

# 2. Application
cp .env.example .env          # set DB_USER=pa_app, DB_PASSWORD=…
npm install
npm run db:migrate            # creates tables, roles and default settings
npm run db:seed               # OPTIONAL fictional demo data (wipes existing data!)
npm run dev                   # http://localhost:3000
```

Demo sign-ins after seeding (password `Demo@Parl2026`): `admin`, `officer`, `approver`,
`management`, `viewer`. The demo database has 80 constituencies with fictional Members and about
two sessions of plenary and committee attendance.

## 6.3 Production install

1. **Server:** create a service user `pa`; install Node.js, PostgreSQL and nginx; open only 443 (and 22 from the admin network).
2. **Database:** create the database; apply the schema with an admin account (`npm run db:migrate` with admin credentials, or `psql -f database/schema.sql`); create the application role with `scripts/grants.sql`.
3. **Application:**
   ```bash
   sudo -u pa git clone <repo> /opt/parliament-attendance && cd /opt/parliament-attendance
   cp .env.example .env && chmod 600 .env       # production values, COOKIE_SECURE=true, APP_ORIGIN=https://ams.parliament.gh
   npm ci && npm run build
   npm run db:create-admin                      # prints a one-time admin password
   ```
4. **Branding:** copy the official logo to `public/branding/parliament-logo.png` (and `favicon.png`); set corporate colours in `src/app/globals.css`; rebuild.
5. **Roster:** sign in as admin → Sittings › Parliaments: add the current Parliament, sessions and meetings → Members › Import CSV with the official roster → Committees.
6. **Users:** create named accounts for each officer and approver; deliver one-time passwords securely.

### systemd unit (`/etc/systemd/system/parliament-attendance.service`)

```ini
[Unit]
Description=Parliament MP Attendance System
After=network.target postgresql.service

[Service]
User=pa
WorkingDirectory=/opt/parliament-attendance
EnvironmentFile=/opt/parliament-attendance/.env
ExecStart=/usr/bin/node .next/standalone/server.js
Environment=NODE_ENV=production PORT=3000 HOSTNAME=127.0.0.1
Restart=always
NoNewPrivileges=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

With `output: "standalone"`, copy static assets once after each build:
`cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`.

### nginx

```nginx
server {
  listen 443 ssl http2;
  server_name ams.parliament.gh;
  ssl_certificate     /etc/ssl/certs/ams.crt;
  ssl_certificate_key /etc/ssl/private/ams.key;
  client_max_body_size 3m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}
server { listen 80; server_name ams.parliament.gh; return 301 https://$host$request_uri; }
```

Set `TRUST_PROXY=true` so audit records show the client's IP from `X-Forwarded-For`.

### Docker alternative

```bash
cp .env.example .env   # DB_USER / DB_PASSWORD become the container's Postgres owner
docker compose up -d --build
docker compose exec app node -e "console.log('ok')"
```
Run `npm run db:create-admin` from a host checkout pointed at the container's database.

## 6.4 Configuration reference (`.env`)

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_CONNECTION_LIMIT` | PostgreSQL connection (`DB_SSL=true` for servers that require TLS) |
| `APP_ORIGIN` | Public URL; mutating API calls from any other origin are rejected |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `UPLOAD_DIR` | Photograph storage (outside the web root; back it up) |
| `TRUST_PROXY` | Use `X-Forwarded-For` for audit IPs |
| `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_FULL_NAME` | Used by `db:create-admin` |

In-app settings (Settings screen) cover attendance rules and the security policy.

## 6.5 Backup and recovery

```bash
chmod +x scripts/backup.sh scripts/restore.sh
crontab -e   # as pa:
30 1 * * * /opt/parliament-attendance/scripts/backup.sh >> /var/log/pa-backup.log 2>&1
```

- Consistent `pg_dump -Fc` snapshot (no downtime, compressed), `pg_restore --list` integrity check, `sha256` checksum, optional GPG encryption (`BACKUP_GPG_RECIPIENT`), photographs archived, 30-day rotation (`RETENTION_DAYS`), optional off-site `rsync` (`OFFSITE_RSYNC_TARGET`).
- **Restore:** `scripts/restore.sh <file>` restores into `<db>_restore`, prints row counts for checking, and leaves the live database untouched until you switch.
- **Test a restore every quarter** and record it. Targets: RPO 24 h (nightly), RTO 4 h. For lower RPO enable WAL archiving and point-in-time recovery.
