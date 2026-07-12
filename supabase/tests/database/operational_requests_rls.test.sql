begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(49);

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
    ('61000000-0000-0000-0000-000000000001'::uuid, 'owner-a@example.test', 'Owner A'),
    ('61000000-0000-0000-0000-000000000002'::uuid, 'admin-a@example.test', 'Admin A'),
    ('61000000-0000-0000-0000-000000000003'::uuid, 'requester-a@example.test', 'Requester A'),
    ('61000000-0000-0000-0000-000000000004'::uuid, 'assignee-a@example.test', 'Assignee A'),
    ('61000000-0000-0000-0000-000000000005'::uuid, 'operator-a@example.test', 'Operator A'),
    ('61000000-0000-0000-0000-000000000006'::uuid, 'viewer-a@example.test', 'Viewer A'),
    ('61000000-0000-0000-0000-000000000007'::uuid, 'suspended-a@example.test', 'Suspended A'),
    ('61000000-0000-0000-0000-000000000008'::uuid, 'invited-a@example.test', 'Invited A'),
    ('61000000-0000-0000-0000-000000000009'::uuid, 'owner-b@example.test', 'Owner B'),
    ('61000000-0000-0000-0000-000000000010'::uuid, 'operator-b@example.test', 'Operator B')
) as user_data(id, email, display_name);

insert into public.organizations (id, name, slug, created_by)
values
  (
    '62000000-0000-0000-0000-000000000001',
    'Operations A',
    'operations-a',
    '61000000-0000-0000-0000-000000000001'
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    'Operations B',
    'operations-b',
    '61000000-0000-0000-0000-000000000009'
  );

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status
)
values
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'admin', 'active'),
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', 'operator', 'active'),
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000004', 'operator', 'active'),
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000005', 'operator', 'active'),
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000006', 'viewer', 'active'),
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000007', 'operator', 'suspended'),
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000008', 'operator', 'invited'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000009', 'owner', 'active'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000010', 'operator', 'active');

insert into public.requests (
  id,
  organization_id,
  title,
  description,
  requester_id,
  assignee_id
)
values
  (
    '63000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    'Organization A request',
    'A request used for organization A policy tests.',
    '61000000-0000-0000-0000-000000000003',
    '61000000-0000-0000-0000-000000000004'
  ),
  (
    '63000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    'Organization B request',
    'A request used for organization B policy tests.',
    '61000000-0000-0000-0000-000000000010',
    null
  );

