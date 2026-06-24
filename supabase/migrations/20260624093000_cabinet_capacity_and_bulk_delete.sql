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
  v_decoded_image_bytes bigint;
  v_largest_image_bytes bigint;
  v_image_count integer;
  v_product_count integer;
  v_average_image_bytes numeric;
  v_average_decoded_image_bytes numeric;
  v_estimated_image_slots bigint;
  v_remaining_bytes bigint;
  v_quota_warnings text[] := array[]::text[];
begin
  perform public.cabinet_assert_admin(p_session_token);

  select pg_database_size(current_database())
  into v_database_bytes;

  with image_sizes as (
    select
      octet_length(data_url)::bigint as data_url_bytes,
      greatest(
        0,
        ((length(split_part(data_url, ',', 2)) * 3) / 4)
          - case
              when right(split_part(data_url, ',', 2), 2) = '==' then 2
              when right(split_part(data_url, ',', 2), 1) = '=' then 1
              else 0
            end
      )::bigint as decoded_bytes
    from public.cabinet_images
  )
  select
    coalesce(sum(data_url_bytes), 0)::bigint,
    coalesce(sum(decoded_bytes), 0)::bigint,
    coalesce(max(decoded_bytes), 0)::bigint,
    count(*)::integer
  into v_image_bytes, v_decoded_image_bytes, v_largest_image_bytes, v_image_count
  from image_sizes;

  select count(*)::integer
  into v_product_count
  from public.cabinet_products;

  v_average_image_bytes := greatest(
    coalesce(v_image_bytes::numeric / nullif(v_image_count, 0), 30 * 1024),
    30 * 1024
  );
  v_average_decoded_image_bytes := coalesce(
    v_decoded_image_bytes::numeric / nullif(v_image_count, 0),
    0
  );
  v_remaining_bytes := greatest(v_database_limit_bytes - v_database_bytes, 0);
  v_estimated_image_slots := floor(v_remaining_bytes::numeric / v_average_image_bytes);

  if v_database_bytes::numeric / v_database_limit_bytes > 0.8 then
    v_quota_warnings := array_append(v_quota_warnings, '数据库空间已超过 80%，建议整理旧图片。');
  end if;

  if v_largest_image_bytes > 30 * 1024 then
    v_quota_warnings := array_append(v_quota_warnings, '存在超过 30KB 的历史图片，建议重新上传压缩。');
  end if;

  return jsonb_build_object(
    'databaseBytes', v_database_bytes,
    'databaseLimitBytes', v_database_limit_bytes,
    'imageBytes', v_image_bytes,
    'decodedImageBytes', v_decoded_image_bytes,
    'imageCount', v_image_count,
    'productCount', v_product_count,
    'averageImageBytes', round(v_average_image_bytes),
    'averageDecodedImageBytes', round(v_average_decoded_image_bytes),
    'largestImageBytes', v_largest_image_bytes,
    'estimatedImageSlots', v_estimated_image_slots,
    'updatedAt', now(),
    'lastCheckedAt', now(),
    'quotaWarnings', to_jsonb(v_quota_warnings)
  );
end;
$$;

grant execute on function public.cabinet_get_capacity(text) to anon, authenticated;

create or replace function public.cabinet_bulk_delete(
  p_session_token text,
  p_product_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_image_ids text[];
begin
  perform public.cabinet_assert_admin(p_session_token);

  if p_product_ids is null or cardinality(p_product_ids) = 0 then
    raise exception '请选择要删除的商品。' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct image_id), array[]::text[])
  into v_image_ids
  from public.cabinet_products product
  cross join unnest(coalesce(product.image_ids, array[]::text[])) as image_id
  where product.id = any(p_product_ids);

  delete from public.cabinet_products
  where id = any(p_product_ids);

  if cardinality(v_image_ids) > 0 then
    delete from public.cabinet_images
    where id = any(v_image_ids);
  end if;

  return public.cabinet_get_state(p_session_token);
end;
$$;

grant execute on function public.cabinet_bulk_delete(text, text[]) to anon, authenticated;
