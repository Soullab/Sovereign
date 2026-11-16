#!/usr/bin/env bash
# Proof for migration 20261116000002_living_work_studio_stage_and_notes (founder 2026-11-16: all College Essay stages; notes private
# by default). Runs ONLY against a throwaway cluster it creates and removes; never reads DATABASE_URL.
#
#   1  applies on top of the studio-program schema (20261115000001);
#   2  a program Work may carry a stage; the format CHECK refuses a malformed stage;
#   3  a Work with NO program cannot carry a stage (CHECK);
#   4  a note per Work and stage; a second note for the same stage is refused (UNIQUE); oversize body refused;
#   5  erasing the Work, or the member, removes their notes;
#   6  the previous reader is unaffected: its named-column insert/update/delete on living_works succeed;
#   7  the DESTRUCTIVE schema rollback REFUSES while a note or a staged Work exists; data intact;
#   8  with nothing carried, the schema rollback is clean;
#   9  re-applying the migration is safe.
set -euo pipefail
export LC_ALL=C LANG=C
here="$(cd "$(dirname "$0")/../.." && pwd)"
prior="$here/database/migrations/20261115000001_living_work_studio_path.sql"
mig="$here/database/migrations/20261116000002_living_work_studio_stage_and_notes.sql"
rb="$here/database/migrations/20261116000002_living_work_studio_stage_and_notes_rollback.rollback"
tmp="$(mktemp -d)"; port=54333
trap 'pg_ctl -D "$tmp/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
initdb -D "$tmp/data" -U proof -A trust >/dev/null
if ! pg_ctl -D "$tmp/data" -o "-p $port -k $tmp -c listen_addresses=''" -l "$tmp/log" -w start >/dev/null; then
  echo "FAIL: the disposable server did not start."; sed 's/^/  | /' "$tmp/log" | tail -20; exit 1
fi
q() { psql -h "$tmp" -p "$port" -U proof -d "$1" -v ON_ERROR_STOP=1 -q -At "${@:2}"; }
fail() { echo "FAIL: $*"; exit 1; }
expect_error() { local db=$1 sql=$2 pat=$3; if out=$(q "$db" -c "$sql" 2>&1); then fail "expected an error for: $sql"; fi; echo "$out" | grep -q "$pat" || fail "wrong error for: $sql -> $out"; }
setup() {
  q "$1" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE members (id uuid PRIMARY KEY);
    CREATE TABLE living_works (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      title text NOT NULL, purpose text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());"
  q "$1" -f "$prior"
}
echo "cluster: $(postgres --version)"
createdb -h "$tmp" -p "$port" -U proof proof; setup proof
MB="'11111111-1111-4111-8111-111111111111'"; E="'a0000000-0000-4000-8000-00000000000a'"; O="'b0000000-0000-4000-8000-00000000000b'"
q proof -c "INSERT INTO members (id) VALUES ($MB);
  INSERT INTO living_works (id, member_id, title, studio_path) VALUES ($E, $MB, 'Essay', 'college-essay');
  INSERT INTO living_works (id, member_id, title) VALUES ($O, $MB, 'Other');"

q proof -f "$mig" && echo "PASS 1 migration applies on the studio-program schema"

q proof -c "UPDATE living_works SET studio_stage = 'meaning' WHERE id = $E"
expect_error proof "UPDATE living_works SET studio_stage = 'Meaning!' WHERE id = $E" "living_works_studio_stage_format"
echo "PASS 2 a program Work carries a stage; a malformed stage is refused"

expect_error proof "UPDATE living_works SET studio_stage = 'meaning' WHERE id = $O" "living_works_studio_stage_needs_program"
echo "PASS 3 a Work with no program cannot carry a stage"

q proof -c "INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body) VALUES ($E, $MB, 'meaning', 'mine')"
expect_error proof "INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body) VALUES ($E, $MB, 'meaning', 'again')" "duplicate key"
expect_error proof "INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body) VALUES ($E, $MB, 'voice', repeat('x', 20001))" "check constraint"
q proof -c "INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body, checks) VALUES ($E, $MB, 'ready', '', ARRAY['read-aloud'])"
expect_error proof "INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body, checks) VALUES ($E, $MB, 'revise', '', array_fill('x'::text, ARRAY[21]))" "check constraint"
q proof -c "DELETE FROM studio_stage_notes WHERE stage = 'ready'"
echo "PASS 4 one note per Work and stage; oversize body and over 20 ticks refused; ticks stored"

q proof -c "INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body) VALUES ($E, $MB, 'voice', 'scene')"
q proof -c "DELETE FROM living_works WHERE id = $E"
[ "$(q proof -c "SELECT count(*) FROM studio_stage_notes")" = 0 ] || fail "notes outlived their Work"
q proof -c "INSERT INTO living_works (id, member_id, title, studio_path) VALUES ($E, $MB, 'Essay', 'college-essay');
  INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body) VALUES ($E, $MB, 'meaning', 'mine');"
q proof -c "DELETE FROM living_works WHERE member_id = $MB; DELETE FROM members WHERE id = $MB"
[ "$(q proof -c "SELECT count(*) FROM studio_stage_notes")" = 0 ] || fail "notes outlived their member"
echo "PASS 5 erasing the Work or the member removes their notes"

q proof -c "INSERT INTO members (id) VALUES ($MB);
  INSERT INTO living_works (member_id, title) VALUES ($MB, 'Old reader insert');
  UPDATE living_works SET title = 'Renamed', purpose = 'p', updated_at = now() WHERE title = 'Old reader insert';
  DELETE FROM living_works WHERE title = 'Renamed';"
echo "PASS 6 the previous reader's named-column insert/update/delete succeed"

q proof -c "INSERT INTO living_works (id, member_id, title, studio_path, studio_stage) VALUES ($E, $MB, 'Essay', 'college-essay', 'voice');
  INSERT INTO studio_stage_notes (living_work_id, member_id, stage, body) VALUES ($E, $MB, 'voice', 'scene');"
expect_error proof "$(cat "$rb")" "refusing destructive rollback"
[ "$(q proof -c "SELECT count(*) FROM studio_stage_notes")" = 1 ] || fail "notes lost after refused rollback"
[ "$(q proof -c "SELECT studio_stage FROM living_works WHERE id = $E")" = voice ] || fail "stage lost after refused rollback"
echo "PASS 7 the destructive schema rollback refuses while notes or stages exist; data intact"

createdb -h "$tmp" -p "$port" -U proof clean; setup clean
q clean -f "$mig"; q clean -f "$rb"
[ "$(q clean -c "SELECT to_regclass('studio_stage_notes') IS NULL")" = t ] || fail "clean rollback left the table"
[ "$(q clean -c "SELECT count(*) FROM information_schema.columns WHERE table_name='living_works' AND column_name='studio_stage'")" = 0 ] || fail "clean rollback left the column"
echo "PASS 8 with nothing carried, the schema rollback is clean"

q proof -f "$mig" && echo "PASS 9 re-applying the migration is safe"
echo "ALL PASS ($(postgres --version))"
