#!/usr/bin/env bash
# Proof for migration 20261116000001_member_age_attestations (founder ruling 2026-11-16, #1900).
#
# Runs ONLY against a throwaway PostgreSQL cluster it creates in a temp directory, on a private socket and port, and removes
# it afterwards. It never reads DATABASE_URL and never connects to any other database.
#
# It applies the REAL migration and rollback files and checks:
#   1  the migration applies;
#   2  an adult attestation, and a minor WITH supervision, are recorded;
#   3  a minor WITHOUT supervision is refused by the database (CHECK);
#   4  any other band (e.g. an under-13 answer) is refused by the database (CHECK): there is no row shape for it;
#   5  append-only: UPDATE is refused, DELETE is refused while the member exists, TRUNCATE is refused;
#   6  erasing the member removes their attestations with them (ON DELETE CASCADE through the guard);
#   7  the previous reader is unaffected: the members table itself is unchanged and usable;
#   8  the DESTRUCTIVE schema rollback REFUSES while any attestation exists, and leaves the data intact;
#   9  with no attestation, the schema rollback is clean;
#  10  re-applying the migration is safe.
# Exit status 0 only if every check holds.
set -euo pipefail
export LC_ALL=C LANG=C
here="$(cd "$(dirname "$0")/../.." && pwd)"
mig="$here/database/migrations/20261116000001_member_age_attestations.sql"
rb="$here/database/migrations/20261116000001_member_age_attestations_rollback.rollback"
tmp="$(mktemp -d)"; port=54331
trap 'pg_ctl -D "$tmp/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
initdb -D "$tmp/data" -U proof -A trust >/dev/null
if ! pg_ctl -D "$tmp/data" -o "-p $port -k $tmp -c listen_addresses=''" -l "$tmp/log" -w start >/dev/null; then
  echo "FAIL: the disposable server did not start. Its log (before cleanup):"
  sed 's/^/  | /' "$tmp/log" 2>/dev/null | tail -20
  exit 1
fi
q() { psql -h "$tmp" -p "$port" -U proof -d "$1" -v ON_ERROR_STOP=1 -q -At "${@:2}"; }
fail() { echo "FAIL: $*"; exit 1; }
expect_error() { local db=$1 sql=$2 pat=$3; if out=$(q "$db" -c "$sql" 2>&1); then fail "expected an error for: $sql"; fi; echo "$out" | grep -q "$pat" || fail "wrong error for: $sql -> $out"; }

echo "cluster: $(postgres --version)"
createdb -h "$tmp" -p "$port" -U proof proof
A="'11111111-1111-4111-8111-111111111111'"; M="'22222222-2222-4222-8222-222222222222'"
q proof -c "CREATE TABLE members (id uuid PRIMARY KEY, username text);
  INSERT INTO members (id, username) VALUES ($A, 'adult'), ($M, 'teen');"

q proof -f "$mig" && echo "PASS 1 migration applies"

q proof -c "INSERT INTO member_age_attestations (member_id, age_band, supervision_attested, studio_path) VALUES ($A, 'adult', false, 'college-essay');
  INSERT INTO member_age_attestations (member_id, age_band, supervision_attested, studio_path) VALUES ($M, 'minor', true, 'college-essay');"
[ "$(q proof -c "SELECT count(*) FROM member_age_attestations")" = 2 ] && echo "PASS 2 adult and supervised minor recorded"

expect_error proof "INSERT INTO member_age_attestations (member_id, age_band, supervision_attested) VALUES ($M, 'minor', false)" "member_age_attestations_minor_supervised"
echo "PASS 3 a minor without supervision is refused"

expect_error proof "INSERT INTO member_age_attestations (member_id, age_band, supervision_attested) VALUES ($M, 'under_13', true)" "check constraint"
expect_error proof "INSERT INTO member_age_attestations (member_id, age_band, supervision_attested, studio_path) VALUES ($A, 'adult', false, 'Bad Path')" "check constraint"
echo "PASS 4 no row shape for an under-13 answer (or a malformed door)"

expect_error proof "UPDATE member_age_attestations SET supervision_attested = false" "append-only"
expect_error proof "DELETE FROM member_age_attestations WHERE member_id = $M" "removed only with their member"
expect_error proof "TRUNCATE member_age_attestations" "may not be truncated"
[ "$(q proof -c "SELECT count(*) FROM member_age_attestations")" = 2 ] || fail "rows changed by refused statements"
echo "PASS 5 append-only: update, delete-while-member-exists and truncate refused"

q proof -c "DELETE FROM members WHERE id = $M"
[ "$(q proof -c "SELECT count(*) FROM member_age_attestations WHERE member_id = $M")" = 0 ] || fail "erasure left attestations"
[ "$(q proof -c "SELECT count(*) FROM member_age_attestations WHERE member_id = $A")" = 1 ] || fail "erasure touched another member"
echo "PASS 6 erasing a member removes their attestations (and only theirs)"

q proof -c "INSERT INTO members (id, username) VALUES ($M, 'teen-again'); UPDATE members SET username = 'adult2' WHERE id = $A;"
[ "$(q proof -c "SELECT count(*) FROM members")" = 2 ] || fail "members unusable"
echo "PASS 7 the previous reader's members table is unchanged and usable"

expect_error proof "$(cat "$rb")" "refusing destructive rollback"
[ "$(q proof -c "SELECT count(*) FROM member_age_attestations")" = 1 ] || fail "data lost after refused rollback"
echo "PASS 8 the destructive schema rollback refuses while attestations exist; data intact"

createdb -h "$tmp" -p "$port" -U proof clean
q clean -c "CREATE TABLE members (id uuid PRIMARY KEY); CREATE TABLE schema_migrations (filename text PRIMARY KEY); INSERT INTO schema_migrations VALUES ('20261116000001_member_age_attestations.sql');"
q clean -f "$mig"; q clean -f "$rb"
[ "$(q clean -c "SELECT to_regclass('member_age_attestations') IS NULL")" = t ] || fail "clean rollback left the table"
[ "$(q clean -c "SELECT count(*) FROM schema_migrations")" = 0 ] || fail "clean rollback left its ledger row"
echo "PASS 9 with no attestation, the schema rollback is clean, and it removes its own ledger row"

q proof -f "$mig" && echo "PASS 10 re-applying the migration is safe"
echo "ALL PASS ($(postgres --version))"
