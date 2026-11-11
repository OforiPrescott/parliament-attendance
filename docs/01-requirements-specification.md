# 1. System Requirements Specification

**System:** MP Attendance Management System (AMS)
**Client:** Parliament of Ghana — Office of the Clerk to Parliament
**Version:** 1.0 (proposal build) · November 2026

## 1.1 Purpose

The AMS replaces paper and spreadsheet attendance registers with a single, secure, auditable
record of Members' attendance at plenary sittings, committee meetings and other official
parliamentary business. It produces dashboards and reports for the Clerk's office, the
Leadership and the public-affairs function, and gives early warning when a Member approaches
the constitutional absence threshold.

## 1.2 Scope

In scope: MP registry and membership history; parties, regions and constituencies; the
parliamentary calendar (Parliament → Session → Meeting → Sitting) and committees; register
capture, review and approval; post-approval corrections; dashboards; ten report types with PDF
and Excel export; users, roles and audit trail; settings; backup and restore.

Out of scope for v1 (candidates for phase 2): biometric or card-reader capture; MP self-service
portal; publishing attendance to the public website; SMS/e-mail notifications; integration with
the Hansard / Votes and Proceedings system; single sign-on with Parliament's directory.

## 1.3 Stakeholders and roles

| Role | Typical holder | Responsibilities in the system |
|---|---|---|
| System Administrator | ICT Directorate | Users, roles, settings, reference data, reopening registers |
| Attendance Officer | Table Office / committee clerks | Capture registers, submit, request corrections |
| Reviewer / Approver | Senior Table Office staff, Deputy Clerk | Approve or return registers and corrections; manage calendar and committees |
| Management | Clerk, Deputy Clerks, Leadership offices | Dashboards, reports, audit trail |
| Report Viewer | Public Affairs, Research | Dashboards and reports (read-only) |

The full permission matrix is in `src/lib/permissions.ts` and on the **Users › Role permissions** screen.

## 1.4 Functional requirements

| ID | Requirement | Module | Status |
|---|---|---|---|
| FR-01 | Users sign in with username and password; passwords are hashed (bcrypt, cost 12) | Login | Built |
| FR-02 | Accounts lock after a configurable number of failed sign-ins for a configurable period | Login | Built |
| FR-03 | Sessions expire after idle and absolute timeouts; users can sign out; password change signs out other devices | Login | Built |
| FR-04 | New and reset accounts receive a one-time password that must be changed at first sign-in; optional password expiry | Login | Built |
| FR-05 | Dashboard shows total MPs, present/absent at the latest sitting, attendance rate with change vs previous period | Dashboard | Built |
| FR-06 | Dashboard shows attendance trend, status mix, party and region comparison, year-on-year monthly comparison | Dashboard | Built |
| FR-07 | Dashboard lists highest/lowest attending MPs and constituencies, and an absence watch-list for the current meeting | Dashboard | Built |
| FR-08 | Create, edit and search MPs with name, photograph, parliamentary ID, party, constituency, region, term and status | MPs | Built |
| FR-09 | Record membership changes (floor-crossing, new Parliament, by-election) without losing history | MPs | Built |
| FR-10 | Leaving office (resigned, deceased, vacated, former) closes the seat and committee places from a given date | MPs | Built |
| FR-11 | Bulk import/update of the MP roster from CSV with validation preview | MPs | Built |
| FR-12 | Manage political parties (name, abbreviation, colour, active) | Parties | Built |
| FR-13 | Manage regions and constituencies; show sitting member and vacancies | Constituencies | Built |
| FR-14 | Manage Parliaments, sessions and meetings; mark the current Parliament | Sittings | Built |
| FR-15 | Schedule plenary, committee and other sittings; generate all plenary sittings for a meeting by weekday | Sittings | Built |
| FR-16 | Manage committees and dated committee membership (chair, vice-chair, ranking member, member) | Sittings | Built |
| FR-17 | Capture attendance per sitting: Present, Late (with arrival time), Absent, Excused, Official duty, plus remarks | Capture | Built |
| FR-18 | The expected list is computed automatically: all serving MPs for plenary; committee members for committee meetings | Capture | Built |
| FR-19 | Duplicate attendance for the same MP and sitting is impossible (database unique key + upsert) | Capture | Built |
| FR-20 | Registers can be saved as drafts and must be complete before submission | Capture | Built |
| FR-21 | Reviewers approve or return submitted registers with comments; reviewers cannot approve their own submissions | Review | Built |
| FR-22 | Approved registers are locked; changes go through a correction request approved by a different user | Review | Built |
| FR-23 | Administrators may reopen an approved register with a recorded reason | Review | Built |
| FR-24 | Daily, weekly, monthly, quarterly and annual reports | Reports | Built |
| FR-25 | Individual MP, party, constituency, region and sitting reports | Reports | Built |
| FR-26 | Filter reports by date range, sitting type, MP, party, region, constituency and sitting | Reports | Built |
| FR-27 | Export reports to PDF (branded) and Excel | Reports | Built |
| FR-28 | Manage users, roles, activation, unlock and password reset | Users | Built |
| FR-29 | Append-only audit trail of sign-ins, changes (before/after), approvals and exports; searchable and exportable | Audit | Built |
| FR-30 | Configure institution name, attendance rules and security policy | Settings | Built |
| FR-31 | Automated, verified, rotated database and photograph backups with documented restore | Operations | Built (scripts) |

