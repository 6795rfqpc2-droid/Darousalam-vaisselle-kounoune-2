-- Photos des produits : colonne + stockage (à exécuter une fois dans SQL Editor)

alter table public.produits add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produits', 'produits', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists produits_photos_select on storage.objects;
create policy produits_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'produits' and public.is_active());

drop policy if exists produits_photos_insert on storage.objects;
create policy produits_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'produits' and public.is_admin());

drop policy if exists produits_photos_update on storage.objects;
create policy produits_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'produits' and public.is_admin()) with check (bucket_id = 'produits' and public.is_admin());

drop policy if exists produits_photos_delete on storage.objects;
create policy produits_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'produits' and public.is_admin());
