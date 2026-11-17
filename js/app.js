'use strict';

const Pages = {};

const NAV = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'grid' },
  { id: 'vente', label: 'Nouvelle vente', icon: 'cart' },
  { id: 'ventes', label: 'Ventes & paiements', icon: 'receipt' },
  { id: 'produits', label: 'Produits', icon: 'tag' },
  { id: 'stock', label: 'Stock', icon: 'box' },
  { id: 'depenses', label: 'Dépenses', icon: 'coin', admin: true },
  { id: 'personnel', label: 'Personnel', icon: 'users', admin: true },
  { id: 'historique', label: 'Historique', icon: 'clock', admin: true },
  { id: 'parametres', label: 'Paramètres', icon: 'sliders', admin: true },
];

const Data = {
  async categories() {
    const { data, error } = await sb.from('categories').select('*').order('nom');
    if (error) throw error;
    return data;
  },
  async produits({ actifOnly = false } = {}) {
    let q = sb
      .from('produits')
      .select('id,nom,reference,categorie_id,prix_vente,stock,seuil_alerte,actif,created_at,photo_url,categories(nom)')
      .order('nom');
    if (actifOnly) q = q.eq('actif', true);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async couts() {
    const { data, error } = await sb.from('produits_couts').select('*');
    if (error) throw error;
    return Object.fromEntries(data.map((r) => [r.produit_id, Number(r.prix_achat)]));
  },
};

const App = {
  started: false,
  routeBound: false,
  settings: { nom_boutique: 'DAROU SALAM VAISSELLE', adresse: 'Kounoune 2', telephone: '', message_pied: 'Merci de votre confiance !' },
  staff: {},

  staffName(id) {
    return this.staff[id] || '—';
  },

  async loadShared() {
    const [s, p] = await Promise.all([sb.from('parametres').select('*').eq('id', 1).maybeSingle(), sb.from('profiles').select('id,nom')]);
    if (s.data) this.settings = s.data;
    if (p.data) this.staff = Object.fromEntries(p.data.map((x) => [x.id, x.nom]));
  },

  showView(name) {
    ['auth-view', 'pending-view', 'app-view'].forEach((id) => $('#' + id).classList.toggle('hidden', id !== name));
    $('#loader').classList.add('hidden');
  },
};

async function route() {
  const id = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/')[0];
  const nav = NAV.find((n) => n.id === id) || NAV[0];
  if (nav.admin && !Auth.isAdmin) {
    location.hash = '#/dashboard';
    return;
  }
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav.id));
  $('#page-title').textContent = nav.label;
  document.body.classList.remove('nav-open');
  const root = document.createElement('div');
  root.className = 'page-inner fade-in';
  root.innerHTML = '<div class="center pad"><div class="spin lg"></div></div>';
  $('#page').replaceChildren(root);
  try {
    await Pages[nav.id].render(root);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="card error-card"><h3>Une erreur est survenue</h3><p class="muted">${esc(errMsg(e))}</p><button class="btn primary" id="retry">Réessayer</button></div>`;
    $('#retry', root).addEventListener('click', route);
  }
  window.scrollTo(0, 0);
}
App.route = route;

function buildShell() {
  const p = Auth.profile;
  $('#nav').innerHTML = NAV.filter((n) => !n.admin || Auth.isAdmin)
    .map((n) => `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon, 19)}<span>${esc(n.label)}</span></a>`)
    .join('');
  $('#burger').innerHTML = icon('menu', 22);
  const chip = `<span class="avatar">${esc(initials(p.nom))}</span>`;
  if (CONFIG.OPEN_MODE) {
    $('#btn-account').innerHTML = `${chip}<span class="su-text"><b>${esc(p.nom)}</b><small>Accès libre</small></span>`;
    $('#btn-account').style.cursor = 'default';
    $('#btn-account-top').classList.add('hidden');
  } else {
    $('#btn-account').innerHTML = `${chip}<span class="su-text"><b>${esc(p.nom)}</b><small>${p.role === 'admin' ? 'Administrateur' : 'Personnel'}</small></span>`;
    $('#btn-account-top').innerHTML = chip;
  }
  $('#side-shop').textContent = App.settings.nom_boutique;
}

function accountModal() {
  if (CONFIG.OPEN_MODE) return;
  const p = Auth.profile;
  const m = modal(
    'Mon compte',
    `<div class="acc"><span class="avatar lg">${esc(initials(p.nom))}</span><div><b>${esc(p.nom)}</b><div class="muted sm">${esc(p.email || '')}</div>${badge(p.role === 'admin' ? 'Administrateur' : 'Personnel', p.role === 'admin' ? 'ok' : 'muted')}</div></div>
     <form id="pw-form" class="form" autocomplete="off"><h4 class="sec-title">Changer le mot de passe</h4>
       <label class="field"><span>Nouveau mot de passe</span><input type="password" name="pw" minlength="8" required autocomplete="new-password"></label>
       <label class="field"><span>Confirmer</span><input type="password" name="pw2" minlength="8" required autocomplete="new-password"></label>
       <div class="form-actions"><button class="btn primary" type="submit">Mettre à jour</button></div></form>
     <div class="form-actions between"><button class="btn danger ghost" id="acc-logout" type="button">${icon('logout')} Déconnexion</button></div>`
  );
  onSubmit($('#pw-form', m.el), async (d) => {
    if (d.pw !== d.pw2) throw new Error('Les mots de passe ne correspondent pas.');
    const { error } = await sb.auth.updateUser({ password: d.pw });
    if (error) throw error;
    toast('Mot de passe mis à jour', 'success');
    m.close();
  });
  $('#acc-logout', m.el).addEventListener('click', () => Auth.logout());
}

async function afterAuth() {
  if (!CONFIG.OPEN_MODE && !Auth.session) return App.showView('auth-view');
  if (!Auth.profile || !Auth.profile.actif) return App.showView('pending-view');
  await App.loadShared();
  buildShell();
  App.started = true;
  App.showView('app-view');
  if (!App.routeBound) {
    App.routeBound = true;
    window.addEventListener('hashchange', route);
    $('#burger').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    $('#overlay').addEventListener('click', () => document.body.classList.remove('nav-open'));
    $('#btn-account').addEventListener('click', accountModal);
    $('#btn-account-top').addEventListener('click', accountModal);
  }
  route();
}

function bindAuthForms() {
  onSubmit($('#login-form'), async (d) => {
    await Auth.login(d.email.trim(), d.password);
    await afterAuth();
  });
  $('#btn-logout-pending').addEventListener('click', () => Auth.logout());
}

async function boot() {
  bindAuthForms();
  if (/VOTRE-PROJET|VOTRE_CLE/.test(CONFIG.SUPABASE_URL + CONFIG.SUPABASE_ANON_KEY)) {
    App.showView('auth-view');
    $('#config-warning').classList.remove('hidden');
    return;
  }
  try {
    await Auth.init();
    await afterAuth();
  } catch (e) {
    console.error(e);
    App.showView('auth-view');
    toast(errMsg(e), 'error');
  }
}

document.addEventListener('DOMContentLoaded', boot);
