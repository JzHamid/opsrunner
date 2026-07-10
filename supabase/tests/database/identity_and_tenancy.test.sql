begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'organizations', 'organizations table exists');
select has_table(
  'public',
  'organization_memberships',
  'organization memberships table exists'
);

select columns_are(
  'public',
  'profiles',
  array['id', 'display_name', 'created_at', 'updated_at'],
  'profiles has only the Phase 1B columns'
);
select columns_are(
  'public',
  'organizations',
  array['id', 'name', 'slug', 'created_by', 'created_at', 'updated_at'],
  'organizations has only the Phase 1B columns'
);
select columns_are(
  'public',
  'organization_memberships',
  array[
    'id',
    'organization_id',
    'user_id',
    'role',
    'status',
    'created_at',
    'updated_at'
  ],
  'organization memberships has only the Phase 1B columns'
);

select col_is_pk('public', 'profiles', 'id', 'profiles.id is the primary key');
select col_is_pk(
  'public',
  'organizations',
  'id',
  'organizations.id is the primary key'
);
select col_is_pk(
  'public',
  'organization_memberships',
  'id',
  'organization_memberships.id is the primary key'
);

select has_index(
  'public',
  'profiles',
  'profiles_pkey',
  'profiles.id has a primary-key index'
);
select has_index(
  'public',
  'organizations',
  'organizations_slug_key',
  'organizations.slug has a unique index'
);
select has_index(
  'public',
  'organizations',
  'organizations_created_by_idx',
  'organizations.created_by is indexed'
);
select has_index(
  'public',
  'organization_memberships',
  'organization_memberships_organization_id_idx',
  'membership organization_id is indexed'
);
select has_index(
  'public',
  'organization_memberships',
  'organization_memberships_user_id_idx',
  'membership user_id is indexed'
);
select has_index(
  'public',
  'organization_memberships',
  'organization_memberships_organization_user_key',
  'membership organization and user pair is uniquely indexed'
);
select has_index(
  'public',
  'organization_memberships',
  'organization_memberships_organization_status_idx',
  'membership organization and status are indexed'
);

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
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'phase1b-owner@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Local Owner"}',
  now(),
  now()
);

select results_eq(
  $$
    select display_name
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  $$values ('Local Owner'::text)$$,
  'auth user creation creates only the matching basic profile'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.create_organization('Local Operations', 'local-operations')$$,
  'an authenticated user can create an organization atomically'
);

select results_eq(
  $$
    select created_by
    from public.organizations
    where slug = 'local-operations'
  $$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid)$$,
  'the authenticated caller is recorded as organization creator'
);

select results_eq(
  $$
    select membership.role, membership.status
    from public.organization_memberships as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where organization.slug = 'local-operations'
      and membership.user_id = '10000000-0000-0000-0000-000000000001'
  $$,
  $$values ('owner'::text, 'active'::text)$$,
  'organization creation gives the caller an active owner membership'
);

select throws_ok(
  $$select public.create_organization('', 'missing-name')$$,
  '22023',
  'Organization name is required.',
  'organization creation rejects a blank name'
);

select throws_ok(
  $$select public.create_organization('Missing Slug', '   ')$$,
  '22023',
  'Organization slug is required.',
  'organization creation rejects a blank slug'
);

select throws_ok(
  $$select public.create_organization('Duplicate', 'local-operations')$$,
  '23505',
  'Organization slug already exists.',
  'organization creation rejects a duplicate slug'
);

reset role;
select * from finish();
rollback;
