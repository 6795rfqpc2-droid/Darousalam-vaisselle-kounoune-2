'use strict';

Pages.parametres = {
  async render(root) {
    const s = App.settings;
    root.innerHTML = `
      <div class="page-head"><div><h2>Paramètres</h2><p class="muted">Informations affichées sur les reçus et factures</p></div></div>
      <div class="card narrow">
        <form class="form" id="sf">
          <label class="field"><span>Nom de la boutique *</span><input name="nom_boutique" required maxlength="80" value="${esc(s.nom_boutique)}"></label>
          <label class="field"><span>Adresse</span><input name="adresse" maxlength="120" value="${esc(s.adresse || '')}"></label>
          <label class="field"><span>Téléphone</span><input name="telephone" type="tel" maxlength="40" value="${esc(s.telephone || '')}"></label>
          <label class="field"><span>Message de bas de reçu</span><input name="message_pied" maxlength="160" value="${esc(s.message_pied || '')}"></label>
          <div class="form-actions"><button class="btn primary" type="submit">Enregistrer</button></div>
        </form>
      </div>`;
    onSubmit($('#sf', root), async (d) => {
      const payload = {
        nom_boutique: d.nom_boutique.trim(),
        adresse: d.adresse.trim(),
        telephone: d.telephone.trim(),
        message_pied: d.message_pied.trim(),
      };
      if (!payload.nom_boutique) throw new Error('Le nom de la boutique est obligatoire.');
      const { error } = await sb.from('parametres').update(payload).eq('id', 1);
      if (error) throw error;
      Object.assign(App.settings, payload);
      $('#side-shop').textContent = payload.nom_boutique;
      toast('Paramètres enregistrés', 'success');
    });
  },
};
