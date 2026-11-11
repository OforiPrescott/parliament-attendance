# 7. Testing and deployment

## 7.1 Test strategy

| Level | Scope | Tooling |
|---|---|---|
| Static | Types across the codebase | `npm run typecheck` (TypeScript strict) |
| Unit | Permission matrix and segregation of duties, password policy, CSV parser, formatting | `npm test` (Vitest) — `tests/unit.test.ts` |
| Integration | API routes against a disposable PostgreSQL: workflow transitions, duplicate prevention, correction rules | Recommended next step: Vitest + Testcontainers (PostgreSQL 17) |
| End-to-end | Key journeys in a browser | Recommended: Playwright scripts mirroring the UAT cases below |
| Security | OWASP ZAP baseline scan; dependency audit; manual checks in 7.3 | Before go-live and after each release |
| Performance | 10 years of synthetic data (≈ 500k rows); dashboard and reports < 2 s | Seed script scaled up + k6 |
| UAT | Officers, approvers and management using the demo and then real data | Scripts below |

## 7.2 User acceptance test scripts

| # | Role | Steps | Expected result |
|---|---|---|---|
| UAT-01 | Any | Sign in with a wrong password 5 times | Account locked for 15 minutes; entries in audit trail |
| UAT-02 | Admin | Create an officer; sign in as that officer | One-time password shown once; officer forced to change it |
| UAT-03 | Officer | Attendance capture → Take attendance for today's plenary; mark several; Save draft; reload | Marks persist; register status *Draft* |
| UAT-04 | Officer | Mark remaining present; set one Late with arrival time; Submit | Confirmation summary; status *Awaiting approval*; register read-only |
| UAT-05 | Officer | Try to approve the register they submitted (sign in as an admin who submitted) | Approve button absent; API refuses with segregation-of-duties message |
| UAT-06 | Approver | Return the register with a comment | Officer sees the comment in red on capture; can amend and resubmit |
| UAT-07 | Approver | Approve the register | Dashboard and reports include it; register locked |
| UAT-08 | Officer | On the approved register, request a correction Absent → Excused with reason | Request listed under Correction requests; record unchanged |
| UAT-09 | Approver | Approve the correction | Record updated; audit shows before/after |
| UAT-10 | Admin | Record a floor-crossing for a Member effective today | History shows two periods; earlier party reports unchanged |
| UAT-11 | Admin | Change a Member's status to Deceased with a date | Member drops off registers after that date; committee places closed |
| UAT-12 | Admin | Import the official roster CSV (validate first, then import) | Errors listed per row; valid file imports; audit entry |
| UAT-13 | Management | Reports → Monthly, this year → export PDF and Excel | Branded PDF with logo, totals, page numbers; Excel with filters and % format |
| UAT-14 | Viewer | Try to open /users or /settings | "You don't have access" page; API returns 403 |
| UAT-15 | Any | Leave the app idle for the configured time | Warning at T-1 minute; signed out at timeout |
| UAT-16 | Admin | Restore last night's backup into a test database | Row counts match production |

## 7.3 Security checklist before go-live

- [ ] `COOKIE_SECURE=true`, HTTPS only, HSTS active, TLS 1.2+.
- [ ] `APP_ORIGIN` set to the production URL.
- [ ] Application DB account created with `scripts/grants.sql` (audit table append-only).
- [ ] Demo seed never run on production; demo accounts absent.
- [ ] Default and temporary passwords changed; admin accounts named, not shared.
- [ ] `npm audit --omit=dev` reviewed; OWASP ZAP baseline clean of high findings.
- [ ] Backups scheduled, encrypted, copied off-site, restore tested.
- [ ] Server firewall: only 443 public; SSH restricted; PostgreSQL not exposed.
- [ ] Official logo and colours applied; business rules in `02-business-rules.md` signed off.

## 7.4 Release process

1. Merge to `main` after review; CI runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
2. Back up the production database (`scripts/backup.sh`).
3. Apply schema changes with `npm run db:migrate` (idempotent DDL; future changes as numbered migration files).
4. Build and restart: `npm ci && npm run build && sudo systemctl restart parliament-attendance` (or `docker compose up -d --build`).
5. Smoke test: sign in, dashboard loads, open a register, export a report.
6. Roll back by redeploying the previous build and, if needed, restoring the pre-release backup.

## 7.5 Go-live plan (suggested)

| Week | Activity |
|---|---|
| 1 | Business-rule sign-off; logo/colours; server provisioning |
| 2 | Production install; roster, calendar and committee load; user accounts |
| 3 | Officer and approver training on the demo instance; UAT |
| 4 | Parallel run with the paper register for one week of sittings; reconcile |
| 5 | Go-live; paper register retired after the Clerk's sign-off |
