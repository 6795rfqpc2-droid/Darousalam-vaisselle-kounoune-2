'use strict';

const Sales = {
  async detail(id, onChange) {
    const m = modal('Vente', '<div class="center pad"><div class="spin lg"></div></div>', { wide: true });
    const paint = async () => {
      try {
        const d = await Print.load(id);
        const v = d.vente;
        const reste = Math.max(0, v.total - v.montant_paye);
        $('.modal-head h3', m.el).textContent = `Vente n° ${pad(v.numero, 6)}`;
        m.body.innerHTML = `
          <div class="detail-top">
            <div><div class="muted sm">Date</div><b>${fmtDate(v.created_at)}</b></div>
            <div><div class="muted sm">Client</div><b>${esc(v.client_nom || 'Client comptoir')}</b>${v.client_tel ? `<div class="sm muted">${esc(v.client_tel)}</div>` : ''}</div>
            <div><div class="muted sm">Vendeur</div><b>${esc(App.staffName(v.user_id))}</b></div>
            <div><div class="muted sm">Statut</div>${statutBadge(v.statut)}</div>
          </div>
          ${dataTable(
            [
              { h: 'Produit', r: (l) => esc(l.designation) },
              { h: 'Qté', c: 'right', r: (l) => l.quantite },
              { h: 'Prix unitaire', c: 'right', r: (l) => esc(fcfa(l.prix_unitaire)) },
              { h: 'Montant', c: 'right', r: (l) => `<b>${esc(fcfa(l.quantite * l.prix_unitaire))}</b>` },
            ],
            d.lignes
          )}
          <div class="totals boxed">
            <div class="t-row"><span>Sous-total</span><span>${esc(fcfa(v.sous_total))}</span></div>
            ${v.remise > 0 ? `<div class="t-row"><span>Remise</span><span>- ${esc(fcfa(v.remise))}</span></div>` : ''}
            <div class="t-row big"><span>Total</span><span>${esc(fcfa(v.total))}</span></div>
            <div class="t-row"><span>Payé</span><span>${esc(fcfa(v.montant_paye))}</span></div>
            <div class="t-row ${reste > 0 ? 'warn' : ''}"><span>Reste à payer</span><span>${esc(fcfa(reste))}</span></div>
          </div>
          <h4 class="sec-title">Paiements</h4>
          ${dataTable(
            [
              { h: 'Date', r: (p) => fmtDate(p.created_at) },
              { h: 'Mode', r: (p) => esc(MODES[p.mode] || p.mode) },
              { h: 'Reçu par', r: (p) => esc(App.staffName(p.user_id)) },
              { h: 'Montant', c: 'right', r: (p) => `<b>${esc(fcfa(p.montant))}</b>` },
            ],
            d.paiements,
            { empty: 'Aucun paiement enregistré' }
          )}
          <div class="form-actions between wrap">
            <div class="btn-group">
              <button class="btn" id="d-recu" type="button">${icon('printer')} Reçu</button>
              <button class="btn" id="d-facture" type="button">${icon('printer')} Facture</button>
            </div>
            <div class="btn-group">
              ${Auth.isAdmin && !v.annulee ? `<button class="btn danger ghost" id="d-cancel" type="button">Annuler la vente</button>` : ''}
              ${!v.annulee && reste > 0 ? `<button class="btn primary" id="d-pay" type="button">${icon('wallet')} Encaisser</button>` : ''}
            </div>
          </div>`;
        $('#d-recu', m.el).addEventListener('click', () => safe(() => Print.print(id, 'recu')));
        $('#d-facture', m.el).addEventListener('click', () => safe(() => Print.print(id, 'facture')));
        $('#d-pay', m.el)?.addEventListener('click', () =>
          this.payModal(v, reste, async () => {
            await paint();
            if (onChange) onChange();
          })
        );
        $('#d-cancel', m.el)?.addEventListener('click', async () => {
          if (!(await confirmBox(`Annuler la vente n° ${pad(v.numero, 6)} ? Le stock sera remis à jour.`, { ok: 'Annuler la vente', danger: true }))) return;
          await safe(async () => {
            const { error } = await sb.rpc('annuler_vente', { p_vente: id });
            if (error) throw error;
            toast('Vente annulée', 'success');
            await paint();
            if (onChange) onChange();
          });
        });
      } catch (e) {
        console.error(e);
        m.body.innerHTML = `<p class="muted">${esc(errMsg(e))}</p>`;
      }
    };
    await paint();
  },

  payModal(v, reste, done) {
    const m = modal(
      'Encaisser un paiement',
      `<form class="form" id="pay-form">
        <div class="info-box">Reste à payer : <b>${esc(fcfa(reste))}</b></div>
        <div class="field"><span>Mode de paiement</span>${modePicker('especes')}</div>
        <label class="field"><span>Montant (FCFA)</span><input name="montant" type="number" min="1" max="${reste}" step="1" value="${reste}" required inputmode="numeric"></label>
        <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>
      </form>`
    );
    onSubmit($('#pay-form', m.el), async (d) => {
      const montant = toInt(d.montant);
      if (montant <= 0 || montant > reste) throw new Error('Montant invalide.');
      const { error } = await sb.rpc('ajouter_paiement', { p_vente: v.id, p_montant: montant, p_mode: d.mode });
      if (error) throw error;
      toast('Paiement enregistré', 'success');
      m.close();
      await done();
    });
  },
};

