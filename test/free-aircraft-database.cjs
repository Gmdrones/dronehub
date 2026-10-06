// Execute with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
// Uses an isolated PostgreSQL database; never connects to a pilot's account.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  const pilot = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const migration = name => fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8');
  await db.exec(`
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    create table public.account_entitlements (user_id uuid primary key, plan text, role text, status text, courtesy_expires_at timestamptz);
  `);
  await db.exec(migration('20260726044914_account_sync.sql'));
  await db.exec(migration('20260726141235_server_plan_enforcement.sql'));
  // Reproduce the existing permissive write policies, without requiring Realtime.
  const realtime = migration('20260808183000_mission_realtime_sync.sql');
  await db.exec(realtime.slice(realtime.indexOf('drop policy'), realtime.indexOf('create index')));
  await db.exec(migration('20260924200000_enforce_user_records_select_by_plan.sql'));
  await db.exec(migration('20261006025713_enforce_free_aircraft_access.sql'));
  await db.exec(`insert into auth.users values ('${pilot}'), ('${other}');
    insert into public.account_entitlements values ('${pilot}','pro','pilot','active',null), ('${other}','free','pilot','active',null);
    insert into public.user_records (user_id,collection,record_id) values
      ('${pilot}','aircraft','100'), ('${pilot}','aircraft','200'), ('${pilot}','aircraft','300');
    set role authenticated; select set_config('request.jwt.claim.sub','${pilot}',false);`);
  const ids = async () => (await db.query("select record_id from public.user_records where collection='aircraft' order by record_id")).rows.map(row => row.record_id);
  const setPlan = async (plan, expiry = 'null') => db.exec(`reset role; update public.account_entitlements set plan='${plan}', courtesy_expires_at=${expiry} where user_id='${pilot}'; set role authenticated;`);
  assert.deepEqual(await ids(), ['100','200','300']);
  await setPlan('free');
  assert.deepEqual(await ids(), ['100']);
  assert.equal((await db.query("update public.user_records set payload='{}' where record_id='200' returning record_id")).rows.length, 0);
  assert.equal((await db.query("delete from public.user_records where record_id='200' returning record_id")).rows.length, 0);
  await assert.rejects(db.exec(`insert into public.user_records (user_id,collection,record_id) values ('${pilot}','aircraft','050')`), error => error.code === '42501');
  await assert.rejects(db.exec("update public.user_records set record_id='050' where record_id='100'"), error => error.code === '42501');
  await db.exec(`insert into public.user_records (user_id,collection,record_id,payload) values ('${pilot}','aircraft','100','{"modelo":"Editado"}') on conflict (user_id,collection,record_id) do update set payload=excluded.payload;`);
  assert.equal((await db.query("select payload->>'modelo' as model from public.user_records where record_id='100'")).rows[0].model, 'Editado');
  await setPlan('pro', "now()-interval '1 second'");
  assert.deepEqual(await ids(), ['100']);
  await setPlan('pro', "now()+interval '1 day'");
  assert.deepEqual(await ids(), ['100','200','300']);
  await setPlan('free');
  await db.exec("delete from public.user_records where record_id='100'");
  assert.deepEqual(await ids(), ['200']);
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
  assert.deepEqual(await ids(), []);
  await db.exec(`insert into public.user_records (user_id,collection,record_id) values ('${other}','aircraft','100');`);
  await assert.rejects(db.exec(`insert into public.user_records (user_id,collection,record_id) values ('${other}','aircraft','200')`), error => error.code === '42501');
  await assert.rejects(db.exec(`insert into public.user_records (user_id,collection,record_id) values ('${pilot}','aircraft','090')`), error => error.code === '42501');
  assert.deepEqual(await ids(), ['100']);
  await db.exec(`delete from public.user_records where user_id='${other}';`);
  await assert.rejects(db.exec(`insert into public.user_records (user_id,collection,record_id) values ('${other}','aircraft','100'), ('${other}','aircraft','200')`), error => error.code === '42501');
  assert.deepEqual(await ids(), []);
  await db.exec('reset role;');
  assert.equal((await db.query(`select count(*)::int as total from public.user_records where user_id='${pilot}' and collection='aircraft'`)).rows[0].total, 2);
  await db.close();
  console.log('PASS: Pro, Free, expiration, renewal, preservation, SELECT/INSERT/UPDATE/DELETE, upsert, bulk insert and owner isolation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
