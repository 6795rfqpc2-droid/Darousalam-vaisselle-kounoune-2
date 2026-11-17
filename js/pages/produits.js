'use strict';

Pages.produits = {
  async render(root) {
    const admin = Auth.isAdmin;
    const st = { tab: 'produits', q: '', cat: '', archives: false };
    let produits = [];
    let cats = [];
    let couts = {};

    const load = async () => {
      [produits, cats] = await Promise.all([Data.produits(), Data.categories()]);
      couts = admin ? await Data.couts() : {};
    };

    root.innerHTML = `
      <div class="page-head"><div><h2>Produits</h2><p class="muted">Catalogue, prix et catégories</p></div><div class="head-actions" id="head-actions"></div></div>
      ${admin ? `<div class="tabs" id="tabs"><button class="tab active" data-tab="produits" type="button">Produits</button><button class="tab" data-tab="categories" type="button">Catégories</button></div>` : ''}
      <div id="view"></div>`;

    const drawList = () => {
      const q = st.q.trim().toLowerCase();
      const list = produits.filter(
        (p) => (st.archives ? !p.actif : p.actif) && (!st.cat || p.categorie_id === st.cat) && (!q || `${p.nom} ${p.reference || ''}`.toLowerCase().includes(q))
      );
      const cols = [
        { h: 'Produit', r: (p) => `<div class="who">${photoThumb(p)}<span><b>${esc(p.nom)}</b>${p.reference ? `<small class="muted block">Réf. ${esc(p.reference)}</small>` : ''}</span></div>` },
        { h: 'Catégorie', r: (p) => esc(p.categories?.nom || '—') },
        { h: 'Prix de vente', c: 'right', r: (p) => esc(fcfa(p.prix_vente)) },
      ];
      if (admin) {
        cols.push({ h: "Prix d'achat", c: 'right', r: (p) => esc(fcfa(couts[p.id] ?? 0)) });
        cols.push({
          h: 'Marge',
          c: 'right',
          r: (p) => {
            const m = p.prix_vente - (couts[p.id] ?? 0);
            return `<span class="${m < 0 ? 'neg' : 'pos-text'}">${esc(fcfa(m))}</span>`;
          },
        });
      }
      cols.push({ h: 'Stock', c: 'right', r: (p) => stockBadge(p.stock, p.seuil_alerte) });
      if (admin)
        cols.push({
          h: '',
          c: 'actions',
          r: (p) =>
            `<button class="btn sm" data-edit="${esc(p.id)}" type="button">${icon('edit', 15)} Modifier</button> <button class="btn sm ghost" data-arch="${esc(p.id)}" type="button">${p.actif ? 'Archiver' : 'Réactiver'}</button>`,
        });
      $('#plist', root).innerHTML = `<div class="card">${dataTable(cols, list, { empty: st.archives ? 'Aucun produit archivé' : 'Aucun produit' })}</div>`;
    };

    const drawProduits = () => {
      $('#head-actions', root).innerHTML = admin ? `<button class="btn primary" id="new-prod" type="button">${icon('plus')} Nouveau produit</button>` : '';
      $('#view', root).innerHTML = `
        <div class="toolbar">
          <div class="search">${icon('search')}<input id="q" type="search" placeholder="Rechercher…" value="${esc(st.q)}"></div>
          <select id="fc"><option value="">Toutes les catégories</option>${cats.map((c) => `<option value="${esc(c.id)}" ${st.cat === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select>
          ${admin ? `<label class="check"><input type="checkbox" id="fa" ${st.archives ? 'checked' : ''}> Archivés</label>` : ''}
        </div>
        <div id="plist"></div>`;
      $('#q', root).addEventListener('input', (e) => {
        st.q = e.target.value;
        drawList();
      });
      $('#fc', root).addEventListener('change', (e) => {
        st.cat = e.target.value;
        drawList();
      });
      $('#fa', root)?.addEventListener('change', (e) => {
        st.archives = e.target.checked;
        drawList();
      });
      $('#new-prod', root)?.addEventListener('click', () => productForm());
      drawList();
    };

    const drawCats = () => {
      $('#head-actions', root).innerHTML = `<button class="btn primary" id="new-cat" type="button">${icon('plus')} Nouvelle catégorie</button>`;
      const count = (id) => produits.filter((p) => p.categorie_id === id && p.actif).length;
      $('#view', root).innerHTML = `<div class="card">${dataTable(
        [
          { h: 'Catégorie', r: (c) => `<b>${esc(c.nom)}</b>` },
          { h: 'Description', r: (c) => esc(c.description || '—') },
          { h: 'Produits', c: 'right', r: (c) => count(c.id) },
          {
            h: '',
            c: 'actions',
            r: (c) => `<button class="btn sm" data-cedit="${esc(c.id)}" type="button">${icon('edit', 15)} Modifier</button> <button class="btn sm danger ghost" data-cdel="${esc(c.id)}" type="button">${icon('trash', 15)}</button>`,
          },
        ],
        cats,
        { empty: 'Aucune catégorie' }
      )}</div>`;
      $('#new-cat', root).addEventListener('click', () => catForm());
    };

    const draw = () => (st.tab === 'categories' ? drawCats() : drawProduits());
    const refresh = async () => {
      await load();
      draw();
    };

    const productForm = (p) => {
      const m = modal(
        p ? 'Modifier le produit' : 'Nouveau produit',
        `<form class="form" id="pf">
          <label class="field"><span>Nom du produit *</span><input name="nom" required maxlength="120" value="${esc(p?.nom || '')}"></label>
          <div class="field"><span>Photo du produit</span>
            <div class="photo-edit">
              <div id="ph-prev">${photoThumb(p || { nom: '?' }, 'thumb lg')}</div>
              <div class="ph-actions">
                <input type="file" name="photo" id="ph-file" accept="image/jpeg,image/png,image/webp">
                ${p?.photo_url ? '<label class="check"><input type="checkbox" name="retirer_photo"> Retirer la photo</label>' : ''}
              </div>
            </div>
          </div>
          <div class="grid-2">
            <label class="field"><span>Référence</span><input name="reference" maxlength="40" value="${esc(p?.reference || '')}"></label>
            <label class="field"><span>Catégorie</span><select name="categorie_id"><option value="">— Aucune —</option>${cats
              .map((c) => `<option value="${esc(c.id)}" ${p?.categorie_id === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`)
              .join('')}</select></label>
          </div>
          <div class="grid-2">
            <label class="field"><span>Prix d'achat (FCFA) *</span><input name="prix_achat" type="number" min="0" step="1" required inputmode="numeric" value="${p ? couts[p.id] ?? 0 : ''}"></label>
            <label class="field"><span>Prix de vente (FCFA) *</span><input name="prix_vente" type="number" min="0" step="1" required inputmode="numeric" value="${p ? p.prix_vente : ''}"></label>
          </div>
          <div class="grid-2">
            <label class="field"><span>Seuil d'alerte</span><input name="seuil_alerte" type="number" min="0" step="1" value="${p ? p.seuil_alerte : 5}"></label>
            ${p ? '' : '<label class="field"><span>Stock initial</span><input name="stock" type="number" min="0" step="1" value="0"></label>'}
          </div>
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>
        </form>`
      );
      $('#ph-file', m.el).addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (f && /^image\//.test(f.type)) $('#ph-prev', m.el).innerHTML = `<img class="thumb lg" src="${URL.createObjectURL(f)}" alt="">`;
      });
      onSubmit($('#pf', m.el), async (d, f) => {
        const payload = {
          nom: d.nom.trim(),
          reference: d.reference.trim() || null,
          categorie_id: d.categorie_id || null,
          prix_vente: toInt(d.prix_vente),
          seuil_alerte: toInt(d.seuil_alerte),
        };
        if (!payload.nom) throw new Error('Le nom est obligatoire.');
        const achat = toInt(d.prix_achat);
        const file = f.elements.photo.files[0];
        if (file) payload.photo_url = await Photos.upload(file);
        else if (f.elements.retirer_photo?.checked) payload.photo_url = null;
        if (p) {
          const r1 = await sb.from('produits').update(payload).eq('id', p.id);
          if (r1.error) throw r1.error;
          const r2 = await sb.from('produits_couts').upsert({ produit_id: p.id, prix_achat: achat });
          if (r2.error) throw r2.error;
        } else {
          const r1 = await sb.from('produits').insert(payload).select('id').single();
          if (r1.error) throw r1.error;
          const r2 = await sb.from('produits_couts').insert({ produit_id: r1.data.id, prix_achat: achat });
          if (r2.error) throw r2.error;
          const init = toInt(d.stock);
          if (init > 0) {
            const r3 = await sb.rpc('mouvement_stock', { p_produit: r1.data.id, p_type: 'entree', p_quantite: init, p_motif: 'Stock initial' });
            if (r3.error) throw r3.error;
          }
        }
        if (p?.photo_url && 'photo_url' in payload) Photos.remove(p.photo_url);
        toast('Produit enregistré', 'success');
        m.close();
        await refresh();
      });
    };

    const catForm = (c) => {
      const m = modal(
        c ? 'Modifier la catégorie' : 'Nouvelle catégorie',
        `<form class="form" id="cf">
          <label class="field"><span>Nom *</span><input name="nom" required maxlength="80" value="${esc(c?.nom || '')}"></label>
          <label class="field"><span>Description</span><textarea name="description" rows="3" maxlength="300">${esc(c?.description || '')}</textarea></label>
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>
        </form>`
      );
      onSubmit($('#cf', m.el), async (d) => {
        const payload = { nom: d.nom.trim(), description: d.description.trim() || null };
        if (!payload.nom) throw new Error('Le nom est obligatoire.');
        const r = c ? await sb.from('categories').update(payload).eq('id', c.id) : await sb.from('categories').insert(payload);
        if (r.error) throw r.error;
        toast('Catégorie enregistrée', 'success');
        m.close();
        await refresh();
      });
    };

    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab],[data-edit],[data-arch],[data-cedit],[data-cdel]');
      if (!t) return;
      if (t.dataset.tab) {
        st.tab = t.dataset.tab;
        $$('#tabs .tab', root).forEach((b) => b.classList.toggle('active', b === t));
        draw();
      } else if (t.dataset.edit) productForm(produits.find((p) => p.id === t.dataset.edit));
      else if (t.dataset.cedit) catForm(cats.find((c) => c.id === t.dataset.cedit));
      else if (t.dataset.arch) {
        const p = produits.find((x) => x.id === t.dataset.arch);
        const msg = p.actif ? `Archiver « ${p.nom} » ? Il ne sera plus proposé à la vente.` : `Réactiver « ${p.nom} » ?`;
        if (!(await confirmBox(msg))) return;
        await safe(async () => {
          const { error } = await sb.from('produits').update({ actif: !p.actif }).eq('id', p.id);
          if (error) throw error;
          toast(p.actif ? 'Produit archivé' : 'Produit réactivé', 'success');
          await refresh();
        });
      } else if (t.dataset.cdel) {
        const c = cats.find((x) => x.id === t.dataset.cdel);
        if (!(await confirmBox(`Supprimer la catégorie « ${c.nom} » ? Ses produits resteront sans catégorie.`, { ok: 'Supprimer', danger: true }))) return;
        await safe(async () => {
          const { error } = await sb.from('categories').delete().eq('id', c.id);
          if (error) throw error;
          toast('Catégorie supprimée', 'success');
          await refresh();
        });
      }
    });

    await load();
    draw();
  },
};
