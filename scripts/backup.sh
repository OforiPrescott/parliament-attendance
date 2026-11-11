#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nightly PostgreSQL backup with rotation and integrity check.
#   Schedule (crontab -e, as the service user):
#     30 1 * * * /opt/parliament-attendance/scripts/backup.sh >> /var/log/pa-backup.log 2>&1
#
# Reads DB_* from .env. Credentials are passed via a temporary pgpass file,
# never on the command line (where `ps` could reveal them).
# Optional: BACKUP_DIR, RETENTION_DAYS, BACKUP_GPG_RECIPIENT (encrypt at rest),
#           OFFSITE_RSYNC_TARGET (e.g. backup@dr-site:/srv/pa-backups/)
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/parliament-attendance}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
PGPASSFILE="$(mktemp)"; export PGPASSFILE; trap 'rm -f "$PGPASSFILE"' EXIT
chmod 600 "$PGPASSFILE"
printf "%s:%s:%s:%s:%s\n" "$DB_HOST" "${DB_PORT:-5432}" "$DB_NAME" "$DB_USER" "$DB_PASSWORD" > "$PGPASSFILE"

# pg_dump takes a consistent snapshot without locking users out.
# Custom format (-Fc) is compressed and restorable with pg_restore.
pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -Fc -Z 9 --no-owner --no-privileges -f "$FILE" "$DB_NAME"

pg_restore --list "$FILE" > /dev/null             # integrity check
sha256sum "$FILE" > "$FILE.sha256"

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$FILE.gpg" "$FILE"
  rm -f "$FILE"; FILE="$FILE.gpg"
fi

# Uploaded MP photographs
UPLOADS="${UPLOAD_DIR:-./storage/uploads}"
[ -d "$UPLOADS" ] && tar -czf "$BACKUP_DIR/uploads-${STAMP}.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"

find "$BACKUP_DIR" -type f -mtime +"$RETENTION_DAYS" -delete

if [ -n "${OFFSITE_RSYNC_TARGET:-}" ]; then
  rsync -a --delete-after "$BACKUP_DIR/" "$OFFSITE_RSYNC_TARGET"
fi

echo "$(date -u +%FT%TZ) backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
