# DAROU SALAM VAISSELLE — Kounoune 2

```
index.html
css/style.css
js/config.js        <- URL + clé anon Supabase + OPEN_MODE
js/utils.js  auth.js  print.js  app.js
js/pages/           dashboard, vente, ventes, produits, stock, depenses, personnel, historique, parametres
sql/schema.sql              <- 1) à exécuter en premier
sql/mode_sans_connexion.sql <- 2) accès sans compte (OPEN_MODE: true)
sql/mode_avec_connexion.sql <- retour au mode sécurisé (OPEN_MODE: false)
```

Mode sans connexion : exécuter `schema.sql` puis `mode_sans_connexion.sql`, renseigner `js/config.js`, ouvrir `index.html`.
Mode sécurisé : exécuter `mode_avec_connexion.sql`, mettre `OPEN_MODE: false`, créer le premier administrateur dans Supabase > Authentication > Users > Add user (« Auto Confirm User » coché).
