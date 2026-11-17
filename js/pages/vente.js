'use strict';

Pages.vente = {
  async render(root) {
    const [produits, cats] = await Promise.all([Data.produits({ actifOnly: true }), Data.categories()]);
    const byId = new Map(produits.map((p) => [p.id, p]));
    const st = { cart: [], q: '', cat: '', payFull: true };

    root.innerHTML = `
      <div class="page-head"><div><h2>Nouvelle vente</h2><p class="muted">Sélectionnez les produits puis encaissez</p></div></div>
      <div class="pos">
        <section class="pos-products">
          <div class="search big">${icon('search')}<input id="p-q" type="search" placeholder="Rechercher un produit ou une référence…" autocomplete="off"></div>
          <div class="chips scroll" id="p-cats"></div>
          <div class="product-grid" id="p-grid"></div>
        </section>
        <form class="pos-cart card" id="cart" autocomplete="off">
          <div class="card-head"><h3>Panier</h3><button type="button" class="btn ghost sm" id="c-clear">Vider</button></div>
          <div id="c-lines" class="cart-lines"></div>
          <div class="grid-2">
            <label class="field"><span>Client</span><input id="c-nom" placeholder="Nom (optionnel)" maxlength="80"></label>
            <label class="field"><span>Téléphone</span><input id="c-tel" type="tel" placeholder="77 000 00 00" maxlength="20"></label>
          </div>
          <label class="field"><span>Remise (FCFA)</span><input id="c-remise" type="number" min="0" step="1" value="0" inputmode="numeric"></label>
          <div class="totals" id="c-totals"></div>
          <div class="field"><span>Mode de paiement</span>${modePicker('especes')}</div>
          <label class="field"><span>Montant encaissé (FCFA)</span><input id="c-montant" type="number" min="0" step="1" value="0" inputmode="numeric"></label>
          <div class="quick">
            <button type="button" class="chip" data-pay="full">Paiement intégral</button>
            <button type="button" class="chip" data-pay="half">Moitié</button>
            <button type="button" class="chip" data-pay="zero">À crédit</button>
          </div>
          <button class="btn primary lg block" type="submit" id="c-submit">Valider la vente</button>
        </form>
      </div>
      <button class="cart-fab" id="fab" type="button"></button>`;

    const sub = () => st.cart.reduce((s, c) => s + byId.get(c.id).prix_vente * c.qte, 0);
    const remise = () => Math.min(toInt($('#c-remise', root).value), sub());
    const total = () => sub() - remise();
    const montant = () => Math.min(toInt($('#c-montant', root).value), total());

    const drawCats = () => {
      $('#p-cats', root).innerHTML =
        `<button type="button" class="chip ${st.cat ? '' : 'active'}" data-cat="">Toutes</button>` +
        cats.map((c) => `<button type="button" class="chip ${st.cat === c.id ? 'active' : ''}" data-cat="${esc(c.id)}">${esc(c.nom)}</button>`).join('');
    };

    const drawGrid = () => {
      const q = st.q.trim().toLowerCase();
      const list = produits.filter((p) => (!st.cat || p.categorie_id === st.cat) && (!q || `${p.nom} ${p.reference || ''}`.toLowerCase().includes(q)));
      $('#p-grid', root).innerHTML = list.length
        ? list
            .map(
              (p) => `<button type="button" class="pcard ${p.stock <= 0 ? 'out' : ''}" data-id="${esc(p.id)}" ${p.stock <= 0 ? 'disabled' : ''}>
                ${photoThumb(p, 'pimg')}
                <span class="pname">${esc(p.nom)}</span>
                <span class="pprice">${esc(fcfa(p.prix_vente))}</span>
                <span class="pstock ${p.stock <= p.seuil_alerte ? 'low' : ''}">${p.stock <= 0 ? 'Rupture' : `${p.stock} en stock`}</span>
              </button>`
            )
            .join('')
        : '<div class="empty wide">Aucun produit trouvé</div>';
    };

    const drawTotals = () => {
      const s = sub();
      const r = remise();
      const t = s - r;
      if (st.payFull) $('#c-montant', root).value = t;
      const m = montant();
      $('#c-totals', root).innerHTML = `
        <div class="t-row"><span>Sous-total</span><span>${esc(fcfa(s))}</span></div>
        ${r > 0 ? `<div class="t-row"><span>Remise</span><span>- ${esc(fcfa(r))}</span></div>` : ''}
        <div class="t-row big"><span>Total</span><span>${esc(fcfa(t))}</span></div>
        <div class="t-row ${t - m > 0 ? 'warn' : ''}"><span>Reste à payer</span><span>${esc(fcfa(t - m))}</span></div>`;
      const n = st.cart.reduce((a, c) => a + c.qte, 0);
      $('#fab', root).innerHTML = `${icon('cart')} Panier (${n}) · ${esc(fcfa(t))}`;
      $('#fab', root).classList.toggle('hidden', n === 0);
    };

    const drawCart = () => {
      $('#c-lines', root).innerHTML = st.cart.length
        ? st.cart
            .map((c) => {
              const p = byId.get(c.id);
              return `<div class="cline">
                ${photoThumb(p, 'thumb sm')}
                <div class="cl-info"><b>${esc(p.nom)}</b><small class="muted">${esc(fcfa(p.prix_vente))} × ${c.qte} = ${esc(fcfa(p.prix_vente * c.qte))}</small></div>
                <div class="stepper">
                  <button type="button" data-act="dec" data-id="${esc(c.id)}" aria-label="Moins">−</button>
                  <input type="number" min="1" max="${p.stock}" value="${c.qte}" data-qty="${esc(c.id)}" inputmode="numeric" aria-label="Quantité">
                  <button type="button" data-act="inc" data-id="${esc(c.id)}" aria-label="Plus">+</button>
                </div>
                <button type="button" class="icon-btn" data-act="del" data-id="${esc(c.id)}" aria-label="Retirer">${icon('trash', 16)}</button>
              </div>`;
            })
            .join('')
        : '<div class="empty">Panier vide — touchez un produit pour l\'ajouter</div>';
      drawTotals();
    };

    const add = (id) => {
      const p = byId.get(id);
      if (!p) return;
      const line = st.cart.find((c) => c.id === id);
      const q = (line ? line.qte : 0) + 1;
      if (q > p.stock) return toast(`Stock disponible : ${p.stock}`, 'warn');
      if (line) line.qte = q;
      else st.cart.push({ id, qte: 1 });
      drawCart();
    };

    $('#p-q', root).addEventListener('input', (e) => {
      st.q = e.target.value;
      drawGrid();
    });
    $('#p-cats', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      st.cat = b.dataset.cat;
      drawCats();
      drawGrid();
    });
    $('#p-grid', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (b) add(b.dataset.id);
    });
    $('#c-lines', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const line = st.cart.find((c) => c.id === b.dataset.id);
      if (!line) return;
      const p = byId.get(line.id);
      if (b.dataset.act === 'inc') {
        if (line.qte + 1 > p.stock) return toast(`Stock disponible : ${p.stock}`, 'warn');
        line.qte++;
      } else if (b.dataset.act === 'dec') {
        line.qte--;
        if (line.qte <= 0) st.cart = st.cart.filter((c) => c !== line);
      } else st.cart = st.cart.filter((c) => c !== line);
      drawCart();
    });
    $('#c-lines', root).addEventListener('change', (e) => {
      const i = e.target.closest('[data-qty]');
      if (!i) return;
      const line = st.cart.find((c) => c.id === i.dataset.qty);
      const p = byId.get(i.dataset.qty);
      let q = toInt(i.value);
      if (q <= 0) st.cart = st.cart.filter((c) => c !== line);
      else {
        if (q > p.stock) {
          toast(`Stock disponible : ${p.stock}`, 'warn');
          q = p.stock;
        }
        line.qte = q;
      }
      drawCart();
    });
    $('#c-clear', root).addEventListener('click', () => {
      st.cart = [];
      st.payFull = true;
      drawCart();
    });
    $('#c-remise', root).addEventListener('input', drawTotals);
    $('#c-montant', root).addEventListener('input', () => {
      st.payFull = false;
      drawTotals();
    });
    $('.quick', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-pay]');
      if (!b) return;
      if (b.dataset.pay === 'full') {
        st.payFull = true;
      } else {
        st.payFull = false;
        $('#c-montant', root).value = b.dataset.pay === 'half' ? Math.round(total() / 2) : 0;
      }
      drawTotals();
    });
    $('#fab', root).addEventListener('click', () => $('#cart', root).scrollIntoView({ behavior: 'smooth' }));

    $('#cart', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#c-submit', root);
      await busy(btn, async () => {
        try {
          if (!st.cart.length) throw new Error('Le panier est vide.');
          const t = total();
          const m = montant();
          const nom = $('#c-nom', root).value.trim();
          if (t <= 0) throw new Error('Le total doit être supérieur à 0.');
          if (m < t && !nom) throw new Error('Le nom du client est obligatoire pour un paiement partiel ou à crédit.');
          const mode = new FormData($('#cart', root)).get('mode');
          const { data, error } = await sb.rpc('creer_vente', {
            p_client_nom: nom,
            p_client_tel: $('#c-tel', root).value.trim(),
            p_remise: remise(),
            p_lignes: st.cart.map((c) => ({ produit_id: c.id, quantite: c.qte })),
            p_montant: m,
            p_mode: mode,
          });
          if (error) throw error;
          toast('Vente enregistrée', 'success');
          await App.route();
          Sales.detail(data);
        } catch (err) {
          console.error(err);
          toast(errMsg(err), 'error');
        }
      });
    });

    drawCats();
    drawGrid();
    drawCart();
  },
};
