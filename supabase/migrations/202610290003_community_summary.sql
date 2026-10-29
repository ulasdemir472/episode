begin;
create function public.community_rating_summary(requested_target text)
returns table(average_rating numeric, rating_count bigint)
language sql stable security invoker set search_path = '' as $$
  select round(avg(score), 1), count(*) from public.ratings where target_key = requested_target;
$$;
create function public.comment_like_summary(requested_ids uuid[])
returns table(comment_id uuid, like_count bigint, liked_by_me boolean)
language sql stable security invoker set search_path = '' as $$
  select c.id, count(l.user_id), coalesce(bool_or(l.user_id = auth.uid()),false)
  from public.comments c left join public.comment_likes l on l.comment_id = c.id
  where c.id = any(requested_ids) group by c.id;
$$;
create function public.blocked_profiles()
returns table(id uuid, first_name text, last_name text, username text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.last_name, p.username from public.user_blocks b join public.profiles p on p.id = b.blocked_user_id where b.user_id = auth.uid();
$$;
revoke all on function public.community_rating_summary(text), public.comment_like_summary(uuid[]), public.blocked_profiles() from public, anon;
grant execute on function public.community_rating_summary(text), public.comment_like_summary(uuid[]), public.blocked_profiles() to authenticated;
commit;
