#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Restore a backup made by backup.sh.
#   scripts/restore.sh /var/backups/parliament-attendance/<file>.dump[.gpg] [target_db]
# Restores into target_db (default: <DB_NAME>_restore) so the live database
# is untouched until you have verified the copy. To go live, stop the app,
# point DB_NAME at the restored database (or rename), then start the app.
# RESTORE_USER needs CREATEDB (or create the target database beforehand).
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

SRC="${1:?Usage: restore.sh <backup.dump|.dump.gpg> [target_db]}"
TARGET="${2:-${DB_NAME}_restore}"
[ -f "$SRC.sha256" ] && sha256sum -c "$SRC.sha256"

RUSER="${RESTORE_USER:-$DB_USER}"
PGPASSFILE="$(mktemp)"; export PGPASSFILE
TMPDUMP=""
trap 'rm -f "$PGPASSFILE" ${TMPDUMP:+"$TMPDUMP"}' EXIT
chmod 600 "$PGPASSFILE"
printf "%s:%s:*:%s:%s\n" "$DB_HOST" "${DB_PORT:-5432}" "$RUSER" "${RESTORE_PASSWORD:-$DB_PASSWORD}" > "$PGPASSFILE"
CONN=(-h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$RUSER")

if ! psql "${CONN[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$TARGET'" | grep -q 1; then
  createdb "${CONN[@]}" -E UTF8 -T template0 "$TARGET"
fi

case "$SRC" in
  *.gpg) TMPDUMP="$(mktemp)"; gpg --batch --decrypt --output "$TMPDUMP" "$SRC"; DUMP="$TMPDUMP" ;;
  *)     DUMP="$SRC" ;;
esac
pg_restore "${CONN[@]}" -d "$TARGET" --no-owner --no-privileges --exit-on-error "$DUMP"

psql "${CONN[@]}" -d "$TARGET" -c \
  "SELECT (SELECT COUNT(*) FROM mps) mps, (SELECT COUNT(*) FROM sittings) sittings, (SELECT COUNT(*) FROM attendance) attendance, (SELECT MAX(created_at) FROM audit_logs) last_audit"
echo "Restored into '$TARGET'. Verify the counts above before switching the application to it."
