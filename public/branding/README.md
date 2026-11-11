# Official branding assets

Place Parliament of Ghana's official, high-resolution logo here **before go-live**:

| File | Used for | Spec |
|---|---|---|
| `parliament-logo.png` | Sign-in page, sidebar, PDF report header | Transparent PNG, square, at least 512 × 512 px |
| `favicon.png` | Browser tab icon | Square PNG, 64 × 64 px |

The application never generates, redraws or approximates the official emblem. Until
`parliament-logo.png` is supplied, a neutral placeholder mark is displayed.

Obtain the files from the Public Affairs Directorate / Clerk's office together with the
corporate identity colours, then set those colours in `src/app/globals.css`
(`--primary`, `--gold`, `--sidebar` …) so the whole interface follows the official palette.
