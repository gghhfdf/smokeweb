alter table public.cabinet_products
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists sort_order integer not null default 0,
  add column if not exists origin text not null default '',
  add column if not exists flavor_notes text not null default '',
  add column if not exists image_meta jsonb not null default '{}'::jsonb;

alter table public.cabinet_settings
  add column if not exists hero_layout text not null default 'editorial',
  add column if not exists default_sort text not null default 'manual',
  add column if not exists show_origin boolean not null default true,
  add column if not exists show_flavor_notes boolean not null default true;

alter table public.cabinet_settings
  drop constraint if exists cabinet_settings_hero_layout_check;

alter table public.cabinet_settings
  drop constraint if exists cabinet_settings_default_sort_check;

alter table public.cabinet_settings
  add constraint cabinet_settings_hero_layout_check
  check (hero_layout = any (array['editorial'::text, 'catalog'::text, 'minimal'::text]));

alter table public.cabinet_settings
  add constraint cabinet_settings_default_sort_check
  check (default_sort = any (array['manual'::text, 'updated'::text, 'name'::text, 'price'::text]));

update public.cabinet_products
set sort_order = ranked.sort_order
from (
  select id, row_number() over (order by featured desc, updated_at desc, id asc) - 1 as sort_order
  from public.cabinet_products
) ranked
where public.cabinet_products.id = ranked.id
  and public.cabinet_products.sort_order = 0;

create or replace function public.cabinet_product_json(p_product public.cabinet_products)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_product.id,
    'name', p_product.name,
    'subtitle', p_product.subtitle,
    'category', p_product.category,
    'price', p_product.price,
    'specs', p_product.specs,
    'stock', p_product.stock,
    'status', p_product.status,
    'featured', p_product.featured,
    'description', p_product.description,
    'imageIds', coalesce(to_jsonb(p_product.image_ids), '[]'::jsonb),
    'coverImageId', p_product.cover_image_id,
    'tags', coalesce(to_jsonb(p_product.tags), '[]'::jsonb),
    'sortOrder', p_product.sort_order,
    'origin', p_product.origin,
    'flavorNotes', p_product.flavor_notes,
    'imageMeta', coalesce(p_product.image_meta, '{}'::jsonb),
    'updatedAt', p_product.updated_at
  )
$$;

create or replace function public.cabinet_settings_json()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'brandName', brand_name,
    'heroTitle', hero_title,
    'heroBody', hero_body,
    'accentTheme', accent_theme,
    'fontPreset', font_preset,
    'requireAgeGate', require_age_gate,
    'gridDensity', grid_density,
    'heroLayout', hero_layout,
    'defaultSort', default_sort,
    'showStock', show_stock,
    'showPrice', show_price,
    'showOrigin', show_origin,
    'showFlavorNotes', show_flavor_notes
  )
  from public.cabinet_settings
  where singleton_id = true
$$;

