revoke execute on function public.cabinet_admin_json(public.cabinet_admins)
from public, anon, authenticated;

revoke execute on function public.cabinet_assert_admin(text)
from public, anon, authenticated;

revoke execute on function public.cabinet_new_session(uuid)
from public, anon, authenticated;

revoke execute on function public.cabinet_product_json(public.cabinet_products)
from public, anon, authenticated;

revoke execute on function public.cabinet_settings_json()
from public, anon, authenticated;

grant execute on function public.cabinet_bulk_delete(text, text[]) to anon, authenticated;
grant execute on function public.cabinet_bulk_status(text, text, text[]) to anon, authenticated;
grant execute on function public.cabinet_clear_all(text) to anon, authenticated;
grant execute on function public.cabinet_create_admin(text, text, text) to anon, authenticated;
grant execute on function public.cabinet_delete_image(text, text) to anon, authenticated;
grant execute on function public.cabinet_delete_product(text, text) to anon, authenticated;
grant execute on function public.cabinet_get_capacity(text) to anon, authenticated;
grant execute on function public.cabinet_get_image(text) to anon, authenticated;
grant execute on function public.cabinet_get_images(text[]) to anon, authenticated;
grant execute on function public.cabinet_get_state(text) to anon, authenticated;
grant execute on function public.cabinet_import_payload(text, jsonb) to anon, authenticated;
grant execute on function public.cabinet_list_images(text) to anon, authenticated;
grant execute on function public.cabinet_login(text, text) to anon, authenticated;
grant execute on function public.cabinet_logout(text) to anon, authenticated;
grant execute on function public.cabinet_save_image(text, text, text, text, text) to anon, authenticated;
grant execute on function public.cabinet_save_product(text, jsonb) to anon, authenticated;
grant execute on function public.cabinet_save_settings(text, jsonb) to anon, authenticated;
grant execute on function public.cabinet_set_product_status(text, text, text) to anon, authenticated;
grant execute on function public.cabinet_update_admin(text, text, text, text, text) to anon, authenticated;
