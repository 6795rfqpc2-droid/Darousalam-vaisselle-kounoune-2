-- =====================================================================
-- DAROU SALAM VAISSELLE KOUNOUNE 2 - Schéma Supabase complet
-- À exécuter en une seule fois dans Supabase > SQL Editor.
-- Le PREMIER utilisateur créé (Authentication > Users) devient administrateur.
-- Désactiver "Confirm email" dans Authentication > Providers > Email.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- TABLES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  telephone text,
  email text,
  role text not null default 'personnel' check (role in ('admin','personnel')),
  actif boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.parametres (
  id int primary key default 1 check (id = 1),
  nom_boutique text not null default 'DAROU SALAM VAISSELLE',
  adresse text default 'Kounoune 2',
  telephone text default '',
  message_pied text default 'Merci de votre confiance !'
);
insert into public.parametres (id) values (1) on conflict do nothing;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.produits (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  reference text,
  categorie_id uuid references public.categories(id) on delete set null,
  prix_vente numeric(14,0) not null default 0 check (prix_vente >= 0),
  stock int not null default 0 check (stock >= 0),
  seuil_alerte int not null default 5 check (seuil_alerte >= 0),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Prix d'achat isolés : visibles uniquement par l'administrateur
create table if not exists public.produits_couts (
  produit_id uuid primary key references public.produits(id) on delete cascade,
  prix_achat numeric(14,0) not null default 0 check (prix_achat >= 0)
);

create table if not exists public.ventes (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  client_nom text,
  client_tel text,
  sous_total numeric(14,0) not null default 0,
  remise numeric(14,0) not null default 0,
  total numeric(14,0) not null default 0,
  montant_paye numeric(14,0) not null default 0,
  statut text not null default 'impayee' check (statut in ('payee','partielle','impayee','annulee')),
  annulee boolean not null default false,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.vente_lignes (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete cascade,
  produit_id uuid references public.produits(id) on delete set null,
  designation text not null,
  quantite int not null check (quantite > 0),
  prix_unitaire numeric(14,0) not null,
  prix_achat numeric(14,0) not null default 0
);

create table if not exists public.paiements (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete cascade,
  montant numeric(14,0) not null check (montant > 0),
  mode text not null check (mode in ('especes','wave','orange_money')),
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references public.produits(id) on delete cascade,
  type text not null check (type in ('entree','sortie')),
  quantite int not null check (quantite > 0),
  motif text,
  vente_id uuid references public.ventes(id) on delete set null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.depenses (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  categorie text,
  montant numeric(14,0) not null check (montant > 0),
  mode text not null default 'especes' check (mode in ('especes','wave','orange_money')),
  date_depense date not null default current_date,
  note text,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.historique (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_nom text,
  action text not null,
  entite text not null,
  entite_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ventes_date on public.ventes(created_at desc);
create index if not exists idx_paiements_vente on public.paiements(vente_id);
create index if not exists idx_lignes_vente on public.vente_lignes(vente_id);
create index if not exists idx_mvt_produit on public.mouvements_stock(produit_id, created_at desc);
create index if not exists idx_hist_date on public.historique(created_at desc);
create index if not exists idx_dep_date on public.depenses(date_depense desc);

-- ---------- FONCTIONS D'AIDE ----------
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and actif)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and actif and role = 'admin')
$$;

create or replace function public.ecrire_historique(p_action text, p_entite text, p_id text, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select nom into n from public.profiles where id = auth.uid();
  insert into public.historique (user_id, user_nom, action, entite, entite_id, details)
  values (auth.uid(), coalesce(n, 'Système'), p_action, p_entite, p_id, p_details);
end $$;

-- Création automatique du profil (le 1er utilisateur = admin actif)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare premier boolean;
begin
  select not exists (select 1 from public.profiles) into premier;
  insert into public.profiles (id, nom, telephone, email, role, actif)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nom',''), split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'telephone',
    new.email,
    case when premier then 'admin' else 'personnel' end,
    premier
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Journalisation automatique
create or replace function public.trg_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if TG_OP = 'DELETE' then r := to_jsonb(OLD); else r := to_jsonb(NEW); end if;
  if TG_TABLE_NAME = 'produits' and TG_OP = 'UPDATE' then
    if (to_jsonb(NEW) - 'stock') = (to_jsonb(OLD) - 'stock') then return NEW; end if;
  end if;
  if TG_TABLE_NAME = 'ventes' and TG_OP = 'UPDATE' then
    if NEW.annulee = OLD.annulee then return NEW; end if;
  end if;
  if TG_TABLE_NAME = 'mouvements_stock' then
    if r->>'vente_id' is not null then return NEW; end if;
  end if;
  perform public.ecrire_historique(TG_OP, TG_TABLE_NAME, r->>'id', r);
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

drop trigger if exists log_categories on public.categories;
create trigger log_categories after insert or update or delete on public.categories for each row execute function public.trg_log();
drop trigger if exists log_produits on public.produits;
create trigger log_produits after insert or update or delete on public.produits for each row execute function public.trg_log();
drop trigger if exists log_depenses on public.depenses;
create trigger log_depenses after insert or update or delete on public.depenses for each row execute function public.trg_log();
drop trigger if exists log_profiles on public.profiles;
create trigger log_profiles after insert or update on public.profiles for each row execute function public.trg_log();
drop trigger if exists log_parametres on public.parametres;
create trigger log_parametres after update on public.parametres for each row execute function public.trg_log();
drop trigger if exists log_mouvements on public.mouvements_stock;
create trigger log_mouvements after insert on public.mouvements_stock for each row execute function public.trg_log();
drop trigger if exists log_paiements on public.paiements;
create trigger log_paiements after insert on public.paiements for each row execute function public.trg_log();
drop trigger if exists log_ventes on public.ventes;
create trigger log_ventes after update on public.ventes for each row execute function public.trg_log();

-- Impossible de retirer le dernier administrateur actif
create or replace function public.protect_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if OLD.role = 'admin' and OLD.actif and (NEW.role <> 'admin' or not NEW.actif) then
    if not exists (select 1 from public.profiles where id <> OLD.id and role = 'admin' and actif) then
      raise exception 'Impossible : il doit rester au moins un administrateur actif';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists protect_admin on public.profiles;
create trigger protect_admin before update on public.profiles
for each row execute function public.protect_last_admin();

-- Mise à jour du statut de la vente après paiement
create or replace function public.maj_vente_paiement() returns trigger
language plpgsql security definer set search_path = public as $$
declare t numeric; s numeric;
begin
  select total into t from public.ventes where id = NEW.vente_id;
  select coalesce(sum(montant),0) into s from public.paiements where vente_id = NEW.vente_id;
  update public.ventes
     set montant_paye = s,
         statut = case when s >= t then 'payee' when s > 0 then 'partielle' else 'impayee' end
   where id = NEW.vente_id;
  return NEW;
end $$;

drop trigger if exists maj_paiement on public.paiements;
create trigger maj_paiement after insert on public.paiements for each row execute function public.maj_vente_paiement();

-- ---------- FONCTIONS MÉTIER (RPC) ----------
create or replace function public.mouvement_stock(p_produit uuid, p_type text, p_quantite int, p_motif text)
returns void language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not public.is_active() then raise exception 'Accès refusé'; end if;
  if p_type not in ('entree','sortie') then raise exception 'Type de mouvement invalide'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Quantité invalide'; end if;
  select * into p from public.produits where id = p_produit for update;
  if not found then raise exception 'Produit introuvable'; end if;
  if p_type = 'sortie' and p.stock < p_quantite then
    raise exception 'Stock insuffisant pour % (disponible : %)', p.nom, p.stock;
  end if;
  update public.produits
     set stock = case when p_type = 'entree' then stock + p_quantite else stock - p_quantite end
   where id = p_produit;
  insert into public.mouvements_stock (produit_id, type, quantite, motif, user_id)
  values (p_produit, p_type, p_quantite, nullif(trim(p_motif),''), auth.uid());
end $$;

create or replace function public.creer_vente(
  p_client_nom text, p_client_tel text, p_remise numeric, p_lignes jsonb, p_montant numeric, p_mode text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; l jsonb; prod record; qte int; sous numeric := 0; tot numeric; cout numeric; v_num bigint;
begin
  if not public.is_active() then raise exception 'Accès refusé'; end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Le panier est vide';
  end if;
  if coalesce(p_remise,0) < 0 then raise exception 'Remise invalide'; end if;

  insert into public.ventes (client_nom, client_tel, remise, user_id)
  values (nullif(trim(p_client_nom),''), nullif(trim(p_client_tel),''), coalesce(p_remise,0), auth.uid())
  returning id, numero into v_id, v_num;

  for l in select * from jsonb_array_elements(p_lignes) loop
    qte := (l->>'quantite')::int;
    if qte is null or qte <= 0 then raise exception 'Quantité invalide'; end if;
    select * into prod from public.produits where id = (l->>'produit_id')::uuid and actif for update;
    if not found then raise exception 'Produit introuvable ou archivé'; end if;
    if prod.stock < qte then
      raise exception 'Stock insuffisant pour % (disponible : %)', prod.nom, prod.stock;
    end if;
    cout := coalesce((select prix_achat from public.produits_couts where produit_id = prod.id), 0);
    insert into public.vente_lignes (vente_id, produit_id, designation, quantite, prix_unitaire, prix_achat)
    values (v_id, prod.id, prod.nom, qte, prod.prix_vente, cout);
    update public.produits set stock = stock - qte where id = prod.id;
    insert into public.mouvements_stock (produit_id, type, quantite, motif, vente_id, user_id)
    values (prod.id, 'sortie', qte, 'Vente n° ' || v_num, v_id, auth.uid());
    sous := sous + prod.prix_vente * qte;
  end loop;

  if coalesce(p_remise,0) > sous then raise exception 'La remise dépasse le total'; end if;
  tot := sous - coalesce(p_remise,0);
  if tot <= 0 then raise exception 'Total invalide'; end if;
  update public.ventes set sous_total = sous, total = tot where id = v_id;

  if coalesce(p_montant,0) > 0 then
    if p_mode not in ('especes','wave','orange_money') then raise exception 'Mode de paiement invalide'; end if;
    if p_montant > tot then raise exception 'Le paiement dépasse le total'; end if;
    insert into public.paiements (vente_id, montant, mode, user_id) values (v_id, p_montant, p_mode, auth.uid());
  end if;

  perform public.ecrire_historique('VENTE', 'ventes', v_id::text,
    jsonb_build_object('numero', v_num, 'client_nom', nullif(trim(p_client_nom),''), 'total', tot, 'paye', coalesce(p_montant,0)));
  return v_id;
end $$;

create or replace function public.ajouter_paiement(p_vente uuid, p_montant numeric, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not public.is_active() then raise exception 'Accès refusé'; end if;
  if p_mode not in ('especes','wave','orange_money') then raise exception 'Mode de paiement invalide'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant invalide'; end if;
  select * into v from public.ventes where id = p_vente for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if v.annulee then raise exception 'Vente annulée'; end if;
  if p_montant > v.total - v.montant_paye then raise exception 'Le montant dépasse le reste à payer'; end if;
  insert into public.paiements (vente_id, montant, mode, user_id) values (p_vente, p_montant, p_mode, auth.uid());
end $$;

create or replace function public.annuler_vente(p_vente uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v record; l record;
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  select * into v from public.ventes where id = p_vente for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if v.annulee then raise exception 'Vente déjà annulée'; end if;
  for l in select * from public.vente_lignes where vente_id = p_vente and produit_id is not null loop
    update public.produits set stock = stock + l.quantite where id = l.produit_id;
    insert into public.mouvements_stock (produit_id, type, quantite, motif, vente_id, user_id)
    values (l.produit_id, 'entree', l.quantite, 'Annulation vente n° ' || v.numero, p_vente, auth.uid());
  end loop;
  update public.ventes set annulee = true, statut = 'annulee' where id = p_vente;
end $$;

create or replace function public.stats_dashboard(p_debut date, p_fin date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_fin < p_debut or p_fin - p_debut > 366 then raise exception 'Période invalide'; end if;
  select jsonb_build_object(
    'ca', coalesce((select sum(total) from public.ventes where not annulee and created_at::date between p_debut and p_fin), 0),
    'nb_ventes', (select count(*) from public.ventes where not annulee and created_at::date between p_debut and p_fin),
    'cout', coalesce((select sum(l.quantite * l.prix_achat) from public.vente_lignes l join public.ventes v on v.id = l.vente_id
                      where not v.annulee and v.created_at::date between p_debut and p_fin), 0),
    'encaisse', coalesce((select sum(p.montant) from public.paiements p join public.ventes v on v.id = p.vente_id
                          where not v.annulee and p.created_at::date between p_debut and p_fin), 0),
    'creances', coalesce((select sum(total - montant_paye) from public.ventes where not annulee), 0),
    'depenses', coalesce((select sum(montant) from public.depenses where date_depense between p_debut and p_fin), 0),
    'par_mode', coalesce((select jsonb_object_agg(mode, s) from (
                  select p.mode, sum(p.montant) s from public.paiements p join public.ventes v on v.id = p.vente_id
                  where not v.annulee and p.created_at::date between p_debut and p_fin group by p.mode) x), '{}'::jsonb),
    'top_produits', coalesce((select jsonb_agg(t) from (
                  select l.designation as nom, sum(l.quantite) as quantite, sum(l.quantite * l.prix_unitaire) as ca
                  from public.vente_lignes l join public.ventes v on v.id = l.vente_id
                  where not v.annulee and v.created_at::date between p_debut and p_fin
                  group by l.designation order by sum(l.quantite) desc limit 5) t), '[]'::jsonb),
    'serie', coalesce((select jsonb_agg(jsonb_build_object(
                  'jour', d::date,
                  'ca', coalesce((select sum(total) from public.ventes where not annulee and created_at::date = d::date), 0),
                  'depenses', coalesce((select sum(montant) from public.depenses where date_depense = d::date), 0)
                ) order by d) from generate_series(p_debut::timestamp, p_fin::timestamp, interval '1 day') d), '[]'::jsonb),
    'valeur_stock', coalesce((select sum(p.stock * c.prix_achat) from public.produits p join public.produits_couts c on c.produit_id = p.id where p.actif), 0),
    'alertes', (select count(*) from public.produits where actif and stock <= seuil_alerte)
  ) into r;
  return r;
end $$;

-- ---------- SÉCURITÉ (RLS) ----------
alter table public.profiles enable row level security;
alter table public.parametres enable row level security;
alter table public.categories enable row level security;
alter table public.produits enable row level security;
alter table public.produits_couts enable row level security;
alter table public.ventes enable row level security;
alter table public.vente_lignes enable row level security;
alter table public.paiements enable row level security;
alter table public.mouvements_stock enable row level security;
alter table public.depenses enable row level security;
alter table public.historique enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_active());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists param_select on public.parametres;
create policy param_select on public.parametres for select to authenticated using (public.is_active());
drop policy if exists param_update on public.parametres;
create policy param_update on public.parametres for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists cat_select on public.categories;
create policy cat_select on public.categories for select to authenticated using (public.is_active());
drop policy if exists cat_admin on public.categories;
create policy cat_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists prod_select on public.produits;
create policy prod_select on public.produits for select to authenticated using (public.is_active());
drop policy if exists prod_admin on public.produits;
create policy prod_admin on public.produits for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists couts_admin on public.produits_couts;
create policy couts_admin on public.produits_couts for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists ventes_select on public.ventes;
create policy ventes_select on public.ventes for select to authenticated using (public.is_active());
drop policy if exists lignes_select on public.vente_lignes;
create policy lignes_select on public.vente_lignes for select to authenticated using (public.is_active());
drop policy if exists paie_select on public.paiements;
create policy paie_select on public.paiements for select to authenticated using (public.is_active());
drop policy if exists mvt_select on public.mouvements_stock;
create policy mvt_select on public.mouvements_stock for select to authenticated using (public.is_active());

drop policy if exists dep_admin on public.depenses;
create policy dep_admin on public.depenses for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists hist_select on public.historique;
create policy hist_select on public.historique for select to authenticated using (public.is_admin());

-- ---------- PRIVILÈGES ----------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public, anon, authenticated;

revoke insert, update, delete, truncate on public.ventes, public.paiements, public.mouvements_stock, public.vente_lignes, public.historique from authenticated;
revoke insert, delete, truncate on public.profiles, public.parametres from authenticated;
-- le prix d'achat figé sur les lignes de vente n'est jamais lisible côté client
revoke select on public.vente_lignes from authenticated;
grant select (id, vente_id, produit_id, designation, quantite, prix_unitaire) on public.vente_lignes to authenticated;

grant execute on function public.is_active() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.mouvement_stock(uuid, text, int, text) to authenticated;
grant execute on function public.creer_vente(text, text, numeric, jsonb, numeric, text) to authenticated;
grant execute on function public.ajouter_paiement(uuid, numeric, text) to authenticated;
grant execute on function public.annuler_vente(uuid) to authenticated;
grant execute on function public.stats_dashboard(date, date) to authenticated;

-- ---------- DONNÉES INITIALES ----------
insert into public.categories (nom) values
  ('Assiettes'), ('Verres et tasses'), ('Casseroles et marmites'), ('Couverts'), ('Plateaux et plats'), ('Accessoires de cuisine')
on conflict (nom) do nothing;
