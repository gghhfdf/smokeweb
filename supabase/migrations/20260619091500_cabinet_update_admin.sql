create or replace function public.cabinet_update_admin(
  p_session_token text,
  p_display_name text,
  p_username text,
  p_current_password_hash text,
  p_new_password_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_username text;
  v_display_name text;
  v_new_password_hash text;
begin
  v_admin_id := public.cabinet_assert_admin(p_session_token);
  v_username := lower(trim(p_username));
  v_display_name := coalesce(nullif(trim(p_display_name), ''), '陈列管理员');
  v_new_password_hash := nullif(trim(coalesce(p_new_password_hash, '')), '');

  if v_username is null or length(v_username) = 0 then
    raise exception 'Username is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.cabinet_admins
    where id = v_admin_id
      and password_hash = p_current_password_hash
  ) then
    raise exception 'Current password is incorrect.' using errcode = '28000';
  end if;

  if exists (
    select 1
    from public.cabinet_admins
    where lower(username) = v_username
      and id <> v_admin_id
  ) then
    raise exception 'Username is already in use.' using errcode = '23505';
  end if;

  update public.cabinet_admins
  set display_name = v_display_name,
      username = trim(p_username),
      password_hash = coalesce(v_new_password_hash, password_hash)
  where id = v_admin_id;

  return public.cabinet_get_state(p_session_token);
end;
$$;

grant execute on function public.cabinet_update_admin(
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;
