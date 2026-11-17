'use strict';

Pages.personnel = {
  async render(root) {
    const me = Auth.session?.user.id || null;
    let staff = [];
    let sales = {};

    root.innerHTML = `
      <div class="page-head"><div><h2>Personnel</h2><p class="muted">Comptes, rôles et accès</p></div>
        <button class="btn primary" id="new-staff" type="button">${icon('plus')} Ajouter un membre</button></div>
      <div class="card" id="s-list"></div>`;

    const draw = () => {
      $('#s-list', root).innerHTML = dataTable(
        [
          { h: 'Nom', r: (p) => `<div class="who"><span class="avatar">${esc(initials(p.nom))}</span><span><b>${esc(p.nom)}</b>${p.id === me ? ' <small class="muted">(vous)</small>' : ''}<small class="muted block">${esc(p.email || '')}</small></span></div>` },
          { h: 'Téléphone', r: (p) => esc(p.telephone || '—') },
          { h: 'Rôle', r: (p) => (p.role === 'admin' ? badge('Administrateur', 'ok') : badge('Personnel', 'muted')) },
          { h: 'Statut', r: (p) => (p.actif ? badge('Actif', 'ok') : badge('Inactif', 'bad')) },
          { h: 'Ventes du mois', c: 'right', r: (p) => (sales[p.id] ? `${esc(fcfa(sales[p.id].total))} <small class="muted block">${sales[p.id].n} vente(s)</small>` : '—') },
          { h: '', c: 'actions', r: (p) => `<button class="btn sm" data-edit="${esc(p.id)}" type="button">${icon('edit', 15)} Modifier</button>` },
        ],
        staff,
        { empty: 'Aucun membre' }
      );
    };

    const load = async () => {
      const [p, v] = await Promise.all([
        sb.from('profiles').select('*').order('created_at'),
        sb.from('ventes').select('user_id,total').eq('annulee', false).gte('created_at', dayStartISO(monthStart())).limit(5000),
      ]);
      if (p.error) throw p.error;
      if (v.error) throw v.error;
      staff = p.data;
      sales = {};
      v.data.forEach((x) => {
        const s = (sales[x.user_id] ||= { total: 0, n: 0 });
        s.total += Number(x.total);
        s.n++;
      });
      App.staff = Object.fromEntries(staff.map((x) => [x.id, x.nom]));
      draw();
    };

    const roleSelect = (val, disabled) =>
      `<select name="role" ${disabled ? 'disabled' : ''}><option value="personnel" ${val === 'personnel' ? 'selected' : ''}>Personnel</option><option value="admin" ${val === 'admin' ? 'selected' : ''}>Administrateur</option></select>`;

    const addForm = () => {
      const m = modal(
        'Ajouter un membre',
        `<form class="form" id="af" autocomplete="off">
          <label class="field"><span>Nom complet *</span><input name="nom" required maxlength="80"></label>
          <div class="grid-2">
            <label class="field"><span>Téléphone</span><input name="telephone" type="tel" maxlength="20"></label>
            <label class="field"><span>Rôle</span>${roleSelect('personnel', false)}</label>
          </div>
          <label class="field"><span>Email (identifiant de connexion) *</span><input name="email" type="email" required autocomplete="off"></label>
          <label class="field"><span>Mot de passe provisoire * (8 caractères min.)</span><input name="password" type="text" minlength="8" required autocomplete="new-password"></label>
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit">Créer le compte</button></div>
        </form>`
      );
      onSubmit($('#af', m.el), async (d) => {
        const nom = d.nom.trim();
        const email = d.email.trim();
        if (!nom) throw new Error('Le nom est obligatoire.');
        if (d.password.length < 8) throw new Error('Mot de passe trop court (8 caractères minimum).');
        const tmp = sbTemp();
        const { data, error } = await tmp.auth.signUp({ email, password: d.password, options: { data: { nom, telephone: d.telephone.trim() } } });
        if (error) throw error;
        if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('Cet email est déjà utilisé.');
        const r = await sb.from('profiles').update({ role: d.role, actif: true, nom, telephone: d.telephone.trim() || null }).eq('id', data.user.id);
        if (r.error) throw r.error;
        toast('Compte créé et activé', 'success');
        m.close();
        await load();
      });
    };

    const editForm = (p) => {
      const self = p.id === me;
      const m = modal(
        'Modifier le membre',
        `<form class="form" id="ef">
          <label class="field"><span>Nom complet *</span><input name="nom" required maxlength="80" value="${esc(p.nom)}"></label>
          <div class="grid-2">
            <label class="field"><span>Téléphone</span><input name="telephone" type="tel" maxlength="20" value="${esc(p.telephone || '')}"></label>
            <label class="field"><span>Rôle</span>${roleSelect(p.role, self)}</label>
          </div>
          <div class="field"><span>Email</span><input value="${esc(p.email || '')}" disabled></div>
          <label class="check"><input type="checkbox" name="actif" ${p.actif ? 'checked' : ''} ${self ? 'disabled' : ''}> Compte actif (peut se connecter)</label>
          ${self ? '<p class="muted sm">Vous ne pouvez pas modifier votre propre rôle ni désactiver votre compte.</p>' : ''}
          <div class="form-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>
        </form>`
      );
      onSubmit($('#ef', m.el), async (d, f) => {
        const payload = { nom: d.nom.trim(), telephone: d.telephone.trim() || null };
        if (!payload.nom) throw new Error('Le nom est obligatoire.');
        if (!self) {
          payload.role = d.role;
          payload.actif = f.elements.actif.checked;
        }
        const r = await sb.from('profiles').update(payload).eq('id', p.id);
        if (r.error) throw r.error;
        toast('Membre mis à jour', 'success');
        m.close();
        await load();
      });
    };

    $('#new-staff', root).addEventListener('click', addForm);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-edit]');
      if (b) editForm(staff.find((x) => x.id === b.dataset.edit));
    });
    await load();
  },
};