Pages.ventes = {
  async render(root) {
    const st = { du: shiftDay(-29), au: today(), statut: '', q: '' };
    let rows = [];
    root.innerHTML = `
      <div class="page-head"><div><h2>Ventes & paiements</h2><p class="muted">Suivi des ventes, encaissements et créances</p></div>
        <a class="btn primary" href="#/vente">${icon('plus')} Nouvelle vente</a></div>
      <div class="card filters-card">
        <label class="field"><span>Du</span><input type="date" id="f-du" value="${st.du}"></label>
        <label class="field"><span>Au</span><input type="date" id="f-au" value="${st.au}"></label>
        <label class="field"><span>Statut</span><select id="f-st">
          <option value="">Toutes</option><option value="payee">Payées</option><option value="due">À encaisser (impayées + partielles)</option>
          <option value="partielle">Partielles</option><option value="impayee">Impayées</option><option value="annulee">Annulées</option></select></label>
        <label class="field grow"><span>Recherche</span><input type="search" id="f-q" placeholder="N° de vente ou client…"></label>
      </div>
      <div class="kpis" id="v-sum"></div>
      <div class="card" id="v-list"></div>`;

    const draw = () => {
      const q = st.q.trim().toLowerCase();
      const list = rows.filter((v) => {
        if (st.statut === 'due' ? !(v.statut === 'impayee' || v.statut === 'partielle') : st.statut && v.statut !== st.statut) return false;
        if (!q) return true;
        return `${v.numero} ${pad(v.numero, 6)} ${v.client_nom || ''} ${v.client_tel || ''}`.toLowerCase().includes(q);
      });
      const ok = list.filter((v) => !v.annulee);
      const tot = ok.reduce((s, v) => s + Number(v.total), 0);
      const paye = ok.reduce((s, v) => s + Number(v.montant_paye), 0);
      $('#v-sum', root).innerHTML =
        kpi('Ventes', String(ok.length), 'Hors annulées') + kpi('Total vendu', fcfa(tot), '', 'brand') + kpi('Encaissé', fcfa(paye)) + kpi('Reste à encaisser', fcfa(tot - paye), '', tot - paye > 0 ? 'danger' : '');
      $('#v-list', root).innerHTML = dataTable(
        [
          { h: 'N°', r: (v) => `<b>${pad(v.numero, 6)}</b>` },
          { h: 'Date', r: (v) => fmtDate(v.created_at) },
          { h: 'Client', r: (v) => esc(v.client_nom || 'Client comptoir') },
          { h: 'Total', c: 'right', r: (v) => esc(fcfa(v.total)) },
          { h: 'Payé', c: 'right', r: (v) => esc(fcfa(v.montant_paye)) },
          { h: 'Reste', c: 'right', r: (v) => (v.annulee ? '—' : esc(fcfa(Math.max(0, v.total - v.montant_paye)))) },
          { h: 'Statut', r: (v) => statutBadge(v.statut) },
          { h: '', c: 'actions', r: (v) => `<button class="btn sm" data-sale="${esc(v.id)}" type="button">${icon('eye', 15)} Voir</button>` },
        ],
        list,
        { empty: 'Aucune vente pour ces critères' }
      );
    };

    const load = async () => {
      $('#v-list', root).innerHTML = '<div class="center pad"><div class="spin lg"></div></div>';
      const { data, error } = await sb
        .from('ventes')
        .select('*')
        .gte('created_at', dayStartISO(st.du))
        .lt('created_at', dayEndISO(st.au))
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      rows = data;
      draw();
    };

    const dates = () => {
      const du = $('#f-du', root).value;
      const au = $('#f-au', root).value;
      if (!du || !au || du > au) return toast('Période invalide', 'warn');
      st.du = du;
      st.au = au;
      safe(load);
    };
    $('#f-du', root).addEventListener('change', dates);
    $('#f-au', root).addEventListener('change', dates);
    $('#f-st', root).addEventListener('change', (e) => {
      st.statut = e.target.value;
      draw();
    });
    $('#f-q', root).addEventListener('input', (e) => {
      st.q = e.target.value;
      draw();
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sale]');
      if (b) Sales.detail(b.dataset.sale, () => safe(load));
    });
    await load();
  },
};
