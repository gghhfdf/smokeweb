create or replace function public.cabinet_get_capacity(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_database_bytes bigint;
  v_database_limit_bytes bigint := 500::bigint * 1024 * 1024;
  v_image_bytes bigint;
  v_image_count integer;
  v_product_count integer;
  v_average_image_bytes numeric;
  v_estimated_image_slots bigint;
  v_remaining_bytes bigint;
begin
  perform public.cabinet_assert_admin(p_session_token);

  select pg_database_size(current_database())
  into v_database_bytes;

  select
    coalesce(sum(octet_length(data_url)), 0)::bigint,
    count(*)::integer
  into v_image_bytes, v_image_count
  from public.cabinet_images;

  select count(*)::integer
  into v_product_count
  from public.cabinet_products;

  v_average_image_bytes := greatest(
    coalesce(v_image_bytes::numeric / nullif(v_image_count, 0), 30 * 1024),
    30 * 1024
  );
  v_remaining_bytes := greatest(v_database_limit_bytes - v_database_bytes, 0);
  v_estimated_image_slots := floor(v_remaining_bytes::numeric / v_average_image_bytes);

  return jsonb_build_object(
    'databaseBytes', v_database_bytes,
    'databaseLimitBytes', v_database_limit_bytes,
    'imageBytes', v_image_bytes,
    'imageCount', v_image_count,
    'productCount', v_product_count,
    'averageImageBytes', round(v_average_image_bytes),
    'estimatedImageSlots', v_estimated_image_slots,
    'updatedAt', now()
  );
end;
$$;

grant execute on function public.cabinet_get_capacity(text) to anon, authenticated;
