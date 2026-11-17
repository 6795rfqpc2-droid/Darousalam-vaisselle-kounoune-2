-- =====================================================================
-- MODE SANS CONNEXION (à exécuter APRÈS schema.sql)
-- ATTENTION : toute personne ayant le lien de l'application peut tout lire
-- et tout modifier (prix d'achat, dépenses, personnel, historique).
-- Pour revenir au mode sécurisé : exécuter sql/mode_avec_connexion.sql
-- =====================================================================

alter table public.parametres add column if not exists mode_ouvert boolean not null default false;
update public.parametres set mode_ouvert = true where id = 1;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select mode_ouvert from public.parametres where id = 1), false)
      or exists (select 1 from public.profiles where id = auth.uid() and actif)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select mode_ouvert from public.parametres where id = 1), false)
      or exists (select 1 from public.profiles where id = auth.uid() and actif and role = 'admin')
$$;

-- Politiques pour le rôle anonyme
do $$
declare t text;
begin
  foreach t in array array['categories','produits','produits_couts','depenses'] loop
    execute format('drop policy if exists anon_%1$s_all on public.%1$s', t);
    execute format('create policy anon_%1$s_all on public.%1$s for all to anon using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  foreach t in array array['ventes','vente_lignes','paiements','mouvements_stock','historique'] loop
    execute format('drop policy if exists anon_%1$s_select on public.%1$s', t);
    execute format('create policy anon_%1$s_select on public.%1$s for select to anon using (public.is_active())', t);
  end loop;
  foreach t in array array['profiles','parametres'] loop
    execute format('drop policy if exists anon_%1$s_select on public.%1$s', t);
    execute format('create policy anon_%1$s_select on public.%1$s for select to anon using (public.is_active())', t);
    execute format('drop policy if exists anon_%1$s_update on public.%1$s', t);
    execute format('create policy anon_%1$s_update on public.%1$s for update to anon using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Privilèges du rôle anonyme
grant select, insert, update, delete on public.categories, public.produits, public.produits_couts, public.depenses to anon;
grant select, update on public.profiles, public.parametres to anon;
grant select on public.ventes, public.paiements, public.mouvements_stock, public.historique to anon;
grant select (id, vente_id, produit_id, designation, quantite, prix_unitaire) on public.vente_lignes to anon;

grant execute on function public.is_active() to anon;
grant execute on function public.is_admin() to anon;
grant execute on function public.mouvement_stock(uuid, text, int, text) to anon;
grant execute on function public.creer_vente(text, text, numeric, jsonb, numeric, text) to anon;
grant execute on function public.ajouter_paiement(uuid, numeric, text) to anon;
grant execute on function public.annuler_vente(uuid) to anon;
grant execute on function public.stats_dashboard(date, date) to anon;
