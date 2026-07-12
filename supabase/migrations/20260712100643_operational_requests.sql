create table public.requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  title text not null,
  description text not null,
  request_type text not null default 'general',
  priority text not null default 'normal',
  status text not null default 'open',
  requester_id uuid not null default auth.uid(),
  assignee_id uuid,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_organization_id_id_key
    unique (organization_id, id),
  constraint requests_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on update restrict
    on delete cascade,
  constraint requests_organization_requester_fkey
    foreign key (organization_id, requester_id)
    references public.organization_memberships (organization_id, user_id)
    on update restrict
    on delete restrict,
  constraint requests_organization_assignee_fkey
    foreign key (organization_id, assignee_id)
    references public.organization_memberships (organization_id, user_id)
    on update restrict
    on delete restrict,
  constraint requests_title_check
    check (btrim(title) <> '' and char_length(title) <= 200),
  constraint requests_description_check
    check (btrim(description) <> '' and char_length(description) <= 20000),
  constraint requests_request_type_check
    check (
      request_type in (
        'general',
        'client_update',
        'onboarding',
        'access',
        'billing',
        'document',
        'follow_up',
        'meeting',
        'automation'
      )
    ),
  constraint requests_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint requests_status_check
    check (
      status in ('open', 'in_progress', 'blocked', 'completed', 'cancelled')
    )
);

create table public.request_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  author_id uuid not null default auth.uid(),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_comments_organization_request_fkey
    foreign key (organization_id, request_id)
    references public.requests (organization_id, id)
    on update restrict
    on delete cascade,
  constraint request_comments_organization_author_fkey
    foreign key (organization_id, author_id)
    references public.organization_memberships (organization_id, user_id)
    on update restrict
    on delete restrict,
  constraint request_comments_body_check
    check (btrim(body) <> '' and char_length(body) <= 10000)
);

create table public.request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  actor_id uuid,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint request_events_organization_request_fkey
    foreign key (organization_id, request_id)
    references public.requests (organization_id, id)
    on update restrict
    on delete cascade,
  constraint request_events_organization_actor_fkey
    foreign key (organization_id, actor_id)
    references public.organization_memberships (organization_id, user_id)
    on update restrict
    on delete restrict,
  constraint request_events_event_type_check
    check (
      event_type in (
        'request_created',
        'request_status_changed',
        'request_priority_changed',
        'request_assignee_changed'
      )
    ),
  constraint request_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index requests_organization_created_at_idx
  on public.requests (organization_id, created_at desc);

create index requests_organization_status_created_at_idx
  on public.requests (organization_id, status, created_at desc);

create index requests_organization_requester_created_at_idx
  on public.requests (organization_id, requester_id, created_at desc);

create index requests_organization_assignee_created_at_idx
  on public.requests (organization_id, assignee_id, created_at desc)
  where assignee_id is not null;

create index request_comments_organization_request_created_at_idx
  on public.request_comments (organization_id, request_id, created_at, id);

create index request_comments_organization_author_idx
  on public.request_comments (organization_id, author_id);

create index request_events_organization_request_created_at_idx
  on public.request_events (organization_id, request_id, created_at, id);

create index request_events_organization_actor_idx
  on public.request_events (organization_id, actor_id)
  where actor_id is not null;

