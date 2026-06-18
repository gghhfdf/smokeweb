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
    show_stock,
    show_price,
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
    coalesce((p_settings->>'showStock')::boolean, true),
    coalesce((p_settings->>'showPrice')::boolean, true),
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
    show_stock = excluded.show_stock,
    show_price = excluded.show_price,
    updated_at = excluded.updated_at;

  return public.cabinet_get_state(p_session_token);
end;
$$;
