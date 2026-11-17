'use strict';

Pages.stock = {
  async render(root) {
    const admin = Auth.isAdmin;
    const st = { tab: 'etat', q: '', alertOnly: false, mv: { produit: '', type: '', du: shiftDay(-29), au: today() } };
    let produits = [];
    let couts = {};

    const load = async () => {
      produits = await Data.produits();
      couts = admin ? await Data.couts() : {};
    };

    root.innerHTML = `
      <div class="page-head"><div><h2>Gestion du stock</h2><p class="muted">Entrées, sorties et niveaux de stock</p></div>
        <button class="btn primary" id="new-mv" type="button">${icon('plus')} Mouvement de stock</button></div>
      <div class="kpis" id="s-kpis"></div>
      <div class="tabs" id="tabs"><button class="tab active" data-tab="etat" type="button">État du stock</button><button class="tab" data-tab="mouvements" type="button">Mouvements</button></div>
      <div id="view"></div>`;

    const actifs = () => produits.filter((p) => p.actif);

    const drawKpis = () => {
      const a = actifs();
      const alertes = a.filter((p) => p.stock <= p.seuil_alerte);
      const valeur = a.reduce((s, p) => s + p.stock * (couts[p.id] ?? 0), 0);
      $('#s-kpis', root).innerHTML =
        kpi('Produits actifs', String(a.length), '', 'brand') +
        kpi('Stock faible', String(alertes.filter((p) => p.stock > 0).length), 'À réapprovisionner') +
        kpi('En rupture', String(a.filter((p) => p.stock <= 0).length), '', a.some((p) => p.stock <= 0) ? 'danger' : '') +
        (admin ? kpi('Valeur du stock', fcfa(valeur), "Au prix d'achat") : '');
    };

    const drawEtat = () => {
      $('#view', root).innerHTML = `
        <div class="toolbar">
          <div class="search">${icon('search')}<input id="q" type="search" placeholder="Rechercher un produit…" value="${esc(st.q)}"></div>
          <label class="check"><input type="checkbox" id="fa" ${st.alertOnly ? 'checked' : ''}> Alertes uniquement</label>
        </div>
        <div id="elist"></div>`;
      const list = () => {
        const q = st.q.trim().toLowerCase();
        const rows = actifs().filter((p) => (!st.alertOnly || p.stock <= p.seuil_alerte) && (!q || `${p.nom} ${p.reference || ''}`.toLowerCase().includes(q)));
        $('#elist', root).innerHTML = `<div class="card">${dataTable(
          [
            { h: 'Produit', r: (p) => `<div class="who">${photoThumb(p)}<b>${esc(p.nom)}</b></div>` },
            { h: 'Catégorie', r: (p) => esc(p.categories?.nom || '—') },
            { h: 'Stock', c: 'right', r: (p) => `<b>${p.stock}</b>` },
            { h: 'Seuil', c: 'right', r: (p) => p.seuil_alerte },
            { h: 'État', r: (p) => (p.stock <= 0 ? badge('Rupture', 'bad') : p.stock <= p.seuil_alerte ? badge('Faible', 'warn') : badge('Correct', 'ok')) },
            {
              h: '',
              c: 'actions',
              r: (p) =>
                `<button class="btn sm" data-mv="${esc(p.id)}" data-type="entree" type="button">${icon('down', 15)} Entrée</button> <button class="btn sm ghost" data-mv="${esc(p.id)}" data-type="sortie" type="button">${icon('up', 15)} Sortie</button>`,
            },
          ],
          rows,
          { empty: 'Aucun produit' }
        )}</div>`;
      };
      $('#q', root).addEventListener('input', (e) => {
        st.q = e.target.value;
        list();
      });
      $('#fa', root).addEventListener('change', (e) => {
        st.alertOnly = e.target.checked;
        list();
      });
      list();
    };

    const drawMouvements = async () => {
      $('#view', root).innerHTML = `
        <div class="card filters-card">
          <label class="field"><span>Produit</span><select id="m-p"><option value="">Tous</option>${produits.map((p) => `<option value="${esc(p.id)}" ${st.mv.produit === p.id ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
          <label class="field"><span>Type</span><select id="m-t"><option value="">Tous</option><option value="entree" ${st.mv.type === 'entree' ? 'selected' : ''}>Entrées</option><option value="sortie" ${st.mv.type === 'sortie' ? 'selected' : ''}>Sorties</option></select></label>
          <label class="field"><span>Du</span><input type="date" id="m-du" value="${st.mv.du}"></label>
          <label class="field"><span>Au</span><input type="date" id="m-au" value="${st.mv.au}"></label>
        </div>
        <div id="mlist"><div class="center pad"><div class="spin lg"></div></div></div>`;
      const fetchList = async () => {
        let q = sb
          .from('mouvements_stock')
          .select('*')
          .gte('created_at', dayStartISO(st.mv.du))
          .lt('created_at', dayEndISO(st.mv.au))
          .order('created_at', { ascending: false })
          .limit(500);
        if (st.mv.produit) q = q.eq('produit_id', st.mv.produit);
        if (st.mv.type) q = q.eq('type', st.mv.type);
        const { data, error } = await q;
        if (error) throw error;
        const names = Object.fromEntries(produits.map((p) => [p.id, p.nom]));
        $('#mlist', root).innerHTML = `<div class="card">${dataTable(
          [
            { h: 'Date', r: (m) => fmtDate(m.created_at) },
            { h: 'Produit', r: (m) => `<b>${esc(names[m.produit_id] || '—')}</b>` },
            { h: 'Type', r: (m) => (m.type === 'entree' ? badge('Entrée', 'ok') : badge('Sortie', 'warn')) },
            { h: 'Quantité', c: 'right', r: (m) => `${m.type === 'entree' ? '+' : '−'}${m.quantite}` },
            { h: 'Motif', r: (m) => esc(m.motif || '—') },
            { h: 'Par', r: (m) => esc(App.staffName(m.user_id)) },
          ],
          data,
          { empty: 'Aucun mouvement sur la période' }
        )}</div>`;
      };
      const bind = (id, key) =>
        $(id, root).addEventListener('change', (e) => {
          st.mv[key] = e.target.value;
          if (!st.mv.du || !st.mv.au || st.mv.du > st.mv.au) return toast('Période invalide', 'warn');
          safe(fetchList);
        });
      bind('#m-p', 'produit');
      bind('#m-t', 'type');
      bind('#m-du', 'du');
      bind('#m-au', 'au');
      await safe(fetchList);
    };

    const draw = () => {
      drawKpis();
      return st.tab === 'mouvements' ? drawMouvements() : drawEtat();
    };

    const movementModal = (produitId, type = 'entree') => {
      const m = modal(
        'Mouvement de stock',
        `<form class="form" id="mf">
          <label class="field"><span>Produit *</span><select name="produit" required><option value="">— Choisir —</option>${actifs()
            .map((p) => `<option value="${esc(p.id)}" ${p.id === produitId ? 'selected' : ''}>${esc(p.nom)} (stock : ${p.stock})</option>`)
            .join('')}</select></label>
          <div class="field"><span>Type *</span>
            <div class="mode-picker two">
              <label class="mode especes"><input type="radio" name="type" value="entree" ${type === 'entree' ? 'checked' : ''}><span>Entrée</span></label>
              <label class="mode orange_money"><input type="radio" name="type" value="sortie" ${type === 'sortie' ? 'checked' : ''}><span>Sortie</span></label>
            </div></div>
          <div class="grid-2">
            <label class="field"><span>Quantité *</span><input name="quantite" type="number" min="1" step="1" required inputmode="numeric"></label>
            <label class="field"><span>Motif</span><input name="motif" list="motifs" maxlength="120" placeholder="Ex : Réapprovisionnement"></label>
          </div>
          <datalist id="motifs"><option value="Réapprovisionnement"><option value="Retour client"><option value="Casse"><option value="Perte"><option value="Usage interne"><option value="Correction d'inventaire"></datalist>
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>
        </form>`
      );
      onSubmit($('#mf', m.el), async (d) => {
        if (!d.produit) throw new Error('Choisissez un produit.');
        const q = toInt(d.quantite);
        if (q <= 0) throw new Error('Quantité invalide.');
        const { error } = await sb.rpc('mouvement_stock', { p_produit: d.produit, p_type: d.type, p_quantite: q, p_motif: d.motif.trim() });
        if (error) throw error;
        toast('Mouvement enregistré', 'success');
        m.close();
        await load();
        await draw();
      });
    };

    $('#new-mv', root).addEventListener('click', () => movementModal());
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-mv]');
      if (!t) return;
      if (t.dataset.tab) {
        st.tab = t.dataset.tab;
        $$('#tabs .tab', root).forEach((b) => b.classList.toggle('active', b === t));
        draw();
      } else movementModal(t.dataset.mv, t.dataset.type);
    });

    await load();
    await draw();
  },
};
