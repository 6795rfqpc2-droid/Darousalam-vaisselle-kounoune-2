'use strict';

Pages.historique = {
  async render(root) {
    const PAGE = 100;
    const ENTITES = {
      ventes: 'Ventes',
      paiements: 'Paiements',
      produits: 'Produits',
      categories: 'Catégories',
      mouvements_stock: 'Mouvements de stock',
      depenses: 'Dépenses',
      profiles: 'Personnel',
      parametres: 'Paramètres',
    };
    const ACTIONS = { INSERT: ['Création', 'ok'], UPDATE: ['Modification', 'warn'], DELETE: ['Suppression', 'bad'], VENTE: ['Vente', 'ok'] };
    const st = { entite: '', user: '', du: shiftDay(-6), au: today() };
    let rows = [];
    let more = false;
    let names = {};

    const describe = (h) => {
      const d = h.details || {};
      switch (h.entite) {
        case 'ventes':
          return h.action === 'VENTE'
            ? `Vente n° ${pad(d.numero, 6)} · ${d.client_nom || 'Client comptoir'} · total ${fcfa(d.total)} · encaissé ${fcfa(d.paye)}`
            : `Vente n° ${pad(d.numero, 6)} ${d.annulee ? 'annulée' : 'modifiée'}`;
        case 'paiements':
          return `Paiement de ${fcfa(d.montant)} (${MODES[d.mode] || d.mode})`;
        case 'produits':
          return `Produit « ${d.nom} »${h.action === 'UPDATE' && d.actif === false ? ' (archivé)' : ''} · prix de vente ${fcfa(d.prix_vente)}`;
        case 'categories':
          return `Catégorie « ${d.nom} »`;
        case 'mouvements_stock':
          return `${d.type === 'entree' ? 'Entrée' : 'Sortie'} de ${d.quantite} × ${names[d.produit_id] || 'produit'}${d.motif ? ` · ${d.motif}` : ''}`;
        case 'depenses':
          return `Dépense « ${d.libelle} » · ${fcfa(d.montant)}`;
        case 'profiles':
          return `Compte « ${d.nom} » · ${d.role === 'admin' ? 'administrateur' : 'personnel'}${d.actif ? '' : ' · inactif'}`;
        case 'parametres':
          return 'Paramètres de la boutique mis à jour';
        default:
          return '';
      }
    };

    root.innerHTML = `
      <div class="page-head"><div><h2>Historique des opérations</h2><p class="muted">Journal complet et non modifiable de toutes les actions</p></div></div>
      <div class="card filters-card">
        <label class="field"><span>Type</span><select id="f-e"><option value="">Tous</option>${Object.entries(ENTITES).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
        <label class="field"><span>Utilisateur</span><select id="f-u"><option value="">Tous</option>${Object.entries(App.staff).map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select></label>
        <label class="field"><span>Du</span><input type="date" id="f-du" value="${st.du}"></label>
        <label class="field"><span>Au</span><input type="date" id="f-au" value="${st.au}"></label>
      </div>
      <div class="card" id="h-list"></div>
      <div class="center" id="h-more"></div>`;

    const draw = () => {
      $('#h-list', root).innerHTML = dataTable(
        [
          { h: 'Date', r: (h) => `<span class="nowrap">${fmtDate(h.created_at)}</span>` },
          { h: 'Utilisateur', r: (h) => esc(h.user_nom || 'Système') },
          { h: 'Action', r: (h) => badge(...(ACTIONS[h.action] || [h.action, 'muted'])) },
          { h: 'Type', r: (h) => esc(ENTITES[h.entite] || h.entite) },
          { h: 'Détail', r: (h) => esc(describe(h)) },
          { h: '', c: 'actions', r: (h) => `<button class="btn sm ghost" data-det="${esc(h.id)}" type="button">${icon('eye', 15)}</button>` },
        ],
        rows,
        { empty: 'Aucune opération pour ces critères' }
      );
      $('#h-more', root).innerHTML = more ? '<button class="btn" id="load-more" type="button">Charger plus</button>' : '';
      $('#load-more', root)?.addEventListener('click', () => safe(() => load(true)));
    };

    const load = async (append = false) => {
      const from = append ? rows.length : 0;
      let q = sb.from('historique').select('*').order('created_at', { ascending: false }).range(from, from + PAGE - 1);
      if (st.entite) q = q.eq('entite', st.entite);
      if (st.user) q = q.eq('user_id', st.user);
      q = q.gte('created_at', dayStartISO(st.du)).lt('created_at', dayEndISO(st.au));
      const { data, error } = await q;
      if (error) throw error;
      rows = append ? rows.concat(data) : data;
      more = data.length === PAGE;
      draw();
    };

    const bind = (id, key) =>
      $(id, root).addEventListener('change', (e) => {
        st[key] = e.target.value;
        if (!st.du || !st.au || st.du > st.au) return toast('Période invalide', 'warn');
        safe(() => load());
      });
    bind('#f-e', 'entite');
    bind('#f-u', 'user');
    bind('#f-du', 'du');
    bind('#f-au', 'au');

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-det]');
      if (!b) return;
      const h = rows.find((x) => x.id === b.dataset.det);
      modal('Détail de l\'opération', `<p class="muted sm">${fmtDate(h.created_at)} · ${esc(h.user_nom || 'Système')} · ${esc(ENTITES[h.entite] || h.entite)}</p><pre class="json">${esc(JSON.stringify(h.details, null, 2))}</pre>`);
    });

    const prods = await Data.produits();
    names = Object.fromEntries(prods.map((p) => [p.id, p.nom]));
    await load();
  },
};
