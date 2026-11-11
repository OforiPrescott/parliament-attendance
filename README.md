# MP Attendance Management System — Parliament of Ghana

A secure web application to capture, approve, monitor and report the attendance of Members of
Parliament at plenary sittings, committee meetings and other official business.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn-style components ·
Recharts · Lucide · PostgreSQL 13+ · Zod · jsPDF · ExcelJS

## Quick start (demo)

```bash
cp .env.example .env            # set your PostgreSQL credentials
npm install
npm run db:migrate              # schema, roles, default settings
npm run db:seed                 # fictional demo data — never on production
npm run dev                     # http://localhost:3000
```

Sign in as `admin`, `officer`, `approver`, `management` or `viewer` — password `Demo@Parl2026`.

**Before showing it to anyone:** put the official logo at `public/branding/parliament-logo.png`
(see `public/branding/README.md`). A neutral placeholder is shown until then.

## Modules

| # | Module | Where |
|---|---|---|
| 1 | Login & authentication (lockout, idle timeout, forced password change, expiry) | `/login`, `/change-password` |
| 2 | Dashboard (KPIs, trends, party/region, year-on-year, watch-list) | `/dashboard` |
| 3 | Members of Parliament (photos, history, CSV import) | `/members` |
| 4 | Political parties | `/parties` |
| 5 | Constituencies & regions | `/constituencies` |
| 6 | Sittings, calendar & committees | `/sittings` |
| 7 | Attendance capture | `/attendance` |
| 8 | Review & approval, corrections | `/approvals` |
| 9 | Reports & analytics (10 reports, PDF/Excel) | `/reports` |
| 10 | Users & roles | `/users` |
| 11 | Audit trail | `/audit` |
| 12 | System settings | `/settings` |

## Documentation

| | |
|---|---|
| [01 Requirements specification](docs/01-requirements-specification.md) | Scope, roles, functional and non-functional requirements |
| [02 Business rules](docs/02-business-rules.md) | **Defaults that Parliament must confirm** (⚠ items) |
| [03 Architecture & workflows](docs/03-architecture.md) | Diagrams, security model, REST API |
| [04 Database](docs/04-database.md) | ERD, table dictionary, privileges |
| [05 UI/UX design](docs/05-ui-design.md) | Design system and screens |
| [06 Installation & configuration](docs/06-installation.md) | Local, production, Docker, backups |
| [07 Testing & deployment](docs/07-testing-and-deployment.md) | Test strategy, UAT scripts, go-live checklist |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, run |
| `npm run typecheck` / `npm test` | Type-check, unit tests |
| `npm run db:migrate` | Apply `database/schema.sql` (idempotent) |
| `npm run db:seed` | Load fictional demo data (destructive) |
| `npm run db:create-admin` | Create the first production administrator |
| `scripts/backup.sh` / `scripts/restore.sh` | Backup with rotation and verification / safe restore |
| `scripts/grants.sql` | Least-privilege PostgreSQL role for the application |

## Data notice

Region and constituency names in the demo seed are real; every Member name, ID, party allocation,
sitting and attendance record in it is fictional and randomly generated.
