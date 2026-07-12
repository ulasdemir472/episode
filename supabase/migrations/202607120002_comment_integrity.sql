-- Clean up accidental rapid double-submits before enforcing uniqueness.
with duplicates as (
  select id,
         row_number() over (
           partition by user_id, target_key, md5(lower(trim(body)))
           order by created_at desc, id desc
         ) as duplicate_number
  from public.comments
  where deleted_at is null
)
update public.comments as comments
set deleted_at = now()
from duplicates
where comments.id = duplicates.id
  and duplicates.duplicate_number > 1;

create unique index if not exists comments_unique_visible_body_idx
  on public.comments (user_id, target_key, md5(lower(trim(body))))
  where deleted_at is null;