insert into public.request_comments (
  id,
  organization_id,
  request_id,
  author_id,
  body
)
values
  (
    '64000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000003',
    'Initial organization A comment.'
  ),
  (
    '64000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000010',
    'Initial organization B comment.'
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$select count(*) from public.requests$$,
  '42501',
  null,
  'anonymous users cannot read requests'
);
select throws_ok(
  $$select count(*) from public.request_comments$$,
  '42501',
  null,
  'anonymous users cannot read request comments'
);
select throws_ok(
  $$select count(*) from public.request_events$$,
  '42501',
  null,
  'anonymous users cannot read request events'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000006',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select count(*)
    from public.requests
    where organization_id = '62000000-0000-0000-0000-000000000001'
  $$,
  array[1::bigint],
  'an active viewer can read requests in their organization'
);
select results_eq(
  $$
    select count(*)
    from public.requests
    where organization_id = '62000000-0000-0000-0000-000000000002'
  $$,
  array[0::bigint],
  'an active member cannot read another organization request'
);
select results_eq(
  $$
    select count(*)
    from public.request_comments
  $$,
  array[1::bigint],
  'an active viewer can read comments in their organization'
);
select results_eq(
  $$
    select count(*)
    from public.request_events
  $$,
  array[1::bigint],
  'an active viewer can read events in their organization'
);
select throws_ok(
  $$
    insert into public.requests (organization_id, title, description)
    values (
      '62000000-0000-0000-0000-000000000001',
      'Viewer request',
      'Viewers cannot create requests.'
    )
  $$,
  '42501',
  null,
  'viewers cannot create requests'
);
select results_eq(
  $$
    update public.requests
    set status = 'blocked'
    where id = '63000000-0000-0000-0000-000000000001'
    returning id
  $$,
  $$select null::uuid where false$$,
  'viewers cannot update requests'
);
select throws_ok(
  $$
    insert into public.request_comments (organization_id, request_id, body)
    values (
      '62000000-0000-0000-0000-000000000001',
      '63000000-0000-0000-0000-000000000001',
      'Viewers cannot add comments.'
    )
  $$,
  '42501',
  null,
  'viewers cannot add comments'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.requests (
      organization_id,
      title,
      description,
      assignee_id
    )
    values (
      '62000000-0000-0000-0000-000000000001',
      'Operator-created request',
      'The requester and event actor are derived from the session.',
      '61000000-0000-0000-0000-000000000004'
    )
  $$,
  'an active operator can create a request'
);
select results_eq(
  $$
    select requester_id
    from public.requests
    where title = 'Operator-created request'
  $$,
  $$values ('61000000-0000-0000-0000-000000000003'::uuid)$$,
  'requester identity is derived from auth.uid()'
);
select results_eq(
  $$
    select event.actor_id, event.metadata
    from public.request_events as event
    join public.requests as request
      on request.organization_id = event.organization_id
      and request.id = event.request_id
    where request.title = 'Operator-created request'
      and event.event_type = 'request_created'
  $$,
  $$values (
    '61000000-0000-0000-0000-000000000003'::uuid,
    '{}'::jsonb
  )$$,
  'request creation records the authenticated actor with empty safe metadata'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id,
      title,
      description,
      requester_id
    )
    values (
      '62000000-0000-0000-0000-000000000001',
      'Forged requester',
      'The browser cannot choose a requester.',
      '61000000-0000-0000-0000-000000000005'
    )
  $$,
  '42501',
  null,
  'requester identity cannot be forged'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000007',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.requests (organization_id, title, description)
    values (
      '62000000-0000-0000-0000-000000000001',
      'Suspended request',
      'Suspended memberships cannot create requests.'
    )
  $$,
  '42501',
  null,
  'suspended memberships cannot create requests'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000008',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000008","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.requests (organization_id, title, description)
    values (
      '62000000-0000-0000-0000-000000000001',
      'Invited request',
      'Invited memberships cannot create requests.'
    )
  $$,
  '42501',
  null,
  'invited memberships cannot create requests'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, assignee_id
    ) values (
      '62000000-0000-0000-0000-000000000001',
      'Viewer assignment',
      'Viewers cannot be assigned operational requests.',
      '61000000-0000-0000-0000-000000000006'
    )
  $$,
  '42501',
  null,
  'a viewer cannot be assigned a request'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, assignee_id
    ) values (
      '62000000-0000-0000-0000-000000000001',
      'Suspended assignment',
      'Suspended members cannot be assigned operational requests.',
      '61000000-0000-0000-0000-000000000007'
    )
  $$,
  '42501',
  null,
  'a suspended member cannot be assigned a request'
);
select throws_ok(
  $$
    insert into public.requests (
      organization_id, title, description, assignee_id
    ) values (
      '62000000-0000-0000-0000-000000000001',
      'Cross-organization assignment',
      'Another organization member cannot be assigned.',
      '61000000-0000-0000-0000-000000000010'
    )
  $$,
  '42501',
  null,
  'a cross-organization member cannot be assigned a request'
);
select throws_ok(
  $$
    update public.requests
    set organization_id = '62000000-0000-0000-0000-000000000002'
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'users cannot move requests between organizations'
);
select lives_ok(
  $$
    update public.requests
    set
      title = 'Requester-updated request',
      description = 'The requester can update the request content.',
      request_type = 'meeting',
      priority = 'high',
      status = 'in_progress',
      due_at = now() + interval '1 day'
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  'an operator requester can update approved request fields'
);
select throws_ok(
  $$
    update public.requests
    set assignee_id = '61000000-0000-0000-0000-000000000005'
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'Operators cannot reassign requests.',
  'an operator requester cannot reassign a request'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000004',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.requests
    set
      priority = 'urgent',
      status = 'blocked',
      due_at = now() + interval '2 days'
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  'an operator assignee can update execution fields'
);
select throws_ok(
  $$
    update public.requests
    set title = 'Assignee changed title'
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'Assignees may update only priority, status, and due date.',
  'an operator assignee cannot update requester-owned content'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000005',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    update public.requests
    set status = 'completed'
    where id = '63000000-0000-0000-0000-000000000001'
    returning id
  $$,
  $$select null::uuid where false$$,
  'an unrelated operator cannot update a request'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.requests
    set
      title = 'Owner-updated request',
      assignee_id = '61000000-0000-0000-0000-000000000005'
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  'an owner can update and reassign an organization request'
);
select throws_ok(
  $$
    update public.requests
    set assignee_id = '61000000-0000-0000-0000-000000000006'
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'Assignee must be an active owner, admin, or operator.',
  'an owner cannot assign a request to a viewer'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.requests
    set
      description = 'The admin can update any mutable business field.',
      assignee_id = '61000000-0000-0000-0000-000000000004'
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  'an admin can update and reassign an organization request'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    delete from public.requests
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'normal authenticated clients cannot delete requests'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.request_comments (organization_id, request_id, body)
    values (
      '62000000-0000-0000-0000-000000000001',
      '63000000-0000-0000-0000-000000000001',
      'Operator-authored comment.'
    )
  $$,
  'an active operator can add a request comment'
);
select results_eq(
  $$
    select author_id
    from public.request_comments
    where body = 'Operator-authored comment.'
  $$,
  $$values ('61000000-0000-0000-0000-000000000003'::uuid)$$,
  'comment author identity is derived from auth.uid()'
);
select throws_ok(
  $$
    insert into public.request_comments (
      organization_id, request_id, author_id, body
    ) values (
      '62000000-0000-0000-0000-000000000001',
      '63000000-0000-0000-0000-000000000001',
      '61000000-0000-0000-0000-000000000005',
      'Forged comment author.'
    )
  $$,
  '42501',
  null,
  'comment author identity cannot be forged'
);
select throws_ok(
  $$
    insert into public.request_comments (organization_id, request_id, body)
    values (
      '62000000-0000-0000-0000-000000000001',
      '63000000-0000-0000-0000-000000000002',
      'Cross-organization request reference.'
    )
  $$,
  '23503',
  null,
  'comments cannot reference another organization request'
);
select lives_ok(
  $$
    update public.request_comments
    set body = 'Operator updated their own comment.'
    where id = '64000000-0000-0000-0000-000000000001'
  $$,
  'an operator can edit their own comment'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000005',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    update public.request_comments
    set body = 'Another operator edit.'
    where id = '64000000-0000-0000-0000-000000000001'
    returning id
  $$,
  $$select null::uuid where false$$,
  'an operator cannot edit another user comment'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.request_comments
    set body = 'Owner-reviewed comment.'
    where id = '64000000-0000-0000-0000-000000000001'
  $$,
  'an owner can edit a comment in their organization'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.request_comments
    set body = 'Admin-reviewed comment.'
    where id = '64000000-0000-0000-0000-000000000001'
  $$,
  'an admin can edit a comment in their organization'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    delete from public.request_comments
    where id = '64000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'normal authenticated clients cannot delete request comments'
);

