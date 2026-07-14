create or replace function public.register_device_token(target_token text, target_platform text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or target_token !~ '^ExponentPushToken|^ExpoPushToken' or target_platform not in ('ios', 'android') then
    raise exception 'Invalid device registration';
  end if;
  delete from public.devices where expo_push_token = target_token;
  insert into public.devices(user_id, expo_push_token, platform, notifications_enabled)
  values (auth.uid(), target_token, target_platform, true);
end;
$$;
revoke all on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;
