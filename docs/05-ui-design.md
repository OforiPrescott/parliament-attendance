# 5. UI/UX design

## 5.1 Design direction

An institutional, record-of-state feel rather than a generic admin template: a deep-green
sidebar with a gold rule, a warm paper-white canvas, serif display type for titles and figures,
and a narrow kente-inspired stripe as the one decorative motif. Colour is reserved for meaning
(attendance status, party identity, alerts).

| Token | Default | Use |
|---|---|---|
| `--primary` | deep green `#0B5337` | Primary actions, active states, charts |
| `--gold` | `#C4962E` | Accents, current item indicator, eyebrows, highlights |
| `--destructive` | red `#B8241B` | Absences, destructive actions, errors |
| `--sidebar` | near-black green | Navigation, sign-in panel |
| `--background` | warm off-white | Page canvas |

Defaults draw on Ghana's national colours. Replace the values in `src/app/globals.css` with
Parliament's corporate-identity values; every component reads the tokens.

**Type:** Source Serif 4 for page titles, card titles and KPI figures; Public Sans (a typeface
designed for government services) for everything else; tabular figures throughout.

**Logo:** `public/branding/parliament-logo.png` appears on the sign-in panel, the sidebar header
and every PDF report. A neutral placeholder mark is shown until the official file is supplied.

## 5.2 Layout

- **Sidebar** (264 px, collapsible drawer under 1024 px): logo and institution name; grouped
  navigation — Overview, Attendance, Registry, Administration — filtered by the user's role;
  gold indicator on the active item; pending-approval count badge.
- **Top bar:** today's date, user menu (change password, sign out).
- **Content:** max-width 1400 px; page header with gold eyebrow, serif title, description and actions.

## 5.3 Screens

| Screen | Key elements |
|---|---|
| Sign in | Split layout — institutional panel with logo, title and kente stripe; form with show-password, lockout and session messages |
| Dashboard | Period switch (30/90/180 days, 12 months); four KPI cards; pending-actions banner; attendance trend (click a point to open the sitting); status donut; party and region bars; year-on-year comparison; top/bottom MPs and constituencies; absence watch-list |
| Members | Search + party/region/status filters; avatars; party chips; CSV import with validation; add/edit dialog |
| Member profile | Banner with portrait; overall/plenary/committee rates; absence breakdown; monthly chart; membership timeline; committees; recent attendance |
| Parties | Party cards with colour band, seat share and 12-month attendance |
| Constituencies & regions | Searchable table with sitting member, vacancies; regions tab |
| Sittings & calendar | Sittings list with filters; Parliaments/sessions/meetings tab; committees tab with membership editor; bulk generation by weekday |
| Sitting detail | Header with workflow badge and reviewer comments; read-only register; approve / return / reopen; per-row correction requests |
| Attendance capture | Today's sittings; registers to complete (returned first); register grid with P/L/A/E/OD toggles, arrival time, remarks, "mark remaining present", unsaved-change highlight, progress bar, sticky toolbar — designed for a tablet in the Chamber |
| Review & approval | Registers awaiting approval; correction requests (old → new, reason); correction history |
| Reports | Ten report types; filters and quick ranges; sortable table with rate bars; PDF, Excel, print |
| Users & roles | Accounts with status badges (active, locked, temporary password); one-time password dialog; permission matrix |
| Audit trail | Filterable log with expandable before/after JSON; Excel export |
| Settings | Institution, attendance rules, security policy; system information |

## 5.4 Interaction standards

- Every destructive or workflow action uses a confirmation dialog; returns, rejections and reopens require a reason.
- Every mutation shows a toast; validation errors appear under the relevant field.
- Loading skeletons for page transitions; button spinners for actions; idle sign-out warning one minute before the server timeout.
- Leaving the register with unsaved changes prompts the browser's leave-page warning.
- Dialogs trap focus and close on Escape; status pickers are ARIA radio groups; status is shown by label as well as colour.
- Print stylesheet hides navigation so any report or register prints cleanly.
