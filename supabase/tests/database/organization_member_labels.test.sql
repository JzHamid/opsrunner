begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

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
    ('71000000-0000-0000-0000-000000000001'::uuid, 'owner-label@example.test', 'Zara Owner'),
    ('71000000-0000-0000-0000-000000000002'::uuid, 'admin-label@example.test', 'Alex Admin'),
    ('71000000-0000-0000-0000-000000000003'::uuid, 'operator-b@example.test', 'Blake Operator'),
    ('71000000-0000-0000-0000-000000000004'::uuid, 'operator-a@example.test', 'Avery Operator'),
    ('71000000-0000-0000-0000-000000000005'::uuid, 'viewer-label@example.test', 'Visible Viewer'),
    ('71000000-0000-0000-0000-000000000006'::uuid, 'suspended-label@example.test', 'Suspended Operator'),
    ('71000000-0000-0000-0000-000000000007'::uuid, 'blank-label@example.test', '   '),
    ('71000000-0000-0000-0000-000000000008'::uuid, 'owner-other@example.test', 'Other Owner'),
    ('71000000-0000-0000-0000-000000000009'::uuid, 'invited-label@example.test', 'Invited Operator')
) as user_data(id, email, display_name);

insert into public.organizations (id, name, slug, created_by)
values
  (
    '72000000-0000-0000-0000-000000000001',
    'Label Organization',
    'label-organization',
    '71000000-0000-0000-0000-000000000001'
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    'Other Label Organization',
    'other-label-organization',
    '71000000-0000-0000-0000-000000000008'
  );

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status
)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'admin', 'active'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', 'operator', 'active'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004', 'operator', 'active'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000005', 'viewer', 'active'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000006', 'operator', 'suspended'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000007', 'operator', 'active'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000009', 'operator', 'invited'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000008', 'owner', 'active');

select has_function(
  'public',
  'get_organization_member_labels',
  array['uuid'],
  'the member-label function exists with a narrow organization argument'
);

select results_eq(
  $$
    select parameter_name::text collate "C"
    from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'get_organization_member_labels_%'
      and parameter_mode = 'OUT'
    order by ordinal_position
  $$,
  $$
    values
      ('user_id'::text collate "C"),
      ('display_name'::text collate "C"),
      ('role'::text collate "C")
  $$,
  'the function exposes only label-safe columns'
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$
    select *
    from public.get_organization_member_labels(
      '72000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  null,
  'anonymous callers cannot execute the member-label function'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select display_name collate "C", role collate "C"
    from public.get_organization_member_labels(
      '72000000-0000-0000-0000-000000000001'
    )
  $$,
  $$
    values
      ('Zara Owner'::text collate "C", 'owner'::text collate "C"),
      ('Alex Admin'::text collate "C", 'admin'::text collate "C"),
      ('Avery Operator'::text collate "C", 'operator'::text collate "C"),
      ('Blake Operator'::text collate "C", 'operator'::text collate "C"),
      ('Unnamed member'::text collate "C", 'operator'::text collate "C")
  $$,
  'active assignable labels use stable role and display-name ordering'
);

select results_eq(
  $$
    select count(*)
    from public.get_organization_member_labels(
      '72000000-0000-0000-0000-000000000001'
    )
    where display_name in ('Visible Viewer', 'Suspended Operator', 'Invited Operator')
  $$,
  array[0::bigint],
  'viewers and inactive members are not returned'
);

select results_eq(
  $$
    select count(*)
    from public.get_organization_member_labels(
      '72000000-0000-0000-0000-000000000002'
    )
  $$,
  array[0::bigint],
  'an active member receives no cross-organization labels'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-0000-0000-000000000006',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select count(*)
    from public.get_organization_member_labels(
      '72000000-0000-0000-0000-000000000001'
    )
  $$,
  array[0::bigint],
  'a suspended caller receives no labels'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-0000-0000-000000000005',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select count(*)
    from public.get_organization_member_labels(
      '72000000-0000-0000-0000-000000000001'
    )
  $$,
  array[5::bigint],
  'an active viewer caller may resolve safe assignable labels'
);

reset role;
select * from finish();
rollback;
