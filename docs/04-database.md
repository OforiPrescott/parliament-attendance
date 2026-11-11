# 4. Database design

PostgreSQL 13+ · UTF-8 · UTC (`TIMESTAMP WITHOUT TIME ZONE`, sessions run with `timezone=UTC`). Enumerations are `VARCHAR` + `CHECK`; flags are `SMALLINT` 0/1; names are unique case-insensitively via `lower()` indexes; `updated_at` is maintained by triggers. The authoritative DDL is `database/schema.sql`.

## 4.1 Entity-relationship diagram

```mermaid
erDiagram
  REGIONS ||--o{ CONSTITUENCIES : contains
  PARLIAMENTS ||--o{ PARLIAMENT_SESSIONS : has
  PARLIAMENT_SESSIONS ||--o{ MEETINGS : has
  MEETINGS ||--o{ SITTINGS : schedules
  COMMITTEES ||--o{ SITTINGS : "holds (committee type)"
  COMMITTEES ||--o{ COMMITTEE_MEMBERS : has
  MPS ||--o{ COMMITTEE_MEMBERS : serves
  MPS ||--o{ MP_MEMBERSHIPS : "membership history"
  PARTIES ||--o{ MP_MEMBERSHIPS : ""
  CONSTITUENCIES ||--o{ MP_MEMBERSHIPS : ""
  PARLIAMENTS ||--o{ MP_MEMBERSHIPS : ""
  SITTINGS ||--o{ ATTENDANCE : records
  MPS ||--o{ ATTENDANCE : ""
  PARTIES ||--o{ ATTENDANCE : "snapshot"
  CONSTITUENCIES ||--o{ ATTENDANCE : "snapshot"
  ATTENDANCE ||--o{ ATTENDANCE_CORRECTIONS : "corrected by"
  ROLES ||--o{ USERS : ""
  USERS ||--o{ USER_SESSIONS : ""
  USERS ||--o{ AUDIT_LOGS : "acts in"

  MPS { int id PK; varchar parliamentary_id UK; varchar first_name; varchar last_name; enum gender; enum status; varchar photo_path; int current_party_id FK; int current_constituency_id FK }
  MP_MEMBERSHIPS { int id PK; int mp_id FK; int parliament_id FK; int party_id FK; int constituency_id FK; date start_date; date end_date }
  SITTINGS { int id PK; int meeting_id FK; enum sitting_type; int committee_id FK; date sitting_date; time start_time; enum status; enum register_status; int submitted_by FK; int reviewed_by FK }
  ATTENDANCE { bigint id PK; int sitting_id FK; int mp_id FK; int party_id FK; int constituency_id FK; enum status; time arrival_time; varchar remarks }
  ATTENDANCE_CORRECTIONS { int id PK; bigint attendance_id FK; enum old_status; enum new_status; varchar reason; enum status; int requested_by FK; int reviewed_by FK }
  AUDIT_LOGS { bigint id PK; int user_id; varchar action; varchar entity_type; varchar entity_id; json before_data; json after_data; datetime created_at }
```

## 4.2 Table dictionary

| Table | Purpose | Key constraints |
|---|---|---|
| `regions` | The 16 administrative regions | `UNIQUE(name)` |
| `parties` | Political parties incl. *Independent* | `UNIQUE(abbreviation)`, `UNIQUE(name)`, colour CHECK |
| `constituencies` | Electoral constituencies | `UNIQUE(name)`, `UNIQUE(code)`, FK region (RESTRICT) |
| `parliaments` | Parliaments of the Fourth Republic | `UNIQUE(number)`, date CHECK, one `is_current` (enforced in code) |
| `parliament_sessions` | Annual sessions | `UNIQUE(parliament_id, number)` |
| `meetings` | Meeting periods within a session | `UNIQUE(session_id, number)`, date index |
| `committees` | Standing, select, ad hoc committees | `UNIQUE(name)` |
| `mps` | Members of Parliament | `UNIQUE(parliamentary_id)`; current party/constituency are a convenience copy of the open membership |
| `mp_memberships` | Dated seat + party periods | FK RESTRICT on parliament/party/constituency; index `(mp_id, start_date)` |
| `committee_members` | Dated committee membership and role | `UNIQUE(committee_id, mp_id, start_date)` |
| `roles` | The five roles (permissions defined in code) | `UNIQUE(code)` |
| `users` | System users | `UNIQUE(username)`, `UNIQUE(email)`; lockout and password-age fields |
| `user_sessions` | Server-side sessions (hash of token) | revocation, idle and absolute expiry |
| `sittings` | Plenary, committee and other sittings with register workflow state | CHECK committee required for committee type; CHECK end > start |
| `attendance` | One row per MP per sitting | **`UNIQUE(sitting_id, mp_id)`** — duplicates impossible; party/constituency snapshot |
| `attendance_corrections` | Post-approval change requests | status + reviewer; index `(status, requested_at)` |
| `audit_logs` | Append-only audit trail | indexes on time, entity, user, action |
| `settings` | Key/value configuration | — |

## 4.3 Capacity

276 seats × ~90 plenary sittings a year ≈ 25,000 rows/year, plus committee meetings — roughly
50,000 attendance rows a year, ≈ 0.5 million per decade. All dashboard and report queries filter
on indexed columns (`sittings.sitting_date`, `register_status`, `attendance.sitting_id/mp_id/party_id/constituency_id`).

## 4.4 Recommended database privileges

Run the application with a least-privilege account created by `scripts/grants.sql`:

- `SELECT, INSERT` only on `audit_logs` — the audit trail is append-only even if the application were compromised;
- no `DELETE` on `attendance`, `attendance_corrections`, `users` or `settings`;
- `SELECT` only on `roles`;
- no `DROP`, `ALTER`, `GRANT` or `FILE` anywhere.

Use a separate administrator account for `npm run db:migrate`, `db:seed` (needs `TRUNCATE`) and backups.
