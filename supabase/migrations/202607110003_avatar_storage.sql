begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatar_images_public_read on storage.objects;
drop policy if exists avatar_images_insert_own on storage.objects;
drop policy if exists avatar_images_update_own on storage.objects;
drop policy if exists avatar_images_delete_own on storage.objects;

create policy avatar_images_public_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatar_images_insert_own on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy avatar_images_update_own on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy avatar_images_delete_own on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

commit;
