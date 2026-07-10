create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (btrim(name) <> ''),
  constraint organizations_slug_not_blank check (btrim(slug) <> '')
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_organization_user_key
    unique (organization_id, user_id),
  constraint organization_memberships_role_check
    check (role in ('owner', 'admin', 'operator', 'viewer')),
  constraint organization_memberships_status_check
    check (status in ('invited', 'active', 'suspended'))
);

create index organizations_created_by_idx
  on public.organizations (created_by);

create index organization_memberships_organization_id_idx
  on public.organization_memberships (organization_id);

create index organization_memberships_user_id_idx
  on public.organization_memberships (user_id);

create index organization_memberships_organization_status_idx
  on public.organization_memberships (organization_id, status);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_display_name text;
begin
  new_display_name := nullif(
    left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 120),
    ''
  );

  insert into public.profiles (id, display_name)
  values (new.id, new_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function private.is_active_organization_member(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.can_insert_organization_membership(
  target_organization_id uuid,
  target_user_id uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.organization_memberships as actor_membership
      where actor_membership.organization_id = target_organization_id
        and actor_membership.user_id = (select auth.uid())
        and actor_membership.status = 'active'
        and actor_membership.role in ('owner', 'admin')
    )
    and not (
      target_user_id = (select auth.uid())
      and target_role = 'owner'
    );
$$;

create or replace function private.can_update_organization_membership(
  target_membership_id uuid,
  proposed_organization_id uuid,
  proposed_user_id uuid,
  proposed_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as target_membership
    join public.organization_memberships as actor_membership
      on actor_membership.organization_id = target_membership.organization_id
    where target_membership.id = target_membership_id
      and actor_membership.user_id = (select auth.uid())
      and actor_membership.status = 'active'
      and actor_membership.role in ('owner', 'admin')
      and target_membership.organization_id = proposed_organization_id
      and target_membership.user_id = proposed_user_id
      and (
        target_membership.user_id <> (select auth.uid())
        or target_membership.role = proposed_role
      )
  );
$$;

create or replace function public.create_organization(
  organization_name text,
  organization_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_name text := btrim(organization_name);
  clean_slug text := btrim(organization_slug);
  new_organization_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if clean_name is null or clean_name = '' then
    raise exception 'Organization name is required.' using errcode = '22023';
  end if;

  if clean_slug is null or clean_slug = '' then
    raise exception 'Organization slug is required.' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (clean_name, clean_slug, caller_id)
  returning id into new_organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    new_organization_id,
    caller_id,
    'owner',
    'active'
  );

  return new_organization_id;
exception
  when unique_violation then
    raise exception 'Organization slug already exists.' using errcode = '23505';
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function private.set_updated_at();

create trigger create_profile_after_auth_user_insert
after insert on auth.users
for each row execute function private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Active members can read their organizations"
on public.organizations
for select
to authenticated
using (private.is_active_organization_member(id));

create policy "Active members can read organization memberships"
on public.organization_memberships
for select
to authenticated
using (private.is_active_organization_member(organization_id));

create policy "Owners and admins can add organization memberships"
on public.organization_memberships
for insert
to authenticated
with check (
  private.can_insert_organization_membership(
    organization_id,
    user_id,
    role
  )
);

create policy "Owners and admins can update organization memberships"
on public.organization_memberships
for update
to authenticated
using (
  private.can_update_organization_membership(
    id,
    organization_id,
    user_id,
    role
  )
)
with check (
  private.can_update_organization_membership(
    id,
    organization_id,
    user_id,
    role
  )
);

revoke all on public.profiles from anon, authenticated;
revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_memberships from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.organizations to authenticated;

grant select on public.organization_memberships to authenticated;
grant insert (
  organization_id,
  user_id,
  role,
  status
) on public.organization_memberships to authenticated;
grant update (role, status) on public.organization_memberships to authenticated;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.is_active_organization_member(uuid)
  from public, anon, authenticated;
revoke all on function private.can_insert_organization_membership(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.can_update_organization_membership(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function private.is_active_organization_member(uuid)
  to authenticated;
grant execute on function private.can_insert_organization_membership(uuid, uuid, text)
  to authenticated;
grant execute on function private.can_update_organization_membership(uuid, uuid, uuid, text)
  to authenticated;

revoke all on function public.create_organization(text, text)
  from public, anon, authenticated;
grant execute on function public.create_organization(text, text)
  to authenticated;
