begin;

create or replace function public.create_watch_wheel(invited_user_ids uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_wheel_id uuid;
begin
  if current_user_id is null then
    raise exception 'Oda oluşturmak için giriş yapmalısın.';
  end if;

  insert into public.watch_wheels (owner_id)
  values (current_user_id)
  returning id into created_wheel_id;

  insert into public.watch_wheel_members (wheel_id, user_id)
  select created_wheel_id, invited_user_id
  from unnest(coalesce(invited_user_ids, '{}')) as invited_user_id
  where invited_user_id <> current_user_id
    and exists (
      select 1 from public.friendships friendship
      where friendship.status = 'accepted'
        and ((friendship.requester_id = current_user_id and friendship.addressee_id = invited_user_id)
          or (friendship.addressee_id = current_user_id and friendship.requester_id = invited_user_id))
    )
  on conflict do nothing;

  return created_wheel_id;
end;
$$;

revoke all on function public.create_watch_wheel(uuid[]) from public;
grant execute on function public.create_watch_wheel(uuid[]) to authenticated;

commit;
