-- Migration: delete_user_account
-- Description: Allows authenticated users to permanently delete their own account and all cascaded data.

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete from auth.users which automatically cascades to:
  -- public.profiles, public.user_library, public.watch_history,
  -- public.ratings, public.comments, public.friendships, etc.
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
