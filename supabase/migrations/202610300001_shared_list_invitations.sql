begin;
create function public.invite_shared_watchlist_members(requested_list uuid, invited_user_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (select 1 from public.watch_wheels where id = requested_list and owner_id = actor and kind = 'list') then
    raise exception 'Only the list owner can invite members';
  end if;
  if exists (select 1 from unnest(coalesce(invited_user_ids, '{}')) invited where invited is null or (invited <> actor and (not public.are_friends(actor, invited) or public.users_blocked(actor, invited)))) then
    raise exception 'Only unblocked friends can be invited';
  end if;
  insert into public.watch_wheel_members(wheel_id,user_id)
  select requested_list, invited from unnest(coalesce(invited_user_ids, '{}')) invited where invited <> actor
  on conflict do nothing;
end $$;
revoke all on function public.invite_shared_watchlist_members(uuid, uuid[]) from public, anon;
grant execute on function public.invite_shared_watchlist_members(uuid, uuid[]) to authenticated;
commit;
