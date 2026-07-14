begin;

drop table if exists public.follows;

drop policy if exists friendships_read_related on public.friendships;
drop policy if exists friendships_read_visible on public.friendships;

create policy friendships_read_visible on public.friendships
  for select to authenticated
  using (
    status = 'accepted'
    or auth.uid() = requester_id
    or auth.uid() = addressee_id
  );

commit;
