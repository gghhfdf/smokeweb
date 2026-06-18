alter table public.cabinet_images
  drop constraint if exists cabinet_images_data_url_check;

alter table public.cabinet_images
  add constraint cabinet_images_data_url_check
  check (
    left(data_url, 11) = 'data:image/'
    and octet_length(data_url) <= 120000
  );

create or replace function public.cabinet_save_image(
  p_session_token text,
  p_id text,
  p_name text,
  p_type text,
  p_data_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.cabinet_assert_admin(p_session_token);

  if p_data_url is null
    or left(p_data_url, 11) <> 'data:image/'
    or octet_length(p_data_url) > 120000 then
    raise exception 'Image must be a compressed data URL below 120KB.' using errcode = '22023';
  end if;

  insert into public.cabinet_images (id, name, type, data_url)
  values (p_id, coalesce(nullif(p_name, ''), 'product-image'), coalesce(nullif(p_type, ''), 'image/jpeg'), p_data_url)
  on conflict (id) do update set
    name = excluded.name,
    type = excluded.type,
    data_url = excluded.data_url;

  return jsonb_build_object('id', p_id, 'name', p_name, 'type', p_type, 'createdAt', now());
end;
$function$;
