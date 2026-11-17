'use strict';

const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Client temporaire (sans session) pour créer des comptes sans déconnecter l'administrateur
const sbTemp = () =>
  window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'ds-temp-signup' },
  });

const Auth = {
  session: null,
  profile: null,

  get isAdmin() {
    return !!(this.profile && this.profile.actif && this.profile.role === 'admin');
  },

  async init() {
    if (CONFIG.OPEN_MODE) {
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
      this.profile = { id: null, nom: 'Boutique', email: '', role: 'admin', actif: true };
      return;
    }
    const { data } = await sb.auth.getSession();
    this.session = data.session;
    if (this.session) await this.loadProfile();
  },

  async loadProfile() {
    const { data, error } = await sb.from('profiles').select('*').eq('id', this.session.user.id).maybeSingle();
    if (error) throw error;
    this.profile = data;
  },

  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid login/i.test(error.message) ? 'Email ou mot de passe incorrect.' : error.message);
    this.session = data.session;
    await this.loadProfile();
  },

  async signup({ nom, telephone, email, password }) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nom, telephone } } });
    if (error) throw error;
    if (!data.session) throw new Error('Compte créé. Confirmez votre email puis connectez-vous.');
    this.session = data.session;
    await this.loadProfile();
  },

  async logout() {
    await sb.auth.signOut();
    this.session = null;
    this.profile = null;
    location.hash = '';
    location.reload();
  },
};

sb.auth.onAuthStateChange((evt) => {
  if (evt === 'SIGNED_OUT' && typeof App !== 'undefined' && App.started) location.reload();
});
