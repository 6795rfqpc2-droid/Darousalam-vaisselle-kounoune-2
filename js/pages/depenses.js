'use strict';

Pages.depenses = {
  async render(root) {
    const st = { du: monthStart(), au: today(), cat: '' };
    let rows = [];
    const CATS = ['Loyer', 'Électricité / Eau', 'Transport', 'Salaires', 'Fournitures', 'Réparations', 'Communication', 'Impôts / Taxes', 'Autre'];

    root.innerHTML = `
      <div class="page-head"><div><h2>Dépenses</h2><p class="muted">Suivi des charges de la boutique</p></div>
        <button class="btn primary" id="new-dep" type="button">${icon('plus')} Nouvelle dépense</button></div>
      <div class="card filters-card">
        <label class="field"><span>Du</span><input type="date" id="f-du" value="${st.du}"></label>
        <label class="field"><span>Au</span><input type="date" id="f-au" value="${st.au}"></label>
        <label class="field"><span>Catégorie</span><select id="f-c"><option value="">Toutes</option>${CATS.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <div class="kpis" id="d-kpis"></div>
      <div class="card" id="d-list"></div>`;

    const draw = () => {
      const list = rows.filter((d) => !st.cat || d.categorie === st.cat);
      const total = list.reduce((s, d) => s + Number(d.montant), 0);
      const by = {};
      list.forEach((d) => (by[d.categorie || 'Autre'] = (by[d.categorie || 'Autre'] || 0) + Number(d.montant)));
      const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
      $('#d-kpis', root).innerHTML =
        kpi('Total des dépenses', fcfa(total), `${list.length} opération(s)`, 'brand') + kpi('Plus gros poste', top ? top[0] : '—', top ? fcfa(top[1]) : '');
      $('#d-list', root).innerHTML = dataTable(
        [
          { h: 'Date', r: (d) => fmtDay(d.date_depense) },
          { h: 'Libellé', r: (d) => `<b>${esc(d.libelle)}</b>${d.note ? `<small class="muted block">${esc(d.note)}</small>` : ''}` },
          { h: 'Catégorie', r: (d) => esc(d.categorie || '—') },
          { h: 'Mode', r: (d) => esc(MODES[d.mode] || d.mode) },
          { h: 'Montant', c: 'right', r: (d) => `<b>${esc(fcfa(d.montant))}</b>` },
          {
            h: '',
            c: 'actions',
            r: (d) => `<button class="btn sm" data-edit="${esc(d.id)}" type="button">${icon('edit', 15)}</button> <button class="btn sm danger ghost" data-del="${esc(d.id)}" type="button">${icon('trash', 15)}</button>`,
          },
        ],
        list,
        { empty: 'Aucune dépense sur la période' }
      );
    };

    const load = async () => {
      const { data, error } = await sb
        .from('depenses')
        .select('*')
        .gte('date_depense', st.du)
        .lte('date_depense', st.au)
        .order('date_depense', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      rows = data;
      draw();
    };

    const form = (d) => {
      const m = modal(
        d ? 'Modifier la dépense' : 'Nouvelle dépense',
        `<form class="form" id="df">
          <label class="field"><span>Libellé *</span><input name="libelle" required maxlength="120" value="${esc(d?.libelle || '')}"></label>
          <div class="grid-2">
            <label class="field"><span>Catégorie</span><select name="categorie">${CATS.map((c) => `<option ${(d?.categorie || 'Autre') === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
            <label class="field"><span>Montant (FCFA) *</span><input name="montant" type="number" min="1" step="1" required inputmode="numeric" value="${d ? d.montant : ''}"></label>
          </div>
          <div class="grid-2">
            <label class="field"><span>Date *</span><input name="date_depense" type="date" required value="${d?.date_depense || today()}"></label>
            <label class="field"><span>Payé par</span><select name="mode">${Object.entries(MODES).map(([k, l]) => `<option value="${k}" ${(d?.mode || 'especes') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>Note</span><textarea name="note" rows="2" maxlength="300">${esc(d?.note || '')}</textarea></label>
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>
        </form>`
      );
      onSubmit($('#df', m.el), async (v) => {
        const payload = {
          libelle: v.libelle.trim(),
          categorie: v.categorie,
          montant: toInt(v.montant),
          mode: v.mode,
          date_depense: v.date_depense,
          note: v.note.trim() || null,
        };
        if (!payload.libelle) throw new Error('Le libellé est obligatoire.');
        if (payload.montant <= 0) throw new Error('Montant invalide.');
        const r = d ? await sb.from('depenses').update(payload).eq('id', d.id) : await sb.from('depenses').insert(payload);
        if (r.error) throw r.error;
        toast('Dépense enregistrée', 'success');
        m.close();
        await load();
      });
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
    $('#f-c', root).addEventListener('change', (e) => {
      st.cat = e.target.value;
      draw();
    });
    $('#new-dep', root).addEventListener('click', () => form());
    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-edit],[data-del]');
      if (!t) return;
      if (t.dataset.edit) return form(rows.find((x) => x.id === t.dataset.edit));
      const d = rows.find((x) => x.id === t.dataset.del);
      if (!(await confirmBox(`Supprimer la dépense « ${d.libelle} » (${fcfa(d.montant)}) ?`, { ok: 'Supprimer', danger: true }))) return;
      await safe(async () => {
        const { error } = await sb.from('depenses').delete().eq('id', d.id);
        if (error) throw error;
        toast('Dépense supprimée', 'success');
        await load();
      });
    });
    await load();
  },
};
