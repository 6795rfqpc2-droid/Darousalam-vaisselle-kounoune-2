'use strict';

/* ---------- DOM & formats ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0));
const fcfa = (n) => `${num(n)} FCFA`;
const pad = (n, l = 2) => String(n ?? '').padStart(l, '0');
const toInt = (v) => Math.max(0, Math.round(Number(v) || 0));
const isoDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const today = () => isoDay(new Date());
const shiftDay = (n, from = new Date()) => {
  const x = new Date(from);
  x.setDate(x.getDate() + n);
  return isoDay(x);
};
const monthStart = () => {
  const x = new Date();
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-01`;
};
const dayStartISO = (s) => new Date(`${s}T00:00:00`).toISOString();
const dayEndISO = (s) => {
  const x = new Date(`${s}T00:00:00`);
  x.setDate(x.getDate() + 1);
  return x.toISOString();
};
const fmtDate = (d, withTime = true) => {
  if (!d) return '—';
  const x = new Date(d);
  const date = x.toLocaleDateString('fr-FR');
  return withTime ? `${date} ${x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : date;
};
const fmtDay = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR') : '—');
const initials = (n) =>
  String(n || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

const LIGNE_COLS = 'id,vente_id,produit_id,designation,quantite,prix_unitaire';
const MODES = { especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money' };
const STATUTS = { payee: ['Payée', 'ok'], partielle: ['Partielle', 'warn'], impayee: ['Impayée', 'bad'], annulee: ['Annulée', 'muted'] };

const badge = (t, k = 'muted') => `<span class="badge ${k}">${esc(t)}</span>`;
const statutBadge = (s) => {
  const [t, k] = STATUTS[s] || [s, 'muted'];
  return badge(t, k);
};
const stockBadge = (s, seuil) => (s <= 0 ? badge('Rupture', 'bad') : s <= seuil ? badge(`${s} · Faible`, 'warn') : badge(String(s), 'ok'));
const modePicker = (sel = 'especes') =>
  `<div class="mode-picker">${Object.entries(MODES)
    .map(([k, l]) => `<label class="mode ${k}"><input type="radio" name="mode" value="${k}" ${k === sel ? 'checked' : ''}><span>${l}</span></label>`)
    .join('')}</div>`;
const kpi = (label, value, sub = '', tone = '') =>
  `<div class="kpi ${tone}"><div class="k-label">${esc(label)}</div><div class="k-value">${esc(value)}</div>${sub ? `<div class="k-sub">${esc(sub)}</div>` : ''}</div>`;

/* ---------- Icônes ---------- */
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  receipt: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  coin: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  down: '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>',
  up: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
  wallet: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
};
const icon = (n, s = 18) =>
  `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- Notifications, modales ---------- */
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, 4200);
}

function modal(title, html, opts = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Fermer" type="button">${icon('x')}</button></div><div class="modal-body">${html}</div></div>`;
  $('#modal-root').appendChild(back);
  document.body.classList.add('no-scroll');
  const api = {
    el: back,
    body: $('.modal-body', back),
    close() {
      back.remove();
      if (!$('#modal-root').children.length) document.body.classList.remove('no-scroll');
      if (opts.onClose) opts.onClose();
    },
  };
  back.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) api.close();
  });
  const first = $('input:not([type=radio]):not([type=hidden]),select,textarea', back);
  if (first && window.matchMedia('(min-width:700px)').matches) first.focus();
  return api;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const m = $('#modal-root').lastElementChild;
    if (m) $('[data-close]', m)?.click();
  }
});

function confirmBox(message, { ok = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = modal(
      'Confirmation',
      `<p>${esc(message)}</p><div class="form-actions"><button class="btn ghost" data-close type="button">Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok" type="button">${esc(ok)}</button></div>`,
      { onClose: () => resolve(false) }
    );
    $('#cf-ok', m.el).addEventListener('click', () => {
      resolve(true);
      m.close();
    });
  });
}

/* ---------- Erreurs & état occupé ---------- */
function errMsg(e) {
  const m = (e && e.message) || String(e);
  if (/row-level security|permission denied/i.test(m)) return 'Action non autorisée pour votre rôle.';
  if (/duplicate key/i.test(m)) return 'Cette valeur existe déjà.';
  if (/violates foreign key/i.test(m)) return 'Opération impossible : élément utilisé ailleurs.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Connexion impossible. Vérifiez votre réseau.';
  if (/JWT|expired/i.test(m)) return 'Session expirée. Reconnectez-vous.';
  return m;
}

async function busy(btn, fn) {
  if (!btn) return fn();
  if (btn.disabled) return;
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

function onSubmit(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    await busy(btn, async () => {
      try {
        await handler(Object.fromEntries(new FormData(form)), form);
      } catch (err) {
        console.error(err);
        toast(errMsg(err), 'error');
      }
    });
  });
}

async function safe(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    toast(errMsg(e), 'error');
  }
}

/* ---------- Tableau responsive ---------- */
function dataTable(cols, rows, { empty = 'Aucun résultat' } = {}) {
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
  const head = cols.map((c) => `<th class="${c.c || ''}">${esc(c.h)}</th>`).join('');
  const body = rows
    .map((r) => `<tr${r && r.id ? ` data-id="${esc(r.id)}"` : ''}>${cols.map((c) => `<td data-label="${esc(c.h)}" class="${c.c || ''}">${c.r(r)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-wrap"><table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ---------- Photos produits ---------- */
const photoThumb = (p, cls = 'thumb') =>
  p && p.photo_url
    ? `<img class="${cls}" src="${esc(p.photo_url)}" alt="" loading="lazy">`
    : `<span class="${cls} ph">${esc(((p && p.nom) || '?')[0].toUpperCase())}</span>`;

async function resizeImage(file, max = 800) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Image illisible.'))), 'image/jpeg', 0.82));
}

const Photos = {
  async upload(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Format accepté : JPG, PNG ou WebP.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Image trop lourde (15 Mo maximum).');
    const blob = await resizeImage(file);
    const path = `${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from('produits').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
    return sb.storage.from('produits').getPublicUrl(path).data.publicUrl;
  },
  async remove(url) {
    const i = (url || '').indexOf('/produits/');
    if (i < 0) return;
    const path = decodeURIComponent(url.slice(i + 10).split('?')[0]);
    try {
      await sb.storage.from('produits').remove([path]);
    } catch (e) {
      console.warn(e);
    }
  },
};
