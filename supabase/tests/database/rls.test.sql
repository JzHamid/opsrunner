begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  user_data.id,
  'authenticated',
  'authenticated',
  user_data.email,
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', user_data.display_name),
  now(),
  now()
from (
  values
    ('20000000-0000-0000-0000-000000000001'::uuid, 'owner@example.test', 'Owner'),
    ('20000000-0000-0000-0000-000000000002'::uuid, 'admin@example.test', 'Admin'),
    ('20000000-0000-0000-0000-000000000003'::uuid, 'operator@example.test', 'Operator'),
    ('20000000-0000-0000-0000-000000000004'::uuid, 'viewer@example.test', 'Viewer'),
    ('20000000-0000-0000-0000-000000000005'::uuid, 'outsider@example.test', 'Outsider'),
    ('20000000-0000-0000-0000-000000000006'::uuid, 'candidate-one@example.test', 'Candidate One'),
    ('20000000-0000-0000-0000-000000000007'::uuid, 'candidate-two@example.test', 'Candidate Two'),
    ('20000000-0000-0000-0000-000000000008'::uuid, 'candidate-three@example.test', 'Candidate Three')
) as user_data(id, email, display_name);

insert into public.organizations (id, name, slug, created_by)
values
  (
    '30000000-0000-0000-0000-000000000001',
    'Organization One',
    'organization-one',
    '20000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'Organization Two',
    'organization-two',
    '20000000-0000-0000-0000-000000000005'
  );

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'owner',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'admin',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    'operator',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    'viewer',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000005',
    'owner',
    'active'
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select results_eq(
  'select count(*) from public.profiles',
  array[0::bigint],
  'anonymous users cannot read profiles'
);
select results_eq(
  'select count(*) from public.organizations',
  array[0::bigint],
  'anonymous users cannot read organizations'
);
select results_eq(
  'select count(*) from public.organization_memberships',
  array[0::bigint],
  'anonymous users cannot read memberships'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  'select count(*) from public.profiles',
  array[1::bigint],
  'authenticated users can read only their own profile'
);
select results_eq(
  $$
    update public.profiles
    set display_name = 'Changed by another user'
    where id = '20000000-0000-0000-0000-000000000002'
    returning id
  $$,
  $$select null::uuid where false$$,
  'users cannot update another profile'
);
select results_eq(
  'select count(*) from public.organizations',
  array[1::bigint],
  'an active member reads their organization but not other organizations'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000004',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select count(*)
    from public.organizations
    where id = '30000000-0000-0000-0000-000000000001'
  $$,
  array[1::bigint],
  'an active viewer can read their organization'
);
select results_eq(
  $$
    select count(*)
    from public.organization_memberships
    where organization_id = '30000000-0000-0000-0000-000000000001'
  $$,
  array[4::bigint],
  'an active viewer can read memberships in their organization'
);
select throws_ok(
  $$
    insert into public.organization_memberships (
      organization_id,
      user_id,
      role,
      status
    ) values (
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000006',
      'viewer',
      'active'
    )
  $$,
  '42501',
  null,
  'a viewer cannot insert memberships'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    update public.organization_memberships
    set status = 'suspended'
    where organization_id = '30000000-0000-0000-0000-000000000001'
      and user_id = '20000000-0000-0000-0000-000000000004'
    returning id
  $$,
  $$select null::uuid where false$$,
  'an operator cannot update memberships'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.organization_memberships (
      organization_id,
      user_id,
      role,
      status
    ) values (
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000006',
      'operator',
      'active'
    )
  $$,
  'an owner can insert an allowed membership'
);
select lives_ok(
  $$
    update public.organization_memberships
    set status = 'suspended'
    where organization_id = '30000000-0000-0000-0000-000000000001'
      and user_id = '20000000-0000-0000-0000-000000000006'
  $$,
  'an owner can update an allowed membership'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.organization_memberships (
      organization_id,
      user_id,
      role,
      status
    ) values (
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000007',
      'viewer',
      'active'
    )
  $$,
  'an admin can insert an allowed membership'
);
select lives_ok(
  $$
    update public.organization_memberships
    set role = 'operator'
    where organization_id = '30000000-0000-0000-0000-000000000001'
      and user_id = '20000000-0000-0000-0000-000000000007'
  $$,
  'an admin can update an allowed membership'
);
select throws_ok(
  $$
    update public.organization_memberships
    set role = 'owner'
    where organization_id = '30000000-0000-0000-0000-000000000001'
      and user_id = '20000000-0000-0000-0000-000000000002'
  $$,
  '42501',
  null,
  'a member cannot raise their own role'
);
select throws_ok(
  $$
    insert into public.organization_memberships (
      organization_id,
      user_id,
      role,
      status
    ) values (
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      'owner',
      'active'
    )
  $$,
  '42501',
  null,
  'a normal client request cannot insert the caller as owner'
);
select throws_ok(
  $$
    update public.organization_memberships
    set organization_id = '30000000-0000-0000-0000-000000000002'
    where organization_id = '30000000-0000-0000-0000-000000000001'
      and user_id = '20000000-0000-0000-0000-000000000007'
  $$,
  '42501',
  null,
  'cross-organization membership reassignment is rejected'
);
select throws_ok(
  $$
    insert into public.organization_memberships (
      organization_id,
      user_id,
      role,
      status
    ) values (
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000008',
      'super-admin',
      'active'
    )
  $$,
  '23514',
  null,
  'invalid membership roles are rejected'
);
select throws_ok(
  $$
    insert into public.organization_memberships (
      organization_id,
      user_id,
      role,
      status
    ) values (
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000008',
      'viewer',
      'disabled'
    )
  $$,
  '23514',
  null,
  'invalid membership statuses are rejected'
);

reset role;
select * from finish();
rollback;