select results_eq(
  $$
    select metadata
    from public.request_events
    where request_id = '63000000-0000-0000-0000-000000000001'
      and event_type = 'request_status_changed'
      and metadata = '{"from":"open","to":"in_progress"}'::jsonb
  $$,
  $$values ('{"from":"open","to":"in_progress"}'::jsonb)$$,
  'status changes create an allowlisted request event'
);
select results_eq(
  $$
    select metadata
    from public.request_events
    where request_id = '63000000-0000-0000-0000-000000000001'
      and event_type = 'request_priority_changed'
      and metadata = '{"from":"normal","to":"high"}'::jsonb
  $$,
  $$values ('{"from":"normal","to":"high"}'::jsonb)$$,
  'priority changes create an allowlisted request event'
);
select results_eq(
  $$
    select metadata
    from public.request_events
    where request_id = '63000000-0000-0000-0000-000000000001'
      and event_type = 'request_assignee_changed'
      and metadata = jsonb_build_object(
        'from',
        '61000000-0000-0000-0000-000000000004'::uuid,
        'to',
        '61000000-0000-0000-0000-000000000005'::uuid
      )
  $$,
  $$values (
    jsonb_build_object(
      'from',
      '61000000-0000-0000-0000-000000000004'::uuid,
      'to',
      '61000000-0000-0000-0000-000000000005'::uuid
    )
  )$$,
  'assignee changes create an allowlisted request event'
);
select lives_ok(
  $$
    update public.requests
    set status = status
    where id = '63000000-0000-0000-0000-000000000001'
  $$,
  'a no-op request update completes normally'
);
select results_eq(
  $$
    select count(*)
    from public.request_events
    where request_id = '63000000-0000-0000-0000-000000000001'
  $$,
  array[7::bigint],
  'a no-op request update creates no event'
);
select throws_ok(
  $$
    insert into public.request_events (
      organization_id, request_id, actor_id, event_type, metadata
    ) values (
      '62000000-0000-0000-0000-000000000001',
      '63000000-0000-0000-0000-000000000001',
      '61000000-0000-0000-0000-000000000001',
      'request_created',
      '{}'::jsonb
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot insert request events directly'
);
select throws_ok(
  $$
    update public.request_events
    set metadata = metadata
    where request_id = '63000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'authenticated clients cannot update request events directly'
);
select throws_ok(
  $$
    delete from public.request_events
    where request_id = '63000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'authenticated clients cannot delete request events directly'
);
select results_eq(
  $$
    select count(*)
    from public.request_events as event
    cross join lateral jsonb_object_keys(event.metadata) as metadata_key(key)
    where metadata_key.key not in ('from', 'to')
  $$,
  array[0::bigint],
  'event metadata contains only allowlisted keys'
);

reset role;

update public.organization_memberships
set status = 'suspended'
where organization_id = '62000000-0000-0000-0000-000000000001'
  and user_id = '61000000-0000-0000-0000-000000000003';

select results_eq(
  $$
    select event.actor_id
    from public.request_events as event
    join public.requests as request
      on request.organization_id = event.organization_id
      and request.id = event.request_id
    where request.title = 'Operator-created request'
      and event.event_type = 'request_created'
  $$,
  $$values ('61000000-0000-0000-0000-000000000003'::uuid)$$,
  'suspension preserves historical event attribution'
);

select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000003',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select
      (select count(*) from public.requests),
      (select count(*) from public.request_comments),
      (select count(*) from public.request_events)
  $$,
  $$values (0::bigint, 0::bigint, 0::bigint)$$,
  'a suspended member loses access to all operational request records'
);

reset role;
select * from finish();
rollback;
