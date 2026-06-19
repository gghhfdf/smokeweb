create or replace function public.cabinet_get_images(p_image_ids text[])
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', image.id,
        'name', image.name,
        'type', image.type,
        'dataUrl', image.data_url,
        'createdAt', image.created_at
      )
      order by array_position(p_image_ids, image.id)
    ),
    '[]'::jsonb
  )
  from public.cabinet_images image
  where p_image_ids is not null
    and cardinality(p_image_ids) > 0
    and image.id = any (p_image_ids[1:80]);
$$;

grant execute on function public.cabinet_get_images(text[]) to anon, authenticated;
