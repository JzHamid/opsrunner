create or replace function public.get_organization_member_labels(
  target_organization_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.user_id,
    coalesce(
      nullif(pg_catalog.btrim(profile.display_name), ''),
      'Unnamed member'
    ) as display_name,
    membership.role
  from public.organization_memberships as membership
  left join public.profiles as profile
    on profile.id = membership.user_id
  where target_organization_id is not null
    and private.is_active_organization_member(target_organization_id)
    and membership.organization_id = target_organization_id
    and membership.status = 'active'
    and membership.role in ('owner', 'admin', 'operator')
  order by
    case membership.role
      when 'owner' then 1
      when 'admin' then 2
      when 'operator' then 3
      else 4
    end,
    coalesce(
      nullif(pg_catalog.btrim(profile.display_name), ''),
      'Unnamed member'
    ) collate "C",
    membership.user_id;
$$;

revoke all on function public.get_organization_member_labels(uuid)
  from public, anon, authenticated;

grant execute on function public.get_organization_member_labels(uuid)
  to authenticated;
