/**
 * Drift guard: a table that can block closing an account must be a decision, never an accident.
 *
 * A table whose `member_id` names `members` ON DELETE RESTRICT makes `DELETE FROM members` fail while the member has a
 * row in it. The route's refuse posture is only able to say WHAT is held for the tables in GOVERNED_CONTENT; a missing
 * line costs the member the explanation (the route still refuses, see manuscriptsHeld.test.ts L2), but it was also how a
 * member with a Work and no manuscript used to reach a rolled-back 500 (`living_works`).
 *
 * So every RESTRICT table found in the schema SQL (database/baseline + database/migrations) must be either registered
 * in GOVERNED_CONTENT or listed in ACKNOWLEDGED_UNREGISTERED below. A NEW blocking table therefore fails here until a
 * person registers it or writes it down; a registered table must leave the acknowledged list.
 *
 * ⚠️ ACKNOWLEDGED_UNREGISTERED is a census of the SQL text at the commit that wrote it. Nothing about these tables was
 * adjudicated: not whether a member can reach them without a Work, not whether they hold the member's own words. It
 * only stops the gap from growing unseen. The scan reads explicit `ON DELETE RESTRICT`; a foreign key with no ON DELETE
 * clause (NO ACTION) blocks the same way and is NOT scanned, which is why the route's foreign-key net exists.
 *
 * Source-reading only. Defeat candidates feed the same drift check a registry that forgot a table and SQL with a table
 * the list has never seen, in both the CREATE TABLE and the ALTER TABLE … ADD CONSTRAINT shapes the real SQL uses.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/** Tables with a blocking foreign key that no one has registered. Sorted. Remove a name when it is registered. */
const ACKNOWLEDGED_UNREGISTERED: readonly string[] = [
  'ask_authorization_acts',
  'ask_threads',
  'developmental_observation_standing_events',
  'epistemic_join_records',
  'library_sources',
  'living_work_expressions',
  'living_work_material_considerations',
  'living_work_visuals',
  'manuscript_collections',
  'manuscript_keeps',
  'manuscript_renders',
  'manuscript_revision_authorizations',
  'manuscript_revision_offers',
  'manuscript_source_arrivals',
  'manuscript_working_drafts',
  'practice_fields',
  'proposal_chains',
  'relationship_space_artifacts',
  'relationship_space_messages',
  'relationship_space_notes',
  'relationship_spaces',
  'working_draft_revisions',
  'writer_source_landing_intents',
  'writer_studio_chapter_review_runs',
];

/** Tables whose foreign key to `members(id)` is ON DELETE RESTRICT, read statement by statement from SQL text. */
function blockingTables(sqlTexts: readonly string[]): Set<string> {
  const found = new Set<string>();
  for (const text of sqlTexts) {
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    for (const stmt of code.split(';')) {
      const head = /^\s*(?:CREATE TABLE(?: IF NOT EXISTS)?|ALTER TABLE(?: IF EXISTS)?(?: ONLY)?)\s+(?:"?public"?\.)?"?(\w+)"?/i.exec(stmt);
      if (!head) continue;
      if (/REFERENCES\s+(?:"?public"?\.)?"?members"?\s*\(\s*"?id"?\s*\)\s*ON\s+DELETE\s+RESTRICT/i.test(stmt)) found.add(head[1]);
    }
  }
  return found;
}

