alter table public.cabinet_settings
  drop constraint if exists cabinet_settings_accent_theme_check;

alter table public.cabinet_settings
  drop constraint if exists cabinet_settings_font_preset_check;

alter table public.cabinet_settings
  alter column accent_theme set default 'wenkai-sage',
  alter column font_preset set default 'wenkai';

update public.cabinet_settings
set
  accent_theme = case accent_theme
    when 'sage' then 'wenkai-sage'
    when 'champagne' then 'mashan-amber'
    when 'graphite' then 'xiaowei-porcelain'
    else accent_theme
  end,
  font_preset = case font_preset
    when 'heritage' then 'wenkai'
    when 'modern' then 'kuaile'
    when 'editorial' then 'xiaowei'
    else font_preset
  end,
  updated_at = now();

alter table public.cabinet_settings
  add constraint cabinet_settings_accent_theme_check
  check (
    accent_theme = any (
      array[
        'sage',
        'champagne',
        'graphite',
        'wenkai-sage',
        'kuaile-peach',
        'xiaowei-porcelain',
        'mashan-amber',
        'longcang-ink'
      ]::text[]
    )
  );

alter table public.cabinet_settings
  add constraint cabinet_settings_font_preset_check
  check (
    font_preset = any (
      array[
        'heritage',
        'modern',
        'editorial',
        'wenkai',
        'kuaile',
        'xiaowei',
        'mashan',
        'longcang'
      ]::text[]
    )
  );
