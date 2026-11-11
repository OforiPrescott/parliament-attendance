# 3. System architecture and workflows

## 3.1 Architecture overview

A single Next.js 15 (App Router) application serves both the user interface and a REST API,
backed by PostgreSQL. Pages are React Server Components that read the database directly through a
small data-access layer; interactive parts are client components that call the REST API and
then refresh the server-rendered view. There is one codebase, one deployable and one database.

```mermaid
flowchart LR
  subgraph Client["Browser — desktop, tablet, phone"]
    UI["React UI<br/>Tailwind · Recharts · Lucide"]
  end
  subgraph Server["Node.js — Next.js 15"]
    MW["Middleware<br/>CSRF origin check · sign-in redirect"]
    RSC["Server Components<br/>pages: dashboard, registry, reports…"]
    API["REST route handlers<br/>/api/*"]
    LIB["Domain layer<br/>auth · permissions · attendance · stats · reports · audit"]
    EXP["Exports<br/>jsPDF · ExcelJS"]
  end
  DB[("PostgreSQL 13+<br/>UTF-8, UTC")]
  FS[("Photo store<br/>outside web root")]
  BK[("Backups<br/>gzip + sha256 (+GPG) · off-site")]

  UI -- HTTPS --> MW --> RSC & API
  RSC --> LIB
  API --> LIB --> DB
  API --> EXP
  API --> FS
  DB -. nightly pg_dump .-> BK
  FS -. nightly tar .-> BK
```

### Layers

| Layer | Location | Responsibility |
|---|---|---|
| Pages | `src/app/(app)/*/page.tsx` | Server-rendered screens; call `requireUser(permission)` first |
| Client components | `*-form.tsx`, `*-manager.tsx`, `components/register` | Forms, dialogs, register grid, charts |
| REST API | `src/app/api/**/route.ts` | Every handler is wrapped by `route({ permission })` → auth, RBAC, Zod validation, uniform errors |
| Domain | `src/lib/*.ts` | `auth`, `permissions`, `attendance` (expected lists), `stats` (dashboard), `reports`, `export`, `audit`, `uploads` |
| Data | `src/lib/db.ts` | node-postgres (`pg`) pool; `?` placeholders translated to `$n` in `src/lib/sql.ts`; `rows / one / exec / transaction` helpers; parameterised SQL only |
| UI kit | `src/components/ui/*` | Buttons, form fields, dialogs, confirm, tables, badges, tabs (shadcn-style, no runtime dependency) |

## 3.2 Security architecture

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant M as Middleware
  participant R as route() wrapper
  participant H as Handler
  participant D as PostgreSQL
  B->>M: POST /api/... (cookie pa_session, Origin)
  M->>M: Origin == app origin? else 403
  M->>R: forward
  R->>D: look up SHA-256(token) in user_sessions
  D-->>R: user, role, idle time, revoked?
  R->>R: expired / idle / inactive → 401<br/>must change password → 403<br/>permission missing → 403
  R->>H: user + params
  H->>H: Zod-validate body
  H->>D: BEGIN · SELECT … FOR UPDATE · writes · INSERT audit_logs · COMMIT
  H-->>B: JSON
```

- Session token: 256-bit random, sent as an `HttpOnly; SameSite=Strict; Secure` cookie; only its hash is stored.
- Passwords: bcrypt cost 12; constant-time behaviour for unknown usernames; per-account lockout plus per-IP rate limiting.
- Headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy (`next.config.mjs`).
- Uploads: magic-byte type check, 2 MB limit, random file names outside `/public`, path-traversal guard, served via an authenticated route.
- Exports: formula-injection neutralised for CSV/Excel input; every export audited.

## 3.3 Register workflow

```mermaid
stateDiagram-v2
  [*] --> NOT_STARTED: sitting scheduled
  NOT_STARTED --> DRAFT: officer saves first records
  DRAFT --> DRAFT: save draft
  DRAFT --> SUBMITTED: submit (all members marked)
  RETURNED --> SUBMITTED: amend + resubmit
  SUBMITTED --> APPROVED: reviewer approves (≠ submitter)
  SUBMITTED --> RETURNED: reviewer returns with comment
  APPROVED --> DRAFT: administrator reopens (reason required)
  APPROVED --> APPROVED: correction approved (≠ requester)
