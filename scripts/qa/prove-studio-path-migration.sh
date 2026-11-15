#!/usr/bin/env bash
# Proof for migration 20261115000001_living_work_studio_path (PR #2298, review 2026-11-15).
#
# Runs ONLY against a throwaway PostgreSQL cluster it creates in a temp directory, on a private socket and port,
# and removes it afterwards. It never reads DATABASE_URL and never connects to any other database.
#
# It applies the REAL migration and rollback files and checks:
#   1  the migration applies;
#   2  a registered program can be set once (the member's Begin);
#   3  F1  an unregistered program is refused by the database (FK);
#   4  F2  once chosen, clearing or changing the program is refused (trigger); the same id again is fine;
#   5  APP-ONLY ROLLBACK is lossless: the previous reader's statements (named columns, never studio_path) all succeed
#          and the stored program is preserved;
#   6  the DESTRUCTIVE schema rollback REFUSES while any Work carries a program, and leaves the data intact;
#   7  with no program carried, the schema rollback is clean;
#   8  re-applying the migration is safe.
# Exit status 0 only if every check holds.
set -euo pipefail
# PostgreSQL 16 on macOS refuses to start without a valid locale ("postmaster became multithreaded during startup").
# A fixed C locale for this throwaway cluster only; nothing here depends on collation.
export LC_ALL=C LANG=C
here="$(cd "$(dirname "$0")/../.." && pwd)"
mig="$here/database/migrations/20261115000001_living_work_studio_path.sql"
rb="$here/database/migrations/20261115000001_living_work_studio_path_rollback.rollback"
tmp="$(mktemp -d)"; port=54329
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

pgv=$(postgres --version); echo "cluster: $pgv"
createdb -h "$tmp" -p "$port" -U proof proof
q proof -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE members (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  CREATE TABLE living_works (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    title text NOT NULL, purpose text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
  INSERT INTO members (id) VALUES ('11111111-1111-4111-8111-111111111111');
  INSERT INTO living_works (id, member_id, title) VALUES
    ('a0000000-0000-4000-8000-00000000000a','11111111-1111-4111-8111-111111111111','Essay'),
    ('b0000000-0000-4000-8000-00000000000b','11111111-1111-4111-8111-111111111111','Other'),
    ('c0000000-0000-4000-8000-00000000000c','11111111-1111-4111-8111-111111111111','Gone');"
A="'a0000000-0000-4000-8000-00000000000a'"; B="'b0000000-0000-4000-8000-00000000000b'"

q proof -f "$mig" && echo "PASS 1 migration applies"

q proof -c "UPDATE living_works SET studio_path='college-essay' WHERE id=$A"
[ "$(q proof -c "SELECT studio_path FROM living_works WHERE id=$A")" = college-essay ] && echo "PASS 2 a registered program is set once"

expect_error proof "UPDATE living_works SET studio_path='grant-proposal' WHERE id=$B" "living_works_studio_path_program_fk"
echo "PASS 3 F1 an unregistered program is refused by the database"

expect_error proof "UPDATE living_works SET studio_path=NULL WHERE id=$A" "fixed once chosen"
q proof -c "INSERT INTO studio_programs (id) VALUES ('second-program')"
expect_error proof "UPDATE living_works SET studio_path='second-program' WHERE id=$A" "fixed once chosen"
q proof -c "UPDATE living_works SET studio_path='college-essay' WHERE id=$A"
[ "$(q proof -c "SELECT studio_path FROM living_works WHERE id=$A")" = college-essay ] && echo "PASS 4 F2 clearing and changing refused; the same id is fine"

q proof -c "INSERT INTO living_works (member_id, title) VALUES ('11111111-1111-4111-8111-111111111111','Old reader insert');
  UPDATE living_works SET title='Essay renamed', purpose='a spark', updated_at=now() WHERE id=$A;
  DELETE FROM living_works WHERE id='c0000000-0000-4000-8000-00000000000c';"
[ "$(q proof -c "SELECT title||'|'||studio_path FROM living_works WHERE id=$A")" = 'Essay renamed|college-essay' ] || fail "program not preserved under old-reader writes"
[ "$(q proof -c "SELECT studio_path IS NULL FROM living_works WHERE title='Old reader insert'")" = t ] || fail "old-reader insert"
echo "PASS 5 app-only rollback is lossless: old-reader insert/update/delete succeed and the program is preserved"

expect_error proof "$(cat "$rb")" "refusing destructive rollback"
[ "$(q proof -c "SELECT count(*) FROM information_schema.columns WHERE table_name='living_works' AND column_name='studio_path'")" = 1 ] || fail "column gone after refused rollback"
[ "$(q proof -c "SELECT studio_path FROM living_works WHERE id=$A")" = college-essay ] || fail "program lost after refused rollback"
echo "PASS 6 the destructive schema rollback refuses while a Work carries a program; data intact"

createdb -h "$tmp" -p "$port" -U proof clean
q clean -c "CREATE EXTENSION pgcrypto; CREATE TABLE members (id uuid PRIMARY KEY);
  CREATE TABLE living_works (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES members(id), title text NOT NULL, purpose text, updated_at timestamptz DEFAULT now());"
q clean -f "$mig"; q clean -f "$rb"
[ "$(q clean -c "SELECT count(*) FROM information_schema.columns WHERE table_name='living_works' AND column_name='studio_path'")" = 0 ] || fail "clean rollback left the column"
[ "$(q clean -c "SELECT to_regclass('studio_programs') IS NULL")" = t ] || fail "clean rollback left studio_programs"
echo "PASS 7 with no program carried, the schema rollback is clean"

q proof -f "$mig" && echo "PASS 8 re-applying the migration is safe"
echo "ALL PASS ($pgv)"
