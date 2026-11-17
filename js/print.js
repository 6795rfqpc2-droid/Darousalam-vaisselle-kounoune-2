'use strict';

const Print = {
  async load(id) {
    const [v, l, p] = await Promise.all([
      sb.from('ventes').select('*').eq('id', id).single(),
      sb.from('vente_lignes').select(LIGNE_COLS).eq('vente_id', id).order('designation'),
      sb.from('paiements').select('*').eq('vente_id', id).order('created_at'),
    ]);
    if (v.error) throw v.error;
    if (l.error) throw l.error;
    if (p.error) throw p.error;
    return { vente: v.data, lignes: l.data, paiements: p.data };
  },

  async print(id, type = 'recu') {
    const d = await this.load(id);
    $('#print-area').innerHTML = type === 'facture' ? this.invoice(d) : this.receipt(d);
    let st = $('#page-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'page-style';
      document.head.appendChild(st);
    }
    st.textContent = type === 'facture' ? '@page{size:A4;margin:12mm}' : '@page{size:80mm auto;margin:3mm}';
    setTimeout(() => window.print(), 120);
  },

  receipt({ vente: v, lignes, paiements }) {
    const s = App.settings || {};
    const reste = Math.max(0, v.total - v.montant_paye);
    return `<div class="rc">
      <div class="rc-center"><div class="rc-shop">${esc(s.nom_boutique)}</div><div>${esc(s.adresse)}</div>${s.telephone ? `<div>Tél : ${esc(s.telephone)}</div>` : ''}</div>
      <hr>
      ${v.annulee ? '<div class="rc-center rc-void">*** VENTE ANNULÉE ***</div>' : ''}
      <div class="rc-row"><span>Reçu n°</span><b>${pad(v.numero, 6)}</b></div>
      <div class="rc-row"><span>Date</span><span>${fmtDate(v.created_at)}</span></div>
      <div class="rc-row"><span>Vendeur</span><span>${esc(App.staffName(v.user_id))}</span></div>
      ${v.client_nom ? `<div class="rc-row"><span>Client</span><span>${esc(v.client_nom)}</span></div>` : ''}
      <hr>
      ${lignes
        .map(
          (l) => `<div class="rc-line"><div>${esc(l.designation)}</div><div class="rc-row"><span>${l.quantite} × ${num(l.prix_unitaire)}</span><span>${num(l.quantite * l.prix_unitaire)}</span></div></div>`
        )
        .join('')}
      <hr>
      <div class="rc-row"><span>Sous-total</span><span>${num(v.sous_total)}</span></div>
      ${v.remise > 0 ? `<div class="rc-row"><span>Remise</span><span>- ${num(v.remise)}</span></div>` : ''}
      <div class="rc-row rc-total"><span>TOTAL</span><span>${fcfa(v.total)}</span></div>
      <div class="rc-row"><span>Payé</span><span>${fcfa(v.montant_paye)}</span></div>
      ${reste > 0 ? `<div class="rc-row rc-total"><span>RESTE À PAYER</span><span>${fcfa(reste)}</span></div>` : ''}
      ${
        paiements.length
          ? `<hr><div class="rc-small">${paiements.map((p) => `<div class="rc-row"><span>${fmtDate(p.created_at)} · ${esc(MODES[p.mode] || p.mode)}</span><span>${num(p.montant)}</span></div>`).join('')}</div>`
          : ''
      }
      <hr>
      <div class="rc-center">${esc(s.message_pied)}</div>
    </div>`;
  },

  invoice({ vente: v, lignes, paiements }) {
    const s = App.settings || {};
    const reste = Math.max(0, v.total - v.montant_paye);
    return `<div class="inv">
      <div class="inv-head">
        <div><div class="inv-shop">${esc(s.nom_boutique)}</div><div>${esc(s.adresse)}</div>${s.telephone ? `<div>Tél : ${esc(s.telephone)}</div>` : ''}</div>
        <div class="inv-title"><h1>FACTURE</h1><div>N° F-${pad(v.numero, 6)}</div><div>Date : ${fmtDate(v.created_at)}</div></div>
      </div>
      ${v.annulee ? '<div class="inv-void">ANNULÉE</div>' : ''}
      <div class="inv-meta">
        <div><div class="inv-lbl">Facturé à</div><b>${esc(v.client_nom || 'Client comptoir')}</b>${v.client_tel ? `<div>${esc(v.client_tel)}</div>` : ''}</div>
        <div><div class="inv-lbl">Vendeur</div><b>${esc(App.staffName(v.user_id))}</b></div>
        <div><div class="inv-lbl">Statut</div><b>${esc((STATUTS[v.statut] || [v.statut])[0])}</b></div>
      </div>
      <table class="inv-table">
        <thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">Prix unitaire</th><th class="r">Montant</th></tr></thead>
        <tbody>${lignes
          .map((l) => `<tr><td>${esc(l.designation)}</td><td class="r">${l.quantite}</td><td class="r">${num(l.prix_unitaire)}</td><td class="r">${num(l.quantite * l.prix_unitaire)}</td></tr>`)
          .join('')}</tbody>
      </table>
      <div class="inv-totals">
        <div><span>Sous-total</span><span>${fcfa(v.sous_total)}</span></div>
        ${v.remise > 0 ? `<div><span>Remise</span><span>- ${fcfa(v.remise)}</span></div>` : ''}
        <div class="big"><span>Total</span><span>${fcfa(v.total)}</span></div>
        <div><span>Déjà réglé</span><span>${fcfa(v.montant_paye)}</span></div>
        <div class="big"><span>Reste à payer</span><span>${fcfa(reste)}</span></div>
      </div>
      ${
        paiements.length
          ? `<div class="inv-lbl" style="margin-top:18px">Paiements reçus</div><table class="inv-table small"><tbody>${paiements
              .map((p) => `<tr><td>${fmtDate(p.created_at)}</td><td>${esc(MODES[p.mode] || p.mode)}</td><td class="r">${fcfa(p.montant)}</td></tr>`)
              .join('')}</tbody></table>`
          : ''
      }
      <div class="inv-foot">${esc(s.message_pied)}</div>
      <div class="inv-sign"><div>Cachet et signature</div></div>
    </div>`;
  },
};

window.addEventListener('afterprint', () => {
  const a = $('#print-area');
  if (a) a.innerHTML = '';
});
