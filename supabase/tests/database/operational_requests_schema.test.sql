begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(53);

select has_table('public', 'requests', 'requests table exists');
select has_table(
  'public',
  'request_comments',
  'request comments table exists'
);
select has_table('public', 'request_events', 'request events table exists');

select columns_are(
  'public',
  'requests',
  array[
    'id',
    'organization_id',
    'title',
    'description',
    'request_type',
    'priority',
    'status',
    'requester_id',
    'assignee_id',
    'due_at',
    'created_at',
    'updated_at'
  ],
  'requests has only the Phase 2A columns'
);
select columns_are(
  'public',
  'request_comments',
  array[
    'id',
    'organization_id',
    'request_id',
    'author_id',
    'body',
    'created_at',
    'updated_at'
  ],
  'request comments has only the Phase 2A columns'
);
select columns_are(
  'public',
  'request_events',
  array[
    'id',
    'organization_id',
    'request_id',
    'actor_id',
    'event_type',
    'metadata',
    'created_at'
  ],
  'request events has only the Phase 2A columns'
);

select col_is_pk('public', 'requests', 'id', 'requests.id is the primary key');
select col_is_pk(
  'public',
  'request_comments',
  'id',
  'request_comments.id is the primary key'
);
select col_is_pk(
  'public',
  'request_events',
  'id',
  'request_events.id is the primary key'
);

