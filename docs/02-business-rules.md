# 2. Business rules — defaults to confirm with Parliament

The brief did not define these rules, so the system ships with the defaults below. Each is
marked with where it lives, so the Clerk's office can confirm or change it before go-live.
**Items marked ⚠ need a decision from Parliament.**

## 2.1 Attendance statuses

| Status | Meaning | Counts as attended? |
|---|---|---|
| Present | In attendance at the start of the sitting | Yes |
| Late | Arrived after the start; arrival time recorded | Yes |
| Absent | Absent without the Speaker's permission (unexcused) | No — counts toward the absence threshold |
| Excused | Absent with the Speaker's written permission | No — but **not** counted toward the threshold |
| Official duty | Away on parliamentary business (delegation, committee visit, ECOWAS Parliament) | Yes by default (setting) |

- ⚠ **BR-01** Should *Official duty* count as attended in attendance rates? Default: yes. *Settings › Count 'official duty' as attended.*
- ⚠ **BR-02** When is a Member *late*? Default guidance: 30 minutes after the start time. The officer decides at capture; the system records the arrival time. *Settings › Late after.*
- ⚠ **BR-03** Is attendance taken once per sitting, or at both start and end (to capture Members who leave early)? Default: once. A second roll-call would be a phase-2 change.

## 2.2 Who is expected at a sitting

- **BR-04** Plenary and *other* sittings: every Member whose membership period covers the sitting date. A Member sworn in after a by-election appears from their start date.
- **BR-05** Committee meetings: Members on that committee on the sitting date (dated committee membership).
- **BR-06** Suspended Members remain on the register (status *Suspended*) so their absence is recorded with a remark. ⚠ Confirm, or exclude them.
- **BR-07** The Speaker is not a Member for attendance purposes and is not on the register. ⚠ Confirm treatment of the Speaker and Deputy Speakers (who are Members).

## 2.3 Register workflow

```
NOT_STARTED → DRAFT → SUBMITTED → APPROVED
                 ↑         │
                 └─ RETURNED ┘        (APPROVED → DRAFT only by an Administrator "reopen", with reason)
```

- **BR-08** A register can be captured only on or after the sitting date, never for a cancelled sitting.
- **BR-09** Every expected Member must have a status before submission.
- **BR-10** The reviewer cannot be the person who submitted (segregation of duties).
- **BR-11** Returning a register requires a comment, shown to the officer.
- **BR-12** Only APPROVED registers count in dashboards' period figures and in all reports. The "latest sitting" dashboard card also shows a SUBMITTED register, clearly labelled *awaiting approval*.
- **BR-13** Once attendance exists, a sitting's date, type and committee cannot change; it cannot be deleted (it may be marked Adjourned or Cancelled — but an approved sitting cannot be cancelled).

## 2.4 Corrections after approval

- **BR-14** Changes to an approved register are made by a correction request with a written reason (≥ 10 characters), approved by a different user.
- **BR-15** One pending correction per record at a time. If the record changed since the request, approval is refused.
- **BR-16** Original and corrected values are kept in the audit trail permanently.
- ⚠ **BR-17** Is there a deadline after which approved registers can no longer be corrected (e.g. end of the meeting, or once published)? Default: no deadline.

## 2.5 Absence threshold

- **BR-18** Article 97(1)(c) of the 1992 Constitution provides that a Member vacates the seat if absent, without the Speaker's written permission and without reasonable explanation to the Privileges Committee, from fifteen sittings of a meeting. The dashboard watch-list counts **unexcused plenary absences per meeting** against the configurable threshold (default 15), and lists Members from one-third of the threshold upwards. ⚠ The Clerk's office should confirm this interpretation; the system flags, it does not decide.

## 2.6 Membership and history

- **BR-19** Each attendance row stores the Member's party and constituency **at the time of the sitting**, so party and constituency reports remain historically correct after floor-crossing or a new Parliament.
- **BR-20** A membership change closes the current period the day before the effective date and opens a new one.
- **BR-21** Members with any attendance history cannot be deleted; their status is changed instead. Parties, constituencies, committees and meetings in use likewise cannot be deleted.

## 2.7 Security and data

- **BR-22** Passwords: minimum 10 characters with upper and lower case, a number and a symbol; must not contain the username; expire after 90 days (0 = never). *Settings.*
- **BR-23** Lockout after 5 failed sign-ins for 15 minutes; idle sign-out after 30 minutes; maximum session 12 hours. *Settings.*
- **BR-24** Role changes and deactivation end the user's sessions immediately.
- ⚠ **BR-25** Retention: how long are audit logs and attendance records kept? Default: indefinitely. Parliament's records-management policy should set this.
- ⚠ **BR-26** Who may see Members' phone numbers and e-mail addresses? Default: every role with *View MPs*. Narrow if required.
- ⚠ **BR-27** Should approved attendance be published (website / open data)? Not in v1.