/** Tables named in the route's GOVERNED_CONTENT block. */
function registeredTables(routeSource: string): Set<string> {
  const start = routeSource.indexOf('const GOVERNED_CONTENT');
  const block = routeSource.slice(start, routeSource.indexOf('];', start));
  return new Set([...block.matchAll(/\{\s*table:\s*'(\w+)'/g)].map((m) => m[1]));
}

/** Named drift; empty is conforming. */
function drift(sqlTexts: readonly string[], routeSource: string, acknowledged: readonly string[]): string[] {
  const blocking = blockingTables(sqlTexts);
  const registered = registeredTables(routeSource);
  const known = new Set(acknowledged);
  const found: string[] = [];
  for (const t of [...blocking].sort()) {
    if (!registered.has(t) && !known.has(t)) found.push(`blocking-table-neither-registered-nor-acknowledged:${t}`);
  }
  for (const t of acknowledged) {
    if (!blocking.has(t)) found.push(`acknowledged-table-no-longer-blocking-or-renamed:${t}`);
    if (registered.has(t)) found.push(`acknowledged-table-is-now-registered:${t}`);
  }
  return found;
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const MIGRATIONS = fs.readdirSync(path.join(ROOT, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort();
const SQL = [read('database/baseline/0001_baseline_2026-09-01.sql'), ...MIGRATIONS.map((f) => read(`database/migrations/${f}`))];
const ROUTE = read('app/api/members/delete-account/route.ts');

describe('every table that can block account closure is registered or written down', () => {
  it('no drift between the schema SQL, GOVERNED_CONTENT and the acknowledged list', () => {
    expect(drift(SQL, ROUTE, ACKNOWLEDGED_UNREGISTERED)).toEqual([]);
  });

  it('the Work tables the route refuses over are registered, not merely acknowledged', () => {
    const registered = registeredTables(ROUTE);
    for (const t of ['member_manuscripts', 'living_works']) expect({ t, registered: registered.has(t) }).toEqual({ t, registered: true });
  });

  it('the acknowledged list is sorted and has no duplicates', () => {
    expect([...ACKNOWLEDGED_UNREGISTERED]).toEqual([...new Set([...ACKNOWLEDGED_UNREGISTERED].sort())]);
  });
});

describe('lethality — the same drift check fails each defeat candidate', () => {
  it('a registry that forgot living_works (the route before this fix)', () => {
    const candidate = ROUTE.replace("  { table: 'living_works', column: 'member_id', label: 'your writing' },\n", '');
    expect(candidate).not.toBe(ROUTE);
    expect(drift(SQL, candidate, ACKNOWLEDGED_UNREGISTERED)).toContain(
      'blocking-table-neither-registered-nor-acknowledged:living_works',
    );
  });

  it('a new migration whose CREATE TABLE adds a RESTRICT foreign key to members', () => {
    const migration = 'CREATE TABLE IF NOT EXISTS brand_new_notes (\n  id UUID PRIMARY KEY,\n  member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT\n);';
    expect(drift([...SQL, migration], ROUTE, ACKNOWLEDGED_UNREGISTERED)).toEqual([
      'blocking-table-neither-registered-nor-acknowledged:brand_new_notes',
    ]);
  });

  it('a new migration in the ALTER TABLE … ADD CONSTRAINT shape the baseline uses', () => {
    const migration = 'ALTER TABLE ONLY "public"."brand_new_notes"\n    ADD CONSTRAINT "brand_new_notes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT;';
    expect(drift([...SQL, migration], ROUTE, ACKNOWLEDGED_UNREGISTERED)).toEqual([
      'blocking-table-neither-registered-nor-acknowledged:brand_new_notes',
    ]);
  });

  it('a commented-out foreign key is not a table that blocks', () => {
    const migration = '-- member_id UUID REFERENCES members(id) ON DELETE RESTRICT\nCREATE TABLE IF NOT EXISTS commented_only (id UUID PRIMARY KEY);';
    expect(drift([...SQL, migration], ROUTE, ACKNOWLEDGED_UNREGISTERED)).toEqual([]);
  });

  it('a cascade foreign key is not a table that blocks', () => {
    const migration = 'CREATE TABLE IF NOT EXISTS cascades (id UUID PRIMARY KEY, member_id UUID REFERENCES members(id) ON DELETE CASCADE);';
    expect(drift([...SQL, migration], ROUTE, ACKNOWLEDGED_UNREGISTERED)).toEqual([]);
  });

  it('an acknowledged list that outlives its table, or keeps a table the route now registers', () => {
    expect(drift(SQL, ROUTE, [...ACKNOWLEDGED_UNREGISTERED, 'a_table_that_was_dropped'])).toContain(
      'acknowledged-table-no-longer-blocking-or-renamed:a_table_that_was_dropped',
    );
    expect(drift(SQL, ROUTE, [...ACKNOWLEDGED_UNREGISTERED, 'living_works'])).toContain(
      'acknowledged-table-is-now-registered:living_works',
    );
  });

  it('a scanner that reads only the baseline would miss a table added by a later migration', () => {
    const baselineOnly = [SQL[0]];
    const migration = 'CREATE TABLE brand_new_notes (member_id UUID REFERENCES members(id) ON DELETE RESTRICT);';
    expect(drift([...baselineOnly, migration], ROUTE, ACKNOWLEDGED_UNREGISTERED)).toContain(
      'blocking-table-neither-registered-nor-acknowledged:brand_new_notes',
    );
    // …and the real run reads migrations too: the migration-only tables are all found.
    expect(blockingTables(SQL).has('writer_source_landing_intents')).toBe(true);
    expect(blockingTables(baselineOnly).has('writer_source_landing_intents')).toBe(false);
  });
});