```

## 3.4 Correction workflow

```mermaid
sequenceDiagram
  actor O as Attendance Officer
  participant S as System
  actor A as Approver
  O->>S: Request correction (new status, reason)
  S->>S: register approved? no pending request? value differs?
  S-->>A: appears in Review & approval › Correction requests
  A->>S: Approve (or Reject with reason)
  S->>S: requester ≠ approver · record unchanged since request
  S->>S: update attendance · write audit (before/after)
  S-->>O: status visible in Correction history
```

## 3.5 Attendance capture flow

```mermaid
flowchart TD
  A[Officer opens Attendance capture] --> B{Sitting today?}
  B -- yes --> C[Take attendance]
  B -- no --> D[Registers to complete list] --> C
  C --> E[System builds expected list<br/>plenary: serving MPs on date<br/>committee: members on date]
  E --> F[Mark P / L / A / E / OD<br/>bulk 'mark remaining present'<br/>arrival time · remarks]
  F --> G[Save draft — upsert, no duplicates]
  G --> H{All marked?}
  H -- no --> F
  H -- yes --> I[Submit → locked, awaiting approval]
```

## 3.6 REST API

All endpoints return JSON (exports return files). Errors: `{ error, fields? }` with HTTP 400/401/403/404/409/413/415/423/429/500.

| Method & path | Permission | Purpose |
|---|---|---|
| `POST /api/auth/login` · `/logout` · `/password` | — / signed-in | Sign in, sign out, change password |
| `GET/POST /api/mps` | mps.view / mps.manage | List (filters, paging) / create |
| `GET/PATCH/DELETE /api/mps/:id` | mps.view / mps.manage | Read / update (incl. leaving office) / delete if no history |
| `POST /api/mps/:id/membership` | mps.manage | Record party or seat change |
| `GET/POST/DELETE /api/mps/:id/photo` | mps.view / mps.manage | Serve / upload / remove photograph |
| `POST /api/mps/import[?dryRun=1]` | mps.manage | CSV import with validation |
| `GET/POST /api/parties`, `PATCH/DELETE /api/parties/:id` | reference.manage | Parties |
| `GET/POST /api/regions`, `…/:id` · `GET/POST /api/constituencies`, `…/:id` | reference.manage | Regions, constituencies |
| `GET/POST /api/calendar/:kind`, `PATCH/DELETE /api/calendar/:kind/:id` | sittings.manage | Parliaments, sessions, meetings |
| `POST /api/committees`, `PATCH/DELETE /api/committees/:id`, `GET/PUT …/:id/members` | sittings.manage | Committees and membership |
| `GET/POST /api/sittings[?bulk=1]`, `GET/PATCH/DELETE /api/sittings/:id` | sittings.view / manage | Sittings |
| `GET/PUT /api/sittings/:id/register` | attendance.capture | Load / save register (upsert) |
| `POST /api/sittings/:id/register` `{action}` | capture / review / admin | submit · approve · return · reopen |
| `GET/POST /api/corrections`, `POST /api/corrections/:id` | corrections.* | List / request / approve or reject |
| `GET /api/reports?type=…&format=json\|pdf\|xlsx` | reports.view / export | All reports and exports |
| `GET/POST /api/users`, `PATCH/POST /api/users/:id` | users.manage | Users; POST on `:id` resets password |
| `GET /api/audit[?format=xlsx]` | audit.view | Audit search and export |
| `GET/PATCH /api/settings` | settings.manage | Settings |

## 3.7 Project structure

```
database/schema.sql          PostgreSQL schema, constraints, base roles and settings
scripts/                     migrate · seed (demo) · create-admin · backup.sh · restore.sh
src/middleware.ts            CSRF origin check, sign-in redirect
src/lib/                     domain + data layer (server-only unless noted)
src/components/ui/           design-system components
src/components/register/     attendance register grid (capture, review, corrections)
src/app/login, change-password
src/app/(app)/               dashboard · members · parties · constituencies · sittings
                             attendance · approvals · reports · users · audit · settings
src/app/api/                 REST route handlers
tests/                       unit tests (vitest)
docs/                        this documentation
```