create or replace function private.active_organization_role(
  target_organization_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.organization_memberships as membership
  where membership.organization_id = target_organization_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
  limit 1;
$$;

create or replace function private.is_assignable_request_member(
  target_organization_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_organization_member(target_organization_id)
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = target_organization_id
        and membership.user_id = target_user_id
        and membership.status = 'active'
        and membership.role in ('owner', 'admin', 'operator')
    );
$$;

create or replace function private.guard_request_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
begin
  if caller_id is null then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.requester_id is distinct from old.requester_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Request identity fields cannot be changed.'
      using errcode = '42501';
  end if;

  caller_role := private.active_organization_role(old.organization_id);

  if caller_role in ('owner', 'admin') then
    if new.assignee_id is distinct from old.assignee_id
      and new.assignee_id is not null
      and not private.is_assignable_request_member(
        old.organization_id,
        new.assignee_id
      )
    then
      raise exception 'Assignee must be an active owner, admin, or operator.'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if caller_role <> 'operator'
    or (
      caller_id is distinct from old.requester_id
      and caller_id is distinct from old.assignee_id
    )
  then
    raise exception 'This request cannot be updated by the current user.'
      using errcode = '42501';
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    raise exception 'Operators cannot reassign requests.'
      using errcode = '42501';
  end if;

  if caller_id = old.requester_id then
    return new;
  end if;

  if new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.request_type is distinct from old.request_type
  then
    raise exception 'Assignees may update only priority, status, and due date.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.record_request_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_actor_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.request_events (
      organization_id,
      request_id,
      actor_id,
      event_type,
      metadata
    )
    values (
      new.organization_id,
      new.id,
      event_actor_id,
      'request_created',
      '{}'::jsonb
    );

    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.request_events (
      organization_id,
      request_id,
      actor_id,
      event_type,
      metadata
    )
    values (
      new.organization_id,
      new.id,
      event_actor_id,
      'request_status_changed',
      pg_catalog.jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  if new.priority is distinct from old.priority then
    insert into public.request_events (
      organization_id,
      request_id,
      actor_id,
      event_type,
      metadata
    )
    values (
      new.organization_id,
      new.id,
      event_actor_id,
      'request_priority_changed',
      pg_catalog.jsonb_build_object('from', old.priority, 'to', new.priority)
    );
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.request_events (
      organization_id,
      request_id,
      actor_id,
      event_type,
      metadata
    )
    values (
      new.organization_id,
      new.id,
      event_actor_id,
      'request_assignee_changed',
      pg_catalog.jsonb_build_object(
        'from',
        old.assignee_id,
        'to',
        new.assignee_id
      )
    );
  end if;

  return new;
end;
$$;

create trigger requests_10_guard_update
before update on public.requests
for each row execute function private.guard_request_update();

create trigger requests_20_set_updated_at
before update on public.requests
for each row execute function private.set_updated_at();

create trigger request_comments_set_updated_at
before update on public.request_comments
for each row execute function private.set_updated_at();

create trigger requests_record_events
after insert or update on public.requests
for each row execute function private.record_request_events();

alter table public.requests enable row level security;
alter table public.request_comments enable row level security;
alter table public.request_events enable row level security;

create policy "Active members can read organization requests"
on public.requests
for select
to authenticated
using (private.is_active_organization_member(organization_id));

create policy "Operators and managers can create organization requests"
on public.requests
for insert
to authenticated
with check (
  requester_id = (select auth.uid())
  and private.active_organization_role(organization_id)
    in ('owner', 'admin', 'operator')
  and (
    assignee_id is null
    or private.is_assignable_request_member(organization_id, assignee_id)
  )
);

create policy "Participants and managers can update organization requests"
on public.requests
for update
to authenticated
using (
  private.active_organization_role(organization_id) in ('owner', 'admin')
  or (
    private.active_organization_role(organization_id) = 'operator'
    and (select auth.uid()) in (requester_id, assignee_id)
  )
)
with check (
  private.active_organization_role(organization_id) in ('owner', 'admin')
  or (
    private.active_organization_role(organization_id) = 'operator'
    and (select auth.uid()) in (requester_id, assignee_id)
  )
);

create policy "Active members can read organization request comments"
on public.request_comments
for select
to authenticated
using (private.is_active_organization_member(organization_id));

create policy "Operators and managers can create request comments"
on public.request_comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and private.active_organization_role(organization_id)
    in ('owner', 'admin', 'operator')
);

create policy "Authors and managers can update request comments"
on public.request_comments
for update
to authenticated
using (
  private.active_organization_role(organization_id) in ('owner', 'admin')
  or (
    private.active_organization_role(organization_id) = 'operator'
    and author_id = (select auth.uid())
  )
)
with check (
  private.active_organization_role(organization_id) in ('owner', 'admin')
  or (
    private.active_organization_role(organization_id) = 'operator'
    and author_id = (select auth.uid())
  )
);

create policy "Active members can read organization request events"
on public.request_events
for select
to authenticated
using (private.is_active_organization_member(organization_id));

revoke all on public.requests from public, anon, authenticated;
revoke all on public.request_comments from public, anon, authenticated;
revoke all on public.request_events from public, anon, authenticated;

grant select on public.requests to authenticated;
grant insert (
  organization_id,
  title,
  description,
  request_type,
  priority,
  status,
  assignee_id,
  due_at
) on public.requests to authenticated;
grant update (
  title,
  description,
  request_type,
  priority,
  status,
  assignee_id,
  due_at
) on public.requests to authenticated;

grant select on public.request_comments to authenticated;
grant insert (
  organization_id,
  request_id,
  body
) on public.request_comments to authenticated;
grant update (body) on public.request_comments to authenticated;

grant select on public.request_events to authenticated;

revoke all on function private.active_organization_role(uuid)
  from public, anon, authenticated;
revoke all on function private.is_assignable_request_member(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.guard_request_update()
  from public, anon, authenticated;
revoke all on function private.record_request_events()
  from public, anon, authenticated;

grant execute on function private.active_organization_role(uuid)
  to authenticated;
grant execute on function private.is_assignable_request_member(uuid, uuid)
  to authenticated;