## 1.5 Non-functional requirements

| ID | Category | Requirement | How it is met |
|---|---|---|---|
| NFR-01 | Security | OWASP Top 10 controls | Parameterised SQL; React output escaping + CSP; origin-checked mutations + SameSite=Strict cookies; RBAC on every API route |
| NFR-02 | Security | Least privilege | Five roles; segregation of duties enforced in code; DB user without DROP/GRANT; audit table INSERT-only (recommended grant) |
| NFR-03 | Security | Secure file handling | Photos ≤ 2 MB, type detected from file signature, random names, stored outside the web root, served only to signed-in users |
| NFR-04 | Integrity | No lost or duplicated records | Foreign keys, unique keys, CHECK constraints, transactions with row locks on register save/submit |
| NFR-05 | Integrity | Historical accuracy | Party and constituency snapshotted on each attendance row |
| NFR-06 | Accountability | Full traceability | Every write is audited with user, IP, user agent, timestamp and changed values |
| NFR-07 | Availability | Recoverable within 4 hours, data loss ≤ 24 hours | Nightly backups (configurable), integrity-checked, off-site copy option, restore script |
| NFR-08 | Performance | Dashboard < 2 s and register save < 1 s for 276 MPs and 10 years of data | Indexed queries (≈ 600k attendance rows over a decade); aggregation in SQL |
| NFR-09 | Usability | Usable on desktop, tablet and phone | Responsive layout; register optimised for tablet capture in the Chamber |
| NFR-10 | Accessibility | WCAG 2.1 AA intent | Keyboard-navigable dialogs with focus trap, ARIA roles on status pickers, colour never the only signal |
| NFR-11 | Maintainability | Modular, typed, documented | TypeScript strict mode, one module per domain, shared UI components, unit tests |
| NFR-12 | Data protection | Ghana Data Protection Act, 2012 (Act 843) | Minimal personal data; access restricted by role; audit trail; retention set by policy (see business rules) |

## 1.6 Assumptions and constraints

- Ghana observes UTC+0 all year; the system stores and displays dates in UTC.
- The official logo and corporate colours will be supplied by Parliament (see `public/branding/README.md`).
- The real MP roster will be imported via CSV; the bundled seed data is fictional and for demonstration only.
- Hosting is on Parliament's own infrastructure or an approved Ghanaian data centre (Node.js 20+, PostgreSQL 13+).