select ok(
  (select column_default like '%gen_random_uuid%'
   from information_schema.columns
   where table_schema = 'public' and table_name = 'requests' and column_name = 'id')
  and (select column_default like '%general%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'requests' and column_name = 'request_type')
  and (select column_default like '%normal%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'requests' and column_name = 'priority')
  and (select column_default like '%open%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'requests' and column_name = 'status')
  and (select column_default like '%auth.uid%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'requests' and column_name = 'requester_id')
  and (select column_default like '%now%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'requests' and column_name = 'created_at')
  and (select column_default like '%now%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'requests' and column_name = 'updated_at'),
  'requests has the approved defaults'
);
select ok(
  (select column_default like '%gen_random_uuid%'
   from information_schema.columns
   where table_schema = 'public' and table_name = 'request_comments' and column_name = 'id')
  and (select column_default like '%auth.uid%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'request_comments' and column_name = 'author_id')
  and (select column_default like '%now%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'request_comments' and column_name = 'created_at')
  and (select column_default like '%now%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'request_comments' and column_name = 'updated_at'),
  'request comments has the approved defaults'
);
select ok(
  (select column_default like '%gen_random_uuid%'
   from information_schema.columns
   where table_schema = 'public' and table_name = 'request_events' and column_name = 'id')
  and (select column_default like '%{}%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'request_events' and column_name = 'metadata')
  and (select column_default like '%now%'
       from information_schema.columns
       where table_schema = 'public' and table_name = 'request_events' and column_name = 'created_at'),
  'request events has the approved defaults'
);

select results_eq(
  $$
    select constraint_name::text
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'requests'
      and constraint_type = 'CHECK'
    order by constraint_name
  $$,
  $$values
    ('requests_description_check'::text),
    ('requests_priority_check'::text),
    ('requests_request_type_check'::text),
    ('requests_status_check'::text),
    ('requests_title_check'::text)
  $$,
  'requests has the approved check constraints'
);
select results_eq(
  $$
    select constraint_name::text
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'request_comments'
      and constraint_type = 'CHECK'
    order by constraint_name
  $$,
  $$values ('request_comments_body_check'::text)$$,
  'request comments has the approved body constraint'
);
select results_eq(
  $$
    select constraint_name::text
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'request_events'
      and constraint_type = 'CHECK'
    order by constraint_name
  $$,
  $$values
    ('request_events_event_type_check'::text),
    ('request_events_metadata_object_check'::text)
  $$,
  'request events has the approved check constraints'
);

select results_eq(
  $$
    select constraint_name::text
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'requests'
      and constraint_type = 'FOREIGN KEY'
    order by constraint_name
  $$,
  $$values
    ('requests_organization_assignee_fkey'::text),
    ('requests_organization_id_fkey'::text),
    ('requests_organization_requester_fkey'::text)
  $$,
  'requests has only the approved foreign keys'
);
select results_eq(
  $$
    select constraint_name::text
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'request_comments'
      and constraint_type = 'FOREIGN KEY'
    order by constraint_name
  $$,
  $$values
    ('request_comments_organization_author_fkey'::text),
    ('request_comments_organization_request_fkey'::text)
  $$,
  'request comments has only the approved foreign keys'
);
select results_eq(
  $$
    select constraint_name::text
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'request_events'
      and constraint_type = 'FOREIGN KEY'
    order by constraint_name
  $$,
  $$values
    ('request_events_organization_actor_fkey'::text),
    ('request_events_organization_request_fkey'::text)
  $$,
  'request events has only the approved foreign keys'
);

select ok(
  (select pg_get_constraintdef(oid)
   from pg_constraint
   where conname = 'requests_organization_requester_fkey')
    like '%FOREIGN KEY (organization_id, requester_id)%organization_memberships(organization_id, user_id)%',
  'request requester references an organization membership composite key'
);
select ok(
  (select pg_get_constraintdef(oid)
   from pg_constraint
   where conname = 'requests_organization_assignee_fkey')
    like '%FOREIGN KEY (organization_id, assignee_id)%organization_memberships(organization_id, user_id)%',
  'request assignee references an organization membership composite key'
);
select ok(
  (select pg_get_constraintdef(oid)
   from pg_constraint
   where conname = 'request_comments_organization_request_fkey')
    like '%FOREIGN KEY (organization_id, request_id)%requests(organization_id, id)%',
  'comment request references an organization request composite key'
);
select ok(
  (select pg_get_constraintdef(oid)
   from pg_constraint
   where conname = 'request_comments_organization_author_fkey')
    like '%FOREIGN KEY (organization_id, author_id)%organization_memberships(organization_id, user_id)%',
  'comment author references an organization membership composite key'
);
select ok(
  (select pg_get_constraintdef(oid)
   from pg_constraint
   where conname = 'request_events_organization_request_fkey')
    like '%FOREIGN KEY (organization_id, request_id)%requests(organization_id, id)%',
  'event request references an organization request composite key'
);
select ok(
  (select pg_get_constraintdef(oid)
   from pg_constraint
   where conname = 'request_events_organization_actor_fkey')
    like '%FOREIGN KEY (organization_id, actor_id)%organization_memberships(organization_id, user_id)%',
  'event actor references an organization membership composite key'
);

select has_index(
  'public',
  'requests',
  'requests_organization_id_id_key',
  'requests organization and id pair is uniquely indexed'
);
select has_index(
  'public',
  'requests',
  'requests_organization_created_at_idx',
  'requests organization timeline is indexed'
);
select has_index(
  'public',
  'requests',
  'requests_organization_status_created_at_idx',
  'requests organization status timeline is indexed'
);
select has_index(
  'public',
  'requests',
  'requests_organization_requester_created_at_idx',
  'requests requester timeline is indexed'
);
select has_index(
  'public',
  'requests',
  'requests_organization_assignee_created_at_idx',
  'requests assignee timeline is indexed'
);
select has_index(
  'public',
  'request_comments',
  'request_comments_organization_request_created_at_idx',
  'request comment timeline is indexed'
);
select has_index(
  'public',
  'request_comments',
  'request_comments_organization_author_idx',
  'request comment authors are indexed'
);
select has_index(
  'public',
  'request_events',
  'request_events_organization_request_created_at_idx',
  'request event timeline is indexed'
);
select has_index(
  'public',
  'request_events',
  'request_events_organization_actor_idx',
  'request event actors are indexed'
);

select results_eq(
  $$select relrowsecurity from pg_class where oid = 'public.requests'::regclass$$,
  array[true],
  'requests has RLS enabled'
);
select results_eq(
  $$select relrowsecurity from pg_class where oid = 'public.request_comments'::regclass$$,
  array[true],
  'request comments has RLS enabled'
);
select results_eq(
  $$select relrowsecurity from pg_class where oid = 'public.request_events'::regclass$$,
  array[true],
  'request events has RLS enabled'
);

select results_eq(
  $$
    select count(*)
    from information_schema.column_privileges
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name = 'requests'
  $$,
  array[0::bigint],
  'anon has no request privileges'
);
select results_eq(
  $$
    select count(*)
    from information_schema.column_privileges
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name = 'request_comments'
  $$,
  array[0::bigint],
  'anon has no request comment privileges'
);
select results_eq(
  $$
    select count(*)
    from information_schema.column_privileges
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name = 'request_events'
  $$,
  array[0::bigint],
  'anon has no request event privileges'
);

select results_eq(
  $$
    select
      privilege_type::text,
      string_agg(column_name::text, ',' order by ordinal_position)
    from information_schema.column_privileges
    join information_schema.columns
      using (table_schema, table_name, column_name)
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'requests'
    group by privilege_type
    order by privilege_type
  $$,
  $$values
    ('INSERT'::text, 'organization_id,title,description,request_type,priority,status,assignee_id,due_at'::text),
    ('SELECT'::text, 'id,organization_id,title,description,request_type,priority,status,requester_id,assignee_id,due_at,created_at,updated_at'::text),
    ('UPDATE'::text, 'title,description,request_type,priority,status,assignee_id,due_at'::text)
  $$,
  'authenticated request privileges are limited to approved columns'
);
select results_eq(
  $$
    select
      privilege_type::text,
      string_agg(column_name::text, ',' order by ordinal_position)
    from information_schema.column_privileges
    join information_schema.columns
      using (table_schema, table_name, column_name)
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'request_comments'
    group by privilege_type
    order by privilege_type
  $$,
  $$values
    ('INSERT'::text, 'organization_id,request_id,body'::text),
    ('SELECT'::text, 'id,organization_id,request_id,author_id,body,created_at,updated_at'::text),
    ('UPDATE'::text, 'body'::text)
  $$,
  'authenticated request comment privileges are limited to approved columns'
);
select results_eq(
  $$
    select
      privilege_type::text,
      string_agg(column_name::text, ',' order by ordinal_position)
    from information_schema.column_privileges
    join information_schema.columns
      using (table_schema, table_name, column_name)
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'request_events'
    group by privilege_type
    order by privilege_type
  $$,
  $$values
    ('SELECT'::text, 'id,organization_id,request_id,actor_id,event_type,metadata,created_at'::text)
  $$,
  'authenticated request event privileges are read-only'
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
  '51000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'schema-owner@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);

insert into public.organizations (id, name, slug, created_by)
values (
  '52000000-0000-0000-0000-000000000001',
  'Schema Test Organization',
  'schema-test-organization',
  '51000000-0000-0000-0000-000000000001'
);

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status
)
values (
  '52000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  'owner',
  'active'
);

insert into public.requests (
  id,
  organization_id,
  title,
  description,
  requester_id
)
values (
  '53000000-0000-0000-0000-000000000001',
  '52000000-0000-0000-0000-000000000001',
  'Valid request',
  'Valid request description.',
  '51000000-0000-0000-000000000001'
);

select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, requester_id, status
    ) values (
      '52000000-0000-0000-0000-000000000001',
      'Invalid status',
      'Constraint test.',
      '51000000-0000-0000-0000-000000000001',
      'pending'
    )
  $$,
  '23514',
  null,
  'invalid request status is rejected'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, requester_id, priority
    ) values (
      '52000000-0000-0000-0000-000000000001',
      'Invalid priority',
      'Constraint test.',
      '51000000-0000-0000-0000-000000000001',
      'critical'
    )
  $$,
  '23514',
  null,
  'invalid request priority is rejected'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, requester_id, request_type
    ) values (
      '52000000-0000-0000-0000-000000000001',
      'Invalid request type',
      'Constraint test.',
      '51000000-0000-0000-0000-000000000001',
      'unknown'
    )
  $$,
  '23514',
  null,
  'invalid request type is rejected'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, requester_id
    ) values (
      '52000000-0000-0000-0000-000000000001',
      '   ',
      'Constraint test.',
      '51000000-0000-0000-0000-000000000001'
    )
  $$,
  '23514',
  null,
  'blank request title is rejected'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, requester_id
    ) values (
      '52000000-0000-0000-0000-000000000001',
      'Blank description',
      '   ',
      '51000000-0000-0000-0000-000000000001'
    )
  $$,
  '23514',
  null,
  'blank request description is rejected'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, requester_id
    ) values (
      '52000000-0000-0000-0000-000000000001',
      repeat('x', 201),
      'Constraint test.',
      '51000000-0000-0000-0000-000000000001'
    )
  $$,
  '23514',
  null,
  'oversized request title is rejected'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, requester_id
    ) values (
      '52000000-0000-0000-0000-000000000001',
      'Oversized description',
      repeat('x', 20001),
      '51000000-0000-0000-0000-000000000001'
    )
  $$,
  '23514',
  null,
  'oversized request description is rejected'
);
select throws_ok(
  $$
    insert into public.request_comments (
      organization_id, request_id, author_id, body
    ) values (
      '52000000-0000-0000-0000-000000000001',
      '53000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      '   '
    )
  $$,
  '23514',
  null,
  'blank request comment is rejected'
);
select throws_ok(
  $$
    insert into public.request_comments (
      organization_id, request_id, author_id, body
    ) values (
      '52000000-0000-0000-0000-000000000001',
      '53000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      repeat('x', 10001)
    )
  $$,
  '23514',
  null,
  'oversized request comment is rejected'
);
select throws_ok(
  $$
    insert into public.request_events (
      organization_id, request_id, actor_id, event_type
    ) values (
      '52000000-0000-0000-0000-000000000001',
      '53000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      'request_deleted'
    )
  $$,
  '23514',
  null,
  'invalid request event type is rejected'
);
select throws_ok(
  $$
    insert into public.request_events (
      organization_id, request_id, actor_id, event_type, metadata
    ) values (
      '52000000-0000-0000-0000-000000000001',
      '53000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      'request_created',
      '[]'::jsonb
    )
  $$,
  '23514',
  null,
  'non-object request event metadata is rejected'
);

select * from finish();
rollback;