create or replace function public.cabinet_save_product(
  p_session_token text,
  p_product jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_image_ids text[];
  v_tags text[];
begin
  perform public.cabinet_assert_admin(p_session_token);

  select coalesce(array_agg(value), '{}'::text[])
  into v_image_ids
  from jsonb_array_elements_text(coalesce(p_product->'imageIds', '[]'::jsonb)) as value;

  select coalesce(array_agg(trim(value)) filter (where trim(value) <> ''), '{}'::text[])
  into v_tags
  from jsonb_array_elements_text(coalesce(p_product->'tags', '[]'::jsonb)) as value;

  insert into public.cabinet_products (
    id,
    name,
    subtitle,
    category,
    price,
    specs,
    stock,
    status,
    featured,
    description,
    image_ids,
    cover_image_id,
    tags,
    sort_order,
    origin,
    flavor_notes,
    image_meta,
    updated_at
  ) values (
    p_product->>'id',
    nullif(trim(p_product->>'name'), ''),
    coalesce(p_product->>'subtitle', ''),
    coalesce(nullif(trim(p_product->>'category'), ''), '未分类'),
    coalesce((p_product->>'price')::numeric, 0),
    coalesce(nullif(trim(p_product->>'specs'), ''), '20 支 / 包'),
    coalesce((p_product->>'stock')::integer, 0),
    case when p_product->>'status' in ('live', 'draft') then p_product->>'status' else 'draft' end,
    coalesce((p_product->>'featured')::boolean, false),
    coalesce(p_product->>'description', ''),
    v_image_ids,
    nullif(p_product->>'coverImageId', ''),
    v_tags,
    coalesce((p_product->>'sortOrder')::integer, 0),
    coalesce(p_product->>'origin', ''),
    coalesce(p_product->>'flavorNotes', ''),
    coalesce(p_product->'imageMeta', '{}'::jsonb),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    subtitle = excluded.subtitle,
    category = excluded.category,
    price = excluded.price,
    specs = excluded.specs,
    stock = excluded.stock,
    status = excluded.status,
    featured = excluded.featured,
    description = excluded.description,
    image_ids = excluded.image_ids,
    cover_image_id = excluded.cover_image_id,
    tags = excluded.tags,
    sort_order = excluded.sort_order,
    origin = excluded.origin,
    flavor_notes = excluded.flavor_notes,
    image_meta = excluded.image_meta,
    updated_at = excluded.updated_at;

  return public.cabinet_get_state(p_session_token);
end;
$$;

create or replace function public.cabinet_save_settings(
  p_session_token text,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.cabinet_assert_admin(p_session_token);

  insert into public.cabinet_settings (
    singleton_id,
    brand_name,
    hero_title,
    hero_body,
    accent_theme,
    font_preset,
    require_age_gate,
    grid_density,
    hero_layout,
    default_sort,
    show_stock,
    show_price,
    show_origin,
    show_flavor_notes,
    updated_at
  ) values (
    true,
    coalesce(nullif(trim(p_settings->>'brandName'), ''), 'Cabinet Ops'),
    coalesce(nullif(trim(p_settings->>'heroTitle'), ''), '白金典藏系列'),
    coalesce(p_settings->>'heroBody', ''),
    case
      when p_settings->>'accentTheme' in (
        'sage',
        'champagne',
        'graphite',
        'wenkai-sage',
        'kuaile-peach',
        'xiaowei-porcelain',
        'mashan-amber',
        'longcang-ink'
      ) then p_settings->>'accentTheme'
      else 'wenkai-sage'
    end,
    case
      when p_settings->>'fontPreset' in (
        'heritage',
        'modern',
        'editorial',
        'wenkai',
        'kuaile',
        'xiaowei',
        'mashan',
        'longcang'
      ) then p_settings->>'fontPreset'
      else 'wenkai'
    end,
    coalesce((p_settings->>'requireAgeGate')::boolean, true),
    case when p_settings->>'gridDensity' in ('editorial', 'compact') then p_settings->>'gridDensity' else 'editorial' end,
    case when p_settings->>'heroLayout' in ('editorial', 'catalog', 'minimal') then p_settings->>'heroLayout' else 'editorial' end,
    case when p_settings->>'defaultSort' in ('manual', 'updated', 'name', 'price') then p_settings->>'defaultSort' else 'manual' end,
    coalesce((p_settings->>'showStock')::boolean, true),
    coalesce((p_settings->>'showPrice')::boolean, true),
    coalesce((p_settings->>'showOrigin')::boolean, true),
    coalesce((p_settings->>'showFlavorNotes')::boolean, true),
    now()
  )
  on conflict (singleton_id) do update set
    brand_name = excluded.brand_name,
    hero_title = excluded.hero_title,
    hero_body = excluded.hero_body,
    accent_theme = excluded.accent_theme,
    font_preset = excluded.font_preset,
    require_age_gate = excluded.require_age_gate,
    grid_density = excluded.grid_density,
    hero_layout = excluded.hero_layout,
    default_sort = excluded.default_sort,
    show_stock = excluded.show_stock,
    show_price = excluded.show_price,
    show_origin = excluded.show_origin,
    show_flavor_notes = excluded.show_flavor_notes,
    updated_at = excluded.updated_at;

  return public.cabinet_get_state(p_session_token);
end;
$$;

drop function if exists public.cabinet_bulk_status(text, text);
drop function if exists public.cabinet_bulk_status(text, text, text[]);

create function public.cabinet_bulk_status(
  p_session_token text,
  p_status text,
  p_product_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.cabinet_assert_admin(p_session_token);

  update public.cabinet_products
  set status = case when p_status = 'live' then 'live' else 'draft' end,
      updated_at = now()
  where p_product_ids is null
     or id = any (p_product_ids);

  return public.cabinet_get_state(p_session_token);
end;
$$;

create or replace function public.cabinet_get_state(p_session_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin public.cabinet_admins;
  v_session_admin_id uuid;
  v_is_admin boolean := false;
  v_products jsonb;
begin
  if p_session_token is not null and length(p_session_token) >= 20 then
    begin
      v_session_admin_id := public.cabinet_assert_admin(p_session_token);
      v_is_admin := true;
    exception when others then
      v_session_admin_id := null;
      v_is_admin := false;
    end;
  end if;

  select * into v_admin
  from public.cabinet_admins
  order by created_at asc
  limit 1;

  select coalesce(
    jsonb_agg(public.cabinet_product_json(p) order by p.sort_order asc, p.featured desc, p.updated_at desc),
    '[]'::jsonb
  )
  into v_products
  from public.cabinet_products p
  where v_is_admin or p.status = 'live';

  return jsonb_build_object(
    'adminUser', case when v_admin.id is null then null else public.cabinet_admin_json(v_admin) end,
    'products', v_products,
    'settings', public.cabinet_settings_json(),
    'ageVerified', false,
    'sessionUserId', case when v_is_admin then v_session_admin_id::text else null end
  );
end;
$$;
