-- Retour au mode sécurisé (connexion obligatoire)

update public.parametres set mode_ouvert = false where id = 1;

do $$
declare t text;
begin
  foreach t in array array['categories','produits','produits_couts','depenses'] loop
    execute format('drop policy if exists anon_%1$s_all on public.%1$s', t);
  end loop;
  foreach t in array array['ventes','vente_lignes','paiements','mouvements_stock','historique','profiles','parametres'] loop
    execute format('drop policy if exists anon_%1$s_select on public.%1$s', t);
  end loop;
  foreach t in array array['profiles','parametres'] loop
    execute format('drop policy if exists anon_%1$s_update on public.%1$s', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
